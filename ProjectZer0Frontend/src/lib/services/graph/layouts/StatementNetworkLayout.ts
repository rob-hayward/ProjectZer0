// src/lib/services/graph/layouts/StatementNetworkLayout.ts
import * as d3 from 'd3';
import { BaseLayoutStrategy } from './BaseLayoutStrategy';
import { NavigationNodeLayout } from './common/NavigationNodeLayout';
import type { EnhancedNode, EnhancedLink } from '../../../types/graph/enhanced';
import { asD3Nodes, asD3Links } from '../../../types/graph/enhanced';
import type { ViewType, NodeMode } from '$lib/types/graph/enhanced';
import { COORDINATE_SPACE } from '../../../constants/graph';
import { statementNetworkStore } from '../../../stores/statementNetworkStore';

/**
 * Layout for statement networks following the WordDefinitionLayout pattern
 * 
 * Features:
 * - Central control node fixed at center (0,0)
 * - Navigation nodes in a circle around the central node
 * - Top statement positioned like live definition (to the right)
 * - Other statements positioned in a golden angle spiral based on vote rank
 * - Support for expand/collapse with proper spacing adjustment
 * - Support for hidden nodes with proper positioning
 */
export class StatementNetworkLayout extends BaseLayoutStrategy {
    private readonly GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
    private readonly FIRST_STATEMENT_ANGLE = Math.PI;
    
    // Track node positioning
    private statementAngles: Map<string, number> = new Map();
    private expansionState: Map<string, boolean> = new Map();
    private expandedStatements: Map<string, { rankIndex: number, adjustment: number }> = new Map();
    private hiddenNodes: Map<string, { rankIndex: number, adjustment: number }> = new Map();
    
    // Caching for performance
    private nodeVotesCache = new Map<string, number>();
    private nodeRankMap = new Map<string, number>();
    private nodeRadiusCache = new Map<string, { radius: number, collisionRadius: number }>();
    
    // Store subscription and settings
    private sortType = 'netPositive';
    private sortDirection = 'desc';
    private storeUnsubscribe: (() => void) | null = null;

    constructor(width: number, height: number, viewType: ViewType) {
        super(width, height, viewType);
        this.subscribeToStore();
    }
    
    /**
     * Subscribe to store for sort setting changes
     */
    private subscribeToStore(): void {
        if (statementNetworkStore && typeof statementNetworkStore.subscribe === 'function') {
            this.storeUnsubscribe = statementNetworkStore.subscribe((state) => {
                // Only update if sort settings changed
                if (this.sortType !== state.sortType || this.sortDirection !== state.sortDirection) {
                    this.sortType = state.sortType;
                    this.sortDirection = state.sortDirection;
                    
                    if (this.simulation) {
                        // Get current nodes
                        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
                        
                        // Recalculate node ranks with new sort settings
                        this.calculateNodeRanks(nodes);
                        
                        // Reposition statement nodes
                        this.repositionStatementNodes(nodes);
                        
                        // Apply fixed positions
                        this.enforceFixedPositions();
                        
                        // Manually tick simulation to apply new positions
                        this.forceTick(3);
                    }
                }
            });
        }
    }
    
    /**
     * Force simulation ticks for immediate position updates
     */
    private forceTick(ticks: number = 1): void {
        for (let i = 0; i < ticks; i++) {
            // Before each tick, ensure positions are fixed
            this.enforceFixedPositions();
            
            // Tick the simulation
            this.simulation.tick();
        }
    }
    
    /**
     * Get net votes for a node (positive - negative)
     */
    private getNetVotes(node: EnhancedNode): number {
        // Use cached value if available
        if (this.nodeVotesCache.has(node.id + '_net')) {
            return this.nodeVotesCache.get(node.id + '_net') || 0;
        }
        
        let netVotes = 0;
        
        if (node.type === 'statement' && node.data) {
            // Calculate net votes
            if ('positiveVotes' in node.data && 'negativeVotes' in node.data) {
                const posVotes = this.getNeo4jNumber(node.data.positiveVotes) || 0;
                const negVotes = this.getNeo4jNumber(node.data.negativeVotes) || 0;
                netVotes = posVotes - negVotes;
            } else if (node.metadata?.votes !== undefined) {
                netVotes = node.metadata.votes;
            }
        }
        
        // Cache the result
        this.nodeVotesCache.set(node.id + '_net', netVotes);
        return netVotes;
    }
    
    /**
     * Get total votes for a node (positive + negative)
     */
    private getTotalVotes(node: EnhancedNode): number {
        // Use cached value if available
        if (this.nodeVotesCache.has(node.id + '_total')) {
            return this.nodeVotesCache.get(node.id + '_total') || 0;
        }
        
        let totalVotes = 0;
        
        if (node.type === 'statement' && node.data) {
            // Calculate total votes
            if ('positiveVotes' in node.data && 'negativeVotes' in node.data) {
                const posVotes = this.getNeo4jNumber(node.data.positiveVotes) || 0;
                const negVotes = this.getNeo4jNumber(node.data.negativeVotes) || 0;
                totalVotes = posVotes + negVotes;
            }
        }
        
        // Cache the result
        this.nodeVotesCache.set(node.id + '_total', totalVotes);
        return totalVotes;
    }
    
    /**
     * Get creation date timestamp for chronological sorting
     */
    private getCreationDate(node: EnhancedNode): number {
        // Use cached value if available
        if (this.nodeVotesCache.has(node.id + '_date')) {
            return this.nodeVotesCache.get(node.id + '_date') || 0;
        }
        
        let timestamp = 0;
        
        if (node.type === 'statement' && node.data) {
            // Extract creation date
            if ('createdAt' in node.data) {
                const dateStr = node.data.createdAt;
                if (typeof dateStr === 'string') {
                    const date = new Date(dateStr);
                    timestamp = date.getTime();
                }
            } else if (node.metadata?.createdAt) {
                const date = new Date(node.metadata.createdAt);
                timestamp = date.getTime();
            }
        }
        
        // Cache the result
        this.nodeVotesCache.set(node.id + '_date', timestamp);
        return timestamp;
    }
    
    /**
     * Extract number from Neo4j objects
     */
    private getNeo4jNumber(value: any): number {
        if (value && typeof value === 'object' && 'low' in value) {
            return Number(value.low);
        }
        return Number(value || 0);
    }
    
    /**
     * Calculate node ranks based on current sort settings
     */
    private calculateNodeRanks(nodes: EnhancedNode[]): void {
        // Clear existing ranks
        this.nodeRankMap.clear();
        
        // Get visible statement nodes
        const statementNodes = nodes.filter(n => n.type === 'statement' && !n.isHidden);
        
        // Sort based on current sort settings
        const sortedNodes = [...statementNodes].sort((a, b) => {
            let comparison = 0;
            
            if (this.sortType === 'netPositive') {
                const aVotes = this.getNetVotes(a);
                const bVotes = this.getNetVotes(b);
                comparison = bVotes - aVotes; // Higher votes first
            } 
            else if (this.sortType === 'totalVotes') {
                const aTotalVotes = this.getTotalVotes(a);
                const bTotalVotes = this.getTotalVotes(b);
                comparison = bTotalVotes - aTotalVotes; // Higher total first
            }
            else if (this.sortType === 'chronological') {
                const aDate = this.getCreationDate(a);
                const bDate = this.getCreationDate(b);
                comparison = bDate - aDate; // Newer first
            }
            
            // Apply sort direction
            return this.sortDirection === 'desc' ? comparison : -comparison;
        });
        
        // Assign rank to each node (position in sorted list)
        sortedNodes.forEach((node, index) => {
            this.nodeRankMap.set(node.id, index);
        });
    }
    
    /**
     * Initialize node positions like WordDefinitionLayout approach
     */
    initializeNodePositions(nodes: EnhancedNode[]): void {
        // Stop simulation during initialization
        this.simulation.stop();
        
        // Clear all forces - this is critical for performance
        this.clearAllForces();
        
        // Clear caches
        this.nodeVotesCache.clear();
        this.nodeRankMap.clear();
        this.nodeRadiusCache.clear();
        
        // Update expansion state tracking
        this.updateExpansionState(nodes);
        
        // Update hidden state tracking
        this.updateHiddenState(nodes);
        
        // Reset velocities
        nodes.forEach(node => {
            node.vx = 0;
            node.vy = 0;
            
            // Clear fixed positions for non-central nodes
            if (!node.fixed && node.group !== 'central') {
                node.fx = undefined;
                node.fy = undefined;
            }
        });
        
        // Position navigation nodes using NavigationNodeLayout
        NavigationNodeLayout.positionNavigationNodes(
            nodes, 
            this.getNodeRadius.bind(this)
        );
        
        // Position central control node (if it exists)
        const centralNode = nodes.find(n => n.fixed || n.group === 'central');
        if (centralNode) {
            // Center the control node with EXPLICIT POSITION FIXING
            centralNode.fx = 0;
            centralNode.fy = 0;
            centralNode.x = 0;
            centralNode.y = 0;
            centralNode.vx = 0;
            centralNode.vy = 0;
            centralNode.fixed = true; // Ensure fixed flag is set
            
            // Ensure metadata reflects this
            if (centralNode.metadata) {
                centralNode.metadata.fixed = true;
            }
        }
        
        // Calculate node ranks to determine layout order
        this.calculateNodeRanks(nodes);
        
        // Position statement nodes
        this.positionStatementNodes(nodes);
        
        // Enforce fixed positions
        this.enforceFixedPositions();
    }
    
    /**
     * Position statement nodes - top one separately, rest in spiral
     */
    private positionStatementNodes(nodes: EnhancedNode[]): void {
        // Get visible statement nodes
        const statementNodes = nodes.filter(n => n.type === 'statement' && !n.isHidden);
        
        // Special handling for the most net-positive statement (like "live definition")
        const topStatement = statementNodes.find(n => this.nodeRankMap.get(n.id) === 0);
        
        if (topStatement) {
            // Position most net-positive statement specially to the right of control node
            this.positionTopStatement(topStatement);
        }
        
        // Position remaining statements in a spiral, starting from rank 1
        statementNodes.forEach(node => {
            const rankIndex = this.nodeRankMap.get(node.id) || 0;
            
            // Skip the top statement (already positioned)
            if (rankIndex === 0) return;
            
            // Calculate position with all adjustments
            const position = this.calculateStatementPosition(node, rankIndex);
            
            // Set position
            node.x = position.x;
            node.y = position.y;
            
            // Zero velocity
            node.vx = 0;
            node.vy = 0;
            
            // Cache node radius
            this.cacheNodeRadius(node);
        });
        
        // Position hidden nodes in outer circle
        const hiddenNodes = nodes.filter(n => n.type === 'statement' && n.isHidden);
        hiddenNodes.forEach((node, i) => {
            // Distribute evenly in outer circle
            const angle = (i / Math.max(1, hiddenNodes.length)) * Math.PI * 2;
            const radius = 1800; // Far outside visible nodes
            
            // Set position
            node.x = Math.cos(angle) * radius;
            node.y = Math.sin(angle) * radius;
            
            // Zero velocity
            node.vx = 0;
            node.vy = 0;
            
            // Cache radius
            this.cacheNodeRadius(node);
            
            // Store angle for consistency
            this.statementAngles.set(node.id, angle);
        });
    }
    
    /**
     * Position the top-ranked statement (most net-positive) to the right
     */
    private positionTopStatement(node: EnhancedNode): void {
        // Basic positioning constants
        const baseRadius = COORDINATE_SPACE.LAYOUT.RING_SPACING.INITIAL;
        
        // Retrieve the control node to check its state
        const controlNode = (this.simulation.nodes() as unknown as EnhancedNode[])
            .find(n => n.fixed || n.group === 'central');
        
        // Calculate adjustments based on control node state
        const controlAdjustment = controlNode?.mode === 'preview' ?
            // If control is in preview mode, move statements inward
            (COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL - COORDINATE_SPACE.NODES.SIZES.STANDARD.PREVIEW) / 2 :
            0;
            
        // Calculate expansion adjustment - move outward if expanded
        const expansionAdjustment = node.mode === 'detail' ?
            (COORDINATE_SPACE.NODES.SIZES.STATEMENT.DETAIL - COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW) / 2 :
            0;
            
        // Calculate hidden adjustment - move inward if hidden
        const hiddenAdjustment = node.isHidden ?
            -(COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW - COORDINATE_SPACE.NODES.SIZES.HIDDEN) / 2 :
            0;
        
        // Calculate final position - expansion moves outward, control preview moves inward
        const posX = baseRadius + expansionAdjustment - controlAdjustment + hiddenAdjustment;

        // Set position to the right of control node
        node.x = posX;
        node.y = 0;

        // Store angle for consistency
        this.statementAngles.set(node.id, 0);
        
        // Cache radius
        this.cacheNodeRadius(node);
    }
    
    /**
     * Reposition all statement nodes (used after sort changes)
     */
    private repositionStatementNodes(nodes: EnhancedNode[]): void {
        // Get visible statement nodes
        const statementNodes = nodes.filter(n => n.type === 'statement' && !n.isHidden);
        
        // Special handling for the most net-positive statement (like "live definition")
        const topStatement = statementNodes.find(n => this.nodeRankMap.get(n.id) === 0);
        
        if (topStatement) {
            // Position most net-positive statement specially to the right of control node
            this.positionTopStatement(topStatement);
            
            // If expanded in detail mode, fix its position
            if (topStatement.mode === 'detail') {
                topStatement.fx = topStatement.x;
                topStatement.fy = topStatement.y;
            } else {
                topStatement.fx = undefined;
                topStatement.fy = undefined;
            }
        }
        
        // Position remaining statements
        statementNodes.forEach(node => {
            const rankIndex = this.nodeRankMap.get(node.id) || 0;
            
            // Skip the top statement (already positioned)
            if (rankIndex === 0) return;
            
            // Calculate position with all adjustments
            const position = this.calculateStatementPosition(node, rankIndex);
            
            // Set position
            node.x = position.x;
            node.y = position.y;
            
            // Fix position for expanded nodes
            if (node.mode === 'detail') {
                node.fx = position.x;
                node.fy = position.y;
            } else {
                node.fx = undefined;
                node.fy = undefined;
            }
            
            // Zero velocity
            node.vx = 0;
            node.vy = 0;
        });
    }
    
    /**
     * Calculate position for a statement node considering all adjustments
     */
    private calculateStatementPosition(node: EnhancedNode, rankIndex: number): { x: number, y: number, angle: number, radius: number } {
        // Get or assign an angle for this node
        const nodeId = node.id;
        let angle = this.statementAngles.get(nodeId);
        
        if (angle === undefined) {
            // Adjust rankIndex to account for the special handling of the top statement
            // This ensures we start the spiral from the second highest ranked node
            const adjustedRank = rankIndex > 0 ? rankIndex - 1 : rankIndex;
            
            // Calculate angle using golden ratio for even distribution
            // For the top node, use 0 degrees (right of center)
            // For all other nodes, use golden angle distribution
            angle = rankIndex === 0 ? 
                0 : // Top node on the right
                (this.FIRST_STATEMENT_ANGLE + (this.GOLDEN_ANGLE * adjustedRank)) % (2 * Math.PI);
                
            this.statementAngles.set(nodeId, angle);
        }
        
        // Calculate base radius from coordinate space constants
        // Using same approach as WordDefinitionLayout but accounting for top node
        const baseRadius = COORDINATE_SPACE.LAYOUT.RING_SPACING.INITIAL * 
            (1 + (rankIndex * COORDINATE_SPACE.LAYOUT.RING_SPACING.INCREMENT));
        
        // Retrieve the central node to check its state
        const centralNode = (this.simulation.nodes() as unknown as EnhancedNode[])
            .find(n => n.fixed || n.group === 'central');
        
        // Calculate central node adjustment
        const centralAdjustment = centralNode?.mode === 'preview' ?
            // If central node is in preview mode, move statements inward
            (COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL - COORDINATE_SPACE.NODES.SIZES.STANDARD.PREVIEW) / 2 :
            0;
            
        // Calculate expansion adjustment - move outward if expanded
        const expansionAdjustment = node.mode === 'detail' ?
            (COORDINATE_SPACE.NODES.SIZES.STATEMENT.DETAIL - COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW) / 2 +
            COORDINATE_SPACE.LAYOUT.RING_SPACING.DEFINITION_EXPANSION_BUFFER :
            0;
        
        // Calculate adjustment from inner expanded nodes
        let innerExpandedAdjustment = 0;
        this.expandedStatements.forEach((data, id) => {
            // If this is an inner ring node that's expanded, add its adjustment
            if (data.rankIndex < rankIndex) {
                innerExpandedAdjustment += data.adjustment;
            }
        });
        
        // Calculate adjustment from inner hidden nodes
        let innerHiddenAdjustment = 0;
        this.hiddenNodes.forEach((data, id) => {
            // If this is an inner ring node that's hidden, add its adjustment (negative)
            if (data.rankIndex < rankIndex) {
                innerHiddenAdjustment += data.adjustment;
            }
        });
        
        // Calculate final radius with all adjustments
        const radius = baseRadius + 
                      expansionAdjustment - 
                      centralAdjustment + 
                      innerExpandedAdjustment + 
                      innerHiddenAdjustment;
        
        // Calculate coordinates
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        
        return { x, y, angle, radius };
    }
    
    /**
     * Update expansion state tracking
     */
    private updateExpansionState(nodes: EnhancedNode[]): void {
        // Clear expanded statements
        this.expandedStatements.clear();
        
        nodes.forEach(node => {
            if (node.type === 'statement') {
                const wasExpanded = this.expansionState.get(node.id) || false;
                const isExpanded = node.mode === 'detail';
                
                // Update tracking
                this.expansionState.set(node.id, isExpanded);
                
                // Update expanded statements tracking
                if (isExpanded) {
                    // Calculate rank index
                    const rankIndex = this.nodeRankMap.get(node.id) || 0;
                    
                    // Calculate adjustment
                    const adjustment = (COORDINATE_SPACE.NODES.SIZES.STATEMENT.DETAIL - 
                                      COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW) / 2 +
                                      COORDINATE_SPACE.LAYOUT.RING_SPACING.DEFINITION_EXPANSION_BUFFER;
                                      
                    this.expandedStatements.set(node.id, { rankIndex, adjustment });
                }
            }
        });
    }
    
    /**
     * Update hidden node state tracking
     */
    private updateHiddenState(nodes: EnhancedNode[]): void {
        // Clear hidden nodes map
        this.hiddenNodes.clear();
        
        nodes.forEach(node => {
            if (node.type === 'statement') {
                const isHidden = node.isHidden || false;
                
                // Update hidden nodes tracking
                if (isHidden) {
                    // Calculate rank index
                    const rankIndex = this.nodeRankMap.get(node.id) || 0;
                    
                    // Calculate adjustment (negative value to pull inward)
                    const adjustment = -(COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW - 
                                      COORDINATE_SPACE.NODES.SIZES.HIDDEN) / 2;
                                      
                    this.hiddenNodes.set(node.id, { rankIndex, adjustment });
                }
            }
        });
    }
    
    /**
     * Precalculate node radius and cache it
     */
    private cacheNodeRadius(node: EnhancedNode): void {
        const baseRadius = node.radius || this.getNodeRadius(node);
        
        // Calculate collision radius (base + padding)
        let collisionPadding = 0;
        
        if (node.type === 'navigation') {
            collisionPadding = COORDINATE_SPACE.NODES.PADDING.COLLISION.NAVIGATION;
        } else if (node.type === 'statement') {
            collisionPadding = COORDINATE_SPACE.NODES.PADDING.COLLISION.STATEMENT + 20;
            
            // More padding for important nodes
            if (!node.isHidden) {
                const rank = this.nodeRankMap.get(node.id) || 0;
                if (rank === 0) {
                    collisionPadding += 30; // More space for top node
                } else if (rank < 5) {
                    collisionPadding += 20; // More space for top 5
                } else if (rank < 10) {
                    collisionPadding += 10; // More space for top 10
                }
            }
        } else {
            collisionPadding = COORDINATE_SPACE.NODES.PADDING.COLLISION.BASE;
        }
        
        this.nodeRadiusCache.set(node.id, {
            radius: baseRadius,
            collisionRadius: baseRadius + collisionPadding
        });
    }
    
    /**
     * Configure forces - CRITICAL for performance
     * Using minimal forces like WordDefinitionLayout
     */
    configureForces(): void {
        // Clear all forces - KEY to performance
        this.clearAllForces();
        
        // No forces, just fixed positions
        
        // Add a tick handler to enforce positions on every tick
        this.simulation.on('tick.fixedPosition', () => {
            this.enforceFixedPositions();
        });
        
        // Start with minimal alpha
        this.simulation.alpha(0.01).restart();
    }
    
    /**
     * Clear all forces from simulation - like WordDefinitionLayout
     */
    private clearAllForces(): void {
        // Using NavigationNodeLayout method for force removal
        NavigationNodeLayout.configureNoForces(this.simulation);
    }
    
    /**
     * Enforce fixed positions for all nodes - CRITICAL for stability
     */
    public enforceFixedPositions(): void {
        if (!this.simulation) return;
        
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        
        // Fix central node position
        const centralNode = nodes.find(n => n.fixed || n.group === 'central');
        if (centralNode) {
            centralNode.x = 0;
            centralNode.y = 0;
            centralNode.fx = 0;
            centralNode.fy = 0;
            centralNode.vx = 0;
            centralNode.vy = 0;
            centralNode.fixed = true;
        }
        
        // Fix navigation node positions
        nodes.forEach(node => {
            if (node.type === 'navigation' && node.fx !== undefined && node.fy !== undefined) {
                node.x = node.fx;
                node.y = node.fy;
                node.vx = 0;
                node.vy = 0;
            }
            
            // Fix expanded statement nodes
            if (node.type === 'statement' && node.mode === 'detail' && !node.isHidden) {
                if (node.fx === undefined || node.fy === undefined) {
                    node.fx = node.x;
                    node.fy = node.y;
                } else {
                    node.x = node.fx;
                    node.y = node.fy;
                }
                node.vx = 0;
                node.vy = 0;
            }
        });
        
        // Force simulation to honor these positions
        this.simulation.alpha(0).alphaTarget(0);
    }
    
    /**
     * Handle node mode changes (expand/collapse)
     */
    public handleNodeStateChange(nodeId: string, mode: NodeMode): void {
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const node = nodes.find(n => n.id === nodeId);
        
        if (!node) return;
        
        // Update node mode
        node.mode = mode;
        node.expanded = mode === 'detail';
        
        // Update radius based on new mode
        node.radius = this.getNodeRadius(node);
        
        // Update tracking
        let recalculatePositions = false;
        
        // For central control node, update all statement positions
        if (node.group === 'central') {
            recalculatePositions = true;
        }
        // For statement nodes, update expansion state tracking
        else if (node.type === 'statement') {
            const rankIndex = this.nodeRankMap.get(nodeId) || 0;
            
            if (mode === 'detail') {
                // Add to expanded statements with adjustment
                const adjustment = (COORDINATE_SPACE.NODES.SIZES.STATEMENT.DETAIL - 
                                  COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW) / 2 +
                                  COORDINATE_SPACE.LAYOUT.RING_SPACING.DEFINITION_EXPANSION_BUFFER;
                                  
                this.expandedStatements.set(nodeId, { rankIndex, adjustment });
                this.expansionState.set(nodeId, true);
                
                // Fix position
                node.fx = node.x;
                node.fy = node.y;
                
                recalculatePositions = true;
            } else {
                // Remove from expanded statements
                this.expandedStatements.delete(nodeId);
                this.expansionState.set(nodeId, false);
                
                // Release fixed position
                node.fx = undefined;
                node.fy = undefined;
                
                recalculatePositions = true;
            }
        }
        
        // Recalculate positions if needed
        if (recalculatePositions) {
            this.repositionStatementNodes(nodes);
        }
        
        // Force fixed positions
        this.enforceFixedPositions();
        
        // Manually tick simulation to apply changes
        this.forceTick(3);
    }
    
    /**
     * Handle node visibility changes
     */
    public handleNodeVisibilityChange(nodeId: string, isHidden: boolean): void {
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const node = nodes.find(n => n.id === nodeId);
        
        if (!node) return;
        
        // Update node visibility
        node.isHidden = isHidden;
        
        // Update radius based on new visibility
        node.radius = this.getNodeRadius(node);
        
        // Cache node radius
        this.cacheNodeRadius(node);
        
        // Handle specific node types
        if (node.type === 'statement') {
            const rankIndex = this.nodeRankMap.get(nodeId) || 0;
            
            if (isHidden) {
                // Add to hidden nodes
                const adjustment = -(COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW - 
                                  COORDINATE_SPACE.NODES.SIZES.HIDDEN) / 2;
                                  
                this.hiddenNodes.set(nodeId, { rankIndex, adjustment });
                
                // Remove from expanded nodes if needed
                this.expandedStatements.delete(nodeId);
                this.expansionState.set(nodeId, false);
                
                // Release fixed position
                node.fx = undefined;
                node.fy = undefined;
            } else {
                // Remove from hidden nodes
                this.hiddenNodes.delete(nodeId);
                
                // If node was expanded, restore that state
                if (node.mode === 'detail') {
                    const adjustment = (COORDINATE_SPACE.NODES.SIZES.STATEMENT.DETAIL - 
                                      COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW) / 2 +
                                      COORDINATE_SPACE.LAYOUT.RING_SPACING.DEFINITION_EXPANSION_BUFFER;
                                      
                    this.expandedStatements.set(nodeId, { rankIndex, adjustment });
                    this.expansionState.set(nodeId, true);
                    
                    // Fix position at calculated coordinates
                    const position = this.calculateStatementPosition(node, rankIndex);
                    node.x = position.x;
                    node.y = position.y;
                    node.fx = position.x;
                    node.fy = position.y;
                }
            }
            
            // Recalculate node ranks
            this.calculateNodeRanks(nodes);
            
            // Reposition all statement nodes
            this.repositionStatementNodes(nodes);
        }
        
        // Force fixed positions
        this.enforceFixedPositions();
        
        // Manually tick simulation to apply changes
        this.forceTick(3);
    }
    
    /**
     * Apply visibility preferences
     */
    public applyVisibilityPreferences(preferences: Record<string, boolean>): void {
        if (!preferences || Object.keys(preferences).length === 0) return;
        
        // Get nodes
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        if (!nodes || nodes.length === 0) return;
        
        // Track if any changes were made
        let changed = false;
        
        // Apply preferences
        Object.entries(preferences).forEach(([nodeId, isVisible]) => {
            const node = nodes.find(n => n.id === nodeId);
            if (!node) return;
            
            const shouldBeHidden = !isVisible;
            if (node.isHidden !== shouldBeHidden) {
                // Update node
                node.isHidden = shouldBeHidden;
                node.hiddenReason = 'user';
                node.radius = this.getNodeRadius(node);
                
                // Update cache
                this.cacheNodeRadius(node);
                
                // Handle statement nodes
                if (node.type === 'statement') {
                    const rankIndex = this.nodeRankMap.get(nodeId) || 0;
                    
                    if (shouldBeHidden) {
                        // Add to hidden nodes
                        const adjustment = -(COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW - 
                                          COORDINATE_SPACE.NODES.SIZES.HIDDEN) / 2;
                                          
                        this.hiddenNodes.set(nodeId, { rankIndex, adjustment });
                        
                        // Remove from expanded nodes if needed
                        this.expandedStatements.delete(nodeId);
                        this.expansionState.set(nodeId, false);
                        
                        // Release fixed position
                        node.fx = undefined;
                        node.fy = undefined;
                    } else {
                        // Remove from hidden nodes
                        this.hiddenNodes.delete(nodeId);
                        
                        // If node was expanded, restore that state
                        if (node.mode === 'detail') {
                            const adjustment = (COORDINATE_SPACE.NODES.SIZES.STATEMENT.DETAIL - 
                                              COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW) / 2 +
                                              COORDINATE_SPACE.LAYOUT.RING_SPACING.DEFINITION_EXPANSION_BUFFER;
                                              
                            this.expandedStatements.set(nodeId, { rankIndex, adjustment });
                            this.expansionState.set(nodeId, true);
                        }
                    }
                }
                
                changed = true;
            }
        });
        
        // Only update if changes were made
        if (changed) {
            // Recalculate node ranks
            this.calculateNodeRanks(nodes);
            
            // Reposition all statement nodes
            this.repositionStatementNodes(nodes);
            
            // Force fixed positions
            this.enforceFixedPositions();
            
            // Manually tick simulation to apply changes
            this.forceTick(3);
        }
    }
    
    /**
     * Update data with manually positioned nodes
     */
    public updateData(nodes: EnhancedNode[], links: EnhancedLink[], skipAnimation: boolean = true): void {
        // Always stop simulation
        this.simulation.stop();
        
        // Initialize positions
        this.initializeNodePositions(nodes);
        
        // Update nodes in simulation
        this.simulation.nodes(asD3Nodes(nodes));
        
        // Configure forces (minimal forces)
        this.configureForces();
        
        // Enforce fixed positions
        this.enforceFixedPositions();
        
        // Always skip animation for fixed positioning
        if (skipAnimation) {
            // Manually tick to apply positions
            for (let i = 0; i < 3; i++) {
                this.simulation.tick();
            }
            
            // Set zero alpha to prevent movement
            this.simulation.alpha(0);
            
            // Zero out velocities
            nodes.forEach(node => {
                node.vx = 0;
                node.vy = 0;
            });
        } else {
            // In case we want minimal animation
            this.simulation.alpha(0.01).restart();
        }
    }
    
    /**
     * Clean up resources
     */
    public dispose(): void {
        // Clean up subscription
        if (this.storeUnsubscribe) {
            this.storeUnsubscribe();
            this.storeUnsubscribe = null;
        }
        
        // Clear caches
        this.nodeVotesCache.clear();
        this.nodeRankMap.clear();
        this.nodeRadiusCache.clear();
        this.statementAngles.clear();
        this.expansionState.clear();
        this.expandedStatements.clear();
        this.hiddenNodes.clear();
        
        // Stop simulation
        this.stop();
    }
}