// src/lib/services/graph/SpiralBatchRenderer.ts
// PHASE 2.2: Enhanced spiral-based batch renderer for natural node distribution

import { BATCH_RENDERING } from '$lib/constants/graph/universal-graph';
import type { GraphNode } from '$lib/types/graph/enhanced';

export interface NodePosition {
    x: number;
    y: number;
    ring: number;
    angle?: number;
    targetDistance?: number; // For D3 force reference
    spiralIndex?: number;    // Position in spiral sequence
}

export interface SpiralRenderConfig {
    batchSize: number;           // Nodes per batch (default: 10)
    spiralTightness: number;     // Controls spiral spacing (default: 1.0)
    centerNodeSize: number;      // Size for center node calculation (default: 300)
    maxBatches: number;          // Maximum number of batches to render (default: 2)
    voteInfluence: number;       // How much net votes affect distance from center (default: 10)
    baseDistance: number;        // Minimum distance from center (default: 200)
}

export interface UniversalNodeData extends GraphNode {
    netVotes?: number;
}

/**
 * PHASE 2.2: SpiralBatchRenderer - Golden angle spiral layout for natural node distribution
 * Replaces rigid ring system with organic spiral based on golden ratio
 */
export class SpiralBatchRenderer {
    private config: SpiralRenderConfig;
    private sortedNodes: UniversalNodeData[] = [];
    private spiralPositions: Map<string, NodePosition> = new Map();
    
    // Golden angle for natural spiral distribution
    private static readonly GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~137.5°
    
    constructor(config: Partial<SpiralRenderConfig> = {}) {
        this.config = {
            batchSize: BATCH_RENDERING.BATCH_SIZE,
            spiralTightness: 0.6,  // Start with tighter spiral (adjustable)
            centerNodeSize: 300,
            maxBatches: BATCH_RENDERING.MAX_BATCHES,
            voteInfluence: 20,     // Stronger vote influence for better center clustering
            baseDistance: 150,     // Closer minimum distance from center
            ...config
        };
        
        console.log('[SpiralBatchRenderer] Initialized with golden angle spiral layout, tightness:', this.config.spiralTightness);
    }

    /**
     * Initialize with sorted node data (backend provides pre-sorted by netVotes desc)
     */
    public initialize(sortedNodes: UniversalNodeData[]): void {
        if (sortedNodes.length === 0) {
            console.warn('[SpiralBatchRenderer] No nodes provided for initialization');
            this.sortedNodes = [];
            this.spiralPositions.clear();
            return;
        }
        
        this.sortedNodes = [...sortedNodes];
        this.calculateSpiralPositions();
        
        console.log(`[SpiralBatchRenderer] Positioned ${this.sortedNodes.length} nodes in golden spiral`);
    }

    /**
     * Calculate spiral positions using golden angle for natural distribution
     */
    private calculateSpiralPositions(): void {
        this.spiralPositions.clear();
        
        if (this.sortedNodes.length === 0) {
            console.warn('[SpiralBatchRenderer] No nodes to position');
            return;
        }

        // Calculate total nodes to position
        const totalNodesToPosition = Math.min(
            this.sortedNodes.length, 
            this.config.maxBatches * this.config.batchSize
        );
        
        const nodesToPosition = this.sortedNodes.slice(0, totalNodesToPosition);

        // CENTER NODE: Highest net votes at origin
        const centerNode = nodesToPosition[0];
        this.spiralPositions.set(centerNode.id, { 
            x: 0, 
            y: 0, 
            ring: 0, 
            angle: 0,
            targetDistance: 0,
            spiralIndex: 0
        });

        // SPIRAL NODES: Remaining nodes in golden angle spiral
        const remainingNodes = nodesToPosition.slice(1);
        
        remainingNodes.forEach((node, index) => {
            const spiralIndex = index + 1; // 1-based for spiral calculations
            const position = this.calculateSpiralPosition(spiralIndex, node);
            
            this.spiralPositions.set(node.id, position);
        });
        
        console.log(`[SpiralBatchRenderer] Spiral positioning complete: center + ${remainingNodes.length} nodes`);
    }

    /**
     * Calculate individual spiral position using golden angle
     */
    private calculateSpiralPosition(spiralIndex: number, node: UniversalNodeData): NodePosition {
        // Get net votes for this node
        const netVotes = this.getNetVotes(node);
        
        // Calculate distance from center based on votes and spiral index
        // Higher net votes = closer to center, spiral index adds outward progression
        const voteDistance = Math.max(0, this.config.baseDistance - (netVotes * this.config.voteInfluence));
        const spiralDistance = voteDistance + (spiralIndex * this.config.spiralTightness * 20);
        
        // Golden angle for natural distribution
        const angle = spiralIndex * SpiralBatchRenderer.GOLDEN_ANGLE;
        
        // Calculate position
        const x = Math.cos(angle) * spiralDistance;
        const y = Math.sin(angle) * spiralDistance;
        
        // Determine ring equivalent for compatibility
        const ring = Math.ceil(spiralIndex / 9); // Approximate ring based on traditional system
        
        return {
            x,
            y,
            ring,
            angle,
            targetDistance: spiralDistance,
            spiralIndex
        };
    }

    /**
     * Get all batches with their spiral positions
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
            const position = this.spiralPositions.get(node.id);
            if (position) {
                allBatchPositions.set(node.id, position);
            } else {
                console.warn(`[SpiralBatchRenderer] No position found for node: ${node.id}`);
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
     * Get specific batch by number (1-indexed) with spiral positions
     */
    public getBatch(batchNumber: number): {
        nodes: UniversalNodeData[];
        positions: Map<string, NodePosition>;
        batchNumber: number;
        isLastBatch: boolean;
    } | null {
        if (batchNumber < 1 || batchNumber > this.config.maxBatches) {
            console.warn(`[SpiralBatchRenderer] Invalid batch number: ${batchNumber} (max: ${this.config.maxBatches})`);
            return null;
        }

        // Calculate batch range
        const startIndex = (batchNumber - 1) * this.config.batchSize;
        const endIndex = Math.min(startIndex + this.config.batchSize, this.sortedNodes.length);
        
        if (startIndex >= this.sortedNodes.length) {
            console.warn(`[SpiralBatchRenderer] Batch ${batchNumber} starts beyond available nodes`);
            return null;
        }

        const batchNodes = this.sortedNodes.slice(startIndex, endIndex);
        const batchPositions = new Map<string, NodePosition>();
        
        // Get spiral positions for batch nodes
        batchNodes.forEach(node => {
            const position = this.spiralPositions.get(node.id);
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
     * Update spiral configuration and recalculate positions
     */
    public updateSpiralConfig(newConfig: Partial<SpiralRenderConfig>): void {
        const oldConfig = { ...this.config };
        this.config = { ...this.config, ...newConfig };
        
        // Recalculate positions if spiral parameters changed
        if (this.config.spiralTightness !== oldConfig.spiralTightness ||
            this.config.voteInfluence !== oldConfig.voteInfluence ||
            this.config.baseDistance !== oldConfig.baseDistance ||
            this.config.maxBatches !== oldConfig.maxBatches) {
            
            if (this.sortedNodes.length > 0) {
                this.calculateSpiralPositions();
                console.log('[SpiralBatchRenderer] Recalculated positions after config update');
            }
        }
    }

    /**
     * Get spiral tightness for external control
     */
    public getSpiralTightness(): number {
        return this.config.spiralTightness;
    }

    /**
     * Set spiral tightness for dynamic adjustment
     */
    public setSpiralTightness(tightness: number): void {
        if (tightness !== this.config.spiralTightness) {
            this.updateSpiralConfig({ spiralTightness: tightness });
        }
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
        return new Map(this.spiralPositions);
    }

    /**
     * Get configuration
     */
    public getConfig(): SpiralRenderConfig {
        return { ...this.config };
    }

    /**
     * Check if a node is in any of the rendered batches
     */
    public isInRenderedBatches(nodeId: string): boolean {
        const totalNodesToRender = this.config.maxBatches * this.config.batchSize;
        const renderedNodeIds = this.sortedNodes.slice(0, totalNodesToRender).map(n => n.id);
        return renderedNodeIds.includes(nodeId);
    }

    /**
     * Get which batch a node belongs to (1-indexed, 0 if not in any batch)
     */
    public getNodeBatchNumber(nodeId: string): number {
        const nodeIndex = this.sortedNodes.findIndex(n => n.id === nodeId);
        if (nodeIndex === -1) return 0;
        
        const batchNumber = Math.floor(nodeIndex / this.config.batchSize) + 1;
        return batchNumber <= this.config.maxBatches ? batchNumber : 0;
    }

    /**
     * Get enhanced debug info with spiral statistics
     */
    public getDebugInfo(): any {
        const totalNodesToRender = Math.min(
            this.sortedNodes.length, 
            this.config.maxBatches * this.config.batchSize
        );
        
        const nodesToRender = this.sortedNodes.slice(0, totalNodesToRender);
        
        // Analyze spiral distribution
        const spiralStats = {
            centerNode: nodesToRender[0]?.id || 'none',
            centerNodeVotes: nodesToRender[0] ? this.getNetVotes(nodesToRender[0]) : 0,
            averageDistance: 0,
            maxDistance: 0,
            minDistance: Infinity,
            spiralTightness: this.config.spiralTightness
        };

        // Calculate distance statistics
        let totalDistance = 0;
        for (const [nodeId, position] of this.spiralPositions.entries()) {
            const distance = position.targetDistance || 0;
            spiralStats.maxDistance = Math.max(spiralStats.maxDistance, distance);
            spiralStats.minDistance = Math.min(spiralStats.minDistance, distance);
            totalDistance += distance;
        }
        spiralStats.averageDistance = totalDistance / this.spiralPositions.size;

        return {
            totalNodes: this.sortedNodes.length,
            maxBatches: this.config.maxBatches,
            batchSize: this.config.batchSize,
            totalNodesToRender,
            positionedNodes: this.spiralPositions.size,
            spiralStats,
            config: this.config,
            layoutType: 'golden_angle_spiral'
        };
    }
}