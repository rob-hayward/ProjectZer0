// src/lib/services/graph/simulation/layouts/WordDefinitionLayout.ts
import * as d3 from 'd3';
import { BaseLayoutStrategy } from './BaseLayoutStrategy';
import { NavigationNodeLayout } from './common/NavigationNodeLayout';
import type { LayoutNode, LayoutLink } from '../../../../types/graph/layout';
import type { ViewType } from '../../../../types/graph/core';
import { COORDINATE_SPACE, FORCE_SIMULATION } from '../../../../constants/graph';

export class WordDefinitionLayout extends BaseLayoutStrategy {
    private readonly GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
    private readonly FIRST_ALT_ANGLE = Math.PI;
    private isPreviewMode: boolean = false;
    private definitionAngles: Map<string, number> = new Map();
    private expansionState: Map<string, boolean> = new Map();

    constructor(width: number, height: number, viewType: ViewType) {
        super(COORDINATE_SPACE.WORLD.WIDTH, COORDINATE_SPACE.WORLD.HEIGHT, viewType);
        console.debug('[WORD-LAYOUT] Initializing with dimensions:', {
            width: COORDINATE_SPACE.WORLD.WIDTH,
            height: COORDINATE_SPACE.WORLD.HEIGHT,
            viewType
        });
    }

    // Helper method to get node size based on type and mode
    private getNodeSize(node: LayoutNode): number {
        if (node.type === 'word' || node.metadata.fixed) {
            return node.metadata.isDetail === true ? 
                COORDINATE_SPACE.NODES.SIZES.WORD.DETAIL :
                COORDINATE_SPACE.NODES.SIZES.WORD.PREVIEW;
        } 

        if (node.type === 'definition') {
            return node.metadata.isDetail === true ?
                COORDINATE_SPACE.NODES.SIZES.DEFINITION.DETAIL :
                COORDINATE_SPACE.NODES.SIZES.DEFINITION.PREVIEW;
        }

        return COORDINATE_SPACE.NODES.SIZES.NAVIGATION;
    }

    // Calculate word node radius reduction when collapsing from detail to preview
    private getWordNodeRadiusAdjustment(): number {
        const wordNode = this.simulation.nodes().find(n => n.metadata.fixed);
        if (!wordNode) return 0;

        const detailRadius = COORDINATE_SPACE.NODES.SIZES.WORD.DETAIL / 2;
        const previewRadius = COORDINATE_SPACE.NODES.SIZES.WORD.PREVIEW / 2;
        const radiusDifference = detailRadius - previewRadius;

        console.debug('[WORD-LAYOUT] Word node radius adjustment:', {
            isDetail: wordNode.metadata.isDetail,
            detailRadius,
            previewRadius,
            adjustment: wordNode.metadata.isDetail === true ? 0 : radiusDifference
        });

        return wordNode.metadata.isDetail === true ? 0 : radiusDifference;
    }

    // Calculate propagation amount for expanded nodes
    private getNodeExpansionPropagation(nodeId: string, ringIndex: number): number {
        // Get expansion states for all nodes
        const nodes = this.simulation.nodes();
        const expandedInCurrentRing = this.getExpandedNodesInRing(ringIndex);
        const expandedInInnerRings = this.getExpandedNodesInRingRange(0, ringIndex - 1);
        
        // Calculate size differences for propagation
        const detailRadius = COORDINATE_SPACE.NODES.SIZES.DEFINITION.DETAIL / 2;
        const previewRadius = COORDINATE_SPACE.NODES.SIZES.DEFINITION.PREVIEW / 2;
        const selfExpansionAmount = detailRadius - previewRadius;
        
        // Self-expansion - move outward when expanded
        const selfExpansion = nodes.find(n => n.id === nodeId)?.metadata?.isDetail ? 
            selfExpansionAmount : 0;
            
        // Inner ring propagation - move outward proportionally to number of expanded nodes
        const innerRingPropagation = expandedInInnerRings.length * 
            (selfExpansionAmount * 0.6);
            
        // Current ring propagation - if other nodes in same ring are expanded
        const sameRingPropagation = 
            expandedInCurrentRing.some(id => id !== nodeId) ? 
            (selfExpansionAmount * 0.3) : 0;
            
        const totalPropagation = selfExpansion + innerRingPropagation + sameRingPropagation;
        
        console.debug('[WORD-LAYOUT] Expansion propagation:', {
            nodeId,
            ringIndex,
            selfExpansion,
            innerRingPropagation,
            sameRingPropagation,
            totalPropagation,
            expandedInCurrentRing,
            expandedInInnerRings
        });
        
        return totalPropagation;
    }
    
    // Get expanded nodes in specific ring
    private getExpandedNodesInRing(ringIndex: number): string[] {
        return this.simulation.nodes()
            .filter(n => 
                n.type === 'definition' && 
                this.getDefinitionRingIndex(n) === ringIndex &&
                n.metadata.isDetail
            )
            .map(n => n.id);
    }
    
    // Get expanded nodes in range of rings
    private getExpandedNodesInRingRange(startRing: number, endRing: number): string[] {
        return this.simulation.nodes()
            .filter(n => 
                n.type === 'definition' && 
                this.getDefinitionRingIndex(n) >= startRing &&
                this.getDefinitionRingIndex(n) <= endRing &&
                n.metadata.isDetail
            )
            .map(n => n.id);
    }

    // Determine ring index for definition nodes
    private getDefinitionRingIndex(node: LayoutNode): number {
        if (node.type !== 'definition') return -1;
        if (node.subtype === 'live') return 0;

        const alternatives = this.simulation.nodes()
            .filter(n => n.type === 'definition' && n.subtype === 'alternative')
            .sort((a, b) => (b.metadata.votes || 0) - (a.metadata.votes || 0)) as LayoutNode[];

        return alternatives.findIndex(n => n.id === node.id) + 1;
    }

    // Calculate position for alternative definition with all adjustments
    private calculateAltDefinitionPosition(node: LayoutNode, index: number): { angle: number, radius: number } {
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

        // Calculate expansion propagation
        const expansionPropagation = this.getNodeExpansionPropagation(nodeId, ringIndex);
        
        // Apply word node radius adjustment (inward when word collapses)
        const wordAdjustment = this.getWordNodeRadiusAdjustment();
        
        // Calculate final radius - expansion moves outward (positive), word collapse moves inward (negative)
        const radius = baseRadius + expansionPropagation - wordAdjustment;

        console.debug('[WORD-LAYOUT] Alternative definition position:', {
            nodeId,
            ringIndex,
            baseRadius,
            expansionPropagation,
            wordAdjustment,
            finalRadius: radius,
            angle: angle * (180 / Math.PI),
            isExpanded: node.metadata.isDetail
        });

        return { angle, radius };
    }

    initializeNodePositions(nodes: LayoutNode[]): void {
        console.debug('[WORD-LAYOUT] Initializing node positions', {
            nodeCount: nodes.length,
            nodeTypes: nodes.map(n => ({ id: n.id, type: n.type, subtype: n.subtype }))
        });

        // Update expansion state tracking
        this.updateExpansionState(nodes);

        // Reset velocities but preserve existing positions
        nodes.forEach(node => {
            node.vx = 0;
            node.vy = 0;

            // Clear fixed positions to allow adjustments
            if (!node.metadata.fixed) {
                node.fx = undefined;
                node.fy = undefined;
            }
        });

        // Initialize navigation nodes
        NavigationNodeLayout.initializeNavigationNodes(nodes, this.getNodeSize.bind(this));

        // Find and position central word node
        const centralNode = nodes.find(n => n.metadata.fixed);
        if (!centralNode) {
            console.warn('[WORD-LAYOUT] No central node found');
            return;
        }

        // Center the word node
        centralNode.fx = 0;
        centralNode.fy = 0;
        centralNode.x = 0;
        centralNode.y = 0;

        console.debug('[WORD-LAYOUT] Central node positioned at center');

        // Position live definition with adjustments
        const liveDefinition = nodes.find(n => n.type === 'definition' && n.subtype === 'live');
        if (liveDefinition) {
            this.positionLiveDefinition(liveDefinition);
        }

        // Position alternative definitions
        const alternatives = nodes
            .filter(n => n.type === 'definition' && n.subtype === 'alternative')
            .sort((a, b) => (b.metadata.votes || 0) - (a.metadata.votes || 0));

        // Position all alternatives
        this.positionAlternativeDefinitions(alternatives);
    }

    // Track expansion state changes
    private updateExpansionState(nodes: LayoutNode[]): void {
        // Update our expansion state map
        nodes.forEach(node => {
            if (node.type === 'definition') {
                const wasExpanded = this.expansionState.get(node.id) || false;
                const isExpanded = node.metadata.isDetail || false;
                
                if (wasExpanded !== isExpanded) {
                    console.debug('[WORD-LAYOUT] Node expansion state changed:', {
                        nodeId: node.id,
                        from: wasExpanded,
                        to: isExpanded
                    });
                }
                
                this.expansionState.set(node.id, isExpanded);
            }
        });
    }

    private positionLiveDefinition(node: LayoutNode): void {
        // Basic positioning constants
        const baseRadius = COORDINATE_SPACE.LAYOUT.RING_SPACING.INITIAL;
        
        // Calculate all adjustments
        const expansionPropagation = this.getNodeExpansionPropagation(node.id, 0);
        const wordAdjustment = this.getWordNodeRadiusAdjustment();

        // Calculate final position - expansion moves outward
        const posX = baseRadius + expansionPropagation - wordAdjustment;

        console.debug('[WORD-LAYOUT] Live definition positioned:', {
            id: node.id,
            baseRadius,
            expansionPropagation,
            wordAdjustment,
            finalPosition: posX,
            isDetail: node.metadata.isDetail
        });

        // Set position
        node.x = posX;
        node.y = 0;

        // Store angle for consistency
        this.definitionAngles.set(node.id, 0);
    }

    private positionAlternativeDefinitions(alternatives: LayoutNode[]): void {
        alternatives.forEach((node, index) => {
            // Calculate position with all adjustments
            const { angle, radius } = this.calculateAltDefinitionPosition(node, index);

            // Set position using angle and radius
            node.x = Math.cos(angle) * radius;
            node.y = Math.sin(angle) * radius;
            
            console.debug('[WORD-LAYOUT] Alternative definition positioned:', {
                id: node.id,
                index,
                angle: angle * (180 / Math.PI),
                radius,
                position: { x: node.x, y: node.y },
                isDetail: node.metadata.isDetail
            });
        });
    }

    configureForces(): void {
        console.debug('[WORD-LAYOUT] Configuring forces');

        // Configure navigation node forces
        NavigationNodeLayout.configureNavigationForces(this.simulation, this.getNodeSize.bind(this));

        // Configure collision detection with node-size aware padding
        const collision = d3.forceCollide<LayoutNode>()
            .radius(node => {
                const layoutNode = node as LayoutNode;
                const size = this.getNodeSize(layoutNode);
                const padding = COORDINATE_SPACE.NODES.PADDING.COLLISION[
                    layoutNode.type === 'definition' ? 'DEFINITION' : 'BASE'
                ];
                return (size / 2) + padding;
            })
            .strength(0.8)  // Higher collision strength for better separation
            .iterations(6);

        // Configure minimal forces - let explicit positioning dominate
        this.simulation
            .force('collision', collision)
            .force('charge', d3.forceManyBody<LayoutNode>().strength(node => {
                return -50; // Very minimal charge - just enough to maintain spacing
            }))
            .restart();
    }

    public updateData(nodes: LayoutNode[], links: LayoutLink[], skipAnimation: boolean = false): void {
        console.debug('[WORD-LAYOUT] Updating layout data', {
            nodeCount: nodes.length,
            linkCount: links.length,
            skipAnimation
        });

        // Track expansion state changes
        this.updateExpansionState(nodes);

        this.simulation.stop();
        this.initializeNodePositions(nodes);
        this.simulation.nodes(nodes);
        this.configureForces();

        // Very small alpha to minimize force-based movement
        const alpha = skipAnimation ? 0 : 0.1;

        this.simulation
            .alpha(alpha)
            .alphaTarget(0)
            .restart();
    }

    public updatePreviewMode(isPreview: boolean): void {
        console.debug('[WORD-LAYOUT] Preview mode update', {
            from: this.isPreviewMode,
            to: isPreview
        });

        if (this.isPreviewMode !== isPreview) {
            this.isPreviewMode = isPreview;
            const currentNodes = this.simulation.nodes();
            this.updateData(currentNodes, [], false);
        }
    }
}