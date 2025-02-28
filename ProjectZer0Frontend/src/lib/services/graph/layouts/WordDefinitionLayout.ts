// src/lib/services/graph/simulation/layouts/WordDefinitionLayout.ts
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
 */
export class WordDefinitionLayout extends BaseLayoutStrategy {
    private readonly GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
    private readonly FIRST_ALT_ANGLE = Math.PI;
    private definitionAngles: Map<string, number> = new Map();
    private expansionState: Map<string, boolean> = new Map();

    constructor(width: number, height: number, viewType: ViewType) {
        super(width, height, viewType);
        console.debug('[WordDefinitionLayout] Initializing with dimensions:', {
            width: COORDINATE_SPACE.WORLD.WIDTH,
            height: COORDINATE_SPACE.WORLD.HEIGHT,
            viewType
        });
    }

    /**
     * Set initial positions for all nodes
     */
    initializeNodePositions(nodes: EnhancedNode[]): void {
        console.debug('[WordDefinitionLayout] Initializing node positions', {
            nodeCount: nodes.length,
            nodeTypes: nodes.map(n => ({ id: n.id, type: n.type, subtype: n.subtype }))
        });

        // Update expansion state tracking
        this.updateExpansionState(nodes);

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

        // Center the word node
        centralNode.fx = 0;
        centralNode.fy = 0;
        centralNode.x = 0;
        centralNode.y = 0;

        console.debug('[WordDefinitionLayout] Central node positioned at center');

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
    }

    /**
     * Configure forces for this layout
     */
    configureForces(): void {
        console.debug('[WordDefinitionLayout] Configuring forces');

        // Remove all existing forces first
        (this.simulation as any).force('charge', null);
        (this.simulation as any).force('collision', null);
        (this.simulation as any).force('link', null);
        (this.simulation as any).force('center', null);
        
        // Configure minimal forces for navigation nodes
        NavigationNodeLayout.configureNoForces(this.simulation);

        // Configure collision detection with node-size aware padding
        const collision = d3.forceCollide<any>()
            .radius((d: any) => {
                const node = d as EnhancedNode;
                const size = this.getNodeRadius(node);
                const padding = COORDINATE_SPACE.NODES.PADDING.COLLISION[
                    node.type === 'definition' ? 'DEFINITION' : 'BASE'
                ];
                return size + padding;
            })
            .strength(0.8)  // Higher collision strength for better separation
            .iterations(6);

        // Mild charge force to maintain spacing
        const charge = d3.forceManyBody<any>()
            .strength((d: any) => {
                const node = d as EnhancedNode;
                // Different charge based on node type
                if (node.type === 'word' || node.group === 'central') {
                    return COORDINATE_SPACE.LAYOUT.FORCES.CHARGE.STRENGTH.WORD;
                } else if (node.type === 'definition') {
                    return node.subtype === 'live' ?
                        COORDINATE_SPACE.LAYOUT.FORCES.CHARGE.STRENGTH.DEFINITION.LIVE :
                        COORDINATE_SPACE.LAYOUT.FORCES.CHARGE.STRENGTH.DEFINITION.ALTERNATIVE;
                } else {
                    return -50; // Default mild charge
                }
            })
            .distanceMin(COORDINATE_SPACE.LAYOUT.FORCES.CHARGE.DISTANCE.MIN)
            .distanceMax(COORDINATE_SPACE.LAYOUT.FORCES.CHARGE.DISTANCE.MAX);

        // Configure forces
        this.simulation
            .force('collision', collision)
            .force('charge', charge);
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

        // For word nodes, we need to update all definition positions
        if (node.type === 'word') {
            console.debug('[WordDefinitionLayout] Word node mode changed, repositioning definitions');
            
            // Recalculate all positions
            this.repositionDefinitions(nodes);
        }
        
        // If an alternative definition changes mode, we may need to adjust other definitions
        if (node.type === 'definition' && node.subtype === 'alternative') {
            console.debug('[WordDefinitionLayout] Alternative definition mode changed');
            
            // Get all alternative definitions
            const alternatives = nodes
                .filter(n => n.type === 'definition' && n.subtype === 'alternative')
                .sort((a, b) => (b.metadata?.votes || 0) - (a.metadata?.votes || 0));
                
            // Reposition them to handle expansion changes
            this.positionAlternativeDefinitions(alternatives);
        }
        
        // Ensure navigation node positions are maintained
        NavigationNodeLayout.enforceFixedPositions(nodes);
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
            
        // Calculate expansion adjustment - move outward if expanded
        const expansionAdjustment = node.mode === 'detail' ?
            (COORDINATE_SPACE.NODES.SIZES.DEFINITION.DETAIL - COORDINATE_SPACE.NODES.SIZES.DEFINITION.PREVIEW) / 2 :
            0;
        
        // Calculate final position - expansion moves outward, word preview moves inward
        const posX = baseRadius + expansionAdjustment - wordAdjustment;

        console.debug('[WordDefinitionLayout] Live definition positioned:', {
            id: node.id,
            baseRadius,
            expansionAdjustment,
            wordAdjustment,
            finalPosition: posX,
            isDetail: node.mode === 'detail'
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
                isDetail: node.mode === 'detail'
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
            
        // Calculate expansion adjustment - move outward if expanded
        const expansionAdjustment = node.mode === 'detail' ?
            (COORDINATE_SPACE.NODES.SIZES.DEFINITION.DETAIL - COORDINATE_SPACE.NODES.SIZES.DEFINITION.PREVIEW) / 2 :
            0;
        
        // Calculate final radius - expansion moves outward, word preview moves inward
        const radius = baseRadius + expansionAdjustment - wordAdjustment;

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
     */
    public updateData(nodes: EnhancedNode[], links: EnhancedLink[], skipAnimation: boolean = false): void {
        console.debug('[WordDefinitionLayout] Updating layout data', {
            nodeCount: nodes.length,
            linkCount: links.length,
            skipAnimation
        });

        // Track expansion state changes
        this.updateExpansionState(nodes);

        this.simulation.stop();
        this.initializeNodePositions(nodes);
        this.simulation.nodes(asD3Nodes(nodes));
        this.configureForces();

        // Very small alpha to minimize force-based movement
        const alpha = skipAnimation ? 0 : 0.1;

        this.simulation
            .alpha(alpha)
            .alphaTarget(0)
            .restart();
    }
}