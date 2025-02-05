// src/lib/services/graph/simulation/layouts/SingleNodeLayout.ts
import * as d3 from 'd3';
import { BaseLayoutStrategy } from './BaseLayoutStrategy';
import { NavigationNodeLayout } from './common/NavigationNodeLayout';
import type { LayoutNode, LayoutLink } from '../../../../types/graph/layout';
import type { ViewType } from '../../../../types/graph/core';
import { LAYOUTS, DIMENSIONS } from '../../../../constants/graph';
import { NODE_CONSTANTS } from '../../../../constants/graph/nodes';

export class SingleNodeLayout extends BaseLayoutStrategy {
    constructor(width: number, height: number, viewType: ViewType) {
        super(DIMENSIONS.WIDTH, DIMENSIONS.HEIGHT, viewType);
        console.log('SingleNodeLayout constructed:', { 
            width: DIMENSIONS.WIDTH, 
            height: DIMENSIONS.HEIGHT, 
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

        const { FORCES } = LAYOUTS.SINGLE_NODE;

        // Configure central node forces
        const centralCharge = d3.forceManyBody<LayoutNode>()
            .strength(node => node.type === 'central' ? 
                FORCES.CENTRAL.CHARGE.STRENGTH : 0)
            .distanceMin(FORCES.CENTRAL.CHARGE.DISTANCE.MIN)
            .distanceMax(FORCES.CENTRAL.CHARGE.DISTANCE.MAX);

        const collision = d3.forceCollide<LayoutNode>()
            .radius(node => {
                if (node.type !== 'central') return 0;
                const baseRadius = this.getNodeSize(node) / 2;
                return baseRadius + FORCES.CENTRAL.COLLISION.PADDING;
            })
            .strength(FORCES.CENTRAL.COLLISION.STRENGTH)
            .iterations(FORCES.CENTRAL.COLLISION.ITERATIONS);

        this.simulation
            .force('centralCharge', centralCharge)
            .force('centralCollision', collision)
            .alpha(1)
            .restart();
    }

    private getNodeSize(node: LayoutNode): number {
        if (node.type === 'central') {
            return NODE_CONSTANTS.SIZES.DASHBOARD.size;
        }
        return NODE_CONSTANTS.SIZES.NAVIGATION.size;
    }
}