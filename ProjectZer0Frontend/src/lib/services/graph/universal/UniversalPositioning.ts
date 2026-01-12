// src/lib/services/graph/universal/UniversalPositioning.ts
// Vote-based positioning calculations for Universal Graph
// UPDATED: Dynamic BASE_DISTANCE calculation to respect navigation ring

import type { EnhancedNode, GraphNode } from '$lib/types/graph/enhanced';
import { getNeo4jNumber } from '$lib/utils/neo4j-utils';
import { UNIVERSAL_LAYOUT } from './UniversalConstants';
import { COORDINATE_SPACE } from '$lib/constants/graph/coordinate-space';

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
 * ENHANCED: Now respects navigation ring boundaries
 */
export class UniversalPositioning {
    private readonly goldenAngle = UNIVERSAL_LAYOUT.POSITIONING.GOLDEN_ANGLE;
    private readonly configuredBaseDistance = UNIVERSAL_LAYOUT.POSITIONING.BASE_DISTANCE;
    private readonly distanceIncrement = UNIVERSAL_LAYOUT.POSITIONING.DISTANCE_INCREMENT;
    
    // Ring-based positioning for natural distribution
    private readonly FIRST_RING_SIZE = UNIVERSAL_LAYOUT.POSITIONING.FIRST_RING_SIZE;
    private readonly SECOND_RING_SIZE = UNIVERSAL_LAYOUT.POSITIONING.SECOND_RING_SIZE;
    private readonly THIRD_RING_SIZE = UNIVERSAL_LAYOUT.POSITIONING.THIRD_RING_SIZE || 0;
    private readonly RING_DISTANCE_INCREMENT = UNIVERSAL_LAYOUT.POSITIONING.RING_DISTANCE_INCREMENT;
    
    // NEW: Dynamic base distance that respects navigation ring
    private effectiveBaseDistance: number;
    
    constructor() {
        // Calculate safe minimum distance on initialization
        this.effectiveBaseDistance = this.calculateSafeBaseDistance();
        
        console.log('[UniversalPositioning] Initialized with safe distances:', {
            configuredBaseDistance: this.configuredBaseDistance,
            effectiveBaseDistance: this.effectiveBaseDistance,
            adjustment: this.effectiveBaseDistance - this.configuredBaseDistance
        });
    }
    
    /**
     * Calculate safe minimum distance for content nodes
     * Must be beyond navigation ring outer edge to prevent overlaps
     */
    private calculateSafeBaseDistance(): number {
        // Navigation ring calculation (based on NavigationRingPositioning.ts logic)
        // We use DETAIL mode as worst case (largest ring)
        const controlRadius = COORDINATE_SPACE.NODES.SIZES.CONTROL.DETAIL / 2; // 225px
        const navRadius = COORDINATE_SPACE.NODES.SIZES.NAVIGATION / 2; // 40px
        const gapDistance = COORDINATE_SPACE.LAYOUT.NAVIGATION.DISTANCE.FIXED_DISTANCE.DETAIL_MODE; // 70px
        
        // Ring radius to center of navigation nodes
        const ringRadius = controlRadius + gapDistance + navRadius; // 335px
        
        // Outer edge of navigation nodes
        const navOuterEdge = ringRadius + navRadius; // 375px
        
        // Content nodes need to start beyond this, with safety buffer
        const SAFETY_BUFFER = 60; // Extra space for collision detection and forces
        const safeMinimum = navOuterEdge + SAFETY_BUFFER; // 435px
        
        // Use the larger of configured distance or safe minimum
        const effectiveDistance = Math.max(this.configuredBaseDistance, safeMinimum);
        
        console.log('[UniversalPositioning] Safe distance calculation:', {
            controlRadius,
            navRadius,
            gapDistance,
            ringRadius,
            navOuterEdge,
            SAFETY_BUFFER,
            safeMinimum,
            configuredBase: this.configuredBaseDistance,
            effectiveDistance,
            spacingBeyondNavRing: effectiveDistance - navOuterEdge
        });
        
        return effectiveDistance;
    }
    
    /**
     * Get the effective base distance (accounts for navigation ring)
     */
    public getEffectiveBaseDistance(): number {
        return this.effectiveBaseDistance;
    }
    
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
            node.type === 'answer' || node.type === 'quantity' || node.type === 'evidence' || node.type === 'category' || node.type === 'definition' || node.type === 'word') {
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
     * Calculate target distance for a node based on its index
     * Uses ring-based approach for first nodes, then transitions to spiral
     * UPDATED: Uses effectiveBaseDistance instead of configured base
     */
    private calculateTargetDistance(globalIndex: number): number {
        if (globalIndex < this.FIRST_RING_SIZE) {
            // First ring: all nodes at effective base distance
            return this.effectiveBaseDistance;
        } else if (globalIndex < this.FIRST_RING_SIZE + this.SECOND_RING_SIZE) {
            // Second ring: effective base + one increment
            return this.effectiveBaseDistance + this.RING_DISTANCE_INCREMENT;
        } else if (this.THIRD_RING_SIZE > 0 && 
                   globalIndex < this.FIRST_RING_SIZE + this.SECOND_RING_SIZE + this.THIRD_RING_SIZE) {
            // Third ring: effective base + two increments
            return this.effectiveBaseDistance + (2 * this.RING_DISTANCE_INCREMENT);
        } else {
            // Subsequent nodes: use smooth spiral
            const ringsTotal = this.FIRST_RING_SIZE + this.SECOND_RING_SIZE + this.THIRD_RING_SIZE;
            const spiralIndex = globalIndex - ringsTotal;
            const ringsCount = this.THIRD_RING_SIZE > 0 ? 3 : 2;
            
            return this.effectiveBaseDistance + 
                   (ringsCount * this.RING_DISTANCE_INCREMENT) + 
                   (Math.sqrt(spiralIndex) * this.distanceIncrement);
        }
    }
    
    /**
     * Calculate angle for a node with even distribution
     * Uses different strategies for rings vs spiral
     * UPDATED: Supports 3 rings
     */
    private calculateAngle(globalIndex: number): number {
        if (globalIndex < this.FIRST_RING_SIZE) {
            // First ring: evenly distribute nodes in a circle
            return (globalIndex / this.FIRST_RING_SIZE) * 2 * Math.PI;
        } else if (globalIndex < this.FIRST_RING_SIZE + this.SECOND_RING_SIZE) {
            // Second ring: evenly distribute with offset from first ring
            const secondRingIndex = globalIndex - this.FIRST_RING_SIZE;
            const angleOffset = Math.PI / this.SECOND_RING_SIZE; // Offset for visual variation
            return (secondRingIndex / this.SECOND_RING_SIZE) * 2 * Math.PI + angleOffset;
        } else if (this.THIRD_RING_SIZE > 0 && 
                   globalIndex < this.FIRST_RING_SIZE + this.SECOND_RING_SIZE + this.THIRD_RING_SIZE) {
            // Third ring: evenly distribute with different offset
            const thirdRingIndex = globalIndex - this.FIRST_RING_SIZE - this.SECOND_RING_SIZE;
            const angleOffset = Math.PI / (this.THIRD_RING_SIZE * 2); // Different offset
            return (thirdRingIndex / this.THIRD_RING_SIZE) * 2 * Math.PI + angleOffset;
        } else {
            // Spiral nodes: golden angle for natural distribution
            return globalIndex * this.goldenAngle;
        }
    }
    
    /**
     * Calculate positions for single-node sequential rendering
     * Uses global index to maintain continuity across batches
     * UPDATED: Uses effectiveBaseDistance for safe positioning
     */
    public calculateSingleNodePositions(
        nodes: EnhancedNode[],
        globalStartIndex: number = 0
    ): void {
        const contentNodes = nodes.filter(node => 
            node.type === 'statement' || node.type === 'openquestion' ||
            node.type === 'answer' || node.type === 'quantity' || node.type === 'evidence' || node.type === 'category' || node.type === 'definition' || node.type === 'word'
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
            
            // Calculate distance and angle based on ring strategy
            const targetDistance = this.calculateTargetDistance(globalIndex);
            const angle = this.calculateAngle(globalIndex);
            
            node.x = Math.cos(angle) * targetDistance;
            node.y = Math.sin(angle) * targetDistance;
            
            // Store positioning data for forces
            (node as any).voteBasedDistance = targetDistance;
            (node as any).netVotes = netVotes;
            (node as any).voteRank = globalIndex;
            (node as any).initialAngle = angle;
        });
        
        // Log first few positioned nodes for verification
        if (contentNodes.length > 0) {
            console.log('[UniversalPositioning] First 3 nodes positioned:', 
                contentNodes.slice(0, 3).map(n => ({
                    id: n.id.substring(0, 8),
                    votes: (n as any).netVotes,
                    distance: Math.sqrt((n.x || 0) ** 2 + (n.y || 0) ** 2).toFixed(1),
                    targetDistance: (n as any).voteBasedDistance?.toFixed(1)
                }))
            );
        }
    }
    
    /**
     * Calculate positions for batch rendering with continuity
     * UPDATED: Uses effectiveBaseDistance for safe positioning
     */
    public calculateBatchPositions(
        nodes: EnhancedNode[],
        batchNumber: number,
        nodesPerBatch: number
    ): void {
        const contentNodes = nodes.filter(node => 
            node.type === 'statement' || node.type === 'openquestion' ||
            node.type === 'answer' || node.type === 'quantity' || node.type === 'evidence' || node.type === 'category' || node.type === 'definition' || node.type === 'word'
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
            
            // Calculate distance and angle based on ring strategy
            const targetDistance = this.calculateTargetDistance(index);
            const angle = this.calculateAngle(index);
            
            node.x = Math.cos(angle) * targetDistance;
            node.y = Math.sin(angle) * targetDistance;
            
            // Store positioning data for forces
            (node as any).voteBasedDistance = targetDistance;
            (node as any).netVotes = netVotes;
            (node as any).voteRank = index;
            (node as any).initialAngle = angle;
        });
        
        // Log batch positioning summary
        if (contentNodes.length > 0) {
            const distances = contentNodes.map(n => Math.sqrt((n.x || 0) ** 2 + (n.y || 0) ** 2));
            const minDist = Math.min(...distances);
            const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
            
            console.log('[UniversalPositioning] Batch positioned:', {
                batchNumber,
                nodeCount: contentNodes.length,
                minDistance: minDist.toFixed(1),
                avgDistance: avgDist.toFixed(1),
                effectiveBase: this.effectiveBaseDistance
            });
        }
    }
    
    /**
     * Calculate spiral angle using golden angle
     */
    private calculateSpiralAngle(index: number): number {
        // Golden angle spiral for even distribution
        return index * this.goldenAngle;
    }
    
    /**
     * Get initial position for a new node being added dynamically
     * UPDATED: Uses effectiveBaseDistance for safe positioning
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
        
        // Calculate position using ring strategy with safe base distance
        const targetDistance = this.calculateTargetDistance(insertIndex);
        const angle = this.calculateAngle(insertIndex);
        
        return {
            x: Math.cos(angle) * targetDistance,
            y: Math.sin(angle) * targetDistance,
            angle,
            distance: targetDistance
        };
    }
}