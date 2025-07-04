// src/lib/services/graph/UniversalGraphManager.ts - PHASE 2.7: Enhanced with D3 forceRadial
// Minimal changes to existing working code - adds natural spacing while preserving vote order

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
    LayoutUpdateConfig,
    ConsolidatedKeywordMetadata
} from '$lib/types/graph/enhanced';
import { asD3Nodes, asD3Links } from '$lib/types/graph/enhanced';
import { COORDINATE_SPACE, NODE_CONSTANTS } from '$lib/constants/graph';
import { COLORS } from '$lib/constants/colors';
import { coordinateSystem } from './CoordinateSystem';
import { getNeo4jNumber } from '$lib/utils/neo4j-utils';
import { BATCH_RENDERING } from '$lib/constants/graph/universal-graph';

/**
 * PHASE 2.7: Enhanced UniversalGraphManager with D3 forceRadial
 * Minimal changes to add natural spacing while keeping everything else working
 */
export class UniversalGraphManager {
    private simulation: d3.Simulation<any, any>;
    private nodesStore = writable<EnhancedNode[]>([]);
    private linksStore = writable<EnhancedLink[]>([]);
    private managerId: string;
    private simulationActive = false;
    
    // Batch rendering properties
    private isBatchRenderingEnabled = false;
    private isSequentialRenderingEnabled = false;
    private allNodeData: GraphData | null = null;
    private maxBatchesToRender = BATCH_RENDERING.MAX_BATCHES;
    private currentBatchNumber = 0;
    private batchRenderTimer: number | null = null;
    
    // Single-node rendering properties (from constants)
    private enableSingleNodeMode: boolean = BATCH_RENDERING.ENABLE_SINGLE_NODE_MODE;
    private currentNodeIndex = 0;
    private sortedContentNodes: GraphNode[] = [];
    private singleNodeTimer: number | null = null;
    private singleNodeConfig = {
        baseDistance: BATCH_RENDERING.SINGLE_NODE_MODE.BASE_DISTANCE,
        distanceIncrement: BATCH_RENDERING.SINGLE_NODE_MODE.DISTANCE_INCREMENT,
        nodeDelay: BATCH_RENDERING.SINGLE_NODE_MODE.NODE_DELAY,
        maxNodesToRender: BATCH_RENDERING.SINGLE_NODE_MODE.MAX_NODES
    };
    
    // PHASE 2.7: Track settlement phase
    private isInSettlementPhase = false;
    
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
        layoutType: 'vote_based_with_d3_radial' as const
    };

    // Public derived stores
    public readonly renderableNodes: Readable<RenderableNode[]>;
    public readonly renderableLinks: Readable<RenderableLink[]>;
    
    // PHASE 2.7: Force update counter to trigger reactivity
    private forceUpdateCounter = writable(0);

    constructor() {
        this.managerId = `universal-vote-d3-${Math.random().toString(36).substring(2, 9)}`;
        this.simulation = this.initializeSimulation();
    
        this.renderableNodes = derived(
            [this.nodesStore, this.forceUpdateCounter], 
            ([nodes, _]) => this.createRenderableNodes(nodes)
        );
        
        this.renderableLinks = derived(
            [this.nodesStore, this.linksStore, this.forceUpdateCounter], 
            ([nodes, links, _]) => this.createRenderableLinks(nodes, links)
        );
        
        console.log('[UniversalGraphManager] Phase 2.7 - Enhanced with D3 forceRadial');
    }

    /**
     * Initialize D3 simulation
     */
    private initializeSimulation(): d3.Simulation<any, any> {
        const simulation = d3.forceSimulation()
            .velocityDecay(0.2)
            .alphaDecay(0.003)
            .alphaMin(0.0001)
            .alphaTarget(0);

        let tickCount = 0;
        let lastTickTime = Date.now();
        
        simulation.on('tick', () => {
            tickCount++;
            const now = Date.now();
            
            // Log every 100 ticks to see if simulation is running
            if (tickCount % 100 === 0) {
                console.log(`[UniversalGraphManager] Tick #${tickCount}, alpha: ${simulation.alpha().toFixed(4)}, time since last log: ${now - lastTickTime}ms`);
                lastTickTime = now;
                
                // Sample a node to see if it's moving
                const nodes = simulation.nodes() as unknown as EnhancedNode[];
                const sampleNode = nodes.find(n => n.type === 'statement' || n.type === 'openquestion');
                if (sampleNode) {
                    console.log(`[UniversalGraphManager] Sample node position:`, {
                        id: sampleNode.id,
                        x: sampleNode.x?.toFixed(2),
                        y: sampleNode.y?.toFixed(2),
                        vx: sampleNode.vx?.toFixed(2),
                        vy: sampleNode.vy?.toFixed(2)
                    });
                }
            }
            
            const nodes = simulation.nodes() as unknown as EnhancedNode[];
            
            nodes.forEach(node => {
                if (node.fixed || node.group === 'central') {
                    this.centerNode(node);
                } else if (node.type === 'navigation') {
                    this.enforceNavigationPosition(node);
                }
            });
            
            // CRITICAL FIX: During settlement phase, force derived stores to update
            if (this.isInSettlementPhase) {
                if (tickCount % 5 === 0) { // Every 5 ticks
                    // Update the force counter to trigger derived store recalculation
                    this.forceUpdateCounter.update(n => n + 1);
                    
                    if (tickCount % 50 === 0) {
                        console.log(`[UniversalGraphManager] Forcing derived store update - tick ${tickCount}`);
                    }
                }
                
                // Still update the nodes store normally
                this.nodesStore.set([...nodes]);
            } else {
                // Normal update during drop phase
                this.nodesStore.set([...nodes]);
            }
        });

        simulation.on('end', () => {
            if (this.isInSettlementPhase) {
                console.log(`[UniversalGraphManager] Simulation reached low energy but will continue running...`);
                // Don't stop - let it keep running!
            } else {
                const mode = this.enableSingleNodeMode ? 'single-node' : 'batch';
                console.log(`[UniversalGraphManager] Drop phase complete (${mode} mode)`);
            }
        });
        
        return simulation;
    }

    /**
     * Enable batch rendering with mode selection
     */
    public enableBatchRendering(
        enable: boolean = true, 
        maxBatches: number = BATCH_RENDERING.MAX_BATCHES, 
        sequential: boolean = true,
        singleNodeMode?: boolean
    ): void {
        this.isBatchRenderingEnabled = enable;
        this.isSequentialRenderingEnabled = enable && sequential;
        
        // Use override if provided, otherwise use constant
        this.enableSingleNodeMode = singleNodeMode !== undefined ? 
            singleNodeMode : BATCH_RENDERING.ENABLE_SINGLE_NODE_MODE;
            
        this.maxBatchesToRender = maxBatches;
        
        this.performanceMetrics.layoutType = 'vote_based_with_d3_radial';
        
        console.log('[UniversalGraphManager] Rendering configuration with D3 enhancements:', {
            enabled: enable,
            sequential,
            singleNodeMode: this.enableSingleNodeMode,
            maxBatches
        });
    }

    /**
     * Set graph data
     */
    public setData(data: GraphData, config?: LayoutUpdateConfig): void {
        const startTime = performance.now();
        
        this.allNodeData = data;
        this.performanceMetrics.totalNodeCount = data.nodes.length;
        
        if (this.isBatchRenderingEnabled) {
            if (this.enableSingleNodeMode) {
                this.setupSingleNodeRendering(data, config);
            } else {
                this.setupBatchRendering(data, config);
            }
        } else {
            this.setupStandardRendering(data, config);
        }
        
        this.performanceMetrics.renderTime = performance.now() - startTime;
    }

    /**
     * Setup single-node sequential rendering
     */
    private setupSingleNodeRendering(data: GraphData, config?: LayoutUpdateConfig): void {
        this.stopSimulation();
        this.clearCaches();
        this.clearAllTimers();
        
        const contentNodes = data.nodes.filter(node => 
            node.type === 'statement' || node.type === 'openquestion'
        );
        const systemNodes = data.nodes.filter(node => 
            node.type === 'navigation' || node.type === 'dashboard' || node.type === 'control'
        );
        
        if (contentNodes.length === 0) {
            this.setupStandardRendering(data, config);
            return;
        }
        
        this.sortedContentNodes = this.sortNodesByVotes(contentNodes);
        this.allNodeData = { nodes: [...systemNodes, ...this.sortedContentNodes], links: data.links || [] };
        this.currentNodeIndex = 0;
        
        // Start with system nodes
        const enhancedSystemNodes = this.transformNodes(systemNodes);
        this.nodesStore.set(enhancedSystemNodes);
        this.linksStore.set([]);
        
        this.configureSimulation(enhancedSystemNodes, []);
        this.renderNextSingleNode(systemNodes);
        
        console.log(`[UniversalGraphManager] Single-node rendering started: ${this.sortedContentNodes.length} content nodes`);
    }

    /**
     * Render next single node
     */
    private renderNextSingleNode(systemNodes: GraphNode[]): void {
        if (!this.allNodeData) {
            console.log('[UniversalGraphManager] No allNodeData - stopping');
            return;
        }
        
        const shouldStop = this.currentNodeIndex >= this.sortedContentNodes.length || 
                          this.currentNodeIndex >= this.singleNodeConfig.maxNodesToRender;
        
        console.log(`[UniversalGraphManager] renderNextSingleNode - index: ${this.currentNodeIndex}, sorted: ${this.sortedContentNodes.length}, max: ${this.singleNodeConfig.maxNodesToRender}, shouldStop: ${shouldStop}`);
        
        if (shouldStop) {
            console.log('[UniversalGraphManager] All nodes rendered, scheduling settlement phase...');
            
            // PHASE 2.7: Start settlement phase after all nodes are dropped
            setTimeout(() => {
                console.log('[UniversalGraphManager] Settlement timeout fired!');
                this.startSettlementPhase();
            }, 300);
            return;
        }
        
        const currentContentNodes = this.sortedContentNodes.slice(0, this.currentNodeIndex + 1);
        const currentNodes = [...systemNodes, ...currentContentNodes];
        const enhancedNodes = this.transformNodes(currentNodes);
        
        // Position nodes using guaranteed vote ordering
        this.calculateSingleNodePositions(enhancedNodes);
        
        // PHASE 2.7: Pin newly added node during drop
        const newNode = enhancedNodes[enhancedNodes.length - 1];
        if (newNode.type === 'statement' || newNode.type === 'openquestion') {
            newNode.fx = newNode.x;
            newNode.fy = newNode.y;
            console.log(`[UniversalGraphManager] Pinned node ${newNode.id} at (${newNode.fx}, ${newNode.fy})`);
        }
        
        // Get links
        const renderedNodeIds = new Set(currentNodes.map(n => n.id));
        const visibleLinks = (this.allNodeData.links || []).filter(link => {
            const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
            const targetId = typeof link.target === 'string' ? link.target : link.target.id;
            return renderedNodeIds.has(sourceId) && renderedNodeIds.has(targetId);
        });
        
        const enhancedLinks = this.transformLinks(visibleLinks);
        
        // Update stores
        this.nodesStore.set(enhancedNodes);
        this.linksStore.set(enhancedLinks);
        
        // Configure and restart simulation
        this.configureSimulation(enhancedNodes, enhancedLinks);
        this.simulation.alpha(0.3).restart();
        this.simulationActive = true;
        
        this.performanceMetrics.renderedNodeCount = currentNodes.length;
        
        const currentNode = this.sortedContentNodes[this.currentNodeIndex];
        const nodeVotes = this.getNodeVotes(currentNode);
        
        console.log(`[UniversalGraphManager] Rendered node ${this.currentNodeIndex + 1}/${this.sortedContentNodes.length}: ${nodeVotes} votes`);
        
        this.currentNodeIndex++;
        
        // Check if we should continue or start settlement
        const shouldContinue = this.currentNodeIndex < this.sortedContentNodes.length && 
                              this.currentNodeIndex < this.singleNodeConfig.maxNodesToRender;
        
        console.log(`[UniversalGraphManager] After increment - index: ${this.currentNodeIndex}, shouldContinue: ${shouldContinue}`);
        
        if (shouldContinue) {
            this.singleNodeTimer = window.setTimeout(() => {
                this.renderNextSingleNode(systemNodes);
            }, this.singleNodeConfig.nodeDelay);
        } else {
            // We've rendered all nodes, start settlement!
            console.log('[UniversalGraphManager] Reached end of rendering, starting settlement in 300ms...');
            setTimeout(() => {
                this.startSettlementPhase();
            }, 300);
        }
    }

    /**
     * PHASE 2.7: Start settlement phase with D3 forces
     */
    private startSettlementPhase(): void {
        console.log('[UniversalGraphManager] 🚀 SETTLEMENT PHASE STARTING - FREE MOVEMENT!');
        console.log('[UniversalGraphManager] Current simulation:', this.simulation);
        console.log('[UniversalGraphManager] Current nodes:', this.simulation.nodes().length);
        this.isInSettlementPhase = true;
        
        // Get the CURRENT nodes from the simulation, not a stale reference
        const nodes = this.simulation.nodes() as EnhancedNode[];
        console.log('[UniversalGraphManager] Got nodes from simulation:', nodes.length);
        
        // Unpin ALL nodes - complete freedom
        nodes.forEach(node => {
            // Remove ALL constraints
            node.fx = null;
            node.fy = null;
            
            // Give nodes some random velocity to break out of patterns
            if (node.type === 'statement' || node.type === 'openquestion') {
                node.vx = (Math.random() - 0.5) * 10;
                node.vy = (Math.random() - 0.5) * 10;
            }
        });
        
        // Configure FREE MOVEMENT forces
        this.configureFreeMovementForces();
        
        // Debug: Check what forces are active
        console.log('[UniversalGraphManager] Active forces after configuration:');
        ['charge', 'collision', 'radial', 'link', 'centerX', 'centerY', 'angular', 'boundingBox'].forEach(forceName => {
            const force = this.simulation.force(forceName);
            console.log(`  - ${forceName}: ${force ? 'ACTIVE' : 'removed'}`);
        });
        
        // Debug: Check node pinning status
        const pinnedNodes = nodes.filter(n => n.fx !== null || n.fy !== null);
        console.log(`[UniversalGraphManager] Pinned nodes: ${pinnedNodes.length}`, pinnedNodes.map(n => ({id: n.id, type: n.type})));
        
        // Restart with high energy and let it run indefinitely
        console.log('[UniversalGraphManager] Before restart - alpha:', this.simulation.alpha());
        
        this.simulation
            .alpha(1.0) // Maximum energy
            .alphaDecay(0) // NO DECAY - run forever!
            .alphaMin(0) // Never stop
            .alphaTarget(0.3) // Keep some energy in the system
            .restart();
        
        console.log('[UniversalGraphManager] After restart - alpha:', this.simulation.alpha());
        console.log('[UniversalGraphManager] Simulation running?', this.simulationActive);
        
        // Force a manual tick to see if it works
        console.log('[UniversalGraphManager] Forcing manual tick...');
        this.simulation.tick();
        
        // Check velocities after giving random kick
        const sampleNode = nodes.find(n => n.type === 'statement');
        if (sampleNode) {
            console.log('[UniversalGraphManager] Sample node after velocity kick:', {
                id: sampleNode.id,
                vx: sampleNode.vx,
                vy: sampleNode.vy
            });
        }
        
        console.log('[UniversalGraphManager] Simulation will run indefinitely - watch where nodes settle!');
    }

    /**
     * PHASE 2.7: Configure completely free movement forces
     */
    private configureFreeMovementForces(): void {
        const nodes = this.simulation.nodes() as EnhancedNode[];
        
        // Remove ALL constraining forces
        this.simulation.force('radial', null); // NO radial constraint
        this.simulation.force('centerX', null); // NO center force
        this.simulation.force('centerY', null); // NO center force
        this.simulation.force('link', null); // NO link forces
        this.simulation.force('angular', null); // NO angular force
        
        // Just basic repulsion - let's see where nodes want to go
        this.simulation.force('charge', d3.forceManyBody()
            .strength(-500) // Moderate repulsion
            .distanceMin(50)
            .distanceMax(2000) // Long range
            .theta(0.9)
        );
        
        // Basic collision only
        this.simulation.force('collision', d3.forceCollide()
            .radius((d: any) => (d as EnhancedNode).radius + 30) // Basic padding
            .strength(0.7)
            .iterations(1)
        );
        
        // Add a VERY weak center force just to keep things on screen
        this.simulation.force('boundingBox', (alpha) => {
            nodes.forEach(node => {
                // Only apply to content nodes
                if (node.type === 'statement' || node.type === 'openquestion') {
                    const x = node.x ?? 0;
                    const y = node.y ?? 0;
                    const distance = Math.sqrt(x * x + y * y);
                    
                    // Only apply force if node is very far from center (keep on screen)
                    if (distance > 1500) {
                        const force = (distance - 1500) * 0.001 * alpha;
                        if (node.vx !== null && node.vx !== undefined) {
                            node.vx -= (x / distance) * force;
                        }
                        if (node.vy !== null && node.vy !== undefined) {
                            node.vy -= (y / distance) * force;
                        }
                    }
                }
            });
        });
        
        // Set simulation parameters for continuous running
        this.simulation
            .velocityDecay(0.1) // Very low damping - nodes keep moving
            .alphaDecay(0) // No cooling
            .alphaMin(0) // Never stop
            .alphaTarget(0.3); // Maintain energy
    }

    /**
     * Calculate single-node positions with guaranteed vote ordering
     */
    private calculateSingleNodePositions(nodes: EnhancedNode[]): void {
        const contentNodes = nodes.filter(node => 
            node.type === 'statement' || node.type === 'openquestion'
        );
        
        contentNodes.sort((a, b) => {
            const votesA = this.getNodeVotes({ 
                id: a.id, type: a.type, data: a.data, group: a.group, metadata: a.metadata 
            });
            const votesB = this.getNodeVotes({ 
                id: b.id, type: b.type, data: b.data, group: b.group, metadata: b.metadata 
            });
            return votesB - votesA;
        });
        
        contentNodes.forEach((node, index) => {
            const netVotes = this.getNodeVotes({ 
                id: node.id, type: node.type, data: node.data, group: node.group, metadata: node.metadata 
            });
            
            // Guaranteed distance ordering
            const targetDistance = this.singleNodeConfig.baseDistance + 
                                 (index * this.singleNodeConfig.distanceIncrement);
            
            // Golden angle distribution
            const goldenAngle = Math.PI * (3 - Math.sqrt(5));
            const angle = index * goldenAngle;
            
            node.x = Math.cos(angle) * targetDistance;
            node.y = Math.sin(angle) * targetDistance;
            
            // Store data for forces
            (node as any).voteBasedDistance = targetDistance;
            (node as any).netVotes = netVotes;
            (node as any).voteRank = index;
            (node as any).targetDistanceFromCenter = targetDistance;
        });
    }

    /**
     * Setup batch rendering
     */
    private setupBatchRendering(data: GraphData, config?: LayoutUpdateConfig): void {
        this.stopSimulation();
        this.clearCaches();
        this.clearAllTimers();
        
        const contentNodes = data.nodes.filter(node => 
            node.type === 'statement' || node.type === 'openquestion'
        );
        const systemNodes = data.nodes.filter(node => 
            node.type === 'navigation' || node.type === 'dashboard' || node.type === 'control'
        );
        
        if (contentNodes.length === 0) {
            this.setupStandardRendering(data, config);
            return;
        }
        
        const sortedContentNodes = this.sortNodesByVotes(contentNodes);
        this.allNodeData = { nodes: [...systemNodes, ...sortedContentNodes], links: data.links || [] };
        this.currentBatchNumber = 0;
        
        // Start with system nodes
        const enhancedSystemNodes = this.transformNodes(systemNodes);
        this.nodesStore.set(enhancedSystemNodes);
        this.linksStore.set([]);
        
        this.configureSimulation(enhancedSystemNodes, []);
        this.renderNextBatch();
        
        console.log(`[UniversalGraphManager] Batch rendering started: ${sortedContentNodes.length} content nodes`);
    }

    /**
     * Render next batch
     */
    private renderNextBatch(): void {
        if (!this.allNodeData) return;
        
        this.currentBatchNumber++;
        
        if (this.currentBatchNumber > this.maxBatchesToRender) {
            console.log('[UniversalGraphManager] Batch rendering complete');
            setTimeout(() => {
                this.startSettlementPhase();
            }, 300);
            return;
        }
        
        const systemNodes = this.allNodeData.nodes.filter(node => 
            node.type === 'navigation' || node.type === 'dashboard' || node.type === 'control'
        );
        
        const contentNodes = this.allNodeData.nodes.filter(node => 
            node.type === 'statement' || node.type === 'openquestion'
        );
        
        const totalContentNodes = this.currentBatchNumber * 10;
        const currentContentNodes = contentNodes.slice(0, totalContentNodes);
        
        const currentNodes = [...systemNodes, ...currentContentNodes];
        const enhancedNodes = this.transformNodes(currentNodes);
        
        this.calculateBatchPositions(enhancedNodes);
        
        const renderedNodeIds = new Set(currentNodes.map(n => n.id));
        const visibleLinks = (this.allNodeData.links || []).filter(link => {
            const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
            const targetId = typeof link.target === 'string' ? link.target : link.target.id;
            return renderedNodeIds.has(sourceId) && renderedNodeIds.has(targetId);
        });
        
        const enhancedLinks = this.transformLinks(visibleLinks);
        
        this.nodesStore.set(enhancedNodes);
        this.linksStore.set(enhancedLinks);
        
        this.configureSimulation(enhancedNodes, enhancedLinks);
        this.simulation.alpha(0.8).restart();
        this.simulationActive = true;
        
        this.performanceMetrics.renderedNodeCount = currentNodes.length;
        
        console.log(`[UniversalGraphManager] Rendered batch ${this.currentBatchNumber}/${this.maxBatchesToRender}: ${currentNodes.length} total nodes`);
        
        if (this.currentBatchNumber < this.maxBatchesToRender && currentContentNodes.length < contentNodes.length) {
            this.batchRenderTimer = window.setTimeout(() => {
                this.renderNextBatch();
            }, BATCH_RENDERING.DELAY_BETWEEN_BATCHES);
        }
    }

    /**
     * Calculate batch positions with vote-based ordering
     */
    private calculateBatchPositions(nodes: EnhancedNode[]): void {
        const contentNodes = nodes.filter(node => 
            node.type === 'statement' || node.type === 'openquestion'
        );
        
        contentNodes.sort((a, b) => {
            const votesA = this.getNodeVotes({ 
                id: a.id, type: a.type, data: a.data, group: a.group, metadata: a.metadata 
            });
            const votesB = this.getNodeVotes({ 
                id: b.id, type: b.type, data: b.data, group: b.group, metadata: b.metadata 
            });
            return votesB - votesA;
        });
        
        contentNodes.forEach((node, index) => {
            const netVotes = this.getNodeVotes({ 
                id: node.id, type: node.type, data: node.data, group: node.group, metadata: node.metadata 
            });
            
            let targetDistance: number;
            
            if (index === 0) {
                targetDistance = 220;
            } else {
                const maxVotes = this.getNodeVotes({ 
                    id: contentNodes[0].id, type: contentNodes[0].type, 
                    data: contentNodes[0].data, group: contentNodes[0].group, metadata: contentNodes[0].metadata 
                });
                
                const voteDeficit = Math.max(0, maxVotes - netVotes);
                const baseDistance = 300;
                const voteDistanceMultiplier = 20;
                const indexDistanceMultiplier = 30;
                
                targetDistance = baseDistance + 
                               (voteDeficit * voteDistanceMultiplier) + 
                               (index * indexDistanceMultiplier);
            }
            
            const totalNodes = contentNodes.length;
            const nodesPerRing = Math.max(6, Math.min(10, Math.ceil(totalNodes / 4)));
            const ring = Math.floor(index / nodesPerRing);
            const positionInRing = index % nodesPerRing;
            const totalNodesInThisRing = Math.min(nodesPerRing, totalNodes - ring * nodesPerRing);
            
            const angleStep = (2 * Math.PI) / totalNodesInThisRing;
            const ringOffset = ring * 0.4;
            const randomOffset = (Math.random() - 0.5) * 0.15;
            const angle = positionInRing * angleStep + ringOffset + randomOffset;
            
            node.x = Math.cos(angle) * targetDistance;
            node.y = Math.sin(angle) * targetDistance;
            
            (node as any).voteBasedDistance = targetDistance;
            (node as any).netVotes = netVotes;
            (node as any).voteRank = index;
            (node as any).targetDistanceFromCenter = targetDistance;
        });
    }

    /**
     * Setup standard rendering (no batching)
     */
    private setupStandardRendering(data: GraphData, config?: LayoutUpdateConfig): void {
        this.stopSimulation();
        this.clearCaches();
        
        const enhancedNodes = this.transformNodes(data.nodes);
        const enhancedLinks = this.transformLinks(data.links || []);
        
        this.calculateBatchPositions(enhancedNodes);
        this.updatePerformanceMetrics(data.links || []);
        
        this.nodesStore.set(enhancedNodes);
        this.linksStore.set(enhancedLinks);
        
        this.configureSimulation(enhancedNodes, enhancedLinks);
        
        if (!config?.skipAnimation) {
            this.simulation.alpha(1.0).restart();
            this.simulationActive = true;
        }
    }

    /**
     * Configure D3 simulation forces
     */
    private configureSimulation(nodes: EnhancedNode[], links: EnhancedLink[]): void {
        console.log(`[UniversalGraphManager] configureSimulation called - isInSettlementPhase: ${this.isInSettlementPhase}`);
        
        this.simulation.nodes(asD3Nodes(nodes));
        
        const linkForce = this.simulation.force('link') as d3.ForceLink<any, any>;
        if (linkForce && links.length > 0) {
            linkForce.links(asD3Links(links));
        }

        if (this.isInSettlementPhase) {
            console.log('[UniversalGraphManager] In settlement phase - skipping standard force configuration');
            // Settlement phase uses configureSettlementForces()
            return;
        }

        if (this.enableSingleNodeMode) {
            // Single-node mode: lightweight forces during drop
            this.simulation.force('collision', d3.forceCollide()
                .radius((d: any) => (d as EnhancedNode).radius + 50)
                .strength(0.7)
                .iterations(2)
            );

            this.simulation.force('charge', d3.forceManyBody()
                .strength(-150)
                .distanceMin(30)
                .distanceMax(600)
                .theta(0.9)
            );

            this.simulation.force('centerX', d3.forceX(0).strength(0.01));
            this.simulation.force('centerY', d3.forceY(0).strength(0.01));

            if (links.length > 0) {
                this.simulation.force('link', d3.forceLink()
                    .id((d: any) => (d as EnhancedNode).id)
                    .strength(0.03)
                    .distance(120)
                );
            }

            this.simulation
                .velocityDecay(0.5)
                .alphaDecay(0.15)
                .alphaMin(0.02)
                .alphaTarget(0);
        } else {
            // Batch mode: stronger forces for vote ordering
            this.simulation.force('collision', d3.forceCollide()
                .radius((d: any) => (d as EnhancedNode).radius + 80)
                .strength(0.95)
                .iterations(6)
            );

            this.simulation.force('charge', d3.forceManyBody()
                .strength((d: any) => {
                    const node = d as EnhancedNode;
                    const baseRepulsion = -350;
                    const sizeMultiplier = (node.radius / 100) * 50;
                    return baseRepulsion - sizeMultiplier;
                })
                .distanceMin(60)
                .distanceMax(1200)
                .theta(0.7)
            );

            this.simulation.force('centerX', d3.forceX(0)
                .strength((d: any) => {
                    const node = d as EnhancedNode;
                    const netVotes = (node as any).netVotes || 0;
                    const voteRank = (node as any).voteRank || 0;
                    
                    const baseAttraction = 0.05;
                    const voteBonus = Math.max(0, netVotes) * 0.015;
                    const rankPenalty = voteRank * 0.003;
                    
                    return Math.min(0.25, baseAttraction + voteBonus - rankPenalty);
                })
            );

            this.simulation.force('centerY', d3.forceY(0)
                .strength((d: any) => {
                    const node = d as EnhancedNode;
                    const netVotes = (node as any).netVotes || 0;
                    const voteRank = (node as any).voteRank || 0;
                    
                    const baseAttraction = 0.05;
                    const voteBonus = Math.max(0, netVotes) * 0.015;
                    const rankPenalty = voteRank * 0.003;
                    
                    return Math.min(0.25, baseAttraction + voteBonus - rankPenalty);
                })
            );

            if (links.length > 0) {
                this.simulation.force('link', d3.forceLink()
                    .id((d: any) => (d as EnhancedNode).id)
                    .strength(0.08)
                    .distance((l: any) => {
                        const link = l as EnhancedLink;
                        const sourceNode = nodes.find(n => n.id === link.source);
                        const targetNode = nodes.find(n => n.id === link.target);
                        
                        if (!sourceNode || !targetNode) return 160;
                        return sourceNode.radius + targetNode.radius + 160;
                    })
                );
            }

            this.simulation
                .velocityDecay(0.12)
                .alphaDecay(0.0015)
                .alphaMin(0.00003)
                .alphaTarget(0);
        }
    }

    /**
     * Sort nodes by net votes (highest first)
     */
    private sortNodesByVotes(nodes: GraphNode[]): GraphNode[] {
        return [...nodes].sort((a, b) => {
            const votesA = this.getNodeVotes(a);
            const votesB = this.getNodeVotes(b);
            return votesB - votesA;
        });
    }

    /**
     * Get net votes for a node
     */
    private getNodeVotes(node: GraphNode): number {
        if (node.type === 'statement' || node.type === 'openquestion') {
            const votes = node.metadata?.votes as any;
            if (votes) {
                const positiveVotes = getNeo4jNumber(votes.positive);
                const negativeVotes = getNeo4jNumber(votes.negative);
                return positiveVotes - negativeVotes;
            }
        }
        return 0;
    }

    /**
     * Transform GraphNodes to EnhancedNodes
     */
    private transformNodes(nodes: GraphNode[]): EnhancedNode[] {
        return nodes.map(node => {
            const netVotes = this.getNodeVotes(node);
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
     * Update node mode
     */
    public updateNodeMode(nodeId: string, mode: NodeMode): void {
        const currentNodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const nodeIndex = currentNodes.findIndex(n => n.id === nodeId);
        
        if (nodeIndex === -1) return;
        
        const node = currentNodes[nodeIndex];
        if (node.mode === mode) return;
        
        this.simulation.alpha(0).alphaTarget(0);
        this.clearNodeRadiusCache(nodeId);
        
        const newRadius = this.getNodeRadius({
            ...node,
            mode: mode
        });
        
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
        
        const updatedNodes = [...currentNodes];
        updatedNodes[nodeIndex] = updatedNode;
        
        this.simulation.nodes(updatedNodes);
        this.nodesStore.set(updatedNodes);
        
        if (node.group === 'central' || node.fixed) {
            this.centerNode(updatedNode);
        }
        
        this.simulation.alpha(0.1).restart();
        this.simulationActive = true;
    }

    /**
     * Update node visibility
     */
    public updateNodeVisibility(nodeId: string, isHidden: boolean, hiddenReason: 'community' | 'user' = 'user'): void {
        const currentNodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const nodeIndex = currentNodes.findIndex(n => n.id === nodeId);
        
        if (nodeIndex === -1) return;
        
        const oldNode = currentNodes[nodeIndex];
        if (oldNode.isHidden === isHidden) return;
        
        this.clearNodeRadiusCache(nodeId);
        
        let updatedMode = oldNode.mode;
        if (oldNode.isHidden && !isHidden) {
            updatedMode = 'preview';
        }
        
        const newRadius = this.getNodeRadius({
            ...oldNode,
            mode: updatedMode,
            isHidden: isHidden
        });
        
        const updatedNode: EnhancedNode = {
            ...oldNode,
            isHidden: isHidden,
            hiddenReason: hiddenReason,
            mode: updatedMode,
            radius: newRadius,
            expanded: updatedMode === 'detail'
        };
        
        const updatedNodes = [...currentNodes];
        updatedNodes[nodeIndex] = updatedNode;
        
        this.simulation.nodes(updatedNodes);
        this.nodesStore.set(updatedNodes);
        
        this.simulation.alpha(0.2).restart();
        this.simulationActive = true;
    }

    /**
     * Apply visibility preferences
     */
    public applyVisibilityPreferences(preferences: Record<string, boolean>): void {
        if (Object.keys(preferences).length === 0) return;
        
        const currentNodes = this.simulation.nodes() as unknown as EnhancedNode[];
        if (!currentNodes || currentNodes.length === 0) return;
        
        let changedNodeCount = 0;
        const updatedNodes = [...currentNodes];
        
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
                        radius: this.getNodeRadius({
                            ...node,
                            isHidden: newHiddenState
                        })
                    };
                    changedNodeCount++;
                }
            }
        });
        
        if (changedNodeCount > 0) {
            this.simulation.nodes(updatedNodes);
            this.nodesStore.set(updatedNodes);
            this.simulation.alpha(0.1).restart();
            this.simulationActive = true;
        }
    }

    /**
     * Force tick updates
     */
    public forceTick(ticks: number = 1): void {
        this.simulation.alpha(0).alphaTarget(0);
        
        for (let i = 0; i < ticks; i++) {
            this.simulation.tick();
        }
        
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        this.nodesStore.set([...nodes]);
    }

    /**
     * Stop simulation and cleanup
     */
    public stop(): void {
        this.stopSimulation();
        this.clearCaches();
        this.clearAllTimers();
    }

    /**
     * Get performance metrics
     */
    public getPerformanceMetrics() {
        return { ...this.performanceMetrics };
    }

    /**
     * Get batch debug info
     */
    public getBatchDebugInfo(): any {
        const baseInfo = {
            layoutType: 'vote_based_with_d3_radial',
            phase: '2.7',
            batchRenderingEnabled: this.isBatchRenderingEnabled,
            sequentialRenderingEnabled: this.isSequentialRenderingEnabled,
            singleNodeMode: this.enableSingleNodeMode,
            renderedNodeCount: this.performanceMetrics.renderedNodeCount,
            totalNodeCount: this.performanceMetrics.totalNodeCount,
            performanceMetrics: this.getPerformanceMetrics()
        };

        if (this.enableSingleNodeMode) {
            return {
                ...baseInfo,
                currentNodeIndex: this.currentNodeIndex,
                maxNodesToRender: this.singleNodeConfig.maxNodesToRender,
                nodeDelay: this.singleNodeConfig.nodeDelay,
                distanceIncrement: this.singleNodeConfig.distanceIncrement,
                baseDistance: this.singleNodeConfig.baseDistance,
                guaranteedVoteOrdering: true,
                estimatedTotalTime: `${this.singleNodeConfig.maxNodesToRender * this.singleNodeConfig.nodeDelay}ms`,
                d3Settlement: true,
                message: 'Single-node sequential with D3 radial settlement phase'
            };
        } else {
            return {
                ...baseInfo,
                maxBatches: this.maxBatchesToRender,
                currentBatch: this.currentBatchNumber,
                delayBetweenBatches: BATCH_RENDERING.DELAY_BETWEEN_BATCHES,
                pathBlockingPrevention: true,
                d3Settlement: true,
                estimatedTotalTime: `${this.maxBatchesToRender * BATCH_RENDERING.DELAY_BETWEEN_BATCHES}ms`,
                message: 'Enhanced batch rendering with D3 radial settlement'
            };
        }
    }

    // Private helper methods

    private stopSimulation(): void {
        if (!this.simulationActive) return;
        
        this.simulation.stop();
        this.simulation.alpha(0).alphaTarget(0);
        
        const nodes = this.simulation.nodes();
        nodes.forEach((node: any) => {
            node.vx = 0;
            node.vy = 0;
        });
        
        this.simulationActive = false;
    }

    private clearAllTimers(): void {
        if (this.batchRenderTimer) {
            clearTimeout(this.batchRenderTimer);
            this.batchRenderTimer = null;
        }
        
        if (this.singleNodeTimer) {
            clearTimeout(this.singleNodeTimer);
            this.singleNodeTimer = null;
        }
    }

    private updatePerformanceMetrics(links: GraphLink[]): void {
        let originalCount = 0;
        let consolidatedCount = 0;
        
        links.forEach(link => {
            consolidatedCount++;
            
            if (link.type === 'shared_keyword' && link.metadata?.consolidatedKeywords) {
                originalCount += (link.metadata.consolidatedKeywords as ConsolidatedKeywordMetadata).relationCount;
            } else {
                originalCount++;
            }
        });
        
        this.performanceMetrics = {
            ...this.performanceMetrics,
            originalRelationshipCount: originalCount,
            consolidatedRelationshipCount: consolidatedCount,
            consolidationRatio: originalCount > 0 ? originalCount / consolidatedCount : 1.0,
            lastUpdateTime: Date.now(),
            renderTime: 0
        };
    }

    private createRenderableNodes(nodes: EnhancedNode[]): RenderableNode[] {
        // Log occasionally to debug
        if (Math.random() < 0.01) {
            console.log('[UniversalGraphManager] Creating renderable nodes, sample:', {
                nodeId: nodes[0]?.id,
                x: nodes[0]?.x,
                y: nodes[0]?.y
            });
        }
        
        return nodes.map(node => {
            const radius = node.radius;
            const x = node.x ?? 0;
            const y = node.y ?? 0;
            const svgTransform = coordinateSystem.createSVGTransform(x, y);
            
            // Debug log for first few nodes during settlement
            if (this.isInSettlementPhase && node.type === 'statement' && Math.random() < 0.05) {
                console.log(`[UniversalGraphManager] RenderableNode ${node.id}: pos(${x.toFixed(2)}, ${y.toFixed(2)}) transform: ${svgTransform}`);
            }
            
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

    private centerNode(node: EnhancedNode): void {
        node.x = 0;
        node.y = 0;
        node.fx = 0;
        node.fy = 0;
        node.vx = 0;
        node.vy = 0;
    }

    private enforceNavigationPosition(node: EnhancedNode): void {
        if (node.fx !== null && node.fx !== undefined) {
            node.x = node.fx;
        }
        if (node.fy !== null && node.fy !== undefined) {
            node.y = node.fy;
        }
        node.vx = 0;
        node.vy = 0;
    }

    private calculateLinkPath(source: EnhancedNode, target: EnhancedNode, link?: EnhancedLink): string {
        const sourceX = source.x ?? 0;
        const sourceY = source.y ?? 0;
        const targetX = target.x ?? 0;
        const targetY = target.y ?? 0;
        
        const linkInfo = link ? `${link.type}-${link.metadata?.isConsolidated ? 'consolidated' : 'single'}` : 'default';
        const cacheKey = `${source.id}-${target.id}-${linkInfo}-${sourceX.toFixed(1)}-${sourceY.toFixed(1)}-${targetX.toFixed(1)}-${targetY.toFixed(1)}`;
        
        if (this.linkPathCache.has(cacheKey)) {
            return this.linkPathCache.get(cacheKey)!.path;
        }
        
        if (sourceX === targetX && sourceY === targetY) return '';
        
        const dx = targetX - sourceX;
        const dy = targetY - sourceY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const unitX = dx / distance;
        const unitY = dy / distance;
        
        const sourceRadius = source.radius * 0.95;
        const targetRadius = target.radius * 0.95;
        
        const startX = sourceX + (unitX * sourceRadius);
        const startY = sourceY + (unitY * sourceRadius);
        const endX = targetX - (unitX * targetRadius);
        const endY = targetY - (unitY * targetRadius);
        
        const path = `M${startX},${startY}L${endX},${endY}`;
        
        this.linkPathCache.set(cacheKey, {
            path,
            metadata: {
                linkType: link?.type || 'unknown',
                isConsolidated: link?.metadata?.isConsolidated || false
            }
        });
        
        if (this.linkPathCache.size > 500) {
            const firstKey = this.linkPathCache.keys().next().value;
            if (firstKey) this.linkPathCache.delete(firstKey);
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
    }

    private clearNodeRadiusCache(nodeId: string): void {
        for (const key of Array.from(this.nodeRadiusCache.keys())) {
            if (key.startsWith(`${nodeId}-`)) {
                this.nodeRadiusCache.delete(key);
            }
        }
    }
}