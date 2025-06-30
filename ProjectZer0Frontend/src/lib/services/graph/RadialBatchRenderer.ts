// src/lib/services/graph/RadialBatchRenderer.ts
// Simple batch renderer for universal graph - Step 1: First 10 nodes only

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
}

export interface UniversalNodeData extends GraphNode {
    netVotes?: number;
}

/**
 * Simple RadialBatchRenderer - Phase 1: Just first 10 nodes
 * Focus: Center node + 9 nodes in first ring
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
            ...config
        };
    }

    /**
     * Initialize with sorted node data (backend provides pre-sorted by netVotes desc)
     */
    public initialize(sortedNodes: UniversalNodeData[]): void {
        console.log(`[RadialBatchRenderer] Initializing with ${sortedNodes.length} nodes`);
        
        // Handle empty array case
        if (sortedNodes.length === 0) {
            console.warn('[RadialBatchRenderer] No nodes provided for initialization');
            this.sortedNodes = [];
            this.radialPositions.clear();
            return;
        }
        
        console.log(`[RadialBatchRenderer] First node net votes:`, this.getNetVotes(sortedNodes[0]));
        console.log(`[RadialBatchRenderer] Last node net votes:`, this.getNetVotes(sortedNodes[sortedNodes.length - 1]));
        
        this.sortedNodes = [...sortedNodes];
        this.calculateRadialPositions();
    }

    /**
     * Calculate radial positions for first 10 nodes only
     * Layout: 1 center node + 9 nodes in first ring
     */
    private calculateRadialPositions(): void {
        this.radialPositions.clear();
        
        if (this.sortedNodes.length === 0) {
            console.warn('[RadialBatchRenderer] No nodes to position');
            return;
        }

        // Take only first 10 nodes (highest net votes)
        const firstBatch = this.sortedNodes.slice(0, this.config.batchSize);
        console.log(`[RadialBatchRenderer] Positioning first ${firstBatch.length} nodes`);

        // CENTER NODE (highest net votes)
        const centerNode = firstBatch[0];
        this.radialPositions.set(centerNode.id, { 
            x: 0, 
            y: 0, 
            ring: 0, 
            angle: 0 
        });
        console.log(`[RadialBatchRenderer] Center node: ${centerNode.id} (${this.getNetVotes(centerNode)} net votes)`);

        // FIRST RING (remaining 9 nodes)
        const ringNodes = firstBatch.slice(1); // Get nodes 2-10
        const nodesInRing = ringNodes.length;
        
        if (nodesInRing > 0) {
            const angleStep = (2 * Math.PI) / nodesInRing;
            const radius = this.config.ringSpacing;
            
            ringNodes.forEach((node, index) => {
                const angle = index * angleStep;
                const position = {
                    x: Math.cos(angle) * radius,
                    y: Math.sin(angle) * radius,
                    ring: 1,
                    angle: angle
                };
                
                this.radialPositions.set(node.id, position);
                console.log(`[RadialBatchRenderer] Ring 1 node ${index + 1}: ${node.id} at (${position.x.toFixed(1)}, ${position.y.toFixed(1)}) (${this.getNetVotes(node)} net votes)`);
            });
        }

        console.log(`[RadialBatchRenderer] Positioned ${this.radialPositions.size} nodes total`);
    }

    /**
     * Get the first batch (10 highest net vote nodes) with their positions
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
                console.warn(`[RadialBatchRenderer] No position found for node: ${node.id}`);
            }
        });

        console.log(`[RadialBatchRenderer] Returning first batch:`, {
            nodeCount: firstBatch.length,
            positionCount: batchPositions.size,
            totalAvailable: this.sortedNodes.length
        });

        return {
            nodes: firstBatch,
            positions: batchPositions,
            totalNodes: this.sortedNodes.length
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
     * Get configuration
     */
    public getConfig(): BatchRenderConfig {
        return { ...this.config };
    }

    /**
     * Check if a node is in the first batch
     */
    public isInFirstBatch(nodeId: string): boolean {
        const firstBatchIds = this.sortedNodes.slice(0, this.config.batchSize).map(n => n.id);
        return firstBatchIds.includes(nodeId);
    }

    /**
     * Get debug info
     */
    public getDebugInfo(): any {
        const firstBatch = this.sortedNodes.slice(0, this.config.batchSize);
        return {
            totalNodes: this.sortedNodes.length,
            firstBatchSize: firstBatch.length,
            positionedNodes: this.radialPositions.size,
            centerNode: firstBatch[0]?.id || 'none',
            centerNodeVotes: firstBatch[0] ? this.getNetVotes(firstBatch[0]) : 0,
            firstBatchVotes: firstBatch.map(n => ({
                id: n.id,
                netVotes: this.getNetVotes(n),
                type: n.type
            }))
        };
    }
}