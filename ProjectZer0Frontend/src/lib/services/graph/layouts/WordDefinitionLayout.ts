// src/lib/services/graph/layouts/WordDefinitionLayout.ts
import * as d3 from 'd3';
import { BaseLayoutStrategy } from './BaseLayoutStrategy';
import { NavigationNodeLayout } from './common/NavigationNodeLayout';
import type { EnhancedNode, EnhancedLink } from '../../../types/graph/enhanced';
import { asD3Nodes, asD3Links } from '../../../types/graph/enhanced';
import type { 
    GraphData, 
    ViewType, 
    NodeMode, 
    NodeType,
    GraphNode,
    GraphLink
} from '$lib/types/graph/enhanced';
import { COORDINATE_SPACE, FORCE_SIMULATION } from '../../../constants/graph';

/**
 * Layout strategy for word and definition nodes
 * 
 * Features:
 * - Central word node fixed at the center (0,0)
 * - Navigation nodes in a circle around the central node
 * - Live definition positioned to the right of the word node
 * - Alternative definitions positioned using golden angle distribution
 * - Vote-weighted positioning for alternative definitions
 * - Smooth transitions between preview and detail modes
 * - Support for hidden nodes with smaller size and adjusted positioning
 */
export class WordDefinitionLayout extends BaseLayoutStrategy {
    private readonly GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
    private readonly FIRST_ALT_ANGLE = Math.PI;
    private definitionAngles: Map<string, number> = new Map();
    private expansionState: Map<string, boolean> = new Map();
    // Track expanded definitions and their ring indices
    private expandedDefinitions: Map<string, { ringIndex: number, adjustment: number }> = new Map();
    // Track hidden definitions and their ring indices
    private hiddenNodes: Map<string, { ringIndex: number, adjustment: number }> = new Map();

    constructor(width: number, height: number, viewType: ViewType) {
        super(width, height, viewType);
        console.debug('[WordDefinitionLayout] Initializing with dimensions:', {
            width: COORDINATE_SPACE.WORLD.WIDTH,
            height: COORDINATE_SPACE.WORLD.HEIGHT,
            viewType
        });
    }

    /**
     * Clear ALL forces from the simulation - duplicated from SingleNodeLayout
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
            'positioning', 'custom'
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
            console.warn('[WordDefinitionLayout] Some forces still remain:', remainingForces);
            
            // Try to remove these as well
            remainingForces.forEach(name => {
                try {
                    sim.force(name, null);
                } catch (e) {
                    console.warn(`[WordDefinitionLayout] Cannot remove force: ${name}`);
                }
            });
        }
    }

    /**
     * Set initial positions for all nodes
     */
    initializeNodePositions(nodes: EnhancedNode[]): void {
        console.debug('[WordDefinitionLayout] Initializing node positions', {
            nodeCount: nodes.length,
            nodeTypes: nodes.map(n => ({ id: n.id, type: n.type, subtype: n.subtype }))
        });

        // Stop simulation during initialization
        this.simulation.stop();
        
        // CRITICAL: Clear all forces before positioning nodes
        this.clearAllForces();

        // Update expansion state tracking
        this.updateExpansionState(nodes);
        
        // Update hidden node tracking
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

        // Find and position central word node
        const centralNode = nodes.find(n => n.fixed || n.group === 'central');
        if (!centralNode) {
            console.warn('[WordDefinitionLayout] No central node found');
            return;
        }

        // Center the word node with EXPLICIT POSITION FIXING
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

        console.debug('[WordDefinitionLayout] Central node positioned at center with fixed constraints', {
            id: centralNode.id,
            position: { x: centralNode.x, y: centralNode.y },
            fixed: { fx: centralNode.fx, fy: centralNode.fy },
            velocity: { vx: centralNode.vx, vy: centralNode.vy }
        });

        // Position live definition with adjustments
        const liveDefinition = nodes.find(n => n.type === 'definition' && n.subtype === 'live');
        if (liveDefinition) {
            this.positionLiveDefinition(liveDefinition);
        }

        // Position alternative definitions
        const alternatives = nodes
            .filter(n => n.type === 'definition' && n.subtype === 'alternative')
            .sort((a, b) => (b.metadata?.votes || 0) - (a.metadata?.votes || 0));

        // Position all alternatives
        this.positionAlternativeDefinitions(alternatives);
        
        // Final enforcement of fixed positions
        this.enforceFixedPositions();
    }

    /**
     * Configure forces for this layout
     */
    configureForces(): void {
        // CRITICAL: Start with no forces at all
        this.clearAllForces();
        
        // Configure minimal forces for navigation nodes
        NavigationNodeLayout.configureNoForces(this.simulation);

        // NO FORCES: Following the SingleNodeLayout approach, we don't add any forces
        // to the simulation, relying completely on fixed positions instead
        
        // Add a tick handler that enforces central node position on EVERY tick
        this.simulation.on('tick.fixedPosition', () => {
            const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
            
            // Find central node and fix its position on every tick
            const centralNode = nodes.find(n => n.fixed || n.group === 'central');
            if (centralNode) {
                // Aggressively reset position to origin
                centralNode.x = 0;
                centralNode.y = 0;
                centralNode.fx = 0;
                centralNode.fy = 0;
                centralNode.vx = 0;
                centralNode.vy = 0;
            }
            
            // Also fix navigation nodes
            nodes.forEach(node => {
                if (node.type === 'navigation' && node.fx !== undefined && node.fy !== undefined) {
                    node.x = node.fx;
                    node.y = node.fy;
                    node.vx = 0;
                    node.vy = 0;
                }
            });
        });
        
        // Start with a VERY mild alpha - just like SingleNodeLayout
        this.simulation.alpha(0.01).restart();
    }

    /**
     * Additional function to call after layout is applied to ensure positions are fixed
     */
    public enforceFixedPositions(): void {
        if (!this.simulation) return;
        
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        
        // Find and fix central node
        const centralNode = nodes.find(n => n.fixed || n.group === 'central');
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
        NavigationNodeLayout.enforceFixedPositions(nodes);
        
        // Force simulation to honor these positions
        this.simulation.alpha(0).alphaTarget(0);
    }

    /**
     * Handle node mode changes
     */
    public handleNodeStateChange(nodeId: string, mode: NodeMode): void {
        console.debug('[WordDefinitionLayout] Node state change', {
            nodeId,
            mode
        });

        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const node = nodes.find(n => n.id === nodeId);
        
        if (!node) {
            console.warn('[WordDefinitionLayout] Node not found for state change:', nodeId);
            return;
        }

        // Update node mode
        const oldMode = node.mode;
        node.mode = mode;
        node.expanded = mode === 'detail';
        
        // Update radius based on new mode
        const oldRadius = node.radius;
        node.radius = this.getNodeRadius(node);

        console.debug('[WordDefinitionLayout] Node mode updated', {
            nodeId,
            oldMode,
            newMode: mode,
            oldRadius,
            newRadius: node.radius
        });

        // Update expansion state tracking
        this.expansionState.set(nodeId, mode === 'detail');

        // If this is a definition node, update expanded definitions tracking
        if (node.type === 'definition') {
            // Calculate ring index
            let ringIndex = 0;
            if (node.subtype === 'live') {
                ringIndex = 0; // Live definition is always at ring 0
            } else {
                // Find position in sorted alternatives
                const alternatives = nodes
                    .filter(n => n.type === 'definition' && n.subtype === 'alternative')
                    .sort((a, b) => (b.metadata?.votes || 0) - (a.metadata?.votes || 0));
                    
                const altIndex = alternatives.findIndex(d => d.id === nodeId);
                ringIndex = altIndex + 1; // Alternative definitions start at ring 1
            }
            
            // Calculate adjustment for this node (radius difference between detail and preview)
            const adjustment = (COORDINATE_SPACE.NODES.SIZES.DEFINITION.DETAIL - 
                              COORDINATE_SPACE.NODES.SIZES.DEFINITION.PREVIEW) / 2 +
                              COORDINATE_SPACE.LAYOUT.RING_SPACING.DEFINITION_EXPANSION_BUFFER;
                
            // Update tracking
            if (mode === 'detail') {
                this.expandedDefinitions.set(nodeId, { ringIndex, adjustment });
                console.debug('[WordDefinitionLayout] Added expanded definition:', {
                    nodeId,
                    ringIndex,
                    adjustment
                });
            } else {
                this.expandedDefinitions.delete(nodeId);
                console.debug('[WordDefinitionLayout] Removed expanded definition:', {
                    nodeId
                });
            }
        }

        // For word nodes, we need to update all nodes
        if (node.type === 'word') {
            // First update navigation nodes to ensure they adapt to the word node's new size
            NavigationNodeLayout.positionNavigationNodes(
                nodes, 
                this.getNodeRadius.bind(this)
            );
            
            // Then update definition positions
            this.repositionDefinitions(nodes);
        }
        
        // If a definition changes mode, we need to adjust all definitions
        if (node.type === 'definition') {
            this.repositionDefinitions(nodes);
        }
        
        // CRITICAL: Stop simulation and enforce fixed positions
        this.simulation.stop();
        this.enforceFixedPositions();
        
        // Restart with VERY minimal alpha to avoid movement
        this.simulation.alpha(0.01).restart();
    }

    /**
     * Handle node visibility changes
     */
    public handleNodeVisibilityChange(nodeId: string, isHidden: boolean): void {
        console.debug('[WordDefinitionLayout] Node visibility change', {
            nodeId,
            isHidden
        });

        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const node = nodes.find(n => n.id === nodeId);
        
        if (!node) {
            console.warn('[WordDefinitionLayout] Node not found for visibility change:', nodeId);
            return;
        }

        // Update node visibility
        const oldHiddenState = node.isHidden;
        node.isHidden = isHidden;
        
        // Update radius based on new visibility
        const oldRadius = node.radius;
        node.radius = this.getNodeRadius(node);

        console.debug('[WordDefinitionLayout] Node visibility updated', {
            nodeId,
            oldHiddenState,
            newHiddenState: isHidden,
            oldRadius,
            newRadius: node.radius
        });

        // If this is a definition node, update hidden nodes tracking
        if (node.type === 'definition') {
            // Calculate ring index
            let ringIndex = 0;
            if (node.subtype === 'live') {
                ringIndex = 0; // Live definition is always at ring 0
            } else {
                // Find position in sorted alternatives
                const alternatives = nodes
                    .filter(n => n.type === 'definition' && n.subtype === 'alternative')
                    .sort((a, b) => (b.metadata?.votes || 0) - (a.metadata?.votes || 0));
                    
                const altIndex = alternatives.findIndex(d => d.id === nodeId);
                ringIndex = altIndex + 1; // Alternative definitions start at ring 1
            }
            
            // Calculate adjustment for this node when hidden
            // Should be a negative value to pull other nodes inward
            const adjustment = -(COORDINATE_SPACE.NODES.SIZES.DEFINITION.PREVIEW - 
                               COORDINATE_SPACE.NODES.SIZES.HIDDEN) / 2;
                
            // Update tracking
            if (isHidden) {
                this.hiddenNodes.set(nodeId, { ringIndex, adjustment });
                console.debug('[WordDefinitionLayout] Added hidden definition:', {
                    nodeId,
                    ringIndex,
                    adjustment
                });
            } else {
                this.hiddenNodes.delete(nodeId);
                console.debug('[WordDefinitionLayout] Removed hidden definition:', {
                    nodeId
                });
            }
        }

        // For word nodes, we need to update all nodes
        if (node.type === 'word') {
            // First update navigation nodes to ensure they adapt to the word node's new size
            NavigationNodeLayout.positionNavigationNodes(
                nodes, 
                this.getNodeRadius.bind(this)
            );
            
            // Then update definition positions
            this.repositionDefinitions(nodes);
        }
        
        // If a definition changes visibility, we need to adjust all definitions
        if (node.type === 'definition') {
            this.repositionDefinitions(nodes);
        }
        
        // CRITICAL: Stop simulation and enforce fixed positions
        this.simulation.stop();
        this.enforceFixedPositions();
        
        // Restart with VERY minimal alpha to avoid movement
        this.simulation.alpha(0.01).restart();
    }

    /**
     * Track expansion state changes
     */
    private updateExpansionState(nodes: EnhancedNode[]): void {
        // Update our expansion state map
        nodes.forEach(node => {
            if (node.type === 'definition' || node.type === 'word') {
                const wasExpanded = this.expansionState.get(node.id) || false;
                const isExpanded = node.mode === 'detail';
                
                if (wasExpanded !== isExpanded) {
                    console.debug('[WordDefinitionLayout] Node expansion state changed:', {
                        nodeId: node.id,
                        from: wasExpanded,
                        to: isExpanded
                    });
                }
                
                this.expansionState.set(node.id, isExpanded);
                
                // Also update expanded definitions tracking for definition nodes
                if (node.type === 'definition') {
                    if (isExpanded) {
                        // Calculate ring index
                        let ringIndex = 0;
                        if (node.subtype === 'live') {
                            ringIndex = 0;
                        } else {
                            const alternatives = nodes
                                .filter(n => n.type === 'definition' && n.subtype === 'alternative')
                                .sort((a, b) => (b.metadata?.votes || 0) - (a.metadata?.votes || 0));
                                
                            const altIndex = alternatives.findIndex(d => d.id === node.id);
                            ringIndex = altIndex + 1;
                        }
                        
                        // Calculate adjustment
                        const adjustment = (COORDINATE_SPACE.NODES.SIZES.DEFINITION.DETAIL - 
                                          COORDINATE_SPACE.NODES.SIZES.DEFINITION.PREVIEW) / 2 +
                                          COORDINATE_SPACE.LAYOUT.RING_SPACING.DEFINITION_EXPANSION_BUFFER;
                                          
                        this.expandedDefinitions.set(node.id, { ringIndex, adjustment });
                    } else {
                        this.expandedDefinitions.delete(node.id);
                    }
                }
            }
        });
    }

    /**
     * Track hidden node state changes
     */
    private updateHiddenState(nodes: EnhancedNode[]): void {
        // Update our hidden nodes map
        nodes.forEach(node => {
            if (node.type === 'definition' || node.type === 'word') {
                const wasHidden = this.hiddenNodes.has(node.id);
                const isHidden = node.isHidden || false;
                
                if (wasHidden !== isHidden) {
                    console.debug('[WordDefinitionLayout] Node hidden state changed:', {
                        nodeId: node.id,
                        from: wasHidden,
                        to: isHidden
                    });
                }
                
                // Update hidden nodes tracking for definition nodes
                if (node.type === 'definition') {
                    if (isHidden) {
                        // Calculate ring index
                        let ringIndex = 0;
                        if (node.subtype === 'live') {
                            ringIndex = 0;
                        } else {
                            const alternatives = nodes
                                .filter(n => n.type === 'definition' && n.subtype === 'alternative')
                                .sort((a, b) => (b.metadata?.votes || 0) - (a.metadata?.votes || 0));
                                
                            const altIndex = alternatives.findIndex(d => d.id === node.id);
                            ringIndex = altIndex + 1;
                        }
                        
                        // Calculate adjustment (negative value to pull inward)
                        const adjustment = -(COORDINATE_SPACE.NODES.SIZES.DEFINITION.PREVIEW - 
                                          COORDINATE_SPACE.NODES.SIZES.HIDDEN) / 2;
                                          
                        this.hiddenNodes.set(node.id, { ringIndex, adjustment });
                        
                        console.debug('[WordDefinitionLayout] Added hidden node tracking:', {
                            nodeId: node.id,
                            ringIndex,
                            adjustment
                        });
                    } else {
                        if (this.hiddenNodes.has(node.id)) {
                            this.hiddenNodes.delete(node.id);
                            console.debug('[WordDefinitionLayout] Removed hidden node tracking:', {
                                nodeId: node.id
                            });
                        }
                    }
                }
            }
        });
    }

    /**
     * Position the live definition to the right of the word node
     */
    private positionLiveDefinition(node: EnhancedNode): void {
        // Basic positioning constants
        const baseRadius = COORDINATE_SPACE.LAYOUT.RING_SPACING.INITIAL;
        
        // Retrieve the word node to check its state
        const wordNode = (this.simulation.nodes() as unknown as EnhancedNode[])
            .find(n => n.fixed || n.group === 'central');
        
        // Calculate adjustments based on word node state
        const wordAdjustment = wordNode?.mode === 'preview' ?
            // If word is in preview mode, move definitions inward
            (COORDINATE_SPACE.NODES.SIZES.WORD.DETAIL - COORDINATE_SPACE.NODES.SIZES.WORD.PREVIEW) / 2 :
            0;
            
        // Additional inward adjustment if word node is hidden
        const wordHiddenAdjustment = wordNode?.isHidden ?
            // If word is hidden, move definitions even further inward
            (COORDINATE_SPACE.NODES.SIZES.WORD.PREVIEW - COORDINATE_SPACE.NODES.SIZES.HIDDEN) / 2 :
            0;
            
        // Calculate expansion adjustment - move outward if expanded
        const expansionAdjustment = node.mode === 'detail' ?
            (COORDINATE_SPACE.NODES.SIZES.DEFINITION.DETAIL - COORDINATE_SPACE.NODES.SIZES.DEFINITION.PREVIEW) / 2 :
            0;
            
        // Calculate hidden adjustment - move inward if hidden
        const hiddenAdjustment = node.isHidden ?
            -(COORDINATE_SPACE.NODES.SIZES.DEFINITION.PREVIEW - COORDINATE_SPACE.NODES.SIZES.HIDDEN) / 2 :
            0;
        
        // Calculate final position - expansion moves outward, word preview/hidden moves inward
        const posX = baseRadius + expansionAdjustment - wordAdjustment - wordHiddenAdjustment + hiddenAdjustment;

        console.debug('[WordDefinitionLayout] Live definition positioned:', {
            id: node.id,
            baseRadius,
            expansionAdjustment,
            wordAdjustment,
            wordHiddenAdjustment,
            hiddenAdjustment,
            finalPosition: posX,
            isDetail: node.mode === 'detail',
            isHidden: node.isHidden
        });

        // Set position
        node.x = posX;
        node.y = 0;

        // Store angle for consistency
        this.definitionAngles.set(node.id, 0);
    }

    /**
     * Position all alternative definitions
     */
    private positionAlternativeDefinitions(alternatives: EnhancedNode[]): void {
        alternatives.forEach((node, index) => {
            // Calculate position with all adjustments
            const { angle, radius } = this.calculateAltDefinitionPosition(node, index);

            // Set position using angle and radius
            node.x = Math.cos(angle) * radius;
            node.y = Math.sin(angle) * radius;
            
            console.debug('[WordDefinitionLayout] Alternative definition positioned:', {
                id: node.id,
                index,
                angle: angle * (180 / Math.PI),
                radius,
                position: { x: node.x, y: node.y },
                isDetail: node.mode === 'detail',
                isHidden: node.isHidden
            });
        });
    }

    /**
     * Calculate position for alternative definition with all adjustments
     */
    private calculateAltDefinitionPosition(node: EnhancedNode, index: number): { angle: number, radius: number } {
        // Get or assign an angle for this node
        const nodeId = node.id;
        let angle = this.definitionAngles.get(nodeId);
        
        if (angle === undefined) {
            // Calculate angle using golden ratio for even distribution
            angle = index === 0 ? 
                this.FIRST_ALT_ANGLE : 
                (this.FIRST_ALT_ANGLE + (this.GOLDEN_ANGLE * index)) % (2 * Math.PI);
            this.definitionAngles.set(nodeId, angle);
        }

        const ringIndex = index + 1; // Ring index starts at 1 for alternatives

        // Calculate base radius from coordinate space constants
        const baseRadius = COORDINATE_SPACE.LAYOUT.RING_SPACING.INITIAL * 
            (1 + ((index + 1) * COORDINATE_SPACE.LAYOUT.RING_SPACING.INCREMENT));

        // Retrieve the word node to check its state
        const wordNode = (this.simulation.nodes() as unknown as EnhancedNode[])
            .find(n => n.fixed || n.group === 'central');
        
        // Calculate word node adjustment (inward when word is in preview mode)
        const wordAdjustment = wordNode?.mode === 'preview' ?
            (COORDINATE_SPACE.NODES.SIZES.WORD.DETAIL - COORDINATE_SPACE.NODES.SIZES.WORD.PREVIEW) / 2 :
            0;
            
        // Additional inward adjustment if word node is hidden
        const wordHiddenAdjustment = wordNode?.isHidden ?
            (COORDINATE_SPACE.NODES.SIZES.WORD.PREVIEW - COORDINATE_SPACE.NODES.SIZES.HIDDEN) / 2 :
            0;
            
        // Calculate expansion adjustment - move outward if expanded
        const expansionAdjustment = node.mode === 'detail' ?
            (COORDINATE_SPACE.NODES.SIZES.DEFINITION.DETAIL - COORDINATE_SPACE.NODES.SIZES.DEFINITION.PREVIEW) / 2 :
            0;
            
        // Calculate hidden adjustment - move inward if hidden
        const hiddenAdjustment = node.isHidden ?
            -(COORDINATE_SPACE.NODES.SIZES.DEFINITION.PREVIEW - COORDINATE_SPACE.NODES.SIZES.HIDDEN) / 2 :
            0;
        
        // Calculate adjustment from inner expanded nodes
        let innerExpandedAdjustment = 0;
        this.expandedDefinitions.forEach((data, id) => {
            // If this is an inner ring that's expanded, add its adjustment
            if (data.ringIndex < ringIndex) {
                innerExpandedAdjustment += data.adjustment;
                console.debug('[WordDefinitionLayout] Adding inner expanded adjustment:', {
                    forNodeId: node.id,
                    fromNodeId: id,
                    innerRingIndex: data.ringIndex,
                    thisRingIndex: ringIndex,
                    adjustment: data.adjustment
                });
            }
        });
        
        // Calculate adjustment from inner hidden nodes
        let innerHiddenAdjustment = 0;
        this.hiddenNodes.forEach((data, id) => {
            // If this is an inner ring that's hidden, add its adjustment (negative)
            if (data.ringIndex < ringIndex) {
                innerHiddenAdjustment += data.adjustment;
                console.debug('[WordDefinitionLayout] Adding inner hidden adjustment:', {
                    forNodeId: node.id,
                    fromNodeId: id,
                    innerRingIndex: data.ringIndex,
                    thisRingIndex: ringIndex,
                    adjustment: data.adjustment
                });
            }
        });
        
        // Calculate final radius with all adjustments:
        // - Expansion moves outward (positive)
        // - Hidden moves inward (negative)
        // - Word preview/hidden moves inward (negative)
        // - Inner expanded nodes push outward (positive)
        // - Inner hidden nodes pull inward (negative)
        const radius = baseRadius + 
                      expansionAdjustment + 
                      hiddenAdjustment - 
                      wordAdjustment - 
                      wordHiddenAdjustment + 
                      innerExpandedAdjustment + 
                      innerHiddenAdjustment;

        console.debug('[WordDefinitionLayout] Alternative definition position calculated:', {
            nodeId: node.id,
            ringIndex,
            baseRadius,
            expansionAdjustment,
            hiddenAdjustment,
            wordAdjustment,
            wordHiddenAdjustment,
            innerExpandedAdjustment,
            innerHiddenAdjustment,
            finalRadius: radius
        });

        return { angle, radius };
    }

    /**
     * Reposition all definition nodes
     */
    private repositionDefinitions(nodes: EnhancedNode[]): void {
        // Find live definition
        const liveDefinition = nodes.find(n => n.type === 'definition' && n.subtype === 'live');
        if (liveDefinition) {
            this.positionLiveDefinition(liveDefinition);
        }

        // Find and sort alternative definitions
        const alternatives = nodes
            .filter(n => n.type === 'definition' && n.subtype === 'alternative')
            .sort((a, b) => (b.metadata?.votes || 0) - (a.metadata?.votes || 0));

        // Reposition all alternatives
        this.positionAlternativeDefinitions(alternatives);
    }

    /**
     * Update data and handle mode changes
     * ALWAYS skip animation like SingleNodeLayout
     */
    public updateData(nodes: EnhancedNode[], links: EnhancedLink[], skipAnimation: boolean = false): void {
        console.debug('[WordDefinitionLayout] Updating layout data', {
            nodeCount: nodes.length,
            linkCount: links.length
        });

        // Always stop simulation during update
        this.simulation.stop();
        
        // Track expansion state changes
        this.updateExpansionState(nodes);
        
        // Track hidden state changes
        this.updateHiddenState(nodes);

        // Clear all forces
        this.clearAllForces();
        
        // Initialize positions
        this.initializeNodePositions(nodes);
        
        // Update nodes
        this.simulation.nodes(asD3Nodes(nodes));
        
        // Configure forces (which adds no actual forces)
        this.configureForces();

        // ALWAYS skip animation by setting alpha to 0
        this.simulation.alpha(0).alphaTarget(0);
            
        // Ensure fixed positions after update
        this.enforceFixedPositions();
    }
    
    /**
     * Stops the layout strategy and clears all forces
     */
    public stop(): void {
        // Call parent stop
        super.stop();
        
        // Also clear all forces
        if (this.simulation) {
            this.clearAllForces();
        }
    }
}