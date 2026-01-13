// src/lib/services/graph/universal/UniversalRenderingStrategy.ts
// Sequential and batch rendering orchestration for Universal Graph

import type { GraphData, GraphNode, GraphLink, EnhancedNode, EnhancedLink } from '$lib/types/graph/enhanced';
import { UNIVERSAL_LAYOUT } from './UniversalConstants';
import { UniversalPositioning } from './UniversalPositioning';

export interface RenderingCallbacks {
    onNodesReady: (nodes: EnhancedNode[], links: EnhancedLink[]) => void;
    onRenderComplete: () => void;
    onBatchUpdate?: (batchNumber: number, totalBatches: number) => void;
}

export interface RenderingConfig {
    enableBatchRendering: boolean;
    enableSingleNodeMode: boolean;
    maxBatchesToRender: number;
    sequential: boolean;
}

/**
 * Orchestrates sequential and batch rendering for Universal Graph
 */
export class UniversalRenderingStrategy {
    private positioning = new UniversalPositioning();
    private callbacks: RenderingCallbacks;
    
    // Rendering state
    private isBatchRenderingEnabled = false;
    private enableSingleNodeMode = false;
    private maxBatchesToRender: number = UNIVERSAL_LAYOUT.LIMITS.MAX_BATCHES;
    
    // Single-node rendering state
    private currentNodeIndex = 0;
    private sortedContentNodes: GraphNode[] = [];
    private singleNodeTimer: number | null = null;
    
    // Batch rendering state
    private currentBatchNumber = 0;
    private batchRenderTimer: number | null = null;
    
    // All node data
    private allNodeData: GraphData | null = null;
    private systemNodes: GraphNode[] = [];
    
    constructor(callbacks: RenderingCallbacks) {
        this.callbacks = callbacks;
    }
    
    /**
     * Configure rendering mode
     */
    public configure(config: RenderingConfig): void {
        this.isBatchRenderingEnabled = config.enableBatchRendering;
        this.enableSingleNodeMode = config.enableSingleNodeMode;
        this.maxBatchesToRender = config.maxBatchesToRender;
        
        // REDUCED: Only log when configuration actually changes significantly
        if (config.enableBatchRendering !== this.isBatchRenderingEnabled || 
            config.enableSingleNodeMode !== this.enableSingleNodeMode) {
            console.log('[RenderingStrategy] Configuration changed:', {
                batchRendering: config.enableBatchRendering,
                singleNodeMode: config.enableSingleNodeMode,
                maxBatches: config.maxBatchesToRender
            });
        }
    }
    
    /**
     * Start rendering process
     * UPDATED: Filter for all 5 content node types
     */
    public startRendering(
        data: GraphData,
        transformNodes: (nodes: GraphNode[]) => EnhancedNode[],
        transformLinks: (links: GraphLink[]) => EnhancedLink[]
    ): void {
        this.clearAllTimers();
        
        // Separate system and content nodes - UPDATED for all 5 types
        const contentNodes = data.nodes.filter(node => 
            node.type === 'statement' || node.type === 'openquestion' ||
            node.type === 'answer' || node.type === 'quantity' || node.type === 'evidence' || node.type === 'category' || node.type === 'definition' || node.type === 'word'
        );
        const systemNodes = data.nodes.filter(node => 
            node.type === 'navigation' || node.type === 'dashboard' || node.type === 'control'
        );
        
        this.systemNodes = systemNodes;
        
        if (contentNodes.length === 0) {
            // No content nodes, just render system nodes
            const enhancedNodes = transformNodes(data.nodes);
            const enhancedLinks = transformLinks(data.links || []);
            this.callbacks.onNodesReady(enhancedNodes, enhancedLinks);
            this.callbacks.onRenderComplete();
            return;
        }
        
        // Sort content nodes by votes
        this.sortedContentNodes = this.positioning.sortNodesByVotes(contentNodes);
        this.allNodeData = { 
            nodes: [...systemNodes, ...this.sortedContentNodes], 
            links: data.links || [] 
        };
        
        // Start with system nodes
        const enhancedSystemNodes = transformNodes(systemNodes);
        this.callbacks.onNodesReady(enhancedSystemNodes, []);
        
        // Choose rendering mode
        if (this.isBatchRenderingEnabled) {
            if (this.enableSingleNodeMode) {
                console.log(`[RenderingStrategy] Starting single-node rendering: ${contentNodes.length} content nodes`);
                this.currentNodeIndex = 0;
                this.renderNextSingleNode(transformNodes, transformLinks);
            } else {
                console.log(`[RenderingStrategy] Starting batch rendering: ${contentNodes.length} content nodes in ${this.maxBatchesToRender} batches`);
                this.currentBatchNumber = 0;
                this.renderNextBatch(transformNodes, transformLinks);
            }
        } else {
            // Standard rendering - all at once
            const enhancedNodes = transformNodes(data.nodes);
            const enhancedLinks = transformLinks(data.links || []);
            this.positioning.calculateBatchPositions(enhancedNodes, 0, data.nodes.length);
            this.callbacks.onNodesReady(enhancedNodes, enhancedLinks);
            this.callbacks.onRenderComplete();
        }
    }
    
    /**
     * Render next single node (sequential mode)
     * UPDATED: Filter for all 8 content node types
     */
    private renderNextSingleNode(
        transformNodes: (nodes: GraphNode[]) => EnhancedNode[],
        transformLinks: (links: GraphLink[]) => EnhancedLink[]
    ): void {
        if (!this.allNodeData) return;
        
        const shouldStop = this.currentNodeIndex >= this.sortedContentNodes.length || 
                          this.currentNodeIndex >= UNIVERSAL_LAYOUT.LIMITS.MAX_NODES_TO_RENDER;
        
        if (shouldStop) {
            console.log('[RenderingStrategy] Single-node rendering complete, all nodes rendered');
            this.callbacks.onRenderComplete();
            return;
        }
        
        // Get nodes up to current index
        const currentContentNodes = this.sortedContentNodes.slice(0, this.currentNodeIndex + 1);
        const currentNodes = [...this.systemNodes, ...currentContentNodes];
        const enhancedNodes = transformNodes(currentNodes);
        
        // Position nodes with global index for continuity
        this.positioning.calculateSingleNodePositions(enhancedNodes, 0);

        // DEBUG: Check positioning for new types
        const newNode = enhancedNodes[enhancedNodes.length - 1];
        if (newNode.type === 'word' || newNode.type === 'category' || newNode.type === 'definition') {
            console.log(`[RenderingStrategy] 🔍 New ${newNode.type} node positioned:`, {
                id: newNode.id.substring(0, 8),
                type: newNode.type,
                x: newNode.x,
                y: newNode.y,
                willBecome_fx: newNode.x,
                willBecome_fy: newNode.y
            });
        }
        
        // Pin newly added node during drop - UPDATED for all 8 types
        if (newNode.type === 'statement' || newNode.type === 'openquestion' ||
            newNode.type === 'answer' || newNode.type === 'quantity' || newNode.type === 'evidence' 
            || newNode.type === 'category' || newNode.type === 'definition' || newNode.type === 'word') {
            newNode.fx = newNode.x;
            newNode.fy = newNode.y;
            
            // REDUCED: Only log milestone nodes (every 10th node or high-vote nodes)
            const nodeVotes = (newNode as any).netVotes || 0;
            const isKeyNode = (this.currentNodeIndex + 1) % 10 === 0 || 
                             this.currentNodeIndex === 0 || 
                             this.currentNodeIndex === this.sortedContentNodes.length - 1 ||
                             nodeVotes > 50;
            
            if (isKeyNode) {
                console.log(`[RenderingStrategy] Node ${this.currentNodeIndex + 1}/${this.sortedContentNodes.length}: ${nodeVotes} votes at (${newNode.fx?.toFixed(1)}, ${newNode.fy?.toFixed(1)})`);
            }
        }
        
        // Get visible links
        const visibleLinks = this.getVisibleLinks(currentNodes, transformLinks);
        
        // Update callbacks
        this.callbacks.onNodesReady(enhancedNodes, visibleLinks);
        
        if (this.callbacks.onBatchUpdate) {
            this.callbacks.onBatchUpdate(
                Math.ceil((this.currentNodeIndex + 1) / UNIVERSAL_LAYOUT.LIMITS.NODES_PER_BATCH),
                Math.ceil(this.sortedContentNodes.length / UNIVERSAL_LAYOUT.LIMITS.NODES_PER_BATCH)
            );
        }
        
        this.currentNodeIndex++;
        
        // Schedule next node
        const shouldContinue = this.currentNodeIndex < this.sortedContentNodes.length && 
                              this.currentNodeIndex < UNIVERSAL_LAYOUT.LIMITS.MAX_NODES_TO_RENDER;
        
        if (shouldContinue) {
            this.singleNodeTimer = window.setTimeout(() => {
                this.renderNextSingleNode(transformNodes, transformLinks);
            }, UNIVERSAL_LAYOUT.TIMING.NODE_RENDER_DELAY);
        } else {
            // Final completion - only signal completion, don't schedule anything else
            console.log('[RenderingStrategy] Single node rendering complete, scheduling completion callback');
            setTimeout(() => {
                this.callbacks.onRenderComplete();
            }, UNIVERSAL_LAYOUT.TIMING.SETTLEMENT_START_DELAY);
        }
    }
    
    /**
     * Render next batch
     */
    private renderNextBatch(
        transformNodes: (nodes: GraphNode[]) => EnhancedNode[],
        transformLinks: (links: GraphLink[]) => EnhancedLink[]
    ): void {
        if (!this.allNodeData) return;
        
        this.currentBatchNumber++;
        
        if (this.currentBatchNumber > this.maxBatchesToRender) {
            console.log('[RenderingStrategy] Batch rendering complete');
            this.callbacks.onRenderComplete();
            return;
        }
        
        // Calculate nodes for this batch
        const nodesPerBatch = UNIVERSAL_LAYOUT.LIMITS.NODES_PER_BATCH;
        const totalContentNodes = this.currentBatchNumber * nodesPerBatch;
        const currentContentNodes = this.sortedContentNodes.slice(0, totalContentNodes);
        
        const currentNodes = [...this.systemNodes, ...currentContentNodes];
        const enhancedNodes = transformNodes(currentNodes);
        
        // Position with batch continuity
        this.positioning.calculateBatchPositions(
            enhancedNodes, 
            this.currentBatchNumber, 
            nodesPerBatch
        );
        
        // Get visible links
        const visibleLinks = this.getVisibleLinks(currentNodes, transformLinks);
        
        // Update callbacks
        this.callbacks.onNodesReady(enhancedNodes, visibleLinks);
        
        // REDUCED: Only log batch completion, not individual progress
        console.log(`[RenderingStrategy] Batch ${this.currentBatchNumber}/${this.maxBatchesToRender} complete: ${currentContentNodes.length} content nodes`);
        
        if (this.callbacks.onBatchUpdate) {
            this.callbacks.onBatchUpdate(this.currentBatchNumber, this.maxBatchesToRender);
        }
        
        // Schedule next batch if needed
        if (this.currentBatchNumber < this.maxBatchesToRender && 
            currentContentNodes.length < this.sortedContentNodes.length) {
            this.batchRenderTimer = window.setTimeout(() => {
                this.renderNextBatch(transformNodes, transformLinks);
            }, UNIVERSAL_LAYOUT.TIMING.BATCH_RENDER_DELAY);
        } else {
            // Final completion
            setTimeout(() => {
                this.callbacks.onRenderComplete();
            }, UNIVERSAL_LAYOUT.TIMING.SETTLEMENT_START_DELAY);
        }
    }
    
    /**
     * Get visible links for current nodes
     */
    private getVisibleLinks(
        currentNodes: GraphNode[],
        transformLinks: (links: GraphLink[]) => EnhancedLink[]
    ): EnhancedLink[] {
        if (!this.allNodeData) return [];
        
        const renderedNodeIds = new Set(currentNodes.map(n => n.id));
        const visibleLinks = (this.allNodeData.links || []).filter(link => {
            const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
            const targetId = typeof link.target === 'string' ? link.target : link.target.id;
            return renderedNodeIds.has(sourceId) && renderedNodeIds.has(targetId);
        });
        
        return transformLinks(visibleLinks);
    }
    
    /**
     * Clear all timers
     */
    public clearAllTimers(): void {
        if (this.singleNodeTimer) {
            clearTimeout(this.singleNodeTimer);
            this.singleNodeTimer = null;
        }
        
        if (this.batchRenderTimer) {
            clearTimeout(this.batchRenderTimer);
            this.batchRenderTimer = null;
        }
    }
    
    /**
     * Get current rendering stats
     */
    public getRenderingStats(): {
        mode: 'single-node' | 'batch' | 'standard';
        currentIndex: number;
        currentBatch: number;
        totalNodes: number;
        renderedNodes: number;
        isComplete: boolean;
    } {
        const mode = this.isBatchRenderingEnabled ? 
            (this.enableSingleNodeMode ? 'single-node' : 'batch') : 
            'standard';
            
        const renderedNodes = this.isBatchRenderingEnabled ?
            (this.enableSingleNodeMode ? 
                this.currentNodeIndex + this.systemNodes.length :
                Math.min(this.currentBatchNumber * UNIVERSAL_LAYOUT.LIMITS.NODES_PER_BATCH, this.sortedContentNodes.length) + this.systemNodes.length
            ) : 
            (this.allNodeData?.nodes.length || 0);
            
        return {
            mode,
            currentIndex: this.currentNodeIndex,
            currentBatch: this.currentBatchNumber,
            totalNodes: (this.allNodeData?.nodes.length || 0),
            renderedNodes,
            isComplete: false // Will be set by completion callback
        };
    }
    
    /**
     * Stop rendering
     */
    public stopRendering(): void {
        this.clearAllTimers();
        this.currentNodeIndex = 0;
        this.currentBatchNumber = 0;
        this.sortedContentNodes = [];
        this.allNodeData = null;
        this.systemNodes = [];
    }
}