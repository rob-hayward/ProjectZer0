// src/lib/services/graph/UniversalGraphManager.ts - Enhanced with Gentle Sync and FIXED D3-Native Opacity Control
// Central orchestrator using modular components with reactive update protection and immediate node hiding

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

// Import modular components
import { UNIVERSAL_LAYOUT } from './universal/UniversalConstants';
import { UNIVERSAL_FORCES } from './universal/UniversalForceConfig';
import { UniversalPositioning } from './universal/UniversalPositioning';
import { UniversalD3Simulation } from './universal/UniversalD3Simulation';
import { UniversalRenderingStrategy } from './universal/UniversalRenderingStrategy';

/**
 * ENHANCED: UniversalGraphManager with gentle sync, position preservation, and FIXED D3-native opacity control
 * Central orchestrator that delegates to specialized components with immediate node hiding during creation
 */
export class UniversalGraphManager {
    private positioning: UniversalPositioning;
    private d3Simulation: UniversalD3Simulation;
    private renderingStrategy: UniversalRenderingStrategy;
    
    private nodesStore = writable<EnhancedNode[]>([]);
    private linksStore = writable<EnhancedLink[]>([]);
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

    // ENHANCED: Position preservation for gentle updates
    private finalPositionCache = new Map<string, {x: number, y: number, settled: boolean}>();
    private settlementCheckInterval: number | null = null;

    // FIXED: D3-Native opacity control state - simplified
    private visibilityState: 'hidden' | 'revealing' | 'revealed' = 'hidden';
    private revealStartTime: number = 0;
    private revealDuration: number = 2000; // 2 seconds total reveal time
    private revealPattern: 'center-out' | 'vote-ranking' | 'spiral-sequence' = 'center-out';

    // Public derived stores
    public readonly renderableNodes: Readable<RenderableNode[]>;
    public readonly renderableLinks: Readable<RenderableLink[]>;
    
    // Force update mechanism
    private forceUpdateCounter = writable(0);
    private forceUpdateInterval: number | null = null;

    constructor() {
        this.managerId = `universal-enhanced-${Math.random().toString(36).substring(2, 9)}`;
        
        // CRUCIAL DEBUG: Track constructor calls
        console.log('[UniversalGraphManager] Enhanced constructor called with ID:', this.managerId);
        console.trace('[UniversalGraphManager] Created from:');
        
        // CRITICAL: Initialize in hidden state
        this.visibilityState = 'hidden';
        
        // Initialize components
        this.positioning = new UniversalPositioning();
        
        // D3 Simulation with callbacks
        this.d3Simulation = new UniversalD3Simulation({
            onTick: (nodes) => this.handleSimulationTick(nodes),
            onEnd: () => this.handleSimulationEnd(),
            onSettlementTick: (nodes, tickCount) => this.handleSettlementTick(nodes, tickCount)
        });
        
        // Rendering strategy with callbacks
        this.renderingStrategy = new UniversalRenderingStrategy({
            onNodesReady: (nodes, links) => this.handleNodesReady(nodes, links),
            onRenderComplete: () => this.handleRenderComplete(),
            onBatchUpdate: (batch, total) => this.handleBatchUpdate(batch, total)
        });
        
        // Initialize derived stores
        this.renderableNodes = derived(
            [this.nodesStore, this.forceUpdateCounter], 
            ([nodes, updateCount]) => this.createRenderableNodes(nodes)
        );
        
        this.renderableLinks = derived(
            [this.nodesStore, this.linksStore, this.forceUpdateCounter], 
            ([nodes, links, updateCount]) => this.createRenderableLinks(nodes, links)
        );
        
        // CRUCIAL DEBUG: Confirm initialization
        console.log('[UniversalGraphManager] Enhanced architecture initialized with gentle sync capability and FIXED D3-native opacity control');
    }

    /**
     * Enable/disable batch rendering
     */
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

    /**
     * ENHANCED: Gentle data sync that preserves settled simulation state
     * This is the key method that prevents position snapping
     */
    public syncDataGently(newData: Partial<GraphData>): void {
        if (!newData) return;
        
        // Check if simulation is in a settled/dormant state
        const isSettled = this.d3Simulation?.isDormantState?.() === true;
        const hasSettledPositions = this.finalPositionCache.size > 0;
        
        console.log('[UniversalGraphManager] syncDataGently called:', {
            isSettled,
            hasSettledPositions,
            newNodeCount: newData.nodes?.length || 0,
            newLinkCount: newData.links?.length || 0,
            cachedPositions: this.finalPositionCache.size
        });
        
        if (isSettled || hasSettledPositions) {
            console.log('[UniversalGraphManager] 🛡️ PRESERVING SETTLED STATE - gentle sync only');
            
            // For settled simulations, only update data properties, not positions
            if (newData.nodes) {
                const currentNodes = this.d3Simulation.getSimulation().nodes() as unknown as EnhancedNode[];
                const updatedNodes = this.mergeNodeDataOnly(currentNodes, newData.nodes);
                
                // Update stores without triggering simulation restart
                this.nodesStore.set(updatedNodes);
                this.d3Simulation.updateNodes(updatedNodes);
                
                // Update performance metrics
                this.performanceMetrics.renderedNodeCount = updatedNodes.length;
            }
            
            if (newData.links) {
                const transformedLinks = this.transformLinks(newData.links);
                this.linksStore.set(transformedLinks);
                this.d3Simulation.updateLinks(transformedLinks);
                
                // Update performance metrics
                this.updatePerformanceMetrics(transformedLinks);
            }
            
            // Force one gentle update to reactive stores
            this.forceUpdateCounter.update(n => n + 1);
            
            console.log('[UniversalGraphManager] 🛡️ Gentle sync complete - simulation state preserved');
            return; // IMPORTANT: Don't call setData or restart simulation
        }
        
        // If not settled, fall back to normal update
        console.log('[UniversalGraphManager] Simulation not settled, using normal update');
        this.updateState(newData, 0.2);
    }

    /**
     * ENHANCED: Merge new node data without changing positions
     */
    private mergeNodeDataOnly(currentNodes: EnhancedNode[], newNodeData: GraphNode[]): EnhancedNode[] {
        const newDataMap = new Map(newNodeData.map(n => [n.id, n]));
        
        return currentNodes.map(currentNode => {
            const newData = newDataMap.get(currentNode.id);
            if (!newData) return currentNode;
            
            // Get settled position if available
            const settledPosition = this.finalPositionCache.get(currentNode.id);
            
            // Transform the new data to match expected structure
            const transformedData = this.transformSingleNode(newData);
            
            const mergedNode: EnhancedNode = {
                ...currentNode,
                // Update data properties but preserve physics state
                data: { ...currentNode.data, ...transformedData.data },
                metadata: { ...currentNode.metadata, ...transformedData.metadata },
                // Update other node properties that might change
                mode: transformedData.mode || currentNode.mode,
                radius: transformedData.radius || currentNode.radius,
                isHidden: transformedData.isHidden !== undefined ? transformedData.isHidden : currentNode.isHidden,
                hiddenReason: transformedData.hiddenReason || currentNode.hiddenReason,
                
                // CRITICAL: Preserve settled positions
                x: settledPosition?.x ?? currentNode.x,
                y: settledPosition?.y ?? currentNode.y,
                // Keep physics state stable
                vx: 0,
                vy: 0,
                fx: settledPosition ? settledPosition.x : currentNode.fx,
                fy: settledPosition ? settledPosition.y : currentNode.fy
            };
            
            return mergedNode;
        });
    }

    /**
     * Transform a single GraphNode to EnhancedNode (helper for merging)
     */
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
        
        // Build node data similar to transformNodes but for single node
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
        
        return {
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
    }

    /**
     * Enhanced setData with improved dormant state detection and opacity reset
     */
    public setData(data: GraphData, config?: LayoutUpdateConfig & { forceRestart?: boolean }): void {
        const startTime = performance.now();
        
        // ENHANCED: Reset opacity state for new data
        this.visibilityState = 'hidden';
        this.revealStartTime = 0;
        
        // Check if the new data is substantially the same (same node IDs)
        const currentNodes = this.d3Simulation?.getSimulation()?.nodes() as EnhancedNode[] || [];
        const currentNodeIds = new Set(currentNodes.map(n => n.id));
        const newNodeIds = new Set(data.nodes.map(n => n.id));
        const isSameDataSet = currentNodeIds.size === newNodeIds.size && 
            [...currentNodeIds].every(id => newNodeIds.has(id));
        
        // ENHANCED: Check if simulation is settled and stable
        const isSimulationSettled = this.d3Simulation?.isDormantState?.() === true;
        const hasStablePositions = this.finalPositionCache.size > 0;
        
        // Check if this is a forced restart
        const forceRestart = config?.forceRestart === true;
        
        // CRITICAL: If we have the same dataset and simulation is settled, use gentle sync
        const shouldUseGentleSync = isSameDataSet && isSimulationSettled && !forceRestart;
        
        console.log('[UniversalGraphManager] setData analysis:', {
            isSameDataSet,
            isSimulationSettled,
            hasStablePositions,
            shouldUseGentleSync,
            forceRestart,
            currentNodes: currentNodes.length,
            newNodes: data.nodes.length
        });
        
        if (shouldUseGentleSync) {
            console.log('[UniversalGraphManager] 🛡️ USING GENTLE SYNC - preserving settled state');
            this.syncDataGently(data);
            this.performanceMetrics.renderTime = performance.now() - startTime;
            return;
        }
        
        // For new data or forced restarts, proceed with full restart
        console.log('[UniversalGraphManager] Full restart required');
        
        // Clear position cache since we're restarting
        this.finalPositionCache.clear();
        
        // Stop current simulation if needed
        if (forceRestart || !isSameDataSet) {
            console.log('[UniversalGraphManager] Stopping existing simulation for restart');
            this.stop();
        } else if (currentNodes.length > 0) {
            console.log('[UniversalGraphManager] Gentle wake for active simulation');
            this.d3Simulation.wakeSimulation(0.1);
            this.simulationActive = true;
        }
        
        this.performanceMetrics.totalNodeCount = data.nodes.length;
        
        // Start full rendering process
        this.renderingStrategy.startRendering(
            data,
            (nodes) => this.transformNodes(nodes),
            (links) => this.transformLinks(links)
        );
        
        this.performanceMetrics.renderTime = performance.now() - startTime;
    }

    /**
     * Enhanced stop method with dormant state awareness
     */
    public stop(): void {
        // CRUCIAL DEBUG: Track stop calls for debugging
        console.log('[UniversalGraphManager] ⛔ FULL STOP - destroying graph manager');
        console.trace('[UniversalGraphManager] Stop called from:');
        
        this.simulationActive = false;
        
        // Clear settlement monitoring
        if (this.settlementCheckInterval) {
            clearInterval(this.settlementCheckInterval);
            this.settlementCheckInterval = null;
        }
        
        if (this.d3Simulation) {
            // This will clear the dormant state and truly stop the simulation
            this.d3Simulation.stopSimulation();
        }
        
        if (this.forceUpdateInterval) {
            clearInterval(this.forceUpdateInterval);
            this.forceUpdateInterval = null;
        }
        
        // CRUCIAL DEBUG: Confirm stop completion
        console.log('[UniversalGraphManager] ⛔ Graph manager stopped');
    }

    /**
     * ENHANCED: Gentle update method for interactive changes that don't need full restart
     * Use this for: node mode changes, visibility updates, preference changes
     */
    public updateState(newData?: Partial<GraphData>, wakePower: number = 0.2): void {
        console.log('[UniversalGraphManager] updateState called:', {
            hasNewData: !!newData,
            wakePower,
            simulationActive: this.simulationActive,
            isDormant: this.d3Simulation?.isDormantState?.()
        });
        
        if (newData) {
            // Update only changed parts without full restart
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
            }
        }
        
        // Gentle wake to handle any layout adjustments
        if (this.d3Simulation) {
            this.d3Simulation.wakeSimulation(wakePower);
            this.simulationActive = true;
        }
        
        this.forceUpdateCounter.update(n => n + 1);
    }

    /**
     * ENHANCED: Start monitoring for settlement completion without triggering store updates
     */
    private startSettlementMonitoring(): void {
        if (this.settlementCheckInterval) {
            clearInterval(this.settlementCheckInterval);
        }
        
        console.log('[UniversalGraphManager] Starting settlement monitoring');
        
        this.settlementCheckInterval = window.setInterval(() => {
            if (!this.simulationActive) return;
            
            // Check if simulation has settled without triggering events
            const isSettled = this.d3Simulation.isDormantState();
            const wasSettling = this.d3Simulation.isSettling();
            
            if (isSettled && !wasSettling) {
                console.log('[UniversalGraphManager] Settlement detected via polling');
                this.handleSettlementComplete();
            }
        }, 1000); // Check every second
    }

    /**
     * ENHANCED: Handle settlement completion without store cascades
     */
    private handleSettlementComplete(): void {
        if (this.settlementCheckInterval) {
            clearInterval(this.settlementCheckInterval);
            this.settlementCheckInterval = null;
        }
        
        console.log('[UniversalGraphManager] Settlement complete - preserving positions');
        
        // Mark as no longer active but don't update stores
        this.simulationActive = false;
        
        // Get final positions but don't trigger reactive updates
        const nodes = this.d3Simulation.getSimulation().nodes() as unknown as EnhancedNode[];
        
        // Store positions internally without triggering Svelte reactivity
        this.preserveFinalPositions(nodes);
    }

    /**
     * ENHANCED: Preserve final positions without triggering store updates
     */
    private preserveFinalPositions(nodes: EnhancedNode[]): void {
        console.log('[UniversalGraphManager] Preserving final positions for', nodes.length, 'nodes');
        
        // Store positions in a separate cache that won't trigger reactivity
        nodes.forEach(node => {
            if (node.x !== undefined && node.x !== null && node.y !== undefined && node.y !== null) {
                // Store in internal cache instead of reactive store
                this.finalPositionCache.set(node.id, {
                    x: node.x,
                    y: node.y,
                    settled: true
                });
            }
        });
        
        console.log('[UniversalGraphManager] Cached', this.finalPositionCache.size, 'settled positions');
    }

    /**
     * Handle nodes ready from rendering strategy
     */
    private handleNodesReady(nodes: EnhancedNode[], links: EnhancedLink[]): void {
        // Update stores
        this.nodesStore.set(nodes);
        this.linksStore.set(links);
        
        // Update performance metrics
        this.performanceMetrics.renderedNodeCount = nodes.length;
        this.updatePerformanceMetrics(links);
        
        // Configure and start simulation
        this.d3Simulation.configureDropPhaseForces(nodes, links);
        this.d3Simulation.start(UNIVERSAL_FORCES.SIMULATION.DROP_PHASE.ALPHA);
        this.simulationActive = true;
    }

    /**
     * ENHANCED: Handle render complete with settlement monitoring
     */
    private handleRenderComplete(): void {
        console.log('[UniversalGraphManager] Rendering complete, starting settlement monitoring');
        
        // Guard against multiple calls
        if (!this.simulationActive) {
            return;
        }
        
        // Start settlement phase after delay
        setTimeout(() => {
            // Double-check simulation is still active
            if (this.simulationActive && !this.d3Simulation.isSettling()) {
                this.d3Simulation.startSettlementPhase();
                this.startSettlementMonitoring(); // Start polling instead of event-driven
            } else {
                console.log('[UniversalGraphManager] Settlement phase already started or simulation stopped');
            }
        }, UNIVERSAL_LAYOUT.TIMING.SETTLEMENT_START_DELAY);
    }

    /**
     * Handle batch update
     */
    private handleBatchUpdate(batchNumber: number, totalBatches: number): void {
        this.performanceMetrics.currentBatch = batchNumber;
        console.log(`[UniversalGraphManager] Batch ${batchNumber}/${totalBatches} rendered`);
    }

    /**
     * FIXED: Handle simulation tick - ONLY apply opacity during revealing phase
     */
    private handleSimulationTick(nodes: EnhancedNode[]): void {
        // FIXED: Only apply opacity control during revealing phase
        if (this.visibilityState === 'revealing') {
            this.applyRevealOpacity(nodes);
        }
        
        // Only update if simulation is active
        if (this.simulationActive) {
            this.nodesStore.set([...nodes]);
        }
    }

    /**
     * FIXED: Simplified reveal opacity - only handles revealing phase
     */
    private applyRevealOpacity(nodes: EnhancedNode[]): void {
        const elapsed = Date.now() - this.revealStartTime;
        const progress = Math.min(1, elapsed / this.revealDuration);
        
        // Get content nodes and sort by reveal pattern
        const contentNodes = this.getSortedContentNodes(nodes);

        contentNodes.forEach(({ node }, index) => {
            // Calculate staggered reveal timing
            const totalNodes = contentNodes.length;
            const nodeRevealStart = (index / totalNodes) * 0.8; // 80% of total time for staggering
            const nodeRevealDuration = 0.2; // 20% of total time for each node's fade
            
            const nodeProgress = Math.max(0, (progress - nodeRevealStart) / nodeRevealDuration);
            const clampedProgress = Math.min(1, nodeProgress);
            
            // Apply smooth easing
            const opacity = this.easeOutCubic(clampedProgress);
            (node as any).opacity = opacity;
        });

        // Keep system nodes visible
        nodes.forEach(node => {
            if (node.type !== 'statement' && node.type !== 'openquestion') {
                (node as any).opacity = 1;
            }
        });

        // Check if reveal is complete
        if (progress >= 1) {
            console.log('[UniversalGraphManager] ✨ Node reveal sequence complete');
            this.visibilityState = 'revealed';
            
            // Ensure all nodes are fully visible
            nodes.forEach(node => {
                (node as any).opacity = 1;
            });
        }
    }

    /**
     * Sort content nodes based on reveal pattern
     */
    private getSortedContentNodes(nodes: EnhancedNode[]): Array<{ node: EnhancedNode; sortValue: number }> {
        const contentNodes = nodes
            .filter(n => n.type === 'statement' || n.type === 'openquestion')
            .map(node => {
                let sortValue: number;
                
                switch (this.revealPattern) {
                    case 'center-out':
                        // Sort by distance from center (closest first)
                        sortValue = Math.sqrt((node.x || 0) ** 2 + (node.y || 0) ** 2);
                        break;
                        
                    case 'vote-ranking':
                        // Sort by vote count (highest first, so negate for ascending sort)
                        const netVotes = (node as any).netVotes || this.positioning.getNodeVotes({
                            id: node.id, type: node.type, data: node.data, 
                            group: node.group, metadata: node.metadata
                        });
                        sortValue = -netVotes; // Negative for descending order
                        break;
                        
                    case 'spiral-sequence':
                        // Sort by angle for spiral effect
                        const angle = Math.atan2(node.y || 0, node.x || 0);
                        const normalizedAngle = ((angle % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
                        sortValue = normalizedAngle;
                        break;
                        
                    default:
                        sortValue = 0;
                }
                
                return { node, sortValue };
            })
            .sort((a, b) => a.sortValue - b.sortValue);
            
        return contentNodes;
    }

    /**
     * Smooth easing function for opacity transitions
     */
    private easeOutCubic(t: number): number {
        return 1 - Math.pow(1 - t, 3);
    }

    /**
     * Handle settlement tick
     */
    private handleSettlementTick(nodes: EnhancedNode[], tickCount: number): void {
        // Force reactive update every few ticks
        if (tickCount % 3 === 0) {
            this.forceUpdateCounter.update(n => n + 1);
        }
        
        // Direct DOM update as backup
        if (tickCount % 10 === 0) {
            this.updateDOMDirectly(nodes);
        }
    }

    /**
     * FIXED: Handle simulation end - Start reveal sequence properly
     */
    private handleSimulationEnd(): void {
        // CRITICAL FIX: Don't process 'end' events if simulation is dormant
        if (this.d3Simulation?.isDormantState?.()) {
            console.log('[UniversalGraphManager] 🛡️ IGNORING simulation end - dormant state active');
            return;
        }
        
        console.log('[UniversalGraphManager] 🎭 Simulation ended, checking for content nodes to reveal');
        
        const nodes = this.d3Simulation.getSimulation().nodes() as unknown as EnhancedNode[];
        
        // ENHANCED: Check if we have content nodes before starting reveal
        const contentNodes = nodes.filter(n => n.type === 'statement' || n.type === 'openquestion');
        
        if (contentNodes.length > 0) {
            console.log(`[UniversalGraphManager] Starting reveal sequence for ${contentNodes.length} content nodes`);
            this.startRevealSequence();
        } else {
            console.log('[UniversalGraphManager] No content nodes to reveal, marking as revealed');
            this.visibilityState = 'revealed';
            this.simulationActive = false;
        }
        
        // Preserve positions (existing logic)
        this.preserveFinalPositions(nodes);
        this.forceUpdateCounter.update(n => n + 1);
    }

    /**
     * FIXED: Start the reveal sequence with proper timing
     */
    private startRevealSequence(): void {
        console.log(`[UniversalGraphManager] 🎭 Starting ${this.revealPattern} reveal pattern`);
        
        this.visibilityState = 'revealing';
        this.revealStartTime = Date.now();
        
        // CRITICAL FIX: Keep simulation active during reveal for opacity updates
        this.simulationActive = true;
        
        // Wake simulation with very low energy just for opacity updates
        this.d3Simulation.wakeSimulation(0.02); // Even lower energy
        
        // Set timer to complete reveal and sleep simulation
        setTimeout(() => {
            if (this.visibilityState !== 'revealed') {
                this.visibilityState = 'revealed';
                console.log('[UniversalGraphManager] ✨ Reveal sequence completed via timer');
                
                // Ensure all nodes are fully visible
                const nodes = this.d3Simulation.getSimulation().nodes() as unknown as EnhancedNode[];
                nodes.forEach(node => {
                    (node as any).opacity = 1;
                });
                
                // Force final update
                this.nodesStore.set([...nodes]);
                this.forceUpdateCounter.update(n => n + 1);
            }
            
            // Sleep simulation after reveal
            setTimeout(() => {
                this.d3Simulation.sleepSimulation();
                this.simulationActive = false;
                console.log('[UniversalGraphManager] 😴 Simulation sleeping after reveal');
            }, 200);
            
        }, this.revealDuration + 300); // Shorter timeout
    }

    /**
     * Direct DOM update via D3 selection
     */
    private updateDOMDirectly(nodes: EnhancedNode[]): void {
        if (!this.simulationActive || !this.d3Simulation.isSettling()) return;
        if (typeof document === 'undefined') return;
        
        nodes.forEach(node => {
            if (node.type === 'statement' || node.type === 'openquestion') {
                d3.select(`[data-node-id="${node.id}"]`)
                    .transition()
                    .duration(0)
                    .attr('transform', `translate(${node.x},${node.y})`);
            }
        });
    }

    /**
     * Update node mode
     */
    public updateNodeMode(nodeId: string, mode: NodeMode): void {
        const nodes = this.d3Simulation.getSimulation().nodes() as unknown as EnhancedNode[];
        const nodeIndex = nodes.findIndex(n => n.id === nodeId);
        
        if (nodeIndex === -1) return;
        
        const node = nodes[nodeIndex];
        if (node.mode === mode) return;
        
        // Update node properties
        const newRadius = this.getNodeRadius({ ...node, mode });
        const updatedNode: EnhancedNode = {
            ...node,
            mode,
            expanded: mode === 'detail',
            radius: newRadius,
            metadata: { ...node.metadata, isDetail: mode === 'detail' }
        };
        
        // Update in array
        nodes[nodeIndex] = updatedNode;
        
        // Update simulation
        this.d3Simulation.updateNodes(nodes);
        this.nodesStore.set(nodes);
        this.forceUpdateCounter.update(n => n + 1);
        
        // Restart simulation
        this.d3Simulation.start(0.1);
        this.simulationActive = true;
    }

    /**
     * Update node visibility
     */
    public updateNodeVisibility(nodeId: string, isHidden: boolean, hiddenReason: 'community' | 'user' = 'user'): void {
        const nodes = this.d3Simulation.getSimulation().nodes() as unknown as EnhancedNode[];
        const nodeIndex = nodes.findIndex(n => n.id === nodeId);
        
        if (nodeIndex === -1) return;
        
        const oldNode = nodes[nodeIndex];
        if (oldNode.isHidden === isHidden) return;
        
        // Clear cache
        this.clearNodeRadiusCache(nodeId);
        
        // Update mode if transitioning from hidden
        let updatedMode = oldNode.mode;
        if (oldNode.isHidden && !isHidden) {
            updatedMode = 'preview';
        }
        
        // Create updated node
        const newRadius = this.getNodeRadius({ ...oldNode, mode: updatedMode, isHidden });
        const updatedNode: EnhancedNode = {
            ...oldNode,
            isHidden,
            hiddenReason,
            mode: updatedMode,
            radius: newRadius,
            expanded: updatedMode === 'detail'
        };
        
        // Update in array
        nodes[nodeIndex] = updatedNode;
        
        // Update simulation
        this.d3Simulation.updateNodes(nodes);
        this.nodesStore.set(nodes);
        this.forceUpdateCounter.update(n => n + 1);
        
        // Restart simulation
        this.d3Simulation.start(0.2);
        this.simulationActive = true;
    }

    /**
     * Apply visibility preferences
     */
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

    /**
     * Force tick updates
     */
    public forceTick(ticks: number = 1): void {
        this.d3Simulation.forceTick(ticks);
        
        const nodes = this.d3Simulation.getSimulation().nodes() as unknown as EnhancedNode[];
        this.nodesStore.set([...nodes]);
        this.forceUpdateCounter.update(n => n + 1);
    }

    /**
     * Get performance metrics
     */
    public getPerformanceMetrics() {
        return { ...this.performanceMetrics };
    }

    /**
     * Configure reveal pattern for node entrance
     */
    public configureRevealPattern(pattern: 'center-out' | 'vote-ranking' | 'spiral-sequence'): void {
        this.revealPattern = pattern;
        console.log(`[UniversalGraphManager] Reveal pattern set to: ${pattern}`);
    }

    /**
     * Configure reveal timing
     */
    public configureRevealTiming(duration: number): void {
        this.revealDuration = Math.max(1000, Math.min(5000, duration)); // Clamp between 1-5 seconds
        console.log(`[UniversalGraphManager] Reveal duration set to: ${this.revealDuration}ms`);
    }

    /**
     * Force immediate reveal of all nodes (for debugging)
     */
    public forceRevealAll(): void {
        console.log('[UniversalGraphManager] 🚀 Force revealing all nodes');
        this.visibilityState = 'revealed';
        
        // Set all content nodes to full opacity immediately
        const nodes = this.d3Simulation.getSimulation().nodes() as unknown as EnhancedNode[];
        nodes.forEach(node => {
            (node as any).opacity = 1;
        });
        
        // Update stores
        this.nodesStore.set([...nodes]);
        this.forceUpdateCounter.update(n => n + 1);
    }

    /**
     * Get current reveal status (for debugging)
     */
    public getRevealStatus(): { 
        state: string; 
        progress: number; 
        pattern: string; 
        duration: number 
    } {
        const progress = this.visibilityState === 'revealing' && this.revealStartTime > 0
            ? Math.min(1, (Date.now() - this.revealStartTime) / this.revealDuration)
            : (this.visibilityState === 'revealed' ? 1 : 0);
            
        return {
            state: this.visibilityState,
            progress,
            pattern: this.revealPattern,
            duration: this.revealDuration
        };
    }

    /**
     * Get batch debug info with reveal status
     */
    public getBatchDebugInfo(): any {
        const renderingStats = this.renderingStrategy.getRenderingStats();
        const revealStatus = this.getRevealStatus();
        
        return {
            layoutType: 'vote_based_with_natural_forces',
            phase: 'enhanced_gentle_sync_with_fixed_d3_opacity',
            renderingStats,
            settlementPhase: this.d3Simulation.isSettling(),
            settlementTicks: this.d3Simulation.getSettlementTickCount(),
            performanceMetrics: this.getPerformanceMetrics(),
            settledPositionCount: this.finalPositionCache.size,
            revealStatus,
            message: 'Enhanced with FIXED D3-native opacity control and position preservation'
        };
    }

    /**
     * FIXED: Transform GraphNodes to EnhancedNodes with IMMEDIATE opacity control
     */
    private transformNodes(nodes: GraphNode[]): EnhancedNode[] {
        return nodes.map(node => {
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
            
            // CRITICAL FIX: Set opacity to 0 immediately for content nodes during creation
            if (node.type === 'statement' || node.type === 'openquestion') {
                // Hide nodes immediately during creation phase
                if (this.visibilityState === 'hidden') {
                    (enhancedNode as any).opacity = 0;
                    console.log(`[UniversalGraphManager] Created hidden node: ${node.id.substring(0, 8)}`);
                } else {
                    (enhancedNode as any).opacity = 1;
                }
            } else {
                // System nodes always visible
                (enhancedNode as any).opacity = 1;
            }
            
            if (enhancedNode.fixed || enhancedNode.group === 'central') {
                enhancedNode.fx = 0;
                enhancedNode.fy = 0;
                enhancedNode.x = 0;
                enhancedNode.y = 0;
            }
            
            return enhancedNode;
        });
    }

    /**
     * Transform GraphLinks to EnhancedLinks
     */
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
            
            return {
                id: link.id || `${sourceId}-${targetId}`,
                source: sourceId,
                target: targetId,
                type: link.type,
                relationshipType,
                strength,
                metadata: linkMetadata
            };
        });
    }

    /**
     * ENHANCED: Create renderable nodes from enhanced nodes (includes D3-controlled opacity)
     */
    private createRenderableNodes(nodes: EnhancedNode[]): RenderableNode[] {
        // REDUCED: Only log essential sample for debugging layout issues
        const contentNodeCount = nodes.filter(n => n.type === 'statement' || n.type === 'openquestion').length;
        if (contentNodeCount > 0) {
            const sampleNodes = nodes.filter(n => n.type === 'statement' || n.type === 'openquestion').slice(0, 2);
            // REDUCED: Only log when positions are significantly changing or null
            const hasNullPositions = sampleNodes.some(n => n.x === null || n.y === null);
            if (hasNullPositions) {
                console.log('[UniversalGraphManager] createRenderableNodes sample positions:', 
                    sampleNodes.map(n => ({
                        id: n.id.substring(0, 8),
                        x: n.x?.toFixed(1),
                        y: n.y?.toFixed(1),
                        opacity: (n as any).opacity
                    }))
                );
            }
        }
        
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
                opacity: (node as any).opacity || 1, // FIXED: Include D3-controlled opacity
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

    /**
     * Create renderable links
     */
    private createRenderableLinks(nodes: EnhancedNode[], links: EnhancedLink[]): RenderableLink[] {
        if (nodes.length === 0 || links.length === 0) return [];
        
        const nodeMap = new Map<string, EnhancedNode>();
        nodes.forEach(node => nodeMap.set(node.id, node));
        
        return links.map(link => {
            const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
            const targetId = typeof link.target === 'string' ? link.target : link.target.id;
            
            const source = nodeMap.get(sourceId);
            const target = nodeMap.get(targetId);
            
            if (!source || !target || source.isHidden || target.isHidden) {
                return null;
            }
            
            const path = this.calculateLinkPath(source, target, link);
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
            
            return {
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
        }).filter(Boolean) as RenderableLink[];
    }

    // Helper methods (preserved from original)

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
        
        // Only cache if not in settlement phase
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
}