// src/lib/services/graph/SequentialBatchManager.ts
// Progressive batch rendering manager for performance optimization

import type { GraphNode, GraphLink } from '$lib/types/graph/enhanced';
import { RadialBatchRenderer, type UniversalNodeData, type NodePosition } from './RadialBatchRenderer';

export interface BatchRenderState {
    currentBatch: number;
    maxBatches: number;
    totalBatches: number;
    isRendering: boolean;
    isComplete: boolean;
    renderStartTime: number;
    lastBatchRenderTime: number;
}

export interface BatchRenderConfig {
    maxBatches: number;
    batchSize: number;
    delayBetweenBatches: number;
    stabilityCheckInterval: number;
    maxStabilityWaitTime: number;
}

export interface BatchData {
    batchNumber: number;
    nodes: UniversalNodeData[];
    positions: Map<string, NodePosition>;
    isLastBatch: boolean;
    systemNodes: GraphNode[];
    links: GraphLink[];
}

/**
 * SequentialBatchManager - Handles progressive batch rendering
 * Renders batches sequentially with stability checks between each batch
 */
export class SequentialBatchManager {
    private config: BatchRenderConfig;
    private state: BatchRenderState;
    private batchRenderer: RadialBatchRenderer;
    private allContentNodes: UniversalNodeData[] = [];
    private systemNodes: GraphNode[] = [];
    private allLinks: GraphLink[] = [];
    
    // Callbacks for external integration
    private onBatchRender?: (batchData: BatchData) => Promise<void>;
    private onBatchComplete?: (batchNumber: number) => void;
    private onAllBatchesComplete?: () => void;
    private onStateChange?: (state: BatchRenderState) => void;
    
    // Performance tracking
    private batchRenderTimes: number[] = [];
    private stabilityCheckCount = 0;

    constructor(config: Partial<BatchRenderConfig> = {}) {
        this.config = {
            maxBatches: 2,
            batchSize: 10,
            delayBetweenBatches: 500, // ms
            stabilityCheckInterval: 100, // ms
            maxStabilityWaitTime: 2000, // ms max wait for stability
            ...config
        };

        this.state = {
            currentBatch: 0,
            maxBatches: this.config.maxBatches,
            totalBatches: 0,
            isRendering: false,
            isComplete: false,
            renderStartTime: 0,
            lastBatchRenderTime: 0
        };

        this.batchRenderer = new RadialBatchRenderer({
            batchSize: this.config.batchSize,
            ringSpacing: 180,
            centerNodeSize: 300,
            maxBatches: this.config.maxBatches
        });

        console.log('[SequentialBatchManager] Initialized with', this.config.maxBatches, 'batches of', this.config.batchSize, 'nodes');
    }

    /**
     * Set callback functions for external integration
     */
    public setCallbacks(callbacks: {
        onBatchRender?: (batchData: BatchData) => Promise<void>;
        onBatchComplete?: (batchNumber: number) => void;
        onAllBatchesComplete?: () => void;
        onStateChange?: (state: BatchRenderState) => void;
    }): void {
        this.onBatchRender = callbacks.onBatchRender;
        this.onBatchComplete = callbacks.onBatchComplete;
        this.onAllBatchesComplete = callbacks.onAllBatchesComplete;
        this.onStateChange = callbacks.onStateChange;
    }

    /**
     * Initialize with data and start sequential batch rendering
     */
    public async startSequentialRendering(
        contentNodes: UniversalNodeData[],
        systemNodes: GraphNode[],
        links: GraphLink[]
    ): Promise<void> {
        console.log(`[SequentialBatchManager] Starting sequential rendering: ${contentNodes.length} content nodes, ${this.config.maxBatches} batches`);

        // Store data
        this.allContentNodes = [...contentNodes];
        this.systemNodes = [...systemNodes];
        this.allLinks = [...links];

        // Initialize batch renderer
        this.batchRenderer.initialize(this.allContentNodes);

        // Calculate total batches
        this.state.totalBatches = Math.min(
            this.config.maxBatches,
            Math.ceil(this.allContentNodes.length / this.config.batchSize)
        );

        // Reset state
        this.state = {
            ...this.state,
            currentBatch: 0,
            isRendering: true,
            isComplete: false,
            renderStartTime: performance.now(),
            lastBatchRenderTime: 0
        };

        this.batchRenderTimes = [];
        this.stabilityCheckCount = 0;

        this.notifyStateChange();

        // Start rendering batches
        await this.renderNextBatch();
    }

    /**
     * Render the next batch in sequence
     */
    private async renderNextBatch(): Promise<void> {
        const nextBatchNumber = this.state.currentBatch + 1;

        if (nextBatchNumber > this.state.totalBatches) {
            console.log('[SequentialBatchManager] All batches complete');
            await this.completeSequentialRendering();
            return;
        }

        console.log(`[SequentialBatchManager] Starting batch ${nextBatchNumber}/${this.state.totalBatches}`);
        const batchStartTime = performance.now();

        try {
            // Get batch data from renderer
            const batchResult = this.batchRenderer.getBatch(nextBatchNumber);
            
            if (!batchResult) {
                console.error(`[SequentialBatchManager] Failed to get batch ${nextBatchNumber}`);
                return;
            }

            // Prepare batch data for external rendering
            const batchData: BatchData = {
                batchNumber: nextBatchNumber,
                nodes: batchResult.nodes,
                positions: batchResult.positions,
                isLastBatch: batchResult.isLastBatch,
                systemNodes: nextBatchNumber === 1 ? this.systemNodes : [], // Only include system nodes in first batch
                links: this.getLinksForBatch(nextBatchNumber)
            };

            console.log(`[SequentialBatchManager] Batch ${nextBatchNumber} data: ${batchData.nodes.length} nodes, ${batchData.links.length} links`);

            // Update state
            this.state.currentBatch = nextBatchNumber;
            this.notifyStateChange();

            // Render batch via callback
            if (this.onBatchRender) {
                await this.onBatchRender(batchData);
            }

            // Wait for rendering stability
            await this.waitForStability();

            // Track performance
            const batchRenderTime = performance.now() - batchStartTime;
            this.batchRenderTimes.push(batchRenderTime);
            this.state.lastBatchRenderTime = batchRenderTime;

            console.log(`[SequentialBatchManager] Batch ${nextBatchNumber} completed in ${batchRenderTime.toFixed(2)}ms`);

            // Notify batch completion
            if (this.onBatchComplete) {
                this.onBatchComplete(nextBatchNumber);
            }

            // Continue to next batch after delay
            if (!batchResult.isLastBatch && nextBatchNumber < this.state.totalBatches) {
                console.log(`[SequentialBatchManager] Waiting ${this.config.delayBetweenBatches}ms before next batch`);
                
                setTimeout(() => {
                    this.renderNextBatch();
                }, this.config.delayBetweenBatches);
            } else {
                await this.completeSequentialRendering();
            }

        } catch (error) {
            console.error(`[SequentialBatchManager] Error rendering batch ${nextBatchNumber}:`, error);
            await this.completeSequentialRendering();
        }
    }

    /**
     * Wait for rendering stability before proceeding
     */
    private async waitForStability(): Promise<void> {
        return new Promise((resolve) => {
            const startTime = performance.now();
            let checkCount = 0;

            const checkStability = () => {
                checkCount++;
                const elapsedTime = performance.now() - startTime;

                // Simple stability check - just wait for a short period
                // In a real implementation, you might check DOM rendering, animation frames, etc.
                if (elapsedTime >= this.config.stabilityCheckInterval || 
                    elapsedTime >= this.config.maxStabilityWaitTime) {
                    
                    this.stabilityCheckCount += checkCount;
                    console.log(`[SequentialBatchManager] Stability achieved after ${elapsedTime.toFixed(2)}ms (${checkCount} checks)`);
                    resolve();
                } else {
                    // Continue checking
                    requestAnimationFrame(checkStability);
                }
            };

            requestAnimationFrame(checkStability);
        });
    }

    /**
     * Get links relevant to the current batch
     */
    private getLinksForBatch(batchNumber: number): GraphLink[] {
        // Get all nodes rendered up to this batch
        const renderedNodeIds = new Set<string>();
        
        // Add system nodes (always in first batch)
        this.systemNodes.forEach(node => renderedNodeIds.add(node.id));
        
        // Add content nodes up to current batch
        const totalContentNodes = batchNumber * this.config.batchSize;
        const contentNodesToInclude = this.allContentNodes.slice(0, totalContentNodes);
        contentNodesToInclude.forEach(node => renderedNodeIds.add(node.id));

        // Filter links to only include those between rendered nodes
        return this.allLinks.filter(link => {
            const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
            const targetId = typeof link.target === 'string' ? link.target : link.target.id;
            return renderedNodeIds.has(sourceId) && renderedNodeIds.has(targetId);
        });
    }

    /**
     * Complete sequential rendering process
     */
    private async completeSequentialRendering(): Promise<void> {
        const totalRenderTime = performance.now() - this.state.renderStartTime;
        
        this.state.isRendering = false;
        this.state.isComplete = true;

        const performanceStats = {
            totalRenderTime: totalRenderTime.toFixed(2),
            averageBatchTime: this.batchRenderTimes.length > 0 
                ? (this.batchRenderTimes.reduce((a, b) => a + b, 0) / this.batchRenderTimes.length).toFixed(2)
                : '0',
            batchRenderTimes: this.batchRenderTimes.map(t => t.toFixed(2)),
            stabilityChecks: this.stabilityCheckCount,
            renderedBatches: this.state.currentBatch,
            totalNodes: this.systemNodes.length + (this.state.currentBatch * this.config.batchSize)
        };

        console.log('[SequentialBatchManager] Sequential rendering complete:', performanceStats);

        this.notifyStateChange();

        if (this.onAllBatchesComplete) {
            this.onAllBatchesComplete();
        }
    }

    /**
     * Stop sequential rendering (if in progress)
     */
    public stop(): void {
        console.log('[SequentialBatchManager] Stopping sequential rendering');
        
        this.state.isRendering = false;
        this.state.isComplete = true;
        
        this.notifyStateChange();
    }

    /**
     * Get current rendering state
     */
    public getState(): BatchRenderState {
        return { ...this.state };
    }

    /**
     * Get performance metrics
     */
    public getPerformanceMetrics(): any {
        return {
            config: this.config,
            state: this.state,
            batchRenderTimes: [...this.batchRenderTimes],
            averageBatchTime: this.batchRenderTimes.length > 0 
                ? this.batchRenderTimes.reduce((a, b) => a + b, 0) / this.batchRenderTimes.length
                : 0,
            stabilityCheckCount: this.stabilityCheckCount,
            totalRenderTime: this.state.renderStartTime > 0 
                ? performance.now() - this.state.renderStartTime 
                : 0
        };
    }

    /**
     * Update configuration
     */
    public updateConfig(newConfig: Partial<BatchRenderConfig>): void {
        this.config = { ...this.config, ...newConfig };
        
        // Update batch renderer if maxBatches changed
        if (newConfig.maxBatches) {
            this.batchRenderer.updateConfig({ maxBatches: newConfig.maxBatches });
            this.state.maxBatches = newConfig.maxBatches;
        }
        
        console.log('[SequentialBatchManager] Config updated:', this.config);
    }

    /**
     * Notify external listeners of state changes
     */
    private notifyStateChange(): void {
        if (this.onStateChange) {
            this.onStateChange({ ...this.state });
        }
    }

    /**
     * Get debug information
     */
    public getDebugInfo(): any {
        return {
            config: this.config,
            state: this.state,
            batchRenderer: this.batchRenderer.getDebugInfo(),
            performanceMetrics: this.getPerformanceMetrics(),
            dataInfo: {
                contentNodes: this.allContentNodes.length,
                systemNodes: this.systemNodes.length,
                totalLinks: this.allLinks.length
            }
        };
    }
}