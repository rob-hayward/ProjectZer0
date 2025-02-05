// src/lib/services/graph/simulation/layouts/common/NavigationNodeLayout.ts
import * as d3 from 'd3';
import type { LayoutNode, LayoutLink } from '../../../../../types/graph/layout';
import { LAYOUTS, SIMULATION } from '../../../../../constants/graph';
import { NODE_CONSTANTS } from '../../../../../constants/graph/nodes';

export class NavigationNodeLayout {
    private static calculateNavigationRadius(centralNode: LayoutNode, getNodeSize: (node: LayoutNode) => number): number {
        const centralSize = getNodeSize(centralNode);
        const navSize = NODE_CONSTANTS.SIZES.NAVIGATION.size;
        const baseRadius = (centralSize / 2) + (navSize / 2) + LAYOUTS.NAVIGATION.RADIAL.BASE_PADDING;
        
        // Apply multiplier based on detail mode
        const multiplier = centralNode.metadata.isDetail ? 
            LAYOUTS.NAVIGATION.RADIAL.MULTIPLIERS.DETAIL : 
            LAYOUTS.NAVIGATION.RADIAL.MULTIPLIERS.PREVIEW;

        return baseRadius * multiplier;
    }

    static initializeNavigationNodes(
        nodes: LayoutNode[], 
        getNodeSize: (node: LayoutNode) => number
    ): void {
        const centralNode = nodes.find(n => n.metadata.fixed);
        if (!centralNode) return;

        nodes.forEach(node => {
            if (node.metadata.fixed) {
                node.x = 0;
                node.y = 0;
                return;
            }

            if (node.type === 'navigation') {
                const navNodes = nodes.filter(n => n.type === 'navigation');
                const navIndex = navNodes.findIndex(n => n.id === node.id);
                const navCount = navNodes.length;
                
                // Calculate angle for even distribution around circle
                const angle = (2 * Math.PI * navIndex) / navCount - (Math.PI / 2);
                
                // Calculate radius and position
                const radius = this.calculateNavigationRadius(centralNode, getNodeSize);
                node.x = Math.cos(angle) * radius;
                node.y = Math.sin(angle) * radius;
            }
        });
    }

    static configureNavigationForces(
        simulation: d3.Simulation<LayoutNode, LayoutLink>,
        getNodeSize: (node: LayoutNode) => number
    ): void {
        const centralNode = simulation.nodes().find(n => n.metadata.fixed);
        if (!centralNode) return;

        // Radial force for navigation nodes
        const navigationRadial = d3.forceRadial<LayoutNode>(
            node => node.type === 'navigation' ? 
                this.calculateNavigationRadius(centralNode, getNodeSize) : 0,
            0,
            0
        ).strength(LAYOUTS.NAVIGATION.FORCE.STRENGTH);

        // Repulsion between navigation nodes
        const manyBody = d3.forceManyBody<LayoutNode>()
            .strength(node => 
                node.type === 'navigation' ? 
                LAYOUTS.NAVIGATION.FORCE.CHARGE : 0
            )
            .distanceMin(SIMULATION.FORCES.CHARGE.DISTANCE.MIN)
            .distanceMax(SIMULATION.FORCES.CHARGE.DISTANCE.MAX);

        // Collision prevention for navigation nodes
        const collision = d3.forceCollide<LayoutNode>()
            .radius(node => {
                if (node.type !== 'navigation') return 0;
                const baseRadius = NODE_CONSTANTS.SIZES.NAVIGATION.size / 2;
                return baseRadius + LAYOUTS.NAVIGATION.FORCE.COLLISION_PADDING;
            })
            .strength(SIMULATION.FORCES.COLLISION.STRENGTH)
            .iterations(SIMULATION.FORCES.COLLISION.ITERATIONS);

        // Apply forces to simulation
        simulation
            .force('navigationRadial', navigationRadial)
            .force('navigationCharge', manyBody)
            .force('navigationCollision', collision);
    }
}