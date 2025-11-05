// src/lib/services/graph/universal/UniversalPositioning.ts
// Vote-based positioning calculations for Universal Graph

import type { EnhancedNode, GraphNode } from '$lib/types/graph/enhanced';
import { getNeo4jNumber } from '$lib/utils/neo4j-utils';
import { UNIVERSAL_LAYOUT } from './UniversalConstants';

export interface PositionedNode {
    node: EnhancedNode;
    voteRank: number;
    netVotes: number;
    targetDistance: number;
    angle: number;
    x: number;
    y: number;
}

/**
 * Calculate positions for nodes based on vote ranking
 * Maintains continuity across batches by using global index
 */
export class UniversalPositioning {
    private readonly goldenAngle = UNIVERSAL_LAYOUT.POSITIONING.GOLDEN_ANGLE;
    private readonly baseDistance = UNIVERSAL_LAYOUT.POSITIONING.BASE_DISTANCE;
    private readonly distanceIncrement = UNIVERSAL_LAYOUT.POSITIONING.DISTANCE_INCREMENT;
    
    /**
     * Sort nodes by net votes (highest first)
     */
    public sortNodesByVotes(nodes: GraphNode[]): GraphNode[] {
        return [...nodes].sort((a, b) => {
            const votesA = this.getNodeVotes(a);
            const votesB = this.getNodeVotes(b);
            return votesB - votesA;
        });
    }
    
    /**
     * Get net votes for a node
     * UPDATED: Support all 5 content node types
     */
    public getNodeVotes(node: GraphNode): number {
        if (node.type === 'statement' || node.type === 'openquestion' || 
            node.type === 'answer' || node.type === 'quantity' || node.type === 'evidence') {
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
     * Calculate positions for single-node sequential rendering
     * Uses global index to maintain continuity across batches
     * UPDATED: Filter for all 5 content node types
     */
    public calculateSingleNodePositions(
        nodes: EnhancedNode[],
        globalStartIndex: number = 0
    ): void {
        const contentNodes = nodes.filter(node => 
            node.type === 'statement' || node.type === 'openquestion' ||
            node.type === 'answer' || node.type === 'quantity' || node.type === 'evidence'
        );
        
        // Sort by votes
        contentNodes.sort((a, b) => {
            const votesA = this.getNodeVotes({ 
                id: a.id, type: a.type, data: a.data, group: a.group, metadata: a.metadata 
            });
            const votesB = this.getNodeVotes({ 
                id: b.id, type: b.type, data: b.data, group: b.group, metadata: b.metadata 
            });
            return votesB - votesA;
        });
        
        contentNodes.forEach((node, localIndex) => {
            // Use global index for continuity across batches
            const globalIndex = globalStartIndex + localIndex;
            const netVotes = this.getNodeVotes({ 
                id: node.id, type: node.type, data: node.data, group: node.group, metadata: node.metadata 
            });
            
            // Smoother distance progression using square root
            const targetDistance = this.baseDistance + 
                                 (Math.sqrt(globalIndex) * this.distanceIncrement * 2);
            
            // Use global index for angle calculation to maintain spiral continuity
            const angle = this.calculateSpiralAngle(globalIndex);
            
            node.x = Math.cos(angle) * targetDistance;
            node.y = Math.sin(angle) * targetDistance;
            
            // Store positioning data for forces
            (node as any).voteBasedDistance = targetDistance;
            (node as any).netVotes = netVotes;
            (node as any).voteRank = globalIndex;
            (node as any).initialAngle = angle;
        });
    }
    
    /**
     * Calculate positions for batch rendering with continuity
     * UPDATED: Filter for all 5 content node types
     */
    public calculateBatchPositions(
        nodes: EnhancedNode[],
        batchNumber: number,
        nodesPerBatch: number
    ): void {
        const contentNodes = nodes.filter(node => 
            node.type === 'statement' || node.type === 'openquestion' ||
            node.type === 'answer' || node.type === 'quantity' || node.type === 'evidence'
        );
        
        // Sort by votes
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
            
            // Use continuous index calculation for batch continuity
            const globalIndex = index; // Already includes all nodes up to this point
            
            let targetDistance: number;
            
            if (globalIndex === 0) {
                targetDistance = 220; // Closest node slightly out from center
            } else {
                const maxVotes = this.getNodeVotes({ 
                    id: contentNodes[0].id, type: contentNodes[0].type, 
                    data: contentNodes[0].data, group: contentNodes[0].group, 
                    metadata: contentNodes[0].metadata 
                });
                
                const voteDeficit = Math.max(0, maxVotes - netVotes);
                targetDistance = UNIVERSAL_LAYOUT.POSITIONING.BASE_BATCH_DISTANCE + 
                               (voteDeficit * UNIVERSAL_LAYOUT.POSITIONING.VOTE_DISTANCE_MULTIPLIER) + 
                               (globalIndex * UNIVERSAL_LAYOUT.POSITIONING.INDEX_DISTANCE_MULTIPLIER);
            }
            
            // Calculate angle with optional jitter
            const angle = this.calculateSpiralAngle(globalIndex) + 
                         (Math.random() - 0.5) * UNIVERSAL_LAYOUT.POSITIONING.ANGLE_JITTER;
            
            node.x = Math.cos(angle) * targetDistance;
            node.y = Math.sin(angle) * targetDistance;
            
            (node as any).voteBasedDistance = targetDistance;
            (node as any).netVotes = netVotes;
            (node as any).voteRank = globalIndex;
        });
    }
    
    /**
     * Calculate spiral angle using golden angle or Fibonacci spiral
     */
    private calculateSpiralAngle(index: number): number {
        // Golden angle spiral for even distribution
        return index * this.goldenAngle;
        
        // Alternative: Fibonacci spiral (can be toggled via constants)
        // const phi = (1 + Math.sqrt(5)) / 2;
        // return 2 * Math.PI * index / phi;
    }
    
    /**
     * Get initial position for a new node being added dynamically
     * UPDATED: Filter for all 5 content node types
     */
    public getInitialNodePosition(
        existingNodes: EnhancedNode[],
        newNodeVotes: number
    ): { x: number; y: number; angle: number; distance: number } {
        // Sort existing nodes by votes to find where new node fits
        const sortedNodes = [...existingNodes]
            .filter(n => n.type === 'statement' || n.type === 'openquestion' ||
                        n.type === 'answer' || n.type === 'quantity' || n.type === 'evidence')
            .sort((a, b) => {
                const votesA = (a as any).netVotes || 0;
                const votesB = (b as any).netVotes || 0;
                return votesB - votesA;
            });
        
        // Find insertion index
        let insertIndex = sortedNodes.findIndex(n => 
            ((n as any).netVotes || 0) < newNodeVotes
        );
        
        if (insertIndex === -1) {
            insertIndex = sortedNodes.length;
        }
        
        // Calculate position
        const targetDistance = this.baseDistance + 
                             (Math.sqrt(insertIndex) * this.distanceIncrement * 2);
        const angle = this.calculateSpiralAngle(insertIndex);
        
        return {
            x: Math.cos(angle) * targetDistance,
            y: Math.sin(angle) * targetDistance,
            angle,
            distance: targetDistance
        };
    }
}