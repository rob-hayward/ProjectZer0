// src/lib/services/graph/UniversalGraphManager.ts - CLEANED VERSION
// Central orchestrator with enhanced opacity controller integration

import * as d3 from 'd3';
import { writable, derived, type Readable } from 'svelte/store';
import type { 
    GraphData, 
    NodeMode, 
    NodeType,
    GraphNode,
    GraphLink,
    EnhancedNode,
    EnhancedLink, 
    RenderableNode, 
    RenderableLink, 
    LayoutUpdateConfig
} from '$lib/types/graph/enhanced';
import { COORDINATE_SPACE, NODE_CONSTANTS } from '$lib/constants/graph';
import { COLORS } from '$lib/constants/colors';
import { coordinateSystem } from './CoordinateSystem';
import { getNeo4jNumber } from '$lib/utils/neo4j-utils';
import { visibilityStore } from '$lib/stores/visibilityPreferenceStore';

// Import modular components
import { UNIVERSAL_LAYOUT } from './universal/UniversalConstants';
import { UNIVERSAL_FORCES } from './universal/UniversalForceConfig';
import { UniversalPositioning } from './universal/UniversalPositioning';
import { UniversalD3Simulation } from './universal/UniversalD3Simulation';
import { UniversalRenderingStrategy } from './universal/UniversalRenderingStrategy';
import { UniversalOpacityController } from './universal/UniversalOpacityController';
import type { RevealPattern } from './universal/UniversalOpacityController';

export class UniversalGraphManager {
    private positioning: UniversalPositioning;
    private d3Simulation: UniversalD3Simulation;
    private renderingStrategy: UniversalRenderingStrategy;
    private opacityController: UniversalOpacityController;
    
    private nodesStore = writable<EnhancedNode[]>([]);
    private linksStore = writable<EnhancedLink[]>([]);
    private linkOpacityStore = writable<Map<string, number>>(new Map());
    
    private managerId: string;
    private simulationActive = false;
    
    // Performance tracking
    private nodeRadiusCache = new Map<string, number>();
    private linkPathCache = new Map<string, { path: string; metadata: any }>();
    private performanceMetrics = {
        originalRelationshipCount: 0,
        consolidatedRelationshipCount: 0,
        consolidationRatio: 1.0,
        lastUpdateTime: 0,
        renderTime: 0,
        renderedNodeCount: 0,
        totalNodeCount: 0,
        layoutType: 'vote_based_with_natural_forces' as const,
        currentBatch: 0
    };

    // Position preservation for gentle updates
    private finalPositionCache = new Map<string, {x: number, y: number, settled: boolean}>();
    private settlementCheckInterval: number | null = null;

    public readonly renderableNodes: Readable<RenderableNode[]>;
    public readonly renderableLinks: Readable<RenderableLink[]>;
    public readonly linkOpacities: Readable<Map<string, number>>;
    
    private forceUpdateCounter = writable(0);
    private nodeModes = new Map<string, NodeMode>();
    private defaultNodeMode: NodeMode = 'preview';

    constructor() {
        this.managerId = `universal-enhanced-${Math.random().toString(36).substring(2, 9)}`;
        
        visibilityStore.initialize();

        this.positioning = new UniversalPositioning();
        
        this.opacityController = new UniversalOpacityController({
            onNodeOpacityUpdate: (nodes) => this.handleNodeOpacityUpdate(nodes),
            onLinkOpacityUpdate: (linkOpacities) => this.handleLinkOpacityUpdate(linkOpacities),
            onRevealComplete: () => this.handleRevealComplete(),
            onLinkRenderingEnabled: () => this.handleLinkRenderingEnabled()
        });
        
        if (typeof window !== 'undefined') {
            (window as any).universalOpacityController = this.opacityController;
        }

        this.opacityController.configureLinkReveal(4000, 'staggered', 3000, 500);
        
        this.d3Simulation = new UniversalD3Simulation({
            onTick: (nodes) => this.handleSimulationTick(nodes),
            onEnd: () => this.handleSimulationEnd(),
            onSettlementTick: (nodes, tickCount) => this.handleSettlementTick(nodes, tickCount)
        });
        
        this.renderingStrategy = new UniversalRenderingStrategy({
            onNodesReady: (nodes, links) => this.handleNodesReady(nodes, links),
            onRenderComplete: () => this.handleRenderComplete(),
            onBatchUpdate: (batch, total) => this.handleBatchUpdate(batch, total)
        });
        
        this.renderableNodes = derived(
            [this.nodesStore, this.forceUpdateCounter], 
            ([nodes, updateCount]) => this.createRenderableNodes(nodes)
        );
        
        this.renderableLinks = derived(
            [this.nodesStore, this.linksStore, this.linkOpacityStore, this.forceUpdateCounter], 
            ([nodes, links, linkOpacities, updateCount]) => this.createRenderableLinks(nodes, links, linkOpacities)
        );
        
        this.linkOpacities = derived(
            [this.linkOpacityStore, this.forceUpdateCounter],
            ([opacities, updateCount]) => opacities
        );
    }

    public getShouldRenderLinks(): boolean {
        return this.opacityController.getShouldRenderLinks();
    }

    public enableBatchRendering(
        enable: boolean = true, 
        maxBatches: number = UNIVERSAL_LAYOUT.LIMITS.MAX_BATCHES, 
        sequential: boolean = true,
        singleNodeMode?: boolean
    ): void {
        const enableSingleNode = singleNodeMode !== undefined ? 
            singleNodeMode : UNIVERSAL_LAYOUT.LIMITS.MAX_NODES_TO_RENDER > 0;
            
        this.renderingStrategy.configure({
            enableBatchRendering: enable,
            enableSingleNodeMode: enableSingleNode,
            maxBatchesToRender: maxBatches,
            sequential
        });
    }

    public syncDataGently(newData: Partial<GraphData>): void {
        if (!newData) return;
        
        const isSettled = this.d3Simulation?.isDormantState?.() === true;
        const hasSettledPositions = this.finalPositionCache.size > 0;
        
        if (isSettled || hasSettledPositions) {
            if (newData.nodes) {
                const currentNodes = this.d3Simulation.getSimulation().nodes() as unknown as EnhancedNode[];
                const updatedNodes = this.mergeNodeDataOnly(currentNodes, newData.nodes);
                
                this.nodesStore.set(updatedNodes);
                this.d3Simulation.updateNodes(updatedNodes);
                this.performanceMetrics.renderedNodeCount = updatedNodes.length;
            }
            
            if (newData.links) {
                const transformedLinks = this.transformLinks(newData.links);
                this.linksStore.set(transformedLinks);
                this.d3Simulation.updateLinks(transformedLinks);
                this.updatePerformanceMetrics(transformedLinks);
                
                const renderableLinks = this.createRenderableLinks(
                    this.d3Simulation.getSimulation().nodes() as unknown as EnhancedNode[],
                    transformedLinks,
                    new Map()
                );
                this.opacityController.registerLinks(renderableLinks);
            }
            
            this.applyStoredVisibilityPreferences();
            this.forceUpdateCounter.update(n => n + 1);
            return;
        }
        
        this.updateState(newData, 0.2);
    }

    public async setData(data: GraphData, config?: LayoutUpdateConfig & { forceRestart?: boolean }): Promise<void> {
        const startTime = performance.now();
        
        this.opacityController.reset();
        
        const currentNodes = this.d3Simulation?.getSimulation()?.nodes() as EnhancedNode[] || [];
        const currentNodeIds = new Set(currentNodes.map(n => n.id));
        const newNodeIds = new Set(data.nodes.map(n => n.id));
        const isSameDataSet = currentNodeIds.size === newNodeIds.size && 
            [...currentNodeIds].every(id => newNodeIds.has(id));
        
        const isSimulationSettled = this.d3Simulation?.isDormantState?.() === true;
        const hasStablePositions = this.finalPositionCache.size > 0;
        const forceRestart = config?.forceRestart === true;
        
        const shouldUseGentleSync = isSameDataSet && isSimulationSettled && !forceRestart;
        
        if (shouldUseGentleSync) {
            this.syncDataGently(data);
            this.performanceMetrics.renderTime = performance.now() - startTime;
            return;
        }
        
        this.finalPositionCache.clear();
        
        if (forceRestart || !isSameDataSet) {
            this.stop();
        } else if (currentNodes.length > 0) {
            this.d3Simulation.wakeSimulation(0.1);
            this.simulationActive = true;
        }
        
        this.performanceMetrics.totalNodeCount = data.nodes.length;
        
        this.renderingStrategy.startRendering(
            data,
            (nodes) => this.transformNodes(nodes),
            (links) => this.transformLinks(links)
        );
        
        await this.applyStoredVisibilityPreferences();
        
        this.performanceMetrics.renderTime = performance.now() - startTime;
    }

    private async applyStoredVisibilityPreferences(): Promise<void> {
        try {
            const preferences = visibilityStore.getAllPreferences();
            
            if (Object.keys(preferences).length > 0) {
                this.applyVisibilityPreferences(preferences);
            }
        } catch (error) {
            console.error('[UniversalGraphManager] Error applying stored visibility preferences:', error);
        }
    }

    public updateState(newData?: Partial<GraphData>, wakePower: number = 0.2): void {
        if (newData) {
            if (newData.nodes) {
                const transformedNodes = this.transformNodes(newData.nodes);
                this.nodesStore.set(transformedNodes);
                this.d3Simulation.updateNodes(transformedNodes);
                this.performanceMetrics.renderedNodeCount = transformedNodes.length;
            }
            if (newData.links) {
                const transformedLinks = this.transformLinks(newData.links);
                this.linksStore.set(transformedLinks);
                this.d3Simulation.updateLinks(transformedLinks);
                this.updatePerformanceMetrics(transformedLinks);
                
                const currentNodes = this.d3Simulation.getSimulation().nodes() as unknown as EnhancedNode[];
                const renderableLinks = this.createRenderableLinks(currentNodes, transformedLinks, new Map());
                this.opacityController.registerLinks(renderableLinks);
            }
        }
        
        if (this.d3Simulation) {
            this.d3Simulation.wakeSimulation(wakePower);
            this.simulationActive = true;
        }
        
        this.forceUpdateCounter.update(n => n + 1);
    }

    private startSizeChangeSettlementMonitoring(): void {
        // Clear any existing settlement monitoring
        if (this.settlementCheckInterval) {
            clearInterval(this.settlementCheckInterval);
        }
        
        let checkCount = 0;
        const maxChecks = 30; // Maximum 30 seconds of monitoring
        
        this.settlementCheckInterval = window.setInterval(() => {
            checkCount++;
            
            if (!this.simulationActive) return;
            
            const simulation = this.d3Simulation.getSimulation();
            const currentAlpha = simulation.alpha();
            const nodes = simulation.nodes() as EnhancedNode[];
            
            // Calculate average velocity for content nodes
            const contentNodes = nodes.filter(n => 
                (n.type === 'statement' || n.type === 'openquestion') && !n.fixed
            );
            
            if (contentNodes.length === 0) {
                this.clearSizeChangeSettlementMonitoring();
                return;
            }
            
            const totalVelocity = contentNodes.reduce((sum, node) => {
                const vx = node.vx || 0;
                const vy = node.vy || 0;
                return sum + Math.sqrt(vx * vx + vy * vy);
            }, 0);
            
            const avgVelocity = totalVelocity / contentNodes.length;
            const isSettled = avgVelocity < 0.5 && currentAlpha < 0.05;
            
            // Check for overlapping nodes (collision detection)
            const hasOverlaps = this.checkForNodeOverlaps(contentNodes);
            
            if (isSettled && !hasOverlaps) {
                // Nodes have settled without overlaps - return to dormant state
                this.clearSizeChangeSettlementMonitoring();
                this.handleSizeChangeSettlementComplete();
            } else if (checkCount >= maxChecks) {
                // Force settlement after max time to prevent infinite monitoring
                this.clearSizeChangeSettlementMonitoring();
                this.handleSizeChangeSettlementComplete();
            }
        }, 500); // Check every 500ms for size change settlement
    }

    private clearSizeChangeSettlementMonitoring(): void {
        if (this.settlementCheckInterval) {
            clearInterval(this.settlementCheckInterval);
            this.settlementCheckInterval = null;
        }
    }

    private startSettlementMonitoring(): void {
        if (this.settlementCheckInterval) {
            clearInterval(this.settlementCheckInterval);
        }
        
        this.settlementCheckInterval = window.setInterval(() => {
            if (!this.simulationActive) return;
            
            const isSettled = this.d3Simulation.isDormantState();
            const wasSettling = this.d3Simulation.isSettling();
            
            if (isSettled && !wasSettling) {
                this.handleSettlementComplete();
            }
        }, 1000);
    }

    private handleSizeChangeSettlementComplete(): void {
        // Preserve final positions
        const nodes = this.d3Simulation.getSimulation().nodes() as unknown as EnhancedNode[];
        this.preserveFinalPositions(nodes);
        
        // Return simulation to dormant state
        setTimeout(() => {
            if (this.d3Simulation) {
                this.d3Simulation.sleepSimulation();
                this.simulationActive = false;
            }
        }, 200);
    }

    private checkForNodeOverlaps(nodes: EnhancedNode[]): boolean {
        // Check if any nodes are overlapping based on their radii
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const nodeA = nodes[i];
                const nodeB = nodes[j];
                
                const dx = (nodeA.x || 0) - (nodeB.x || 0);
                const dy = (nodeA.y || 0) - (nodeB.y || 0);
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                const minDistance = nodeA.radius + nodeB.radius + 20; // 20px buffer
                
                if (distance < minDistance) {
                    return true; // Overlap detected
                }
            }
        }
        return false;
    }

    private handleSettlementComplete(): void {
        if (this.settlementCheckInterval) {
            clearInterval(this.settlementCheckInterval);
            this.settlementCheckInterval = null;
        }
        
        this.simulationActive = false;
        
        const nodes = this.d3Simulation.getSimulation().nodes() as unknown as EnhancedNode[];
        this.preserveFinalPositions(nodes);
        
        this.opacityController.onSettlementComplete();
    }

    private preserveFinalPositions(nodes: EnhancedNode[]): void {
        nodes.forEach(node => {
            if (node.x !== undefined && node.x !== null && node.y !== undefined && node.y !== null) {
                this.finalPositionCache.set(node.id, {
                    x: node.x,
                    y: node.y,
                    settled: true
                });
            }
        });
    }

    private handleNodesReady(nodes: EnhancedNode[], links: EnhancedLink[]): void {
        this.nodesStore.set(nodes);
        this.linksStore.set(links);
        
        const renderableLinks = this.createRenderableLinks(nodes, links, new Map());
        this.opacityController.registerLinks(renderableLinks);
        
        this.performanceMetrics.renderedNodeCount = nodes.length;
        this.updatePerformanceMetrics(links);
        
        this.d3Simulation.configureDropPhaseForces(nodes, links);
        this.d3Simulation.start(UNIVERSAL_FORCES.SIMULATION.DROP_PHASE.ALPHA);
        this.simulationActive = true;
    }

    private handleRenderComplete(): void {
        if (!this.simulationActive) {
            return;
        }
        
        setTimeout(() => {
            if (this.simulationActive && !this.d3Simulation.isSettling()) {
                this.d3Simulation.startSettlementPhase();
                
                const nodes = this.d3Simulation.getSimulation().nodes() as unknown as EnhancedNode[];
                const contentNodes = nodes.filter(n => n.type === 'statement' || n.type === 'openquestion');
                
                if (contentNodes.length > 0) {
                    this.opacityController.startRevealSequence(nodes);
                } else {
                    this.opacityController.forceRevealAll(nodes);
                }
                
                this.startSettlementMonitoring();
            }
        }, UNIVERSAL_LAYOUT.TIMING.SETTLEMENT_START_DELAY);
    }

    private handleBatchUpdate(batchNumber: number, totalBatches: number): void {
        this.performanceMetrics.currentBatch = batchNumber;
    }

    private handleSimulationTick(nodes: EnhancedNode[]): void {
        if (this.simulationActive) {
            this.nodesStore.set([...nodes]);
        }
    }

    private handleSettlementTick(nodes: EnhancedNode[], tickCount: number): void {
        if (tickCount % 3 === 0) {
            this.forceUpdateCounter.update(n => n + 1);
        }
    }

    private handleSimulationEnd(): void {
        if (this.d3Simulation?.isDormantState?.()) {
            return;
        }
        
        const nodes = this.d3Simulation.getSimulation().nodes() as unknown as EnhancedNode[];
        this.preserveFinalPositions(nodes);
        this.forceUpdateCounter.update(n => n + 1);
    }

    private handleNodeOpacityUpdate(nodes: EnhancedNode[]): void {
        this.nodesStore.set([...nodes]);
        this.forceUpdateCounter.update(n => n + 1);
    }

    private handleLinkOpacityUpdate(linkOpacities: Map<string, number>): void {
        this.linkOpacityStore.set(new Map(linkOpacities));
        this.forceUpdateCounter.update(n => n + 1);
    }

    public configureLinkReveal(
        duration: number = 4000,
        pattern: 'staggered' | 'wave' | 'radial' | 'strength-based' = 'staggered',
        staggerDuration: number = 3000,
        delay: number = 500
    ): void {
        this.opacityController.configureLinkReveal(duration, pattern, staggerDuration, delay);
    }

    private handleRevealComplete(): void {
        setTimeout(() => {
            if (this.d3Simulation) {
                this.d3Simulation.sleepSimulation();
                this.simulationActive = false;
            }
        }, 200);
    }

    private handleLinkRenderingEnabled(): void {
        this.forceUpdateCounter.update(n => n + 1);
        
        setTimeout(() => {
            this.forceUpdateCounter.update(n => n + 1);
        }, 50);
        
        setTimeout(() => {
            this.forceUpdateCounter.update(n => n + 1);
        }, 100);
    }

    private getCurrentLinks(): EnhancedLink[] {
        let currentLinks: EnhancedLink[] = [];
        const unsubscribe = this.linksStore.subscribe(links => {
            currentLinks = links;
        });
        unsubscribe();
        return currentLinks;
    }

    public updateNodeMode(nodeId: string, mode: NodeMode): void {
        const previousMode = this.nodeModes.get(nodeId);
        this.nodeModes.set(nodeId, mode);
        
        const nodes = this.d3Simulation.getSimulation().nodes() as unknown as EnhancedNode[];
        const nodeIndex = nodes.findIndex(n => n.id === nodeId);
        
        if (nodeIndex === -1) {
            return;
        }
        
        const node = nodes[nodeIndex];
        if (node.mode === mode) {
            return;
        }
        
        const oldRadius = node.radius;
        const newRadius = this.getNodeRadius({ ...node, mode });
        
        const updatedNode: EnhancedNode = {
            ...node,
            mode,
            expanded: mode === 'detail',
            radius: newRadius,
            metadata: { 
                ...node.metadata, 
                isDetail: mode === 'detail' 
            }
        };
        
        nodes[nodeIndex] = updatedNode;
        
        this.updateCollisionForce();
        this.storeCurrentPositions(nodes);
        this.reheatSimulation(0.3);
        
        this.d3Simulation.updateNodes(nodes);
        this.nodesStore.set(nodes);
        this.forceUpdateCounter.update(n => n + 1);
        
        this.dispatchModeChangeEvent(nodeId, mode, { x: updatedNode.x ?? 0, y: updatedNode.y ?? 0 });
    }

    public getNodeMode(nodeId: string): NodeMode {
        return this.nodeModes.get(nodeId) ?? this.defaultNodeMode;
    }

    public getAllNodeModes(): Map<string, NodeMode> {
        return new Map(this.nodeModes);
    }

    public setDefaultNodeMode(mode: NodeMode): void {
        this.defaultNodeMode = mode;
    }

    public resetAllNodesToPreview(): void {
        const nodes = this.d3Simulation.getSimulation().nodes() as unknown as EnhancedNode[];
        let changedCount = 0;
        
        nodes.forEach(node => {
            if (node.mode === 'detail' && (node.type === 'statement' || node.type === 'openquestion')) {
                this.nodeModes.set(node.id, 'preview');
                node.mode = 'preview';
                node.expanded = false;
                node.radius = this.getNodeRadius(node);
                node.metadata.isDetail = false;
                changedCount++;
            }
        });
        
        if (changedCount > 0) {
            this.updateCollisionForce();
            this.reheatSimulation(0.2);
            this.d3Simulation.updateNodes(nodes);
            this.nodesStore.set(nodes);
            this.forceUpdateCounter.update(n => n + 1);
        }
    }

    private dispatchModeChangeEvent(nodeId: string, mode: NodeMode, position: { x: number; y: number }): void {
        if (typeof window !== 'undefined') {
            const event = new CustomEvent('node-mode-change', {
                detail: { nodeId, mode, position }
            });
            window.dispatchEvent(event);
        }
    }

    private updateCollisionForce(): void {
        const simulation = this.d3Simulation.getSimulation();
        
        // Remove existing collision force
        simulation.force('collision', null);
        
        // Create enhanced collision force for size changes
        const collisionForce = d3.forceCollide()
            .radius((d: any) => {
                const node = d as EnhancedNode;
                const basePadding = this.d3Simulation.isSettling() 
                    ? UNIVERSAL_LAYOUT.NODE_SIZING.COLLISION_PADDING.SETTLEMENT_PHASE
                    : UNIVERSAL_LAYOUT.NODE_SIZING.COLLISION_PADDING.DROP_PHASE;
                
                // Add extra padding for recently changed nodes to prevent tight clustering
                const extraPadding = 15; // Additional padding for size changes
                return node.radius + basePadding + extraPadding;
            })
            .strength(0.9) // Stronger collision avoidance for size changes
            .iterations(3); // More iterations for better separation
        
        simulation.force('collision', collisionForce);
        
        // Also ensure the charge (repulsion) force is active to help with separation
        this.ensureRepulsionForce();
    }

    private ensureRepulsionForce(): void {
        const simulation = this.d3Simulation.getSimulation();
        
        // Check if charge force exists, if not add a moderate one
        if (!simulation.force('charge')) {
            simulation.force('charge', d3.forceManyBody()
                .strength(-200) // Moderate repulsion
                .distanceMin(50)
                .distanceMax(800)
            );
        }
    }

    private storeCurrentPositions(nodes: EnhancedNode[]): void {
        nodes.forEach(node => {
            if (node.x !== null && node.y !== null) {
                node.fx = node.x;
                node.fy = node.y;
            }
        });
    }

    private reheatSimulation(alpha: number = 0.3): void {
        const simulation = this.d3Simulation.getSimulation();
        
        // Check if simulation is in dormant state and wake it properly
        const isDormant = this.d3Simulation.isDormantState();
        if (isDormant) {
            // Use stronger wake-up energy for node size changes
            this.d3Simulation.wakeSimulation(Math.max(alpha, 0.4));
        } else {
            // Standard alpha increase for active simulation
            simulation.alpha(alpha);
            simulation.alphaTarget(0);
        }
        
        // Release fixed positions after a short delay to allow collision forces to engage
        setTimeout(() => {
            const nodes = simulation.nodes() as EnhancedNode[];
            nodes.forEach(node => {
                // Only release non-permanently fixed nodes
                if (!node.fixed && node.fx !== null) {
                    node.fx = null;
                    node.fy = null;
                }
            });
        }, 150); // Slightly longer delay for better collision force engagement
        
        // Ensure simulation is active and running
        if (!this.simulationActive) {
            simulation.restart();
            this.simulationActive = true;
        }
        
        // Start monitoring for settlement after size changes
        this.startSizeChangeSettlementMonitoring();
    }

    public updateNodeVisibility(nodeId: string, isHidden: boolean, hiddenReason: 'community' | 'user' = 'user'): void {
        const nodes = this.d3Simulation.getSimulation().nodes() as unknown as EnhancedNode[];
        const nodeIndex = nodes.findIndex(n => n.id === nodeId);
        
        if (nodeIndex === -1) return;
        
        const oldNode = nodes[nodeIndex];
        if (oldNode.isHidden === isHidden) return;
        
        this.clearNodeRadiusCache(nodeId);
        
        let updatedMode = oldNode.mode;
        if (oldNode.isHidden && !isHidden) {
            updatedMode = 'preview';
        }
        
        const newRadius = this.getNodeRadius({ ...oldNode, mode: updatedMode, isHidden });
        const updatedNode: EnhancedNode = {
            ...oldNode,
            isHidden,
            hiddenReason,
            mode: updatedMode,
            radius: newRadius,
            expanded: updatedMode === 'detail'
        };
        
        nodes[nodeIndex] = updatedNode;

        if (hiddenReason === 'user') {
            visibilityStore.setPreference(nodeId, !isHidden);
        }
        
        this.d3Simulation.updateNodes(nodes);
        this.nodesStore.set(nodes);
        this.forceUpdateCounter.update(n => n + 1);
        
        this.d3Simulation.start(0.2);
        this.simulationActive = true;
    }

    public applyVisibilityPreferences(preferences: Record<string, boolean>): void {
        if (Object.keys(preferences).length === 0) return;
        
        const nodes = this.d3Simulation.getSimulation().nodes() as unknown as EnhancedNode[];
        if (!nodes || nodes.length === 0) return;
        
        let changedNodeCount = 0;
        const updatedNodes = [...nodes];
        
        Object.entries(preferences).forEach(([nodeId, isVisible]) => {
            const nodeIndex = updatedNodes.findIndex(n => n.id === nodeId);
            if (nodeIndex >= 0) {
                const node = updatedNodes[nodeIndex];
                const newHiddenState = !isVisible;
                
                if (node.isHidden !== newHiddenState) {
                    updatedNodes[nodeIndex] = {
                        ...node,
                        isHidden: newHiddenState,
                        hiddenReason: 'user',
                        radius: this.getNodeRadius({ ...node, isHidden: newHiddenState })
                    };
                    changedNodeCount++;
                }
            }
        });
        
        if (changedNodeCount > 0) {
            this.d3Simulation.updateNodes(updatedNodes);
            this.nodesStore.set(updatedNodes);
            this.forceUpdateCounter.update(n => n + 1);
            this.d3Simulation.start(0.1);
            this.simulationActive = true;
        }
    }

    public forceTick(ticks: number = 1): void {
        this.d3Simulation.forceTick(ticks);
        
        const nodes = this.d3Simulation.getSimulation().nodes() as unknown as EnhancedNode[];
        this.nodesStore.set([...nodes]);
        this.forceUpdateCounter.update(n => n + 1);
    }

    public getPerformanceMetrics() {
        return { ...this.performanceMetrics };
    }

    public configureRevealPattern(pattern: RevealPattern): void {
        this.opacityController.configureRevealPattern(pattern);
    }

    public configureRevealTiming(duration: number): void {
        this.opacityController.configureRevealTiming(duration);
    }

    public forceRevealAll(): void {
        const nodes = this.d3Simulation.getSimulation().nodes() as unknown as EnhancedNode[];
        this.opacityController.forceRevealAll(nodes);
    }

    public getRevealStatus(): {
        nodeState: string;
        nodeProgress: number;
        pattern: string;
        duration: number;
        linkRenderingEnabled: boolean;
        linkCount: number;
    } {
        const status = this.opacityController.getRevealStatus();
        return {
            nodeState: status.nodeState,
            nodeProgress: status.nodeProgress,
            pattern: status.pattern,
            duration: status.duration,
            linkRenderingEnabled: status.linkRenderingEnabled,
            linkCount: status.linkCount
        };
    }

    public getBatchDebugInfo(): any {
        const renderingStats = this.renderingStrategy.getRenderingStats();
        const revealStatus = this.getRevealStatus();
        
        return {
            layoutType: 'vote_based_with_natural_forces',
            phase: 'ENHANCED_PHANTOM_LINKS_ARCHITECTURE',
            renderingStats,
            settlementPhase: this.d3Simulation.isSettling(),
            settlementTicks: this.d3Simulation.getSettlementTickCount(),
            performanceMetrics: this.getPerformanceMetrics(),
            settledPositionCount: this.finalPositionCache.size,
            revealStatus,
            phantomLinks: {
                enabled: this.getShouldRenderLinks(),
                description: 'ENHANCED ARCHITECTURE - Single authority with CSS integration'
            },
            message: 'ENHANCED phantom links with clean separation of concerns'
        };
    }

    private mergeNodeDataOnly(currentNodes: EnhancedNode[], newNodeData: GraphNode[]): EnhancedNode[] {
        const newDataMap = new Map(newNodeData.map(n => [n.id, n]));
        
        return currentNodes.map(currentNode => {
            const newData = newDataMap.get(currentNode.id);
            if (!newData) return currentNode;
            
            const settledPosition = this.finalPositionCache.get(currentNode.id);
            const transformedData = this.transformSingleNode(newData);
            
            const mergedNode: EnhancedNode = {
                ...currentNode,
                data: { ...currentNode.data, ...transformedData.data },
                metadata: { ...currentNode.metadata, ...transformedData.metadata },
                mode: transformedData.mode || currentNode.mode,
                radius: transformedData.radius || currentNode.radius,
                isHidden: transformedData.isHidden !== undefined ? transformedData.isHidden : currentNode.isHidden,
                hiddenReason: transformedData.hiddenReason || currentNode.hiddenReason,
                
                x: settledPosition?.x ?? currentNode.x,
                y: settledPosition?.y ?? currentNode.y,
                vx: 0,
                vy: 0,
                fx: settledPosition ? settledPosition.x : currentNode.fx,
                fy: settledPosition ? settledPosition.y : currentNode.fy
            };
            
            return mergedNode;
        });
    }

    private transformSingleNode(node: GraphNode): EnhancedNode {
        const netVotes = this.positioning.getNodeVotes(node);
        const isHidden = (node.type === 'statement' || node.type === 'openquestion') && netVotes < 0;
        
        let nodeMode: NodeMode | undefined = node.mode;
        if (node.group === 'central' && !node.mode) {
            nodeMode = 'detail';
        }
        
        const nodeRadius = this.getNodeRadius({
            ...node,
            mode: nodeMode,
            isHidden: isHidden
        });
        
        let nodeData: any = {
            ...(node.data || {}),
            id: node.id
        };
        
        if (node.type === 'statement') {
            const votes = node.metadata?.votes as any;
            nodeData = {
                ...nodeData,
                statement: node.data && 'content' in node.data ? node.data.content : 
                           node.data && 'statement' in node.data ? (node.data as any).statement : '',
                positiveVotes: votes?.positive || 0,
                negativeVotes: votes?.negative || 0,
                netVotes: votes?.net || 0,
                votes: votes
            };
        } else if (node.type === 'openquestion') {
            const answerCount = node.metadata?.answer_count || 0;
            nodeData = {
                ...nodeData,
                questionText: node.data && 'content' in node.data ? node.data.content : 
                            node.data && 'questionText' in node.data ? (node.data as any).questionText : '',
                answerCount: answerCount
            };
        }
        
        const enhancedNode: EnhancedNode = {
            id: node.id,
            type: node.type,
            data: nodeData,
            group: node.group,
            mode: nodeMode,
            radius: nodeRadius,
            fixed: node.group === 'central',
            expanded: nodeMode === 'detail',
            isHidden,
            hiddenReason: isHidden ? 'community' : undefined,
            
            x: null,
            y: null,
            vx: null,
            vy: null,
            fx: null,
            fy: null,
            metadata: {
                group: this.getLayoutGroup(node),
                fixed: node.group === 'central',
                isDetail: nodeMode === 'detail',
                votes: netVotes,
                consensus_ratio: node.metadata?.consensus_ratio,
                participant_count: node.metadata?.participant_count,
                net_votes: node.metadata?.net_votes,
                answer_count: node.metadata?.answer_count,
                related_statements_count: node.metadata?.related_statements_count,
                userVoteStatus: node.metadata?.userVoteStatus,
                userVisibilityPreference: node.metadata?.userVisibilityPreference,
                ...(node.metadata || {})
            }
        };
        
        return enhancedNode;
    }

    private transformNodes(nodes: GraphNode[]): EnhancedNode[] {
        return nodes.map(node => {
            const netVotes = this.positioning.getNodeVotes(node);
            
            const visibilityPref = visibilityStore.getPreference(node.id);
            const isHidden = visibilityPref !== undefined ? !visibilityPref : 
                            ((node.type === 'statement' || node.type === 'openquestion') && netVotes < 0);
            const hiddenReason = visibilityPref !== undefined ? 'user' : 
                                (isHidden ? 'community' : undefined);
            
            let nodeMode: NodeMode = this.nodeModes.get(node.id) ?? node.mode ?? this.defaultNodeMode;
            
            if (node.group === 'central' && !this.nodeModes.has(node.id)) {
                nodeMode = 'detail';
                this.nodeModes.set(node.id, nodeMode);
            }
            
            if ((node.type === 'statement' || node.type === 'openquestion') && !this.nodeModes.has(node.id)) {
                nodeMode = 'preview';
                this.nodeModes.set(node.id, nodeMode);
            }
            
            const nodeRadius = this.getNodeRadius({
                ...node,
                mode: nodeMode,
                isHidden: isHidden
            });
            
            let nodeData: any = {
                ...(node.data || {}),
                id: node.id
            };
            
            if (node.type === 'statement') {
                const votes = node.metadata?.votes as any;
                nodeData = {
                    ...nodeData,
                    statement: node.data && 'content' in node.data ? node.data.content : 
                            node.data && 'statement' in node.data ? (node.data as any).statement : '',
                    positiveVotes: getNeo4jNumber(votes?.positive) || 0,
                    negativeVotes: getNeo4jNumber(votes?.negative) || 0,
                    netVotes: getNeo4jNumber(votes?.net) || (getNeo4jNumber(votes?.positive) - getNeo4jNumber(votes?.negative)) || 0,
                    votes: votes
                };
            } else if (node.type === 'openquestion') {
                const votes = node.metadata?.votes as any;
                const answerCount = getNeo4jNumber(node.metadata?.answer_count) || 0;
                nodeData = {
                    ...nodeData,
                    questionText: node.data && 'content' in node.data ? node.data.content : 
                                node.data && 'questionText' in node.data ? (node.data as any).questionText : '',
                    answerCount: answerCount,
                    positiveVotes: getNeo4jNumber(votes?.positive) || 0,
                    negativeVotes: getNeo4jNumber(votes?.negative) || 0,
                    netVotes: getNeo4jNumber(votes?.net) || (getNeo4jNumber(votes?.positive) - getNeo4jNumber(votes?.negative)) || 0,
                    votes: votes
                };
            } else if (node.type === 'dashboard' && node.data && 'sub' in node.data && node.data.sub === 'universal-controls') {
                nodeData = {
                    ...nodeData,
                    sub: 'universal-controls',
                    name: 'Universal Graph Controls',
                    email: '',
                    picture: '',
                    'https://projectzer0.co/user_metadata': {
                        handle: 'universal-controls'
                    }
                };
            }
            
            const enhancedNode: EnhancedNode = {
                id: node.id,
                type: node.type,
                data: nodeData,
                group: node.group,
                mode: nodeMode,
                radius: nodeRadius,
                fixed: node.group === 'central',
                expanded: nodeMode === 'detail',
                isHidden,
                hiddenReason,
                
                x: null,
                y: null,
                vx: null,
                vy: null,
                fx: null,
                fy: null,
                
                metadata: {
                    group: this.getLayoutGroup(node),
                    fixed: node.group === 'central',
                    isDetail: nodeMode === 'detail',
                    votes: netVotes,
                    consensus_ratio: node.metadata?.consensus_ratio,
                    participant_count: getNeo4jNumber(node.metadata?.participant_count) || 0,
                    net_votes: getNeo4jNumber(node.metadata?.net_votes) || netVotes,
                    answer_count: getNeo4jNumber(node.metadata?.answer_count),
                    related_statements_count: node.metadata?.related_statements_count,
                    userVoteStatus: node.metadata?.userVoteStatus,
                    userVisibilityPreference: node.metadata?.userVisibilityPreference,
                    ...(node.metadata || {})
                }
            };
            
            this.opacityController.setInitialNodeOpacity(enhancedNode);
            
            if (enhancedNode.fixed || enhancedNode.group === 'central') {
                enhancedNode.fx = 0;
                enhancedNode.fy = 0;
                enhancedNode.x = 0;
                enhancedNode.y = 0;
            }
            
            return enhancedNode;
        });
    }

    private transformLinks(links: GraphLink[]): EnhancedLink[] {
        return links.map(link => {
            const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
            const targetId = typeof link.target === 'string' ? link.target : link.target.id;
            
            let strength = 0.3;
            let relationshipType: 'direct' | 'keyword' = 'keyword';
            
            if (link.type === 'shared_keyword') {
                relationshipType = 'keyword';
                if (link.metadata?.consolidatedKeywords) {
                    strength = Math.min(1.0, link.metadata.consolidatedKeywords.totalStrength);
                } else {
                    strength = 0.5;
                }
            } else if (link.type === 'answers') {
                strength = 0.8;
                relationshipType = 'direct';
            } else if (link.type === 'related_to') {
                strength = 0.6;
                relationshipType = 'direct';
            }
            
            const linkMetadata: any = {
                ...(link.metadata || {}),
                linkType: link.type,
                sourceId,
                targetId
            };
            
            if (link.type === 'shared_keyword' && link.metadata?.consolidatedKeywords) {
                linkMetadata.isConsolidated = true;
                linkMetadata.originalRelationshipCount = link.metadata.consolidatedKeywords.relationCount;
                linkMetadata.keyword = link.metadata.consolidatedKeywords.primaryKeyword;
                linkMetadata.sharedWords = link.metadata.consolidatedKeywords.sharedWords;
                linkMetadata.relationCount = link.metadata.consolidatedKeywords.relationCount;
            }
            
            const enhancedLink: EnhancedLink = {
                id: link.id || `${sourceId}-${targetId}`,
                source: sourceId,
                target: targetId,
                type: link.type,
                relationshipType,
                strength,
                metadata: linkMetadata
            };
            
            this.opacityController.setInitialLinkOpacity(enhancedLink);
            
            return enhancedLink;
        });
    }

    private createRenderableLinks(
        nodes: EnhancedNode[], 
        links: EnhancedLink[], 
        linkOpacities: Map<string, number>
    ): RenderableLink[] {
        if (nodes.length === 0 || links.length === 0) {
            return [];
        }
        
        const nodeMap = new Map<string, EnhancedNode>();
        nodes.forEach(node => nodeMap.set(node.id, node));
        
        const renderableLinks = links.map(link => {
            const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
            const targetId = typeof link.target === 'string' ? link.target : link.target.id;
            
            const source = nodeMap.get(sourceId);
            const target = nodeMap.get(targetId);
            
            if (!source || !target) {
                return null;
            }
            
            if (source.isHidden || target.isHidden) {
                return null;
            }
            
            const path = this.calculateLinkPath(source, target, link);
            if (!path) {
                return null;
            }
            
            const sourceTransform = coordinateSystem.createSVGTransform(source.x ?? 0, source.y ?? 0);
            const targetTransform = coordinateSystem.createSVGTransform(target.x ?? 0, target.y ?? 0);
            
            const enhancedMetadata: any = { ...link.metadata };
            
            if (link.type === 'shared_keyword') {
                if (link.metadata?.consolidatedKeywords) {
                    enhancedMetadata.sharedWords = link.metadata.consolidatedKeywords.sharedWords;
                    enhancedMetadata.relationCount = link.metadata.consolidatedKeywords.relationCount;
                    enhancedMetadata.keyword = link.metadata.consolidatedKeywords.primaryKeyword;
                    enhancedMetadata.isConsolidated = true;
                } else {
                    enhancedMetadata.sharedWords = [enhancedMetadata.keyword || ''];
                    enhancedMetadata.relationCount = 1;
                    enhancedMetadata.isConsolidated = false;
                }
            }
            
            const renderableLink: RenderableLink = {
                id: link.id,
                type: link.type,
                sourceId: source.id,
                targetId: target.id,
                sourceType: source.type,
                targetType: target.type,
                path,
                sourcePosition: { 
                    x: source.x ?? 0, 
                    y: source.y ?? 0,
                    svgTransform: sourceTransform
                },
                targetPosition: { 
                    x: target.x ?? 0, 
                    y: target.y ?? 0,
                    svgTransform: targetTransform
                },
                strength: link.strength,
                relationshipType: link.relationshipType,
                metadata: enhancedMetadata
            };
            
            const controllerOpacity = this.opacityController.calculateLinkOpacity(renderableLink);
            const finalOpacity = linkOpacities.get(link.id) ?? controllerOpacity;
            
            renderableLink.opacity = finalOpacity;
            if (renderableLink.metadata) {
                renderableLink.metadata.opacity = finalOpacity;
            }
            
            return renderableLink;
        }).filter(Boolean) as RenderableLink[];
        
        return renderableLinks;
    }

    private createRenderableNodes(nodes: EnhancedNode[]): RenderableNode[] {
        return nodes.map(node => {
            const radius = node.radius;
            const x = node.x ?? 0;
            const y = node.y ?? 0;
            const svgTransform = `translate(${x},${y})`;
            
            return {
                id: node.id,
                type: node.type,
                group: node.group,
                mode: node.mode,
                data: node.data,
                radius: radius,
                isHidden: node.isHidden,
                hiddenReason: node.hiddenReason,
                position: { x, y, svgTransform },
                metadata: node.metadata,
                opacity: this.opacityController.calculateNodeOpacity(node as any),
                style: {
                    previewSize: radius,
                    detailSize: radius,
                    colors: {
                        background: this.getNodeBackground(node),
                        border: this.getNodeBorder(node),
                        text: COLORS.UI.TEXT.PRIMARY,
                        hover: this.getNodeHover(node),
                        gradient: {
                            start: this.getNodeGradientStart(node),
                            end: this.getNodeGradientEnd(node)
                        }
                    },
                    padding: {
                        preview: COORDINATE_SPACE.NODES.PADDING.PREVIEW,
                        detail: COORDINATE_SPACE.NODES.PADDING.DETAIL
                    },
                    lineHeight: {
                        preview: NODE_CONSTANTS.LINE_HEIGHT.preview,
                        detail: NODE_CONSTANTS.LINE_HEIGHT.detail
                    },
                    stroke: {
                        preview: {
                            normal: NODE_CONSTANTS.STROKE.preview.normal,
                            hover: NODE_CONSTANTS.STROKE.preview.hover
                        },
                        detail: {
                            normal: NODE_CONSTANTS.STROKE.detail.normal,
                            hover: NODE_CONSTANTS.STROKE.detail.hover
                        }
                    },
                    highlightColor: this.getNodeColor(node)
                }
            };
        });
    }

    private updatePerformanceMetrics(links: EnhancedLink[]): void {
        let originalCount = 0;
        let consolidatedCount = 0;
        
        links.forEach(link => {
            consolidatedCount++;
            
            if (link.type === 'shared_keyword' && link.metadata?.consolidatedKeywords) {
                originalCount += link.metadata.consolidatedKeywords.relationCount;
            } else {
                originalCount++;
            }
        });
        
        this.performanceMetrics = {
            ...this.performanceMetrics,
            originalRelationshipCount: originalCount,
            consolidatedRelationshipCount: consolidatedCount,
            consolidationRatio: originalCount > 0 ? originalCount / consolidatedCount : 1.0,
            lastUpdateTime: Date.now()
        };
    }

    private calculateLinkPath(source: EnhancedNode, target: EnhancedNode, link?: EnhancedLink): string {
        const sourceX = source.x ?? 0;
        const sourceY = source.y ?? 0;
        const targetX = target.x ?? 0;
        const targetY = target.y ?? 0;
        
        if (!this.d3Simulation.isSettling()) {
            const linkInfo = link ? `${link.type}-${link.metadata?.isConsolidated ? 'consolidated' : 'single'}` : 'default';
            const cacheKey = `${source.id}-${target.id}-${linkInfo}-${sourceX.toFixed(1)}-${sourceY.toFixed(1)}-${targetX.toFixed(1)}-${targetY.toFixed(1)}`;
            
            if (this.linkPathCache.has(cacheKey)) {
                return this.linkPathCache.get(cacheKey)!.path;
            }
        }
        
        if (sourceX === targetX && sourceY === targetY) return '';
        
        const dx = targetX - sourceX;
        const dy = targetY - sourceY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const unitX = dx / distance;
        const unitY = dy / distance;
        
        const sourceRadius = source.radius * UNIVERSAL_LAYOUT.NODE_SIZING.RADIUS_SCALE;
        const targetRadius = target.radius * UNIVERSAL_LAYOUT.NODE_SIZING.RADIUS_SCALE;
        
        const startX = sourceX + (unitX * sourceRadius);
        const startY = sourceY + (unitY * sourceRadius);
        const endX = targetX - (unitX * targetRadius);
        const endY = targetY - (unitY * targetRadius);
        
        const path = `M${startX},${startY}L${endX},${endY}`;
        
        if (!this.d3Simulation.isSettling()) {
            const linkInfo = link ? `${link.type}-${link.metadata?.isConsolidated ? 'consolidated' : 'single'}` : 'default';
            const cacheKey = `${source.id}-${target.id}-${linkInfo}-${sourceX.toFixed(1)}-${sourceY.toFixed(1)}-${targetX.toFixed(1)}-${targetY.toFixed(1)}`;
            
            this.linkPathCache.set(cacheKey, {
                path,
                metadata: {
                    linkType: link?.type || 'unknown',
                    isConsolidated: link?.metadata?.isConsolidated || false
                }
            });
            
            if (this.linkPathCache.size > UNIVERSAL_LAYOUT.LIMITS.LINK_PATH_CACHE_SIZE) {
                const firstKey = this.linkPathCache.keys().next().value;
                if (firstKey) this.linkPathCache.delete(firstKey);
            }
        }
        
        return path;
    }

    private getNodeRadius(node: GraphNode | EnhancedNode): number {
        const cacheKey = `${node.id}-${node.type}-${node.mode || 'preview'}-${('isHidden' in node && node.isHidden) ? 'hidden' : 'visible'}`;
        
        if (this.nodeRadiusCache.has(cacheKey)) {
            return this.nodeRadiusCache.get(cacheKey)!;
        }
        
        if ('isHidden' in node && node.isHidden) {
            const radius = COORDINATE_SPACE.NODES.SIZES.HIDDEN / 2;
            this.nodeRadiusCache.set(cacheKey, radius);
            return radius;
        }
        
        let radius = 0;
        switch(node.type) {
            case 'statement':
                radius = node.mode === 'detail' ?
                    COORDINATE_SPACE.NODES.SIZES.STATEMENT.DETAIL / 2 :
                    COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW / 2;
                break;
            case 'openquestion':
                radius = node.mode === 'detail' ?
                    COORDINATE_SPACE.NODES.SIZES.OPENQUESTION.DETAIL / 2 :
                    COORDINATE_SPACE.NODES.SIZES.OPENQUESTION.PREVIEW / 2;
                break;
            case 'navigation':
                radius = COORDINATE_SPACE.NODES.SIZES.NAVIGATION / 2;
                break;
            case 'dashboard':
                if (node.data && 'sub' in node.data && node.data.sub === 'universal-controls') {
                    radius = node.mode === 'detail' ?
                        COORDINATE_SPACE.NODES.SIZES.CONTROL.DETAIL / 2 :
                        COORDINATE_SPACE.NODES.SIZES.CONTROL.PREVIEW / 2;
                } else {
                    radius = COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL / 2;
                }
                break;
            default:
                radius = COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL / 2;
        }
        
        this.nodeRadiusCache.set(cacheKey, radius);
        return radius;
    }

    private getLayoutGroup(node: GraphNode): "central" | "word" | "definition" | "navigation" | "statement" {
        if (node.group === 'central') return 'central';
        if (node.group === 'live-definition' || node.group === 'alternative-definition') return 'definition';
        return node.type as "word" | "navigation" | "statement";
    }

    private getNodeColor(node: EnhancedNode): string {
        switch (node.type) {
            case 'statement':
                return this.extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.STATEMENT);
            case 'openquestion':
                return this.extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.OPENQUESTION);
            case 'navigation':
                return 'transparent';
            case 'dashboard':
                return COLORS.UI.TEXT.PRIMARY;
            default:
                return COLORS.UI.TEXT.PRIMARY;
        }
    }

    private extractBaseColorFromStyle(style: any): string {
        if (style.border) {
            return style.border.substring(0, 7);
        }
        return COLORS.UI.TEXT.PRIMARY;
    }

    private getNodeBackground(node: EnhancedNode): string {
        switch (node.type) {
            case 'statement':
                return NODE_CONSTANTS.COLORS.STATEMENT.background;
            case 'openquestion':
                return NODE_CONSTANTS.COLORS.OPENQUESTION.background;
            case 'dashboard':
                return NODE_CONSTANTS.COLORS.DASHBOARD.background;
            default:
                return 'rgba(0, 0, 0, 0.5)';
        }
    }

    private getNodeBorder(node: EnhancedNode): string {
        switch (node.type) {
            case 'statement':
                return NODE_CONSTANTS.COLORS.STATEMENT.border;
            case 'openquestion':
                return NODE_CONSTANTS.COLORS.OPENQUESTION.border;
            case 'dashboard':
                return NODE_CONSTANTS.COLORS.DASHBOARD.border;
            default:
                return 'rgba(255, 255, 255, 1)';
        }
    }

    private getNodeHover(node: EnhancedNode): string {
        switch (node.type) {
            case 'statement':
                return NODE_CONSTANTS.COLORS.STATEMENT.hover;
            case 'openquestion':
                return NODE_CONSTANTS.COLORS.OPENQUESTION.hover;
            case 'dashboard':
                return NODE_CONSTANTS.COLORS.DASHBOARD.hover;
            default:
                return 'rgba(255, 255, 255, 1)';
        }
    }

    private getNodeGradientStart(node: EnhancedNode): string {
        switch (node.type) {
            case 'statement':
                return NODE_CONSTANTS.COLORS.STATEMENT.gradient.start;
            case 'openquestion':
                return NODE_CONSTANTS.COLORS.OPENQUESTION.gradient.start;
            case 'dashboard':
                return NODE_CONSTANTS.COLORS.DASHBOARD.gradient.start;
            default:
                return 'rgba(255, 255, 255, 0.4)';
        }
    }

    private getNodeGradientEnd(node: EnhancedNode): string {
        switch (node.type) {
            case 'statement':
                return NODE_CONSTANTS.COLORS.STATEMENT.gradient.end;
            case 'openquestion':
                return NODE_CONSTANTS.COLORS.OPENQUESTION.gradient.end;
            case 'dashboard':
                return NODE_CONSTANTS.COLORS.DASHBOARD.gradient.end;
            default:
                return 'rgba(255, 255, 255, 0.2)';
        }
    }

    private clearCaches(): void {
        this.nodeRadiusCache.clear();
        this.linkPathCache.clear();
        this.finalPositionCache.clear();
    }

    private clearNodeRadiusCache(nodeId: string): void {
        for (const key of Array.from(this.nodeRadiusCache.keys())) {
            if (key.startsWith(`${nodeId}-`)) {
                this.nodeRadiusCache.delete(key);
            }
        }
    }

    public stop(): void {
        this.simulationActive = false;
        
        if (this.settlementCheckInterval) {
            clearInterval(this.settlementCheckInterval);
            this.settlementCheckInterval = null;
        }
        
        if (this.d3Simulation) {
            const nodes = this.d3Simulation.getSimulation().nodes() as unknown as EnhancedNode[];
            this.preserveFinalPositions(nodes);
            this.d3Simulation.stopSimulation();
        }
        
        if (this.renderingStrategy) {
            this.renderingStrategy.stopRendering();
        }
        
        if (this.opacityController) {
            this.opacityController.dispose();
        }
        
        const modeCount = this.nodeModes.size;
        this.nodeModes.clear();
        
        this.clearCaches();
        
        this.performanceMetrics = {
            originalRelationshipCount: 0,
            consolidatedRelationshipCount: 0,
            consolidationRatio: 1.0,
            lastUpdateTime: 0,
            renderTime: 0,
            renderedNodeCount: 0,
            totalNodeCount: 0,
            layoutType: 'vote_based_with_natural_forces' as const,
            currentBatch: 0
        };
        
        this.nodesStore.set([]);
        this.linksStore.set([]);
        this.linkOpacityStore.set(new Map());
        
        this.forceUpdateCounter.update(n => n + 1);
        
        if (typeof window !== 'undefined' && (window as any).universalOpacityController) {
            delete (window as any).universalOpacityController;
        }
    }
}