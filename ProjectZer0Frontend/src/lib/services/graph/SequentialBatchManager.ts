// // src/lib/services/graph/SequentialBatchManager.ts
// // PHASE 2.2: Enhanced sequential batch rendering with spiral positioning

// import { BATCH_RENDERING } from '$lib/constants/graph/universal-graph';
// import type { GraphNode, GraphLink } from '$lib/types/graph/enhanced';
// import { SpiralBatchRenderer, type UniversalNodeData, type NodePosition } from './SpiralBatchRenderer';

// export interface BatchRenderState {
//     currentBatch: number;
//     maxBatches: number;
//     totalBatches: number;
//     isRendering: boolean;
//     isComplete: boolean;
//     renderStartTime: number;
//     lastBatchRenderTime: number;
//     spiralTightness: number; // NEW: Track spiral configuration
// }

// export interface BatchRenderConfig {
//     maxBatches: number;
//     batchSize: number;
//     delayBetweenBatches: number;
//     stabilityCheckInterval: number;
//     maxStabilityWaitTime: number;
//     spiralTightness: number; // NEW: Spiral configuration
//     enableSmoothDrop: boolean; // NEW: Enable smooth drop animation
// }

// export interface BatchData {
//     batchNumber: number;
//     nodes: UniversalNodeData[];
//     positions: Map<string, NodePosition>;
//     isLastBatch: boolean;
//     systemNodes: GraphNode[];
//     links: GraphLink[];
//     spiralTightness: number; // NEW: Include spiral config in batch data
// }

// /**
//  * PHASE 2.2: Enhanced SequentialBatchManager with spiral positioning and smooth animations
//  */
// export class SequentialBatchManager {
//     private config: BatchRenderConfig;
//     private state: BatchRenderState;
//     private spiralRenderer: SpiralBatchRenderer; // Changed from RadialBatchRenderer
//     private allContentNodes: UniversalNodeData[] = [];
//     private systemNodes: GraphNode[] = [];
//     private allLinks: GraphLink[] = [];
    
//     // Callbacks for external integration
//     private onBatchRender?: (batchData: BatchData) => Promise<void>;
//     private onBatchComplete?: (batchNumber: number) => void;
//     private onAllBatchesComplete?: () => void;
//     private onStateChange?: (state: BatchRenderState) => void;
    
//     // Performance tracking
//     private batchRenderTimes: number[] = [];
//     private stabilityCheckCount = 0;

//     constructor(config: Partial<BatchRenderConfig> = {}) {
//         this.config = {
//             maxBatches: BATCH_RENDERING.MAX_BATCHES,
//             batchSize: BATCH_RENDERING.BATCH_SIZE,
//             delayBetweenBatches: 200, // REDUCED: Faster batch progression
//             stabilityCheckInterval: 50, // REDUCED: More responsive stability checks
//             maxStabilityWaitTime: 1000, // REDUCED: Faster settling
//             spiralTightness: 0.6, // NEW: Configurable spiral tightness
//             enableSmoothDrop: true, // NEW: Enable smooth animations
//             ...config
//         };

//         this.state = {
//             currentBatch: 0,
//             maxBatches: this.config.maxBatches,
//             totalBatches: 0,
//             isRendering: false,
//             isComplete: false,
//             renderStartTime: 0,
//             lastBatchRenderTime: 0,
//             spiralTightness: this.config.spiralTightness
//         };

//         // Initialize spiral renderer instead of radial renderer
//         this.spiralRenderer = new SpiralBatchRenderer({
//             batchSize: this.config.batchSize,
//             spiralTightness: this.config.spiralTightness,
//             centerNodeSize: 300,
//             maxBatches: this.config.maxBatches
//         });

//         console.log('[SequentialBatchManager] Phase 2.2 - Initialized with spiral rendering and', 
//                    this.config.delayBetweenBatches + 'ms delays');
//     }

//     /**
//      * Set callback functions for external integration
//      */
//     public setCallbacks(callbacks: {
//         onBatchRender?: (batchData: BatchData) => Promise<void>;
//         onBatchComplete?: (batchNumber: number) => void;
//         onAllBatchesComplete?: () => void;
//         onStateChange?: (state: BatchRenderState) => void;
//     }): void {
//         this.onBatchRender = callbacks.onBatchRender;
//         this.onBatchComplete = callbacks.onBatchComplete;
//         this.onAllBatchesComplete = callbacks.onAllBatchesComplete;
//         this.onStateChange = callbacks.onStateChange;
//     }

//     /**
//      * Initialize with data and start sequential spiral rendering
//      */
//     public async startSequentialRendering(
//         contentNodes: UniversalNodeData[],
//         systemNodes: GraphNode[],
//         links: GraphLink[]
//     ): Promise<void> {
//         console.log(`[SequentialBatchManager] Phase 2.2 - Starting spiral sequential rendering: ${contentNodes.length} content nodes`);

//         // Store data
//         this.allContentNodes = [...contentNodes];
//         this.systemNodes = [...systemNodes];
//         this.allLinks = [...links];

//         // Initialize spiral renderer with sorted nodes
//         this.spiralRenderer.initialize(this.allContentNodes);

//         // Calculate total batches
//         this.state.totalBatches = Math.min(
//             this.config.maxBatches,
//             Math.ceil(this.allContentNodes.length / this.config.batchSize)
//         );

//         // Reset state
//         this.state = {
//             ...this.state,
//             currentBatch: 0,
//             isRendering: true,
//             isComplete: false,
//             renderStartTime: performance.now(),
//             lastBatchRenderTime: 0,
//             spiralTightness: this.config.spiralTightness
//         };

//         this.batchRenderTimes = [];
//         this.stabilityCheckCount = 0;

//         this.notifyStateChange();

//         // Start rendering batches with spiral positioning
//         await this.renderNextBatch();
//     }

//     /**
//      * Render the next batch with spiral positioning and smooth animations
//      */
//     private async renderNextBatch(): Promise<void> {
//         const nextBatchNumber = this.state.currentBatch + 1;

//         if (nextBatchNumber > this.state.totalBatches) {
//             console.log('[SequentialBatchManager] Phase 2.2 - All spiral batches complete');
//             await this.completeSequentialRendering();
//             return;
//         }

//         console.log(`[SequentialBatchManager] Phase 2.2 - Starting spiral batch ${nextBatchNumber}/${this.state.totalBatches}`);
//         const batchStartTime = performance.now();

//         try {
//             // Get batch data from spiral renderer
//             const batchResult = this.spiralRenderer.getBatch(nextBatchNumber);
            
//             if (!batchResult) {
//                 console.error(`[SequentialBatchManager] Failed to get spiral batch ${nextBatchNumber}`);
//                 return;
//             }

//             // Prepare enhanced batch data with spiral information
//             const batchData: BatchData = {
//                 batchNumber: nextBatchNumber,
//                 nodes: batchResult.nodes,
//                 positions: batchResult.positions,
//                 isLastBatch: batchResult.isLastBatch,
//                 systemNodes: nextBatchNumber === 1 ? this.systemNodes : [], // Only include system nodes in first batch
//                 links: this.getLinksForBatch(nextBatchNumber),
//                 spiralTightness: this.config.spiralTightness // Include spiral config
//             };

//             console.log(`[SequentialBatchManager] Spiral batch ${nextBatchNumber}: ${batchData.nodes.length} nodes positioned`);

//             // Update state
//             this.state.currentBatch = nextBatchNumber;
//             this.notifyStateChange();

//             // Render batch with spiral positioning
//             if (this.onBatchRender) {
//                 await this.onBatchRender(batchData);
//             }

//             // Reduced stability wait time for smoother experience
//             await this.waitForStability();

//             // Track performance
//             const batchRenderTime = performance.now() - batchStartTime;
//             this.batchRenderTimes.push(batchRenderTime);
//             this.state.lastBatchRenderTime = batchRenderTime;

//             console.log(`[SequentialBatchManager] Spiral batch ${nextBatchNumber} completed in ${batchRenderTime.toFixed(2)}ms`);

//             // Notify batch completion
//             if (this.onBatchComplete) {
//                 this.onBatchComplete(nextBatchNumber);
//             }

//             // Continue to next batch with reduced delay
//             if (!batchResult.isLastBatch && nextBatchNumber < this.state.totalBatches) {
//                 console.log(`[SequentialBatchManager] Waiting ${this.config.delayBetweenBatches}ms before next spiral batch`);
                
//                 setTimeout(() => {
//                     this.renderNextBatch();
//                 }, this.config.delayBetweenBatches);
//             } else {
//                 await this.completeSequentialRendering();
//             }

//         } catch (error) {
//             console.error(`[SequentialBatchManager] Error rendering spiral batch ${nextBatchNumber}:`, error);
//             await this.completeSequentialRendering();
//         }
//     }

//     /**
//      * Enhanced stability check with reduced wait times
//      */
//     private async waitForStability(): Promise<void> {
//         return new Promise((resolve) => {
//             const startTime = performance.now();
//             let checkCount = 0;

//             const checkStability = () => {
//                 checkCount++;
//                 const elapsedTime = performance.now() - startTime;

//                 // Faster stability checks for smoother progression
//                 if (elapsedTime >= this.config.stabilityCheckInterval || 
//                     elapsedTime >= this.config.maxStabilityWaitTime) {
                    
//                     this.stabilityCheckCount += checkCount;
//                     console.log(`[SequentialBatchManager] Spiral stability achieved after ${elapsedTime.toFixed(2)}ms`);
//                     resolve();
//                 } else {
//                     // Continue checking with higher frequency
//                     requestAnimationFrame(checkStability);
//                 }
//             };

//             requestAnimationFrame(checkStability);
//         });
//     }

//     /**
//      * Dynamic spiral tightness adjustment
//      */
//     public updateSpiralTightness(newTightness: number): void {
//         if (newTightness !== this.config.spiralTightness) {
//             this.config.spiralTightness = newTightness;
//             this.state.spiralTightness = newTightness;
            
//             // Update spiral renderer configuration
//             this.spiralRenderer.setSpiralTightness(newTightness);
            
//             console.log(`[SequentialBatchManager] Updated spiral tightness to ${newTightness}`);
//             this.notifyStateChange();
//         }
//     }

//     /**
//      * Get current spiral tightness
//      */
//     public getSpiralTightness(): number {
//         return this.config.spiralTightness;
//     }

//     /**
//      * Get links relevant to the current batch
//      */
//     private getLinksForBatch(batchNumber: number): GraphLink[] {
//         // Get all nodes rendered up to this batch
//         const renderedNodeIds = new Set<string>();
        
//         // Add system nodes (always in first batch)
//         this.systemNodes.forEach(node => renderedNodeIds.add(node.id));
        
//         // Add content nodes up to current batch
//         const totalContentNodes = batchNumber * this.config.batchSize;
//         const contentNodesToInclude = this.allContentNodes.slice(0, totalContentNodes);
//         contentNodesToInclude.forEach(node => renderedNodeIds.add(node.id));

//         // Filter links to only include those between rendered nodes
//         return this.allLinks.filter(link => {
//             const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
//             const targetId = typeof link.target === 'string' ? link.target : link.target.id;
//             return renderedNodeIds.has(sourceId) && renderedNodeIds.has(targetId);
//         });
//     }

//     /**
//      * Complete sequential spiral rendering process
//      */
//     private async completeSequentialRendering(): Promise<void> {
//         const totalRenderTime = performance.now() - this.state.renderStartTime;
        
//         this.state.isRendering = false;
//         this.state.isComplete = true;

//         const performanceStats = {
//             layoutType: 'spiral',
//             totalRenderTime: totalRenderTime.toFixed(2),
//             averageBatchTime: this.batchRenderTimes.length > 0 
//                 ? (this.batchRenderTimes.reduce((a, b) => a + b, 0) / this.batchRenderTimes.length).toFixed(2)
//                 : '0',
//             batchRenderTimes: this.batchRenderTimes.map(t => t.toFixed(2)),
//             stabilityChecks: this.stabilityCheckCount,
//             renderedBatches: this.state.currentBatch,
//             totalNodes: this.systemNodes.length + (this.state.currentBatch * this.config.batchSize),
//             spiralTightness: this.config.spiralTightness,
//             delayBetweenBatches: this.config.delayBetweenBatches
//         };

//         console.log('[SequentialBatchManager] Phase 2.2 - Spiral sequential rendering complete:', performanceStats);

//         this.notifyStateChange();

//         if (this.onAllBatchesComplete) {
//             this.onAllBatchesComplete();
//         }
//     }

//     /**
//      * Stop sequential rendering (if in progress)
//      */
//     public stop(): void {
//         console.log('[SequentialBatchManager] Stopping spiral sequential rendering');
        
//         this.state.isRendering = false;
//         this.state.isComplete = true;
        
//         this.notifyStateChange();
//     }

//     /**
//      * Get current rendering state with spiral information
//      */
//     public getState(): BatchRenderState {
//         return { ...this.state };
//     }

//     /**
//      * Get enhanced performance metrics with spiral information
//      */
//     public getPerformanceMetrics(): any {
//         return {
//             config: this.config,
//             state: this.state,
//             batchRenderTimes: [...this.batchRenderTimes],
//             averageBatchTime: this.batchRenderTimes.length > 0 
//                 ? this.batchRenderTimes.reduce((a, b) => a + b, 0) / this.batchRenderTimes.length
//                 : 0,
//             stabilityCheckCount: this.stabilityCheckCount,
//             totalRenderTime: this.state.renderStartTime > 0 
//                 ? performance.now() - this.state.renderStartTime 
//                 : 0,
//             spiralRenderer: this.spiralRenderer.getDebugInfo(),
//             layoutType: 'golden_angle_spiral'
//         };
//     }

//     /**
//      * Update configuration with spiral support
//      */
//     public updateConfig(newConfig: Partial<BatchRenderConfig>): void {
//         this.config = { ...this.config, ...newConfig };
        
//         // Update spiral renderer if relevant configs changed
//         if (newConfig.maxBatches || newConfig.spiralTightness) {
//             this.spiralRenderer.updateSpiralConfig({
//                 maxBatches: newConfig.maxBatches,
//                 spiralTightness: newConfig.spiralTightness
//             });
            
//             if (newConfig.maxBatches) {
//                 this.state.maxBatches = newConfig.maxBatches;
//             }
            
//             if (newConfig.spiralTightness) {
//                 this.state.spiralTightness = newConfig.spiralTightness;
//             }
//         }
        
//         console.log('[SequentialBatchManager] Phase 2.2 - Config updated:', this.config);
//     }

//     /**
//      * Notify external listeners of state changes
//      */
//     private notifyStateChange(): void {
//         if (this.onStateChange) {
//             this.onStateChange({ ...this.state });
//         }
//     }

//     /**
//      * Get enhanced debug information with spiral statistics
//      */
//     public getDebugInfo(): any {
//         return {
//             config: this.config,
//             state: this.state,
//             spiralRenderer: this.spiralRenderer.getDebugInfo(),
//             performanceMetrics: this.getPerformanceMetrics(),
//             dataInfo: {
//                 contentNodes: this.allContentNodes.length,
//                 systemNodes: this.systemNodes.length,
//                 totalLinks: this.allLinks.length
//             },
//             layoutType: 'golden_angle_spiral',
//             phase: '2.2'
//         };
//     }
// }