// src/lib/services/graph/simulation/layouts/WordDefinitionLayout.ts
import * as d3 from 'd3';
import { BaseLayoutStrategy } from './BaseLayoutStrategy';
import { NavigationNodeLayout } from './common/NavigationNodeLayout';
import type { LayoutNode, LayoutLink } from '../../../../types/graph/layout';
import type { ViewType } from '../../../../types/graph/core';
import { LAYOUTS, DIMENSIONS, SIMULATION } from '../../../../constants/graph';
import { NODE_CONSTANTS } from '../../../../constants/graph/nodes';

export class WordDefinitionLayout extends BaseLayoutStrategy {
    private readonly INITIAL_RING_SPACING = 250; // Reduced base spacing
    private readonly GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ≈ 137.5 degrees
    private readonly LIVE_DEFINITION_ANGLE = 0; // 3 o'clock position (right)
    private readonly FIRST_ALT_ANGLE = Math.PI; // 9 o'clock position (left)

    constructor(width: number, height: number, viewType: ViewType) {
        super(DIMENSIONS.WIDTH, DIMENSIONS.HEIGHT, viewType);
        console.log('WordDefinitionLayout constructed:', {
            width: DIMENSIONS.WIDTH,
            height: DIMENSIONS.HEIGHT,
            viewType
        });
    }

    private calculateAltDefinitionPosition(index: number): { angle: number, radius: number } {
        // First alternative definition starts at 9 o'clock (π radians)
        let angle;
        if (index === 0) {
            angle = this.FIRST_ALT_ANGLE; // 9 o'clock
        } else {
            // Use golden angle progression from the first position
            angle = this.FIRST_ALT_ANGLE + (this.GOLDEN_ANGLE * index);
            // Normalize angle to [0, 2π]
            angle = angle % (2 * Math.PI);
        }

        // Calculate radius with a slower growth rate
        const radius = this.INITIAL_RING_SPACING * (1.25 + (index * 0.2));

        return { angle, radius };
    }

    initializeNodePositions(nodes: LayoutNode[]): void {
        console.log('WordDefinitionLayout: initializing node positions');
        
        // Reset nodes
        nodes.forEach(node => {
            node.x = undefined;
            node.y = undefined;
            node.vx = 0;
            node.vy = 0;
        });

        // Initialize navigation nodes
        NavigationNodeLayout.initializeNavigationNodes(nodes, this.getNodeSize.bind(this));

        // Position central word node
        const wordNode = nodes.find(n => n.metadata.fixed);
        if (!wordNode) return;
        wordNode.x = 0;
        wordNode.y = 0;
        wordNode.fx = 0;
        wordNode.fy = 0;

        // Position live definition
        const liveDefinition = nodes.find(n => n.type === 'definition' && n.subtype === 'live');
        if (liveDefinition) {
            const x = this.INITIAL_RING_SPACING * 1.1; // Slightly further out than base spacing
            liveDefinition.x = x;
            liveDefinition.y = 0;
            liveDefinition.fx = x;
            liveDefinition.fy = 0;
        }

        // Position alternative definitions
        const alternatives = nodes.filter(n => n.type === 'definition' && n.subtype === 'alternative')
            .sort((a, b) => (b.metadata.votes || 0) - (a.metadata.votes || 0));

        alternatives.forEach((node, index) => {
            const { angle, radius } = this.calculateAltDefinitionPosition(index);
            node.x = Math.cos(angle) * radius;
            node.y = Math.sin(angle) * radius;
        });
    }

    configureForces(): void {
        console.log('WordDefinitionLayout: configuring forces');

        // Configure navigation node forces
        NavigationNodeLayout.configureNavigationForces(this.simulation, this.getNodeSize.bind(this));

        const alternatives = this.simulation.nodes()
            .filter(n => n.type === 'definition' && n.subtype === 'alternative');

        // Radial force for alternative definitions
        const radialForce = d3.forceRadial<LayoutNode>(
            node => {
                if (node.type !== 'definition' || node.subtype !== 'alternative') return 0;
                const index = alternatives.indexOf(node);
                return this.INITIAL_RING_SPACING * (1 + (index * 0.5));
            },
            0,
            0
        ).strength(0.8);

        // Collision detection
        const collision = d3.forceCollide<LayoutNode>()
            .radius(node => {
                if (node.type === 'navigation') return 0;
                const size = this.getNodeSize(node);
                const padding = SIMULATION.FORCES.COLLISION.PADDING[
                    node.type === 'definition' ? 'DEFINITION' : 'BASE'
                ];
                return (size / 2) + padding;
            })
            .strength(SIMULATION.FORCES.COLLISION.STRENGTH)
            .iterations(SIMULATION.FORCES.COLLISION.ITERATIONS);

        // Angular force to maintain golden angle distribution
        const angularForce = d3.forceLink<LayoutNode, LayoutLink>([])
            .distance((d, i) => {
                const source = typeof d.source === 'string' ? null : d.source;
                if (!source || source.type !== 'definition' || source.subtype !== 'alternative') return 0;
                const index = alternatives.indexOf(source);
                return this.INITIAL_RING_SPACING * (1 + (index * 0.5)) * (Math.PI / 8);
            })
            .strength(0.3);

        // Configure simulation forces
        this.simulation
            .force('radial', radialForce)
            .force('collision', collision)
            .force('angular', angularForce)
            .force('charge', d3.forceManyBody().strength(-300))
            .restart();
    }

    private getNodeSize(node: LayoutNode): number {
        if (node.type === 'word' || node.type === 'central') {
            return node.metadata.isDetail ? 
                NODE_CONSTANTS.SIZES.WORD.detail :
                NODE_CONSTANTS.SIZES.WORD.preview;
        } 
        
        if (node.type === 'definition') {
            if (node.subtype === 'live') {
                return node.metadata.isDetail ?
                    NODE_CONSTANTS.SIZES.DEFINITION.live.detail :
                    NODE_CONSTANTS.SIZES.DEFINITION.live.preview;
            } else {
                return node.metadata.isDetail ?
                    NODE_CONSTANTS.SIZES.DEFINITION.alternative.detail :
                    NODE_CONSTANTS.SIZES.DEFINITION.alternative.preview;
            }
        }
        
        return NODE_CONSTANTS.SIZES.NAVIGATION.size;
    }
}