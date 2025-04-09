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
 * Layout for statement networks
 * 
 * - Central control node fixed at center (0,0)
 * - Navigation nodes in a circle around the central node
 * - Top statement positioned to the right
 * - Other statements positioned in a golden angle spiral based on vote rank
 */
export class StatementNetworkLayout extends BaseLayoutStrategy {
    private readonly GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
    private readonly FIRST_STATEMENT_ANGLE = Math.PI; // Same angle as first alternative definition
    private statementAngles: Map<string, number> = new Map();
    private expansionState: Map<string, boolean> = new Map();
    private expandedStatements: Map<string, { ringIndex: number, adjustment: number }> = new Map();
    private hiddenNodes: Map<string, { ringIndex: number, adjustment: number }> = new Map();
    
    // Store subscription and settings
    private sortType = 'netPositive';
    private sortDirection = 'desc';
    private storeUnsubscribe: (() => void) | null = null;
    
    // Use a rank map instead of storing rank in node.metadata
    private rankMap = new Map<string, number>();
    
    // Control node identification
    private controlNodeId: string | null = null;

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
     * Get net votes from the statement network store (single source of truth)
     */
    private getNetVotes(node: EnhancedNode): number {
        if (!node.data || node.type !== 'statement') {
            return 0;
        }
        
        // Get vote data from the statement network store
        const voteData = statementNetworkStore.getVoteData(node.id);
        return voteData.netVotes;
    }
    
    /**
     * Get total votes from statement network store
     */
    private getTotalVotes(node: EnhancedNode): number {
        if (!node.data || node.type !== 'statement') {
            return 0;
        }
        
        // Get vote data from the statement network store
        const voteData = statementNetworkStore.getVoteData(node.id);
        return voteData.positiveVotes + voteData.negativeVotes;
    }
    
    /**
     * Get creation date timestamp for chronological sorting
     */
    private getCreationDate(node: EnhancedNode): number {
        if (!node.data || node.type !== 'statement') {
            return 0;
        }
        
        if (node.data && 'createdAt' in node.data && node.data.createdAt) {
            const dateStr = node.data.createdAt;
            if (typeof dateStr === 'string') {
                return new Date(dateStr).getTime();
            }
        }
        
        return 0;
    }
    
    /**
     * Calculate node ranks based on current sort settings
     */
    private calculateNodeRanks(nodes: EnhancedNode[]): void {
        // Clear existing ranks
        this.rankMap.clear();
        
        // Get all statement nodes for ranking
        const allStatementNodes = nodes.filter(n => n.type === 'statement');
        
        // Sort based on current sort settings
        const sortedNodes = [...allStatementNodes].sort((a, b) => {
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
        
        // Store rank information in the rankMap for ALL statement nodes
        sortedNodes.forEach((node, index) => {
            this.rankMap.set(node.id, index);
            
            // Make sure node has metadata
            if (!node.metadata) {
                node.metadata = { group: 'statement' };
            }
        });
    }
    
    /**
     * Clear ALL forces from the simulation - similar to WordDefinitionLayout
     * This ensures no forces can affect node positions
     */
    private clearAllForces(): void {
        // Get all force names
        const sim = this.simulation as any;
        
        // List all forces that might be present
        const potentialForceNames = [
            'charge', 'collision', 'link', 'center', 'x', 'y',
            'manyBody', 'radial', 'navigationRadial', 'navigationCharge',
            'navigationCollision', 'centralCharge', 'centralCollision',
            'positioning', 'custom', 'cluster', 'centralNodeAnchor'
        ];
        
        // Remove all forces
        potentialForceNames.forEach(name => {
            try {
                sim.force(name, null);
            } catch (e) {
                // Ignore errors
            }
        });
        
        // Check if there are still any forces left
        const remainingForces = Object.keys(sim._forces || {});
        if (remainingForces.length > 0) {
            // Try to remove these as well
            remainingForces.forEach(name => {
                try {
                    sim.force(name, null);
                } catch (e) {
                    // Ignore errors
                }
            });
        }
    }
    
    /**
     * Initialize node positions
     */
    initializeNodePositions(nodes: EnhancedNode[]): void {
        // Stop simulation during initialization
        this.simulation.stop();
        
        // CRITICAL: Clear all forces before positioning nodes
        this.clearAllForces();

        // Update expansion state tracking
        this.updateExpansionState(nodes);
        
        // Update hidden state tracking
        this.updateHiddenState(nodes);

        // Reset velocities but preserve existing positions
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

        // Find and position central control node - MOST IMPORTANT FOR STABILITY
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
            
            // Store ID for future reference
            this.controlNodeId = centralNode.id;
            
            // Add a specific centering force just for the central node
            this.addCentralNodeAnchor(centralNode);
        }

        // Calculate node ranks to determine layout order
        this.calculateNodeRanks(nodes);
        
        // Position statement nodes
        this.positionStatementNodes(nodes);
        
        // Final enforcement of fixed positions
        this.enforceFixedPositions();
    }
    
    /**
     * Add a strong centering force to the central control node
     */
    private addCentralNodeAnchor(centralNode: EnhancedNode): void {
        if (!this.simulation) return;
        
        const sim = this.simulation as any;
        if (sim._forces && 'centralNodeAnchor' in sim._forces) {
            // Remove existing force if present
            sim.force('centralNodeAnchor', null);
        }
        
        // Create a custom force that explicitly fixes the node at (0,0)
        sim.force('centralNodeAnchor', () => {
            // This function runs on every tick
            // Force the central node to stay exactly at (0,0)
            centralNode.x = 0;
            centralNode.y = 0;
            centralNode.fx = 0;
            centralNode.fy = 0;
            centralNode.vx = 0;
            centralNode.vy = 0;
        });
    }
    
    /**
     * Position all statement nodes - visible and hidden
     */
    private positionStatementNodes(nodes: EnhancedNode[]): void {
        // Get all statement nodes
        const statementNodes = nodes.filter(n => n.type === 'statement');
        
        // Special handling for the top ranked statement (most net-positive)
        const topStatement = statementNodes.find(n => this.rankMap.get(n.id) === 0);
        
        if (topStatement) {
            // Position top-ranked statement specially to the right of control node
            this.positionTopStatement(topStatement);
        }
        
        // Position remaining statements
        statementNodes.forEach(node => {
            // Skip the top statement (already positioned)
            if (topStatement && node.id === topStatement.id) return;
            
            // Get rank index (will be used for all nodes, visible or hidden)
            const ringIndex = this.rankMap.get(node.id) || 0;
            
            // Calculate position with all adjustments
            const position = this.calculateStatementPosition(node, ringIndex);
            
            // Set position
            node.x = position.x;
            node.y = position.y;
            
            // Fix position for expanded nodes ONLY if they're visible
            if (node.mode === 'detail' && !node.isHidden) {
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
     * Position the top-ranked statement (most net-positive) to the right
     */
    private positionTopStatement(node: EnhancedNode): void {
        // Basic positioning constants - like live definition
        const baseRadius = COORDINATE_SPACE.LAYOUT.RING_SPACING.INITIAL;
        
        // Retrieve the control node to check its state
        const controlNode = this.findControlNode();
        
        // Calculate adjustments based on control node state
        const controlAdjustment = controlNode?.mode === 'preview' ?
            // If control is in preview mode, move statements inward
            (COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL - COORDINATE_SPACE.NODES.SIZES.STANDARD.PREVIEW) / 2 :
            0;
            
        // Calculate expansion adjustment - move outward if expanded
        const expansionAdjustment = node.mode === 'detail' ?
            (COORDINATE_SPACE.NODES.SIZES.STATEMENT.DETAIL - COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW) / 2 +
            COORDINATE_SPACE.LAYOUT.RING_SPACING.DEFINITION_EXPANSION_BUFFER :
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
        
        // Fix position if node is in detail mode AND visible
        if (node.mode === 'detail' && !node.isHidden) {
            node.fx = posX;
            node.fy = 0;
        } else {
            node.fx = undefined;
            node.fy = undefined;
        }

        // Store angle for consistency
        this.statementAngles.set(node.id, 0);
    }
    
    /**
     * Find the control node in the simulation
     */
    private findControlNode(): EnhancedNode | undefined {
        if (!this.simulation) return undefined;
        
        const allNodes = this.simulation.nodes() as unknown as EnhancedNode[];
        
        // First try by controlNodeId
        if (this.controlNodeId) {
            const nodeById = allNodes.find(n => n.id === this.controlNodeId);
            if (nodeById) return nodeById;
        }
        
        // Fallback to finding by group or sub property
        return allNodes.find(n => 
            n.group === 'central' || 
            (n.data && 'sub' in n.data && n.data.sub === 'controls')
        );
    }
    
    /**
     * Reposition all statement nodes (used after sort changes)
     */
    private repositionStatementNodes(nodes: EnhancedNode[]): void {
        this.positionStatementNodes(nodes);
    }
    
    /**
     * Calculate position for a statement node
     */
    private calculateStatementPosition(
        node: EnhancedNode, 
        ringIndex: number
    ): { x: number, y: number, angle: number, radius: number } {
        // Get or assign an angle for this node
        const nodeId = node.id;
        let angle = this.statementAngles.get(nodeId);
        
        if (angle === undefined) {
            // Adjust ringIndex for spiral distribution
            const adjustedRank = ringIndex > 0 ? ringIndex - 1 : ringIndex;
            
            // Calculate angle using golden ratio for even distribution
            angle = ringIndex === 0 ? 
                0 : // Top node on the right
                (this.FIRST_STATEMENT_ANGLE + (this.GOLDEN_ANGLE * adjustedRank)) % (2 * Math.PI);
                
            this.statementAngles.set(nodeId, angle);
        }

        // Use same formula for base radius as WordDefinitionLayout but with a MINIMUM spacing
        const minSpacing = 50; // Minimum spacing between rings
        const baseRadius = Math.max(
            COORDINATE_SPACE.LAYOUT.RING_SPACING.INITIAL * 
            (1 + (ringIndex * COORDINATE_SPACE.LAYOUT.RING_SPACING.INCREMENT)),
            COORDINATE_SPACE.LAYOUT.RING_SPACING.INITIAL + (ringIndex * minSpacing)
        );
        
        // Retrieve the control node
        const controlNode = this.findControlNode();
        
        // Calculate central node adjustment
        const controlAdjustment = controlNode?.mode === 'preview' ?
            (COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL - COORDINATE_SPACE.NODES.SIZES.STANDARD.PREVIEW) / 2 :
            0;
            
        // Calculate expansion adjustment - move outward if expanded
        const expansionAdjustment = node.mode === 'detail' ?
            (COORDINATE_SPACE.NODES.SIZES.STATEMENT.DETAIL - COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW) / 2 +
            COORDINATE_SPACE.LAYOUT.RING_SPACING.DEFINITION_EXPANSION_BUFFER :
            0;
            
        // Calculate hidden adjustment - move inward if hidden
        const hiddenAdjustment = node.isHidden ?
            -(COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW - COORDINATE_SPACE.NODES.SIZES.HIDDEN) / 2 :
            0;
        
        // Calculate adjustment from inner expanded nodes
        let innerExpandedAdjustment = 0;
        this.expandedStatements.forEach((data, id) => {
            // IMPORTANT: Only apply adjustments from inner rings
            // If this is an inner ring (lower rank) that's expanded, add its adjustment
            if (data.ringIndex < ringIndex) {
                innerExpandedAdjustment += data.adjustment;
            }
        });
        
        // Calculate adjustment from inner hidden nodes - LIMIT THE TOTAL PULL
        let innerHiddenAdjustment = 0;
        const maxInwardPull = -100; // Limit how much nodes can be pulled inward
        this.hiddenNodes.forEach((data, id) => {
            // IMPORTANT: Only apply adjustments from inner rings
            // If this is an inner ring (lower rank) that's hidden, add its adjustment (negative)
            if (data.ringIndex < ringIndex) {
                // Add adjustment, but with a damping factor to prevent excessive inward movement
                innerHiddenAdjustment += data.adjustment * 0.5; // Reduce the effect by 50%
            }
        });
        
        // Limit the total inward pull from hidden nodes
        innerHiddenAdjustment = Math.max(innerHiddenAdjustment, maxInwardPull);
        
        // Calculate final radius with all adjustments and enforce minimum distance
        const minRadius = COORDINATE_SPACE.LAYOUT.RING_SPACING.INITIAL * 0.5 + 
                        (ringIndex * COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW * 0.6);
                        
        const radius = Math.max(
            minRadius, // Enforce minimum distance based on ring index
            baseRadius + 
            expansionAdjustment - 
            controlAdjustment + 
            innerExpandedAdjustment + 
            innerHiddenAdjustment +
            hiddenAdjustment
        );
        
        // Calculate coordinates
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        
        return { x, y, angle, radius };
    }
    
    /**
     * Update expansion state tracking
     */
    private updateExpansionState(nodes: EnhancedNode[]): void {
        // Update our expansion state map
        nodes.forEach(node => {
            if (node.type === 'statement') {
                const wasExpanded = this.expansionState.get(node.id) || false;
                const isExpanded = node.mode === 'detail';
                
                this.expansionState.set(node.id, isExpanded);
                
                // Also update expanded statements tracking
                if (isExpanded) {
                    // Get rank index from rankMap
                    const ringIndex = this.rankMap.get(node.id) || 0;
                    
                    // Calculate adjustment
                    const adjustment = (COORDINATE_SPACE.NODES.SIZES.STATEMENT.DETAIL - 
                                      COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW) / 2 +
                                      COORDINATE_SPACE.LAYOUT.RING_SPACING.DEFINITION_EXPANSION_BUFFER;
                                      
                    this.expandedStatements.set(node.id, { ringIndex, adjustment });
                } else {
                    this.expandedStatements.delete(node.id);
                }
            }
        });
    }
    
    /**
     * Update hidden node state tracking
     */
    private updateHiddenState(nodes: EnhancedNode[]): void {
        // Update our hidden nodes map
        nodes.forEach(node => {
            if (node.type === 'statement') {
                const wasHidden = this.hiddenNodes.has(node.id);
                const isHidden = node.isHidden || false;
                
                // Update hidden nodes tracking
                if (isHidden) {
                    // Get rank index from rankMap
                    const ringIndex = this.rankMap.get(node.id) || 0;
                    
                    // Calculate adjustment (negative value to pull inward)
                    const adjustment = -(COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW - 
                                      COORDINATE_SPACE.NODES.SIZES.HIDDEN) / 2;
                                      
                    this.hiddenNodes.set(node.id, { ringIndex, adjustment });
                } else {
                    if (this.hiddenNodes.has(node.id)) {
                        this.hiddenNodes.delete(node.id);
                    }
                }
            }
        });
    }
    
    /**
     * Handle node mode changes (expand/collapse)
     */
    public handleNodeStateChange(nodeId: string, mode: NodeMode): void {
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const node = nodes.find(n => n.id === nodeId);
        
        if (!node) return;
        
        // Stop simulation completely during state change
        this.simulation.stop();
        this.simulation.alpha(0).alphaTarget(0);
        
        // Update node mode
        node.mode = mode;
        node.expanded = mode === 'detail';
        
        // Update radius based on new mode
        node.radius = this.getNodeRadius(node);
        
        // For central control node, ensure it stays at center
        if (node.group === 'central' || node.id === this.controlNodeId) {
            // AGGRESSIVELY ensure control node is at the center
            node.x = 0;
            node.y = 0;
            node.fx = 0;
            node.fy = 0;
            node.vx = 0;
            node.vy = 0;
            node.fixed = true;
            
            // Re-add the central node anchor
            this.addCentralNodeAnchor(node);
            
            console.debug('[StatementNetworkLayout] Control node mode changed, repositioning navigation nodes', {
                nodeId: node.id,
                newMode: mode,
                radius: node.radius
            });
            
            // First reposition navigation nodes when control size changes
            NavigationNodeLayout.positionNavigationNodes(
                nodes, 
                this.getNodeRadius.bind(this)
            );
            
            // Then recalculate all statement positions
            this.repositionStatementNodes(nodes);
        }
        // For statement nodes, update expansion state tracking
        else if (node.type === 'statement') {
            const ringIndex = this.rankMap.get(node.id) || 0;
            
            if (mode === 'detail') {
                // Add to expanded statements with adjustment
                const adjustment = (COORDINATE_SPACE.NODES.SIZES.STATEMENT.DETAIL - 
                                  COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW) / 2 +
                                  COORDINATE_SPACE.LAYOUT.RING_SPACING.DEFINITION_EXPANSION_BUFFER;
                                  
                this.expandedStatements.set(nodeId, { ringIndex, adjustment });
                this.expansionState.set(nodeId, true);
                
                // Calculate position
                const position = this.calculateStatementPosition(node, ringIndex);
                
                // Update node position and FIX it only if visible
                node.x = position.x;
                node.y = position.y;
                
                if (!node.isHidden) {
                    node.fx = position.x;
                    node.fy = position.y;
                } else {
                    node.fx = undefined;
                    node.fy = undefined;
                }
                
                node.vx = 0;
                node.vy = 0;
                
                // Recalculate positions for all statements
                this.repositionStatementNodes(nodes);
            } else {
                // Remove from expanded statements
                this.expandedStatements.delete(nodeId);
                this.expansionState.set(nodeId, false);
                
                // Release fixed position
                node.fx = undefined;
                node.fy = undefined;
                
                // Recalculate positions for all statements
                this.repositionStatementNodes(nodes);
            }
        }
        
        // Force fixed positions
        this.enforceFixedPositions();
        
        // Manually tick simulation to apply changes
        this.forceTick(5);
        
        // Restart with minimal alpha
        this.simulation.alpha(0.01).restart();
    }
    
    /**
     * Handle node visibility changes
     */
    public handleNodeVisibilityChange(nodeId: string, isHidden: boolean): void {
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const node = nodes.find(n => n.id === nodeId);
        
        if (!node) return;
        
        // Stop simulation during visibility change
        this.simulation.stop();
        this.simulation.alpha(0).alphaTarget(0);
        
        // Update node visibility
        node.isHidden = isHidden;
        
        // Update radius based on new visibility
        node.radius = this.getNodeRadius(node);
        
        // Handle statement node visibility specifically
        if (node.type === 'statement') {
            const ringIndex = this.rankMap.get(node.id) || 0;
            
            if (isHidden) {
                // Add to hidden nodes
                const adjustment = -(COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW - 
                                  COORDINATE_SPACE.NODES.SIZES.HIDDEN) / 2;
                                  
                this.hiddenNodes.set(nodeId, { ringIndex, adjustment });
                
                // Release fixed position for hidden nodes
                node.fx = undefined;
                node.fy = undefined;
            } else {
                // Remove from hidden nodes
                this.hiddenNodes.delete(nodeId);
                
                // If node was in detail mode, restore expansion state
                if (node.mode === 'detail') {
                    const adjustment = (COORDINATE_SPACE.NODES.SIZES.STATEMENT.DETAIL - 
                                      COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW) / 2 +
                                      COORDINATE_SPACE.LAYOUT.RING_SPACING.DEFINITION_EXPANSION_BUFFER;
                                      
                    this.expandedStatements.set(nodeId, { ringIndex, adjustment });
                    
                    // Calculate position
                    const position = this.calculateStatementPosition(node, ringIndex);
                    
                    // Fix position for visible nodes in detail mode
                    node.x = position.x;
                    node.y = position.y;
                    node.fx = position.x;
                    node.fy = position.y;
                }
            }
            
            // Recalculate positions for all statement nodes
            this.repositionStatementNodes(nodes);
        }
        
        // Force fixed positions
        this.enforceFixedPositions();
        
        // Manually tick simulation to apply changes
        this.forceTick(5);
        
        // Restart with very low alpha
        this.simulation.alpha(0.01).restart();
    }
    
    /**
     * Additional function to enforce fixed positions - like WordDefinitionLayout
     */
    public enforceFixedPositions(): void {
        if (!this.simulation) return;
        
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        
        // Find and fix central node
        const centralNode = nodes.find(n => n.group === 'central' || (n.id === this.controlNodeId));
        if (centralNode) {
            centralNode.x = 0;
            centralNode.y = 0;
            centralNode.fx = 0;
            centralNode.fy = 0;
            centralNode.vx = 0;
            centralNode.vy = 0;
            centralNode.fixed = true;
            
            // Ensure index 0 for central node (might help with stability)
            if (typeof centralNode.index === 'number') {
                centralNode.index = 0;
            }
        }
        
        // Also enforce navigation node positions
        nodes.forEach(node => {
            if (node.type === 'navigation' && node.fx !== undefined && node.fy !== undefined) {
                node.x = node.fx;
                node.y = node.fy;
                node.vx = 0;
                node.vy = 0;
            }
            
            // Also enforce positions for expanded visible statements
            if (node.type === 'statement' && node.mode === 'detail' && !node.isHidden &&
                node.fx !== undefined && node.fy !== undefined) {
                node.x = node.fx;
                node.y = node.fy;
                node.vx = 0;
                node.vy = 0;
            }
        });
        
        // Force simulation to honor these positions
        this.simulation.alpha(0).alphaTarget(0);
    }
    
    /**
     * Configure forces - Using a "no forces" approach like WordDefinitionLayout
     */
    configureForces(): void {
        // CRITICAL: Clear all forces completely
        this.clearAllForces();
        
        // Add a tick handler that enforces fixed positions on EVERY tick
        this.simulation.on('tick.fixedPosition', () => {
            this.enforceFixedPositions();
        });
        
        // Add the central node anchor if we have a control node
        if (this.controlNodeId) {
            const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
            const centralNode = nodes.find(n => n.id === this.controlNodeId);
            if (centralNode) {
                this.addCentralNodeAnchor(centralNode);
            }
        }
        
        // Start with VERY minimal alpha
        this.simulation.alpha(0.01).restart();
    }
    
    /**
     * Apply visibility preferences from user preferences or community rules
     */
    public applyVisibilityPreferences(preferences: Record<string, boolean>): void {
        // Get nodes
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        if (!nodes || nodes.length === 0) {
            return;
        }
        
        // Track if any changes were made
        let changed = false;
        
        // Process all statement nodes
        const statementNodes = nodes.filter(n => n.type === 'statement');
        
        // First pass: Apply community rules to nodes without user preferences
        statementNodes.forEach(node => {
            // Skip nodes that have explicit user preferences
            const userPreference = preferences ? preferences[node.id] : undefined;
            if (userPreference !== undefined) {
                return}
            
                // Get vote data from store to determine community visibility
                const voteData = statementNetworkStore.getVoteData(node.id);
                const shouldBeHiddenByCommunity = voteData.shouldBeHidden;
                
                // Store original state to track changes
                const originalHiddenState = node.isHidden;
                
                // Apply community rule if no user preference exists
                if (shouldBeHiddenByCommunity !== originalHiddenState || node.hiddenReason !== 'community') {
                    node.isHidden = shouldBeHiddenByCommunity;
                    node.hiddenReason = 'community';
                    
                    // Update node radius
                    node.radius = this.getNodeRadius(node);
                    
                    // Track changes
                    if (originalHiddenState !== shouldBeHiddenByCommunity) {
                        changed = true;
                        
                        // Update tracking for hidden nodes
                        const ringIndex = this.rankMap.get(node.id) || 0;
                        
                        if (shouldBeHiddenByCommunity) {
                            // Add to hidden nodes map
                            const adjustment = -(COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW - 
                                              COORDINATE_SPACE.NODES.SIZES.HIDDEN) / 2;
                            
                            this.hiddenNodes.set(node.id, { ringIndex, adjustment });
                            
                            // Release fixed position
                            node.fx = undefined;
                            node.fy = undefined;
                        } else {
                            // Remove from hidden nodes map
                            this.hiddenNodes.delete(node.id);
                        }
                    }
                }
            });
            
            // Second pass: Apply explicit user preferences (overrides community)
            if (preferences && Object.keys(preferences).length > 0) {
                Object.entries(preferences).forEach(([nodeId, isVisible]) => {
                    const node = nodes.find(n => n.id === nodeId);
                    if (!node) {
                        return;
                    }
                    
                    // Calculate if node should be hidden (inverse of isVisible)
                    const shouldBeHidden = !isVisible;
                    
                    // Store original state to track changes
                    const originalHiddenState = node.isHidden;
                    
                    // Apply user preference if different from current state
                    if (shouldBeHidden !== originalHiddenState || node.hiddenReason !== 'user') {
                        // Set the node's visibility state
                        node.isHidden = shouldBeHidden;
                        node.hiddenReason = 'user';
                        
                        // Update node radius
                        node.radius = this.getNodeRadius(node);
                        
                        // Track changes
                        if (originalHiddenState !== shouldBeHidden) {
                            changed = true;
                            
                            // Update tracking based on visibility state
                            if (node.type === 'statement') {
                                const ringIndex = this.rankMap.get(node.id) || 0;
                                
                                if (shouldBeHidden) {
                                    // Add to hidden nodes
                                    const adjustment = -(COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW - 
                                                     COORDINATE_SPACE.NODES.SIZES.HIDDEN) / 2;
                                    
                                    this.hiddenNodes.set(nodeId, { ringIndex, adjustment });
                                    
                                    // Release fixed position
                                    node.fx = undefined;
                                    node.fy = undefined;
                                } else {
                                    // Remove from hidden nodes
                                    this.hiddenNodes.delete(nodeId);
                                    
                                    // If node was in detail mode, fix its position
                                    if (node.mode === 'detail') {
                                        const position = this.calculateStatementPosition(node, ringIndex);
                                        node.fx = position.x;
                                        node.fy = position.y;
                                    }
                                }
                            }
                        }
                    }
                });
            }
    
            // Only update if changes were made
            if (changed) {
                // Recalculate node ranks
                this.calculateNodeRanks(nodes);
                
                // Reposition all statement nodes
                this.repositionStatementNodes(nodes);
                
                // Force fixed positions
                this.enforceFixedPositions();
                
                // Manually tick simulation to apply changes
                this.forceTick(5);
                
                // Restart with very low alpha
                this.simulation.alpha(0.01).restart();
            }
        }
    
        /**
         * Update data with exactly same approach as WordDefinitionLayout
         */
        public updateData(nodes: EnhancedNode[], links: EnhancedLink[], skipAnimation: boolean = true): void {
            // Always stop simulation during update
            this.simulation.stop();
    
            // Update control node ID
            this.controlNodeId = nodes.find(n => n.group === 'central')?.id || null;
    
            // Track expansion state changes
            this.updateExpansionState(nodes);
    
            // Track hidden state changes
            this.updateHiddenState(nodes);
    
            // Clear all forces
            this.clearAllForces();
    
            // Calculate node ranks and initialize positions
            this.calculateNodeRanks(nodes);
            this.initializeNodePositions(nodes);
    
            // Update nodes in simulation
            this.simulation.nodes(asD3Nodes(nodes));
    
            // Configure forces (which adds no actual forces)
            this.configureForces();
    
            // Update link force if it exists
            const linkForce = this.simulation.force('link') as d3.ForceLink<any, any> | null;
            if (linkForce && links.length > 0) {
                linkForce.links(asD3Links(links));
            }
    
            // Enforce fixed positions
            this.enforceFixedPositions();
    
            // ALWAYS skip animation by setting alpha to 0
            this.simulation.alpha(0).alphaTarget(0);
    
            // Force tick to apply positions immediately
            this.forceTick(5);
        }
    
        /**
         * Force multiple ticks with position enforcement between each tick
         */
        public forceTick(ticks: number = 1): void {
            // Temporarily pause any running transitions
            this.simulation.alpha(0).alphaTarget(0);
    
            for (let i = 0; i < ticks; i++) {
                // Enforce fixed positions before each tick
                this.enforceFixedPositions();
                
                // Perform the tick
                this.simulation.tick();
                
                // Enforce fixed positions after each tick
                this.enforceFixedPositions();
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
    
            // Clear cached data
            this.statementAngles.clear();
            this.expansionState.clear();
            this.expandedStatements.clear();
            this.hiddenNodes.clear();
            this.rankMap.clear();
    
            // Stop simulation
            this.stop();
        }
    }