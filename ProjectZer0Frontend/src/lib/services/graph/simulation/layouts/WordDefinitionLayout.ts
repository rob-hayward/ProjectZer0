// src/lib/services/graph/simulation/layouts/WordDefinitionLayout.ts
import * as d3 from 'd3';
import { BaseLayoutStrategy } from './BaseLayoutStrategy';
import { NavigationNodeLayout } from './common/NavigationNodeLayout';
import type { LayoutNode, LayoutLink } from '../../../../types/graph/layout';
import type { ViewType } from '../../../../types/graph/core';
import { LAYOUTS, DIMENSIONS, SIMULATION } from '../../../../constants/graph';
import { NODE_CONSTANTS } from '../../../../constants/graph/nodes';

export class WordDefinitionLayout extends BaseLayoutStrategy {
    constructor(width: number, height: number, viewType: ViewType) {
        super(DIMENSIONS.WIDTH, DIMENSIONS.HEIGHT, viewType);
        console.log('WordDefinitionLayout constructed:', {
            width: DIMENSIONS.WIDTH,
            height: DIMENSIONS.HEIGHT,
            viewType
        });
    }

    initializeNodePositions(nodes: LayoutNode[]): void {
        console.log('WordDefinitionLayout: initializing node positions');
        
        // Reset node positions and velocities
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

        // Position definition nodes
        const { INITIAL_POSITIONS } = LAYOUTS.WORD_DEFINITION;
        nodes.forEach(node => {
            if (node.type === 'definition') {
                if (node.subtype === 'live') {
                    node.x = INITIAL_POSITIONS.LIVE_DEFINITION.X;
                    node.y = INITIAL_POSITIONS.LIVE_DEFINITION.Y;
                } else {
                    // Random position for alternative definitions within spread range
                    node.x = (Math.random() - 0.5) * INITIAL_POSITIONS.ALTERNATIVE_SPREAD.X_RANGE;
                    node.y = (Math.random() - 0.5) * INITIAL_POSITIONS.ALTERNATIVE_SPREAD.Y_RANGE;
                }
            }
        });
    }

    configureForces(): void {
        console.log('WordDefinitionLayout: configuring forces');

        // Configure navigation node forces
        NavigationNodeLayout.configureNavigationForces(this.simulation, this.getNodeSize.bind(this));

        const { FORCES } = LAYOUTS.WORD_DEFINITION;

        // Many-body force between all nodes
        const manyBody = d3.forceManyBody<LayoutNode>()
            .strength((node: LayoutNode) => {
                if (node.type === 'word') {
                    return FORCES.MANY_BODY.WORD.STRENGTH;
                }
                if (node.type === 'definition') {
                    if (node.subtype === 'live') {
                        return FORCES.MANY_BODY.DEFINITION.LIVE.STRENGTH;
                    } else {
                        const votes = node.metadata.votes || 0;
                        return FORCES.MANY_BODY.DEFINITION.ALTERNATIVE.BASE_STRENGTH + 
                               (votes * FORCES.MANY_BODY.DEFINITION.ALTERNATIVE.VOTE_MULTIPLIER);
                    }
                }
                return 0;
            })
            .distanceMin(FORCES.MANY_BODY.WORD.DISTANCE.MIN)
            .distanceMax(FORCES.MANY_BODY.WORD.DISTANCE.MAX);

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

        // X-force for live definition positioning
        const xForce = d3.forceX<LayoutNode>()
            .strength(node => 
                node.type === 'definition' && node.subtype === 'live' ? 1 : 0
            )
            .x(LAYOUTS.WORD_DEFINITION.INITIAL_POSITIONS.LIVE_DEFINITION.X);

        // Configure simulation forces
        this.simulation
            .force('charge', manyBody)
            .force('collision', collision)
            .force('x', xForce)
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