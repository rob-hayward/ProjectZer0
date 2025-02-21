// src/lib/services/graph/simulation/layouts/SingleNodeLayout.ts
import * as d3 from 'd3';
import { BaseLayoutStrategy } from './BaseLayoutStrategy';
import { NavigationNodeLayout } from './common/NavigationNodeLayout';
import type { LayoutNode, LayoutLink } from '../../../../types/graph/layout';
import type { ViewType } from '../../../../types/graph/core';
import { COORDINATE_SPACE, FORCE_SIMULATION } from '../../../../constants/graph';

export class SingleNodeLayout extends BaseLayoutStrategy {
    constructor(width: number, height: number, viewType: ViewType) {
        super(COORDINATE_SPACE.WORLD.WIDTH, COORDINATE_SPACE.WORLD.HEIGHT, viewType);
        console.log('SingleNodeLayout constructed:', { 
            width: COORDINATE_SPACE.WORLD.WIDTH, 
            height: COORDINATE_SPACE.WORLD.HEIGHT, 
            viewType 
        });
    }

    initializeNodePositions(nodes: LayoutNode[]): void {
        console.log('SingleNodeLayout initializing positions:', {
            nodeCount: nodes.length,
            types: nodes.map(n => ({ id: n.id, type: n.type, x: n.x, y: n.y }))
        });

        this.simulation.stop();
        ['navigationRadial', 'navigationCharge', 'navigationCollision',
         'centralCharge', 'centralCollision'].forEach(forceName => {
            this.simulation.force(forceName, null);
        });

        NavigationNodeLayout.initializeNavigationNodes(nodes, this.getNodeSize.bind(this));
    }

    configureForces(): void {
        const nodes = this.simulation.nodes();
        console.log('SingleNodeLayout configuring forces:', {
            nodeCount: nodes.length,
            currentPositions: nodes.map(n => ({ id: n.id, type: n.type, x: n.x, y: n.y }))
        });

        NavigationNodeLayout.configureNavigationForces(this.simulation, this.getNodeSize.bind(this));

        // Configure central node forces
        const centralCharge = d3.forceManyBody<LayoutNode>()
            .strength(node => node.type === 'central' ? 
                COORDINATE_SPACE.LAYOUT.FORCES.CHARGE.STRENGTH.WORD : 0)
            .distanceMin(COORDINATE_SPACE.LAYOUT.FORCES.CHARGE.DISTANCE.MIN)
            .distanceMax(COORDINATE_SPACE.LAYOUT.FORCES.CHARGE.DISTANCE.MAX);

        const collision = d3.forceCollide<LayoutNode>()
            .radius(node => {
                if (node.type !== 'central') return 0;
                const baseRadius = this.getNodeSize(node) / 2;
                return baseRadius + COORDINATE_SPACE.NODES.PADDING.COLLISION.BASE;
            })
            .strength(FORCE_SIMULATION.SIMULATION.BASE.VELOCITY_DECAY)
            .iterations(6);

        this.simulation
            .force('centralCharge', centralCharge)
            .force('centralCollision', collision)
            .alpha(FORCE_SIMULATION.SIMULATION.BASE.ALPHA_VALUES.START)
            .restart();
    }

    private getNodeSize(node: LayoutNode): number {
        if (node.type === 'central') {
            return COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL;
        }
        return COORDINATE_SPACE.NODES.SIZES.NAVIGATION;
    }
}