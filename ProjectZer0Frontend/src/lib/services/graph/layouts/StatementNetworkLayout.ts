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
 * Following the exact same pattern as WordDefinitionLayout:
 * - Central control node fixed at center (0,0)
 * - Navigation nodes in a circle around the central node
 * - Top statement positioned like live definition (to the right)
 * - Other statements positioned in a golden angle spiral based on vote rank
 * - Support for expand/collapse with proper spacing adjustment
 * - Support for hidden nodes with proper positioning
 */
export class StatementNetworkLayout extends BaseLayoutStrategy {
    private readonly GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
    private readonly FIRST_STATEMENT_ANGLE = Math.PI; // Same angle as first alternative definition
    private statementAngles: Map<string, number> = new Map();
    private expansionState: Map<string, boolean> = new Map();
    private expandedStatements: Map<string, { rankIndex: number, adjustment: number }> = new Map();
    private hiddenNodes: Map<string, { rankIndex: number, adjustment: number }> = new Map();
    
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
     * Get net votes for a node (positive - negative)
     */
    private getNetVotes(node: EnhancedNode): number {
        if (!node.data) return 0;
        
        if (node.type === 'statement' && 'positiveVotes' in node.data && 'negativeVotes' in node.data) {
            const posVotes = this.getNeo4jNumber(node.data.positiveVotes) || 0;
            const negVotes = this.getNeo4jNumber(node.data.negativeVotes) || 0;
            return posVotes - negVotes;
        }
        
        return 0;
    }
    
    /**
     * Get total votes for a node (positive + negative)
     */
    private getTotalVotes(node: EnhancedNode): number {
        if (!node.data) return 0;
        
        if (node.type === 'statement' && 'positiveVotes' in node.data && 'negativeVotes' in node.data) {
            const posVotes = this.getNeo4jNumber(node.data.positiveVotes) || 0;
            const negVotes = this.getNeo4jNumber(node.data.negativeVotes) || 0;
            return posVotes + negVotes;
        }
        
        return 0;
    }
    
    /**
     * Get creation date timestamp for chronological sorting
     */
    private getCreationDate(node: EnhancedNode): number {
        if (!node.data) return 0;
        
        if (node.type === 'statement' && 'createdAt' in node.data) {
            const dateStr = node.data.createdAt;
            if (typeof dateStr === 'string') {
                return new Date(dateStr).getTime();
            }
        }
        
        return 0;
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
        this.rankMap.clear();
        
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
        
        // Store rank information in the rankMap
        sortedNodes.forEach((node, index) => {
            this.rankMap.set(node.id, index);
            
            // Make sure node has metadata
            if (!node.metadata) {
                node.metadata = { group: 'statement' };
            }
        });
        
        console.log(`[StatementNetworkLayout] Calculated ranks for ${sortedNodes.length} nodes`);
    }
    
    /**
     * Clear ALL forces from the simulation - duplicated from WordDefinitionLayout
     * This ensures no forces can affect node positions
     */
    private clearAllForces(): void {
        console.log('[StatementNetworkLayout] Clearing all forces');
        
        // Get all force names
        const sim = this.simulation as any;
        
        // List all forces that might be present
        const potentialForceNames = [
            'charge', 'collision', 'link', 'center', 'x', 'y',
            'manyBody', 'radial', 'navigationRadial', 'navigationCharge',
            'navigationCollision', 'centralCharge', 'centralCollision',
            'positioning', 'custom', 'cluster'
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
            console.warn('[StatementNetworkLayout] Some forces still remain:', remainingForces);
            
            // Try to remove these as well
            remainingForces.forEach(name => {
                try {
                    sim.force(name, null);
                } catch (e) {
                    console.warn(`[StatementNetworkLayout] Cannot remove force: ${name}`);
                }
            });
        }
    }
    
    /**
     * Initialize node positions following the same pattern as WordDefinitionLayout
     */
    initializeNodePositions(nodes: EnhancedNode[]): void {
        console.log('[StatementNetworkLayout] Initializing node positions', {
            nodeCount: nodes.length,
            nodeTypes: nodes.map(n => n.type).filter(t => t === 'statement').length + ' statements'
        });

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

        // Find and position central control node
        const centralNode = nodes.find(n => n.fixed || n.group === 'central');
        if (!centralNode) {
            console.warn('[StatementNetworkLayout] No central node found');
            return;
        }

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
        
        console.log('[StatementNetworkLayout] Central node positioned at center with fixed constraints', {
            id: centralNode.id,
            position: { x: centralNode.x, y: centralNode.y },
            fixed: { fx: centralNode.fx, fy: centralNode.fy }
        });

        // Calculate node ranks to determine layout order
        this.calculateNodeRanks(nodes);
        
        // Position statement nodes
        this.positionStatementNodes(nodes);
        
        // Final enforcement of fixed positions
        this.enforceFixedPositions();
    }
    
    /**
     * Position statement nodes - top one separately, rest in spiral
     */
    private positionStatementNodes(nodes: EnhancedNode[]): void {
        // Get visible statement nodes
        const statementNodes = nodes.filter(n => n.type === 'statement' && !n.isHidden);
        
        // Log statement nodes for debugging
        console.log('[StatementNetworkLayout] Positioning statement nodes:', {
            totalStatementNodes: statementNodes.length,
            rankMap: Array.from(this.rankMap.entries()).slice(0, 3)
        });
        
        // Special handling for the top ranked statement (like "live definition")
        const topStatement = statementNodes.find(n => this.rankMap.get(n.id) === 0);
        
        if (topStatement) {
            // Position top-ranked statement specially to the right of control node (like live definition)
            this.positionTopStatement(topStatement);
        }
        
        // Position remaining statements in a spiral, starting from rank 1
        statementNodes.forEach(node => {
            const rankIndex = this.rankMap.get(node.id) || 0;
            
            // Skip the top statement (already positioned)
            if (rankIndex === 0) return;
            
            // Calculate position with all adjustments
            const position = this.calculateStatementPosition(node, rankIndex);
            
            // Set position
            node.x = position.x;
            node.y = position.y;
            
            console.log(`[StatementNetworkLayout] Positioned statement node rank ${rankIndex} at:`, {
                id: node.id,
                position: { x: position.x, y: position.y },
                angle: position.angle * (180 / Math.PI) // Convert to degrees for readability
            });
            
            // Fix position if node is in detail mode
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
        
        // Position hidden nodes in a tight inner circle (similar to WordDefinitionLayout hidden nodes)
        const hiddenNodes = nodes.filter(n => n.type === 'statement' && n.isHidden);
        hiddenNodes.forEach((node, i) => {
            // Distribute evenly in inner circle
            const angle = (i / Math.max(1, hiddenNodes.length)) * Math.PI * 2;
            const radius = 300; // Use a reasonable inner radius
            
            // Set position
            node.x = Math.cos(angle) * radius;
            node.y = Math.sin(angle) * radius;
            
            // Zero velocity
            node.vx = 0;
            node.vy = 0;
            
            // Store angle for consistency
            this.statementAngles.set(node.id, angle);
        });
    }
    
    /**
     * Position the top-ranked statement (most net-positive) to the right
     * This mirrors WordDefinitionLayout.positionLiveDefinition()
     */
    private positionTopStatement(node: EnhancedNode): void {
        // Basic positioning constants - exactly like live definition
        const baseRadius = COORDINATE_SPACE.LAYOUT.RING_SPACING.INITIAL;
        
        // Retrieve the control node to check its state
        const controlNode = (this.simulation.nodes() as unknown as EnhancedNode[])
            .find(n => n.id === this.controlNodeId);
        
        // Calculate adjustments based on control node state - exactly like word node state affects live definition
        const controlAdjustment = controlNode?.mode === 'preview' ?
            // If control is in preview mode, move statements inward
            (COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL - COORDINATE_SPACE.NODES.SIZES.STANDARD.PREVIEW) / 2 :
            0;
            
        // Calculate expansion adjustment - move outward if expanded (like definition)
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

        console.log('[StatementNetworkLayout] Top statement positioned:', {
            id: node.id,
            baseRadius,
            expansionAdjustment,
            controlAdjustment,
            hiddenAdjustment,
            finalPosition: posX,
            isDetail: node.mode === 'detail',
            isHidden: node.isHidden
        });

        // Set position to the right of control node
        node.x = posX;
        node.y = 0;
        
        // Fix position if node is in detail mode
        if (node.mode === 'detail') {
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
     * Reposition all statement nodes (used after sort changes)
     */
    private repositionStatementNodes(nodes: EnhancedNode[]): void {
        // Get visible statement nodes
        const statementNodes = nodes.filter(n => n.type === 'statement' && !n.isHidden);
        
        console.log('[StatementNetworkLayout] Repositioning statement nodes:', {
            statementNodeCount: statementNodes.length
        });
        
        // Special handling for the top ranked statement (like live definition)
        const topStatement = statementNodes.find(n => this.rankMap.get(n.id) === 0);
        
        if (topStatement) {
            // Position top-ranked statement specially to the right of control node
            this.positionTopStatement(topStatement);
        }
        
        // Position remaining statements
        statementNodes.forEach(node => {
            const rankIndex = this.rankMap.get(node.id) || 0;
            
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
     * This mirrors WordDefinitionLayout.calculateAltDefinitionPosition()
     */
    private calculateStatementPosition(
        node: EnhancedNode, 
        rankIndex: number
    ): { x: number, y: number, angle: number, radius: number } {
        // Get or assign an angle for this node
        const nodeId = node.id;
        let angle = this.statementAngles.get(nodeId);
        
        if (angle === undefined) {
            // Adjust rankIndex to account for the special handling of the top statement
            // This ensures we start the spiral from the second highest ranked node
            const adjustedRank = rankIndex > 0 ? rankIndex - 1 : rankIndex;
            
            // Calculate angle using golden ratio for even distribution
            // For the top node, use 0 degrees (right of center)
            // For all other nodes, use golden angle distribution - just like alternative definitions
            angle = rankIndex === 0 ? 
                0 : // Top node on the right
                (this.FIRST_STATEMENT_ANGLE + (this.GOLDEN_ANGLE * adjustedRank)) % (2 * Math.PI);
                
            this.statementAngles.set(nodeId, angle);
        }

        // Use exact same formula for base radius as WordDefinitionLayout
        const baseRadius = COORDINATE_SPACE.LAYOUT.RING_SPACING.INITIAL * 
            (1 + (rankIndex * COORDINATE_SPACE.LAYOUT.RING_SPACING.INCREMENT));
        
        // Retrieve the control node to check its state
        const controlNode = (this.simulation.nodes() as unknown as EnhancedNode[])
            .find(n => n.id === this.controlNodeId);
        
        // Calculate central node adjustment - exactly like word mode affects definition positions
        const controlAdjustment = controlNode?.mode === 'preview' ?
            // If control is in preview mode, move statements inward
            (COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL - COORDINATE_SPACE.NODES.SIZES.STANDARD.PREVIEW) / 2 :
            0;
            
        // Calculate expansion adjustment - move outward if expanded (like definition)
        const expansionAdjustment = node.mode === 'detail' ?
            (COORDINATE_SPACE.NODES.SIZES.STATEMENT.DETAIL - COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW) / 2 +
            COORDINATE_SPACE.LAYOUT.RING_SPACING.DEFINITION_EXPANSION_BUFFER :
            0;
        
        // Calculate adjustment from inner expanded nodes
        let innerExpandedAdjustment = 0;
        this.expandedStatements.forEach((data, id) => {
            // If this is an inner ring that's expanded, add its adjustment
            if (data.rankIndex < rankIndex) {
                innerExpandedAdjustment += data.adjustment;
            }
        });
        
        // Calculate adjustment from inner hidden nodes
        let innerHiddenAdjustment = 0;
        this.hiddenNodes.forEach((data, id) => {
            // If this is an inner ring that's hidden, add its adjustment (negative)
            if (data.rankIndex < rankIndex) {
                innerHiddenAdjustment += data.adjustment;
            }
        });
        
        // Calculate final radius with all adjustments - exactly like WordDefinitionLayout
        const radius = baseRadius + 
                      expansionAdjustment - 
                      controlAdjustment + 
                      innerExpandedAdjustment + 
                      innerHiddenAdjustment;
        
        // Calculate coordinates with higher precision
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
                
                if (wasExpanded !== isExpanded) {
                    console.log('[StatementNetworkLayout] Node expansion state changed:', {
                        nodeId: node.id.substring(0, 8),
                        from: wasExpanded,
                        to: isExpanded
                    });
                }
                
                this.expansionState.set(node.id, isExpanded);
                
                // Also update expanded statements tracking
                if (isExpanded) {
                    // Get rank index from rankMap
                    const rankIndex = this.rankMap.get(node.id) || 0;
                    
                    // Calculate adjustment - use same values as WordDefinitionLayout for definitions
                    const adjustment = (COORDINATE_SPACE.NODES.SIZES.STATEMENT.DETAIL - 
                                      COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW) / 2 +
                                      COORDINATE_SPACE.LAYOUT.RING_SPACING.DEFINITION_EXPANSION_BUFFER;
                                      
                    this.expandedStatements.set(node.id, { rankIndex, adjustment });
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
                
                if (wasHidden !== isHidden) {
                    console.log('[StatementNetworkLayout] Node hidden state changed:', {
                        nodeId: node.id.substring(0, 8),
                        from: wasHidden,
                        to: isHidden
                    });
                }
                
                // Update hidden nodes tracking
                if (isHidden) {
                    // Get rank index from rankMap
                    const rankIndex = this.rankMap.get(node.id) || 0;
                    
                    // Calculate adjustment (negative value to pull inward)
                    const adjustment = -(COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW - 
                                      COORDINATE_SPACE.NODES.SIZES.HIDDEN) / 2;
                                      
                    this.hiddenNodes.set(node.id, { rankIndex, adjustment });
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
        
        console.log('[StatementNetworkLayout] Node mode change:', {
            nodeId: nodeId.substring(0, 8),
            type: node.type,
            oldMode: node.mode,
            newMode: mode
        });
        
        // Stop simulation completely during state change
        this.simulation.stop();
        this.simulation.alpha(0).alphaTarget(0);
        
        // Update node mode
        node.mode = mode;
        node.expanded = mode === 'detail';
        
        // Update radius based on new mode
        node.radius = this.getNodeRadius(node);
        
        // Update tracking
        let recalculatePositions = false;
        
        // For central control node, ensure it stays at center
        if (node.group === 'central' || node.id === this.controlNodeId) {
            console.log('[StatementNetworkLayout] Control node mode change, enforcing center position');
            
            // AGGRESSIVELY ensure control node is at the center (copied from WordDefinitionLayout)
            node.x = 0;
            node.y = 0;
            node.fx = 0;
            node.fy = 0;
            node.vx = 0;
            node.vy = 0;
            node.fixed = true;
            
            recalculatePositions = true;
        }
        // For statement nodes, update expansion state tracking
        else if (node.type === 'statement') {
            const rankIndex = this.rankMap.get(node.id) || 0;
            
            if (mode === 'detail') {
                // Add to expanded statements with adjustment
                const adjustment = (COORDINATE_SPACE.NODES.SIZES.STATEMENT.DETAIL - 
                                  COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW) / 2 +
                                  COORDINATE_SPACE.LAYOUT.RING_SPACING.DEFINITION_EXPANSION_BUFFER;
                                  
                this.expandedStatements.set(nodeId, { rankIndex, adjustment });
                this.expansionState.set(nodeId, true);
                
                // Calculate position
                const position = this.calculateStatementPosition(node, rankIndex);
                
                // Update node position and FIX it (exactly like WordDefinitionLayout)
                node.x = position.x;
                node.y = position.y;
                node.fx = position.x;
                node.fy = position.y;
                node.vx = 0;
                node.vy = 0;
                
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
        
        console.log('[StatementNetworkLayout] Node visibility change:', {
            nodeId: nodeId.substring(0, 8),
            type: node.type,
            oldHidden: node.isHidden,
            newHidden: isHidden
        });
        
        // Stop simulation during visibility change
        this.simulation.stop();
        this.simulation.alpha(0).alphaTarget(0);
        
        // Update node visibility
        node.isHidden = isHidden;
        
        // Update radius based on new visibility
        node.radius = this.getNodeRadius(node);
        
        // Handle specific node types
        if (node.type === 'statement') {
            const rankIndex = this.rankMap.get(node.id) || 0;
            
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
                    
                    // Calculate position
                    const position = this.calculateStatementPosition(node, rankIndex);
                    
                    // Fix position at calculated coordinates
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
        this.forceTick(5);
        
        // Restart with very low alpha
        this.simulation.alpha(0.01).restart();
    }
    
    /**
     * Enhanced enforceFixedPositions
     * Ensure all fixed nodes stay at their proper positions
     */
    public enforceFixedPositions(): void {
        if (!this.simulation) return;
        
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        
        // Find and fix control node position using controlNodeId
        if (this.controlNodeId) {
            const centralNode = nodes.find(n => n.id === this.controlNodeId);
            if (centralNode) {
                centralNode.x = 0;
                centralNode.y = 0;
                centralNode.fx = 0;
                centralNode.fy = 0;
                centralNode.vx = 0;
                centralNode.vy = 0;
                centralNode.fixed = true; // Ensure fixed flag is set
            }
        }
        
        // Fix navigation node positions
        nodes.forEach(node => {
            if (node.type === 'navigation' && node.fx !== undefined && node.fy !== undefined) {
                node.x = node.fx;
                node.y = node.fy;
                node.vx = 0;
                node.vy = 0;
            }
            
            // Fix expanded statement nodes exactly like expanded definition nodes in WordDefinitionLayout
            if (node.type === 'statement' && node.mode === 'detail' && !node.isHidden) {
                if (node.fx === undefined || node.fy === undefined) {
                    // Calculate position with all adjustments
                    const rankIndex = this.rankMap.get(node.id) || 0;
                    const position = this.calculateStatementPosition(node, rankIndex);
                    
                    // Fix position at these calculated coordinates
                    node.x = position.x;
                    node.y = position.y;
                    node.fx = position.x;
                    node.fy = position.y;
                } else {
                    // Enforce existing fixed position
                    node.x = node.fx;
                    node.y = node.fy;
                }
                node.vx = 0;
                node.vy = 0;
            }
            
            // For preview mode statements, update position but don't fix (exactly like WordDefinitionLayout)
            if (node.type === 'statement' && node.mode === 'preview' && !node.isHidden) {
                const rankIndex = this.rankMap.get(node.id) || 0;
                const position = this.calculateStatementPosition(node, rankIndex);
                
                // Set position but don't fix it to allow minimal movement
                node.x = position.x;
                node.y = position.y;
                // Remove any fixed position
                node.fx = undefined;
                node.fy = undefined;
                
                // But still zero velocity
                node.vx = 0;
                node.vy = 0;
            }
        });
        
        // Force simulation to honor these positions
        this.simulation.alpha(0).alphaTarget(0);
    }
    
    /**
     * Configure forces - Using same approach as WordDefinitionLayout
     */
    configureForces(): void {
        console.log('[StatementNetworkLayout] Configuring forces - using NO forces approach');
        
        // CRITICAL: Clear all forces completely
        this.clearAllForces();
        
        // NO FORCES: Following the WordDefinitionLayout approach, we don't add any forces
        // to the simulation, relying completely on fixed positions instead
        
        // Add a tick handler that enforces fixed positions on EVERY tick
        this.simulation.on('tick.fixedPosition', () => {
            this.enforceFixedPositions();
        });
        
        // Start with VERY minimal alpha - just like WordDefinitionLayout
        this.simulation.alpha(0.01).restart();
    }
    
    /**
     * Apply visibility preferences
     */
    public applyVisibilityPreferences(preferences: Record<string, boolean>): void {
        if (!preferences || Object.keys(preferences).length === 0) return;
        
        // Get nodes
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        if (!nodes || nodes.length === 0) return;
        
        console.log('[StatementNetworkLayout] Applying visibility preferences:', {
            preferenceCount: Object.keys(preferences).length
        });
        
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
                
                // Handle statement nodes
                if (node.type === 'statement') {
                    const rankIndex = this.rankMap.get(node.id) || 0;
                    
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
            console.log('[StatementNetworkLayout] Visibility preferences caused changes, recalculating positions');
            
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
        console.log('[StatementNetworkLayout] Updating data:', {
            nodeCount: nodes.length,
            linkCount: links.length,
            statementNodeCount: nodes.filter(n => n.type === 'statement').length
        });
        
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
     * Clean up resources
     */
    public dispose(): void {
        console.log('[StatementNetworkLayout] Disposing resources');
        
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