// src/lib/services/graph/RadialBatchRenderer.ts
// PHASE 2: Enhanced batch renderer for multi-ring universal graph layout

import type { GraphNode } from '$lib/types/graph/enhanced';

export interface NodePosition {
    x: number;
    y: number;
    ring: number;
    angle?: number;
}

export interface BatchRenderConfig {
    batchSize: number;           // Nodes per batch (default: 10)
    ringSpacing: number;         // Distance between concentric rings (default: 180)
    centerNodeSize: number;      // Size for center node calculation (default: 300)
    maxBatches: number;          // Maximum number of batches to render (default: 2)
}

export interface UniversalNodeData extends GraphNode {
    netVotes?: number;
}

/**
 * PHASE 2: Enhanced RadialBatchRenderer - Multi-ring layout for progressive rendering
 * Now supports: Center node + Ring 1 (9 nodes) + Ring 2 (10 nodes) = 20 content nodes
 */
export class RadialBatchRenderer {
    private config: BatchRenderConfig;
    private sortedNodes: UniversalNodeData[] = [];
    private radialPositions: Map<string, NodePosition> = new Map();
    
    constructor(config: Partial<BatchRenderConfig> = {}) {
        this.config = {
            batchSize: 10,
            ringSpacing: 180,
            centerNodeSize: 300,
            maxBatches: 2,  // PHASE 2: Default to 2 batches
            ...config
        };
    }

    /**
     * Initialize with sorted node data (backend provides pre-sorted by netVotes desc)
     */
    public initialize(sortedNodes: UniversalNodeData[]): void {
        // Handle empty array case
        if (sortedNodes.length === 0) {
            console.warn('[RadialBatchRenderer] Phase 2 - No nodes provided for initialization');
            this.sortedNodes = [];
            this.radialPositions.clear();
            return;
        }
        
        this.sortedNodes = [...sortedNodes];
        this.calculateMultiRingPositions();
    }

    /**
     * PHASE 2: Calculate multi-ring positions for up to maxBatches * batchSize nodes
     * Layout: 1 center node + Ring 1 (9 nodes) + Ring 2 (10 nodes) + Ring 3 (10 nodes)...
     */
    private calculateMultiRingPositions(): void {
        this.radialPositions.clear();
        
        if (this.sortedNodes.length === 0) {
            console.warn('[RadialBatchRenderer] Phase 2 - No nodes to position');
            return;
        }

        // Calculate total nodes to position
        const totalNodesToPosition = Math.min(
            this.sortedNodes.length, 
            this.config.maxBatches * this.config.batchSize
        );
        
        const nodesToPosition = this.sortedNodes.slice(0, totalNodesToPosition);

        // RING 0: CENTER NODE (highest net votes)
        const centerNode = nodesToPosition[0];
        this.radialPositions.set(centerNode.id, { 
            x: 0, 
            y: 0, 
            ring: 0, 
            angle: 0 
        });

        // Remaining nodes for rings
        const remainingNodes = nodesToPosition.slice(1);
        let nodeIndex = 0;

        // PHASE 2: Define ring configurations
        const ringConfigs = [
            { ring: 1, maxNodes: 9, radius: this.config.ringSpacing },        // Ring 1: 180px
            { ring: 2, maxNodes: 10, radius: this.config.ringSpacing * 2 },   // Ring 2: 360px
            { ring: 3, maxNodes: 10, radius: this.config.ringSpacing * 3 },   // Ring 3: 540px
            { ring: 4, maxNodes: 10, radius: this.config.ringSpacing * 4 },   // Ring 4: 720px
        ];

        // Position nodes in rings
        for (const ringConfig of ringConfigs) {
            if (nodeIndex >= remainingNodes.length) break;

            const nodesInThisRing = Math.min(
                ringConfig.maxNodes, 
                remainingNodes.length - nodeIndex
            );

            if (nodesInThisRing > 0) {
                const angleStep = (2 * Math.PI) / nodesInThisRing;
                const radius = ringConfig.radius;
                
                // Add slight rotation offset per ring to prevent alignment
                const ringOffset = (ringConfig.ring - 1) * (Math.PI / 6); // 30 degree offset per ring

                for (let i = 0; i < nodesInThisRing; i++) {
                    const node = remainingNodes[nodeIndex];
                    const angle = (i * angleStep) + ringOffset;
                    
                    const position = {
                        x: Math.cos(angle) * radius,
                        y: Math.sin(angle) * radius,
                        ring: ringConfig.ring,
                        angle: angle
                    };
                    
                    this.radialPositions.set(node.id, position);
                    nodeIndex++;
                }
            }
        }
    }

    /**
     * PHASE 2: Get all batches (center + rings) with their positions
     * Returns all nodes up to maxBatches * batchSize
     */
    public getAllBatches(): {
        nodes: UniversalNodeData[];
        positions: Map<string, NodePosition>;
        totalNodes: number;
        batchCount: number;
    } {
        const totalNodesToRender = Math.min(
            this.sortedNodes.length, 
            this.config.maxBatches * this.config.batchSize
        );
        
        const allBatchNodes = this.sortedNodes.slice(0, totalNodesToRender);
        const allBatchPositions = new Map<string, NodePosition>();
        
        // Get positions for all batch nodes
        allBatchNodes.forEach(node => {
            const position = this.radialPositions.get(node.id);
            if (position) {
                allBatchPositions.set(node.id, position);
            } else {
                console.warn(`[RadialBatchRenderer] Phase 2 - No position found for node: ${node.id}`);
            }
        });

        return {
            nodes: allBatchNodes,
            positions: allBatchPositions,
            totalNodes: this.sortedNodes.length,
            batchCount: this.config.maxBatches
        };
    }

    /**
     * LEGACY: Get the first batch (10 highest net vote nodes) with their positions
     * Kept for backward compatibility with Phase 1
     */
    public getFirstBatch(): {
        nodes: UniversalNodeData[];
        positions: Map<string, NodePosition>;
        totalNodes: number;
    } {
        const firstBatch = this.sortedNodes.slice(0, this.config.batchSize);
        const batchPositions = new Map<string, NodePosition>();
        
        // Get positions for batch nodes
        firstBatch.forEach(node => {
            const position = this.radialPositions.get(node.id);
            if (position) {
                batchPositions.set(node.id, position);
            } else {
                console.warn(`[RadialBatchRenderer] Phase 2 - No position found for node: ${node.id}`);
            }
        });

        return {
            nodes: firstBatch,
            positions: batchPositions,
            totalNodes: this.sortedNodes.length
        };
    }

    /**
     * PHASE 2: Get specific batch by number (1-indexed)
     */
    public getBatch(batchNumber: number): {
        nodes: UniversalNodeData[];
        positions: Map<string, NodePosition>;
        batchNumber: number;
        isLastBatch: boolean;
    } | null {
        if (batchNumber < 1 || batchNumber > this.config.maxBatches) {
            console.warn(`[RadialBatchRenderer] Phase 2 - Invalid batch number: ${batchNumber} (max: ${this.config.maxBatches})`);
            return null;
        }

        // Calculate batch range
        const startIndex = (batchNumber - 1) * this.config.batchSize;
        const endIndex = Math.min(startIndex + this.config.batchSize, this.sortedNodes.length);
        
        if (startIndex >= this.sortedNodes.length) {
            console.warn(`[RadialBatchRenderer] Phase 2 - Batch ${batchNumber} starts beyond available nodes`);
            return null;
        }

        const batchNodes = this.sortedNodes.slice(startIndex, endIndex);
        const batchPositions = new Map<string, NodePosition>();
        
        // Get positions for batch nodes
        batchNodes.forEach(node => {
            const position = this.radialPositions.get(node.id);
            if (position) {
                batchPositions.set(node.id, position);
            }
        });

        const isLastBatch = batchNumber >= this.config.maxBatches || endIndex >= this.sortedNodes.length;

        return {
            nodes: batchNodes,
            positions: batchPositions,
            batchNumber,
            isLastBatch
        };
    }

    /**
     * Helper to extract net votes from node data safely
     */
    private getNetVotes(node: UniversalNodeData): number {
        // Try multiple sources for net votes
        if (node.netVotes !== undefined) {
            return node.netVotes;
        }
        
        if (node.metadata?.net_votes !== undefined) {
            return node.metadata.net_votes;
        }
        
        // Try to calculate from metadata votes
        if (node.metadata?.votes) {
            const votes = node.metadata.votes as any;
            if (votes.positive !== undefined && votes.negative !== undefined) {
                return votes.positive - votes.negative;
            }
        }
        
        // Default fallback
        return 0;
    }

    /**
     * Get all positions (for debugging)
     */
    public getPositions(): Map<string, NodePosition> {
        return new Map(this.radialPositions);
    }

    /**
     * PHASE 2: Get enhanced configuration
     */
    public getConfig(): BatchRenderConfig {
        return { ...this.config };
    }

    /**
     * PHASE 2: Check if a node is in any of the rendered batches
     */
    public isInRenderedBatches(nodeId: string): boolean {
        const totalNodesToRender = this.config.maxBatches * this.config.batchSize;
        const renderedNodeIds = this.sortedNodes.slice(0, totalNodesToRender).map(n => n.id);
        return renderedNodeIds.includes(nodeId);
    }

    /**
     * PHASE 2: Get which batch a node belongs to (1-indexed, 0 if not in any batch)
     */
    public getNodeBatchNumber(nodeId: string): number {
        const nodeIndex = this.sortedNodes.findIndex(n => n.id === nodeId);
        if (nodeIndex === -1) return 0;
        
        const batchNumber = Math.floor(nodeIndex / this.config.batchSize) + 1;
        return batchNumber <= this.config.maxBatches ? batchNumber : 0;
    }

    /**
     * PHASE 2: Get enhanced debug info
     */
    public getDebugInfo(): any {
        const totalNodesToRender = Math.min(
            this.sortedNodes.length, 
            this.config.maxBatches * this.config.batchSize
        );
        
        const nodesToRender = this.sortedNodes.slice(0, totalNodesToRender);
        
        // Group nodes by ring for debug display
        const nodesByRing: Record<number, any[]> = {};
        nodesToRender.forEach((node, index) => {
            const position = this.radialPositions.get(node.id);
            const ring = position?.ring ?? -1;
            
            if (!nodesByRing[ring]) {
                nodesByRing[ring] = [];
            }
            
            nodesByRing[ring].push({
                id: node.id,
                netVotes: this.getNetVotes(node),
                type: node.type,
                position: position ? `(${position.x.toFixed(1)}, ${position.y.toFixed(1)})` : 'NO_POSITION'
            });
        });

        return {
            totalNodes: this.sortedNodes.length,
            maxBatches: this.config.maxBatches,
            batchSize: this.config.batchSize,
            totalNodesToRender,
            positionedNodes: this.radialPositions.size,
            centerNode: nodesToRender[0]?.id || 'none',
            centerNodeVotes: nodesToRender[0] ? this.getNetVotes(nodesToRender[0]) : 0,
            ringSpacing: this.config.ringSpacing,
            nodesByRing,
            ringCounts: Object.keys(nodesByRing).reduce((acc: Record<string, number>, ring) => {
                acc[`ring_${ring}`] = nodesByRing[parseInt(ring)].length;
                return acc;
            }, {})
        };
    }

    /**
     * PHASE 2: Update configuration (useful for dynamic adjustments)
     */
    public updateConfig(newConfig: Partial<BatchRenderConfig>): void {
        const oldMaxBatches = this.config.maxBatches;
        this.config = { ...this.config, ...newConfig };
        
        // Recalculate positions if maxBatches changed
        if (this.config.maxBatches !== oldMaxBatches && this.sortedNodes.length > 0) {
            this.calculateMultiRingPositions();
        }
    }
}