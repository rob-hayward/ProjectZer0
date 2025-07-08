// src/lib/services/graph/UniversalGraphManager.ts - PHASE 3.0: Direct D3 Force Implementation
// Minimal surgical changes to enable natural force-directed layout while preserving vote ordering

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
 * PHASE 3.0: UniversalGraphManager with working D3 force physics
 * Key changes:
 * 1. Force reactive updates during settlement phase
 * 2. Direct D3 DOM manipulation as fallback
 * 3. Proper force configuration for natural spacing
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
    
    // PHASE 3.0: Enhanced settlement tracking
    private isInSettlementPhase = false;
    private settlementTickCounter = 0;
    private lastDOMUpdateTime = 0;
    
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
        layoutType: 'vote_based_with_natural_forces' as const
    };

    // Public derived stores
    public readonly renderableNodes: Readable<RenderableNode[]>;
    public readonly renderableLinks: Readable<RenderableLink[]>;
    
    // PHASE 3.0: Force update counter - properly utilized
    private forceUpdateCounter = writable(0);
    private forceUpdateInterval: number | null = null;

    constructor() {
        this.managerId = `universal-phase3-${Math.random().toString(36).substring(2, 9)}`;
        this.simulation = this.initializeSimulation();
    
        // PHASE 3.0: Include forceUpdateCounter in all derived stores
        this.renderableNodes = derived(
            [this.nodesStore, this.forceUpdateCounter], 
            ([nodes, updateCount]) => {
                // Force fresh computation on each update
                return this.createRenderableNodes(nodes);
            }
        );
        
        this.renderableLinks = derived(
            [this.nodesStore, this.linksStore, this.forceUpdateCounter], 
            ([nodes, links, updateCount]) => {
                return this.createRenderableLinks(nodes, links);
            }
        );
        
        console.log('[UniversalGraphManager] Phase 3.0 - Natural force-directed layout with vote ordering');
    }

   /**
     * Initialize D3 simulation - FIXED version
     */
    private initializeSimulation(): d3.Simulation<any, any> {
        const simulation = d3.forceSimulation()
            .velocityDecay(0.4)
            .alphaDecay(0.02)
            .alphaMin(0.001)
            .alphaTarget(0);

        let tickCount = 0;
        let lastTickTime = Date.now();
        
        simulation.on('tick', () => {
            tickCount++;
            const now = Date.now();
            const nodes = simulation.nodes() as unknown as EnhancedNode[];
            
            // Enforce fixed positions for system nodes
            nodes.forEach(node => {
                if (node.fixed || node.group === 'central') {
                    this.centerNode(node);
                } else if (node.type === 'navigation') {
                    this.enforceNavigationPosition(node);
                }
            });
            
            // PHASE 3.0: Enhanced update mechanism during settlement
            if (this.isInSettlementPhase) {
                this.settlementTickCounter++;
                
                // Enhanced debugging during settlement
                if (this.settlementTickCounter % 20 === 0) {
                    // CRITICAL FIX: Get ALL nodes, not just the filtered ones
                    const allNodes = simulation.nodes() as EnhancedNode[];
                    
                    // Debug what types we have
                    const nodeTypes = new Set(allNodes.map(n => n.type));
                    console.log('[Debug] Node types in simulation:', Array.from(nodeTypes));
                    
                    const contentNodes = allNodes.filter(n => 
                        n.type === 'statement' || n.type === 'openquestion'
                    );
                    
                    console.log('[Debug] Content nodes found:', contentNodes.length);
                    
                    const movingNodes = contentNodes.filter(n => 
                        Math.abs(n.vx ?? 0) > 0.1 || Math.abs(n.vy ?? 0) > 0.1
                    );
                    
                    const stuckNodes = contentNodes.filter(n => 
                        Math.abs(n.vx ?? 0) < 0.1 && Math.abs(n.vy ?? 0) < 0.1
                    );
                    
                    const avgVelocity = movingNodes.reduce((sum, n) => {
                        const v = Math.sqrt((n.vx ?? 0) ** 2 + (n.vy ?? 0) ** 2);
                        return sum + v;
                    }, 0) / (movingNodes.length || 1);
                    
                    const avgDistance = contentNodes.reduce((sum, n) => {
                        const d = Math.sqrt((n.x ?? 0) ** 2 + (n.y ?? 0) ** 2);
                        return sum + d;
                    }, 0) / (contentNodes.length || 1);
                    
                    console.log(`[Settlement] Tick ${this.settlementTickCounter}:`, {
                        alpha: simulation.alpha().toFixed(4),
                        movingNodes: `${movingNodes.length}/${contentNodes.length}`,
                        stuckNodes: stuckNodes.length,
                        avgVelocity: avgVelocity.toFixed(2),
                        avgDistance: avgDistance.toFixed(1),
                        forces: this.getActiveForces()
                    });
                    
                    // Sample node details
                    if (this.settlementTickCounter % 100 === 0 && contentNodes.length > 0) {
                        const sampleNode = contentNodes[0];
                        console.log(`[Settlement] Sample node detail:`, {
                            id: sampleNode.id.substring(0, 8),
                            type: sampleNode.type,
                            position: `(${sampleNode.x?.toFixed(1)}, ${sampleNode.y?.toFixed(1)})`,
                            velocity: `(${sampleNode.vx?.toFixed(2)}, ${sampleNode.vy?.toFixed(2)})`,
                            fixed: `fx=${sampleNode.fx}, fy=${sampleNode.fy}`,
                            voteRank: (sampleNode as any).voteRank
                        });
                    }
                }
                
                // Update nodes store
                this.nodesStore.set([...nodes]);
                
                // Force reactive update every few ticks
                if (this.settlementTickCounter % 3 === 0) {
                    this.forceUpdateCounter.update(n => n + 1);
                }
                
                // Direct D3 DOM update as backup (every 10 ticks)
                if (this.settlementTickCounter % 10 === 0) {
                    this.updateDOMDirectly(nodes);
                }
                
                // Kick stuck nodes periodically
                if (this.settlementTickCounter % 50 === 0) {
                    const contentNodes = nodes.filter(n => 
                        n.type === 'statement' || n.type === 'openquestion'
                    );
                    
                    const stuckNodes = contentNodes.filter(n => 
                        Math.abs(n.vx ?? 0) < 0.5 && 
                        Math.abs(n.vy ?? 0) < 0.5
                    );
                    
                    if (stuckNodes.length > contentNodes.length * 0.8) {
                        console.log(`[Settlement] ${stuckNodes.length}/${contentNodes.length} nodes stuck - may be settled`);
                    }
                }
                
                // STOP SIMULATION if nodes have settled
                if (this.settlementTickCounter > 200) {
                    const contentNodes = nodes.filter(n => 
                        n.type === 'statement' || n.type === 'openquestion'
                    );
                    
                    const totalMovement = contentNodes.reduce((sum, n) => {
                        return sum + Math.abs(n.vx ?? 0) + Math.abs(n.vy ?? 0);
                    }, 0);
                    
                    const avgMovement = totalMovement / (contentNodes.length || 1);
                    
                // CRITICAL: Stop simulation if nodes are stable
                if (avgMovement < 0.5 && this.simulation.alpha() < 0.01) {
                    console.log(`[Settlement] Nodes settled! Avg movement: ${avgMovement.toFixed(3)}, stopping simulation`);
                    
                    // CRITICAL: Stop all updates BEFORE stopping simulation
                    this.isInSettlementPhase = false;
                    
                    // Clear any update intervals
                    if (this.forceUpdateInterval) {
                        clearInterval(this.forceUpdateInterval);
                        this.forceUpdateInterval = null;
                    }
                    
                    // Stop the simulation
                    this.simulation.stop();
                    
                    // Final positions update
                    const finalNodes = [...nodes];
                    this.nodesStore.set(finalNodes);
                    
                    // One final force update
                    this.forceUpdateCounter.update(n => n + 1);
                    
                    // CRITICAL: Prevent any further updates
                    this.simulationActive = false;
                    
                    console.log('[Settlement] All updates stopped, positions locked');
                }
                }
            } else {
                // Normal update during drop phase
                if (tickCount % 100 === 0) {
                    console.log(`[UniversalGraphManager] Drop phase - Tick #${tickCount}, alpha: ${simulation.alpha().toFixed(4)}`);
                }
                this.nodesStore.set([...nodes]);
            }
        });

        simulation.on('end', () => {
            if (this.isInSettlementPhase) {
                console.log(`[UniversalGraphManager] Settlement phase reached minimum alpha after ${this.settlementTickCounter} ticks`);
                
                // Final statistics
                const nodes = simulation.nodes() as unknown as EnhancedNode[];
                const contentNodes = nodes.filter(n => n.type === 'statement' || n.type === 'openquestion');
                
                const distances = contentNodes.map(n => Math.sqrt((n.x ?? 0) ** 2 + (n.y ?? 0) ** 2));
                const minDist = Math.min(...distances);
                const maxDist = Math.max(...distances);
                const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
                
                console.log('[Settlement] Final statistics:', {
                    nodes: contentNodes.length,
                    distanceRange: `${minDist.toFixed(1)} - ${maxDist.toFixed(1)}`,
                    avgDistance: avgDist.toFixed(1),
                    finalAlpha: simulation.alpha()
                });
                
                this.isInSettlementPhase = false;
                this.settlementTickCounter = 0;
                
                // Final update
                this.forceUpdateCounter.update(n => n + 1);
                
                // Clear the update interval
                if (this.forceUpdateInterval) {
                    clearInterval(this.forceUpdateInterval);
                    this.forceUpdateInterval = null;
                }
            } else {
                const mode = this.enableSingleNodeMode ? 'single-node' : 'batch';
                console.log(`[UniversalGraphManager] Drop phase complete (${mode} mode)`);
                
                // CRITICAL: Don't let the drop phase end prevent settlement
                if (this.currentNodeIndex >= this.sortedContentNodes.length || 
                    this.currentNodeIndex >= this.singleNodeConfig.maxNodesToRender) {
                    console.log('[UniversalGraphManager] Drop phase ended at max nodes - forcing settlement start');
                    setTimeout(() => {
                        this.startSettlementPhase();
                    }, 100);
                }
            }
        });
        
        return simulation;
    }

    /**
     * PHASE 3.0: Direct DOM update via D3 selection
     */
    private updateDOMDirectly(nodes: EnhancedNode[]): void {
        // CRITICAL: Don't update if simulation is stopped
        if (!this.simulationActive || !this.isInSettlementPhase) {
            return;
        }
        
        if (typeof document === 'undefined') return;
        
        const now = Date.now();
        if (now - this.lastDOMUpdateTime < 16) return;
        this.lastDOMUpdateTime = now;
        
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
     * PHASE 3.0: Get list of active forces for debugging
     */
    private getActiveForces(): string[] {
        const forces: string[] = []; // Add explicit type
        const forceNames = ['charge', 'collision', 'voteRadial', 'link', 'centerX', 'centerY', 'gentle-center'];
        forceNames.forEach(name => {
            if (this.simulation.force(name)) {
                forces.push(name);
            }
        });
        return forces;
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
        
        this.enableSingleNodeMode = singleNodeMode !== undefined ? 
            singleNodeMode : BATCH_RENDERING.ENABLE_SINGLE_NODE_MODE;
            
        this.maxBatchesToRender = maxBatches;
        
        console.log('[UniversalGraphManager] Batch rendering configuration:', {
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
            
            // CRITICAL: Make sure this actually fires
            const settlementDelay = 300;
            console.log(`[UniversalGraphManager] Setting timeout for settlement in ${settlementDelay}ms`);
            
            setTimeout(() => {
                console.log('[UniversalGraphManager] Settlement timeout fired! Calling startSettlementPhase()');
                this.startSettlementPhase();
            }, settlementDelay);
            return;
        }
        
        const currentContentNodes = this.sortedContentNodes.slice(0, this.currentNodeIndex + 1);
        const currentNodes = [...systemNodes, ...currentContentNodes];
        const enhancedNodes = this.transformNodes(currentNodes);
        
        // Position nodes using guaranteed vote ordering
        this.calculateSingleNodePositions(enhancedNodes);
        
        // Pin newly added node during drop
        const newNode = enhancedNodes[enhancedNodes.length - 1];
        if (newNode.type === 'statement' || newNode.type === 'openquestion') {
            newNode.fx = newNode.x;
            newNode.fy = newNode.y;
            console.log(`[UniversalGraphManager] Pinned node ${this.currentNodeIndex + 1}/${this.sortedContentNodes.length} at (${newNode.fx?.toFixed(1)}, ${newNode.fy?.toFixed(1)})`);
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
        
        console.log(`[UniversalGraphManager] Rendered node ${this.currentNodeIndex + 1}/${this.sortedContentNodes.length}: ${nodeVotes} votes, ${currentContentNodes.length} total content nodes`);
        
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
            
            // CRITICAL: Ensure settlement actually starts
            const settlementTimer = setTimeout(() => {
                console.log('[UniversalGraphManager] Final settlement timeout fired!');
                this.startSettlementPhase();
            }, 300);
            
            // Store the timer reference to prevent garbage collection
            (this as any).settlementTimer = settlementTimer;
        }
    }

    /**
     * PHASE 3.0: Start settlement phase with natural forces
     */
    private startSettlementPhase(): void {
        console.log('[UniversalGraphManager] 🚀 SETTLEMENT PHASE STARTING - Natural force-directed layout!');
        this.isInSettlementPhase = true;
        this.settlementTickCounter = 0;
        
        const nodes = this.simulation.nodes() as EnhancedNode[];
        
        // Unpin ALL content nodes
        nodes.forEach(node => {
            if (node.type === 'statement' || node.type === 'openquestion') {
                node.fx = null;
                node.fy = null;
                
                // Small initial velocity
                const angle = Math.atan2(node.y ?? 0, node.x ?? 0) + (Math.random() - 0.5) * 0.3;
                const speed = 10;
                node.vx = Math.cos(angle) * speed;
                node.vy = Math.sin(angle) * speed;
            }
        });
        
        // Configure natural forces
        this.configureNaturalForces();
        
        // Faster simulation for quicker settling
        this.simulation
            .alpha(0.5) // Lower initial energy
            .alphaDecay(0.03) // Faster decay
            .alphaMin(0.001)
            .alphaTarget(0)
            .restart();
        
        console.log('[UniversalGraphManager] Settlement phase configured for fast settling');
    }

    /**
     * PHASE 3.0: Configure natural force-directed layout
     */
    private configureNaturalForces(): void {
        const nodes = this.simulation.nodes() as EnhancedNode[];
        
        // Clear ALL forces first
        this.simulation.force('radial', null);
        this.simulation.force('voteRadial', null);
        this.simulation.force('centerX', null);
        this.simulation.force('centerY', null);
        this.simulation.force('link', null);
        this.simulation.force('charge', null);
        this.simulation.force('collision', null);
        
        // 1. Moderate charge force for natural repulsion (not too strong!)
        this.simulation.force('charge', d3.forceManyBody()
            .strength(-400) // Reduced from -800
            .distanceMin(80) // Reduced from 100
            .distanceMax(1000) // Reduced from 1500
            .theta(0.9)
        );
        
        // 2. Collision force with reasonable radius
        this.simulation.force('collision', d3.forceCollide()
            .radius((d: any) => {
                const node = d as EnhancedNode;
                return node.radius + 60; // Reduced from 80
            })
            .strength(0.8) // Reduced from 1.0
            .iterations(3) // Reduced from 5
        );
        
        // 3. Gentle center force to prevent explosion
        this.simulation.force('centerX', d3.forceX(0).strength(0.02));
        this.simulation.force('centerY', d3.forceY(0).strength(0.02));
        
        // 4. Soft radial constraint based on votes (very gentle)
        this.simulation.force('softRadial', (alpha) => {
            nodes.forEach(node => {
                if (node.type === 'statement' || node.type === 'openquestion') {
                    const targetDistance = (node as any).voteBasedDistance || 400;
                    const x = node.x ?? 0;
                    const y = node.y ?? 0;
                    const currentDistance = Math.sqrt(x * x + y * y);
                    
                    if (currentDistance > 0) {
                        // Very gentle force toward target distance
                        const distanceDiff = targetDistance - currentDistance;
                        const force = distanceDiff * 0.001 * alpha; // Very weak
                        
                        const fx = (x / currentDistance) * force;
                        const fy = (y / currentDistance) * force;
                        
                        if (node.vx !== null && node.vx !== undefined) node.vx += fx;
                        if (node.vy !== null && node.vy !== undefined) node.vy += fy;
                    }
                }
            });
        });
        
        // 5. Angular spreading force (to break out of spiral)
        this.simulation.force('angular', (alpha) => {
            const angleMap = new Map<number, EnhancedNode[]>();
            
            // Group nodes by similar angles
            nodes.forEach(node => {
                if (node.type === 'statement' || node.type === 'openquestion') {
                    const angle = Math.atan2(node.y ?? 0, node.x ?? 0);
                    const angleKey = Math.round(angle * 8) / 8; // Round to nearest eighth radian
                    
                    if (!angleMap.has(angleKey)) {
                        angleMap.set(angleKey, []);
                    }
                    angleMap.get(angleKey)!.push(node);
                }
            });
            
            // Apply gentle repulsion between nodes at similar angles
            angleMap.forEach(nodesAtAngle => {
                if (nodesAtAngle.length > 1) {
                    for (let i = 0; i < nodesAtAngle.length; i++) {
                        for (let j = i + 1; j < nodesAtAngle.length; j++) {
                            const nodeA = nodesAtAngle[i];
                            const nodeB = nodesAtAngle[j];
                            
                            const dx = (nodeB.x ?? 0) - (nodeA.x ?? 0);
                            const dy = (nodeB.y ?? 0) - (nodeA.y ?? 0);
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            
                            if (distance > 0 && distance < 200) {
                                const force = (200 - distance) * 0.005 * alpha; // Very gentle
                                const fx = (dx / distance) * force;
                                const fy = (dy / distance) * force;
                                
                                if (nodeA.vx !== null && nodeA.vx !== undefined) nodeA.vx -= fx;
                                if (nodeA.vy !== null && nodeA.vy !== undefined) nodeA.vy -= fy;
                                if (nodeB.vx !== null && nodeB.vx !== undefined) nodeB.vx += fx;
                                if (nodeB.vy !== null && nodeB.vy !== undefined) nodeB.vy += fy;
                            }
                        }
                    }
                }
            });
        });
        
        // Adjust simulation parameters for controlled settling
        this.simulation
            .velocityDecay(0.4)    // Moderate damping
            .alphaDecay(0.005)     // Moderate cooling
            .alphaMin(0.001);      // Run until settled
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
            
            // Smoother distance progression
            const targetDistance = this.singleNodeConfig.baseDistance + 
                                (Math.sqrt(index) * this.singleNodeConfig.distanceIncrement * 2);
            
            // Fibonacci spiral for better distribution
            const phi = (1 + Math.sqrt(5)) / 2; // Golden ratio
            const theta = 2 * Math.PI * index / phi;
            
            node.x = Math.cos(theta) * targetDistance;
            node.y = Math.sin(theta) * targetDistance;
            
            // Store data for forces
            (node as any).voteBasedDistance = targetDistance;
            (node as any).netVotes = netVotes;
            (node as any).voteRank = index;
            (node as any).initialAngle = theta;
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
        
        const enhancedSystemNodes = this.transformNodes(systemNodes);
        this.nodesStore.set(enhancedSystemNodes);
        this.linksStore.set([]);
        
        this.configureSimulation(enhancedSystemNodes, []);
        this.renderNextBatch();
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
            
            const goldenAngle = Math.PI * (3 - Math.sqrt(5));
            const angle = index * goldenAngle + (Math.random() - 0.5) * 0.3;
            
            node.x = Math.cos(angle) * targetDistance;
            node.y = Math.sin(angle) * targetDistance;
            
            (node as any).voteBasedDistance = targetDistance;
            (node as any).netVotes = netVotes;
            (node as any).voteRank = index;
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
     * Configure D3 simulation forces (for drop phase)
     */
    private configureSimulation(nodes: EnhancedNode[], links: EnhancedLink[]): void {
        if (this.isInSettlementPhase) {
            // Settlement phase uses configureNaturalForces()
            return;
        }

        this.simulation.nodes(asD3Nodes(nodes));
        
        const linkForce = this.simulation.force('link') as d3.ForceLink<any, any>;
        if (linkForce && links.length > 0) {
            linkForce.links(asD3Links(links));
        }

        // Minimal forces during drop phase
        this.simulation.force('collision', d3.forceCollide()
            .radius((d: any) => (d as EnhancedNode).radius + 30)
            .strength(0.5)
            .iterations(1)
        );

        this.simulation.force('charge', d3.forceManyBody()
            .strength(-100)
            .distanceMin(30)
            .distanceMax(400)
            .theta(0.9)
        );

        this.simulation.force('centerX', d3.forceX(0).strength(0.01));
        this.simulation.force('centerY', d3.forceY(0).strength(0.01));

        this.simulation
            .velocityDecay(0.6)
            .alphaDecay(0.1)
            .alphaMin(0.01)
           .alphaTarget(0);
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
       
       // Force update
       this.forceUpdateCounter.update(n => n + 1);
       
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
       
       // Force update
       this.forceUpdateCounter.update(n => n + 1);
       
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
           
           // Force update
           this.forceUpdateCounter.update(n => n + 1);
           
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
       
       // Force update
       this.forceUpdateCounter.update(n => n + 1);
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
       return {
           layoutType: 'vote_based_with_natural_forces',
           phase: '3.0',
           batchRenderingEnabled: this.isBatchRenderingEnabled,
           sequentialRenderingEnabled: this.isSequentialRenderingEnabled,
           singleNodeMode: this.enableSingleNodeMode,
           renderedNodeCount: this.performanceMetrics.renderedNodeCount,
           totalNodeCount: this.performanceMetrics.totalNodeCount,
           performanceMetrics: this.getPerformanceMetrics(),
           settlementPhase: this.isInSettlementPhase,
           settlementTicks: this.settlementTickCounter,
           message: 'Natural force-directed layout with vote ordering'
       };
   }

   /**
    * Create renderable nodes from enhanced nodes
    * PHASE 3.0: Force fresh transform computation
    */
   private createRenderableNodes(nodes: EnhancedNode[]): RenderableNode[] {
       return nodes.map(node => {
           const radius = node.radius;
           const x = node.x ?? 0;
           const y = node.y ?? 0;
           
           // PHASE 3.0: Always compute fresh transform, never cache during settlement
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

   // Private helper methods

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
       this.isInSettlementPhase = false;
       this.settlementTickCounter = 0;
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
        
        if (typeof window !== 'undefined' && this.forceUpdateInterval) {
            clearInterval(this.forceUpdateInterval);
            this.forceUpdateInterval = null;
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
           lastUpdateTime: Date.now()
       };
   }

   private calculateLinkPath(source: EnhancedNode, target: EnhancedNode, link?: EnhancedLink): string {
       const sourceX = source.x ?? 0;
       const sourceY = source.y ?? 0;
       const targetX = target.x ?? 0;
       const targetY = target.y ?? 0;
       
       // PHASE 3.0: Don't cache during settlement phase
       if (!this.isInSettlementPhase) {
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
       
       const sourceRadius = source.radius * 0.95;
       const targetRadius = target.radius * 0.95;
       
       const startX = sourceX + (unitX * sourceRadius);
       const startY = sourceY + (unitY * sourceRadius);
       const endX = targetX - (unitX * targetRadius);
       const endY = targetY - (unitY * targetRadius);
       
       const path = `M${startX},${startY}L${endX},${endY}`;
       
       // Only cache if not in settlement phase
       if (!this.isInSettlementPhase) {
           const linkInfo = link ? `${link.type}-${link.metadata?.isConsolidated ? 'consolidated' : 'single'}` : 'default';
           const cacheKey = `${source.id}-${target.id}-${linkInfo}-${sourceX.toFixed(1)}-${sourceY.toFixed(1)}-${targetX.toFixed(1)}-${targetY.toFixed(1)}`;
           
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