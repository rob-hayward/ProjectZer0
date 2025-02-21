// src/lib/services/graph/simulation/layouts/common/NavigationNodeLayout.ts
import * as d3 from 'd3';
import type { LayoutNode, LayoutLink } from '../../../../../types/graph/layout';
import { COORDINATE_SPACE, FORCE_SIMULATION } from '../../../../../constants/graph';

export class NavigationNodeLayout {
    private static calculateNavigationRadius(centralNode: LayoutNode, getNodeSize: (node: LayoutNode) => number): number {
        const centralSize = getNodeSize(centralNode);
        const navSize = COORDINATE_SPACE.NODES.SIZES.NAVIGATION;
        
        // Use the constants directly with no multipliers
        // NAVIGATION.RING_DISTANCE represents the desired distance from central node perimeter
        // to navigation node perimeter
        const perimeterDistance = COORDINATE_SPACE.LAYOUT.NAVIGATION.RING_DISTANCE || 40;
        const baseRadius = (centralSize / 2) + perimeterDistance + (navSize / 2);

        console.debug('[NAV-NODE-LAYOUT] Calculated radius:', {
            centralSize,
            navSize,
            perimeterDistance,
            baseRadius
        });

        return baseRadius;
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
                
                console.debug('[NAV-NODE-LAYOUT] Positioned navigation node:', {
                    nodeId: node.id,
                    radius,
                    angle,
                    position: { x: node.x, y: node.y }
                });
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
        ).strength(FORCE_SIMULATION.SIMULATION.BASE.VELOCITY_DECAY);

        // Repulsion between navigation nodes
        const manyBody = d3.forceManyBody<LayoutNode>()
            .strength(node => 
                node.type === 'navigation' ? 
                COORDINATE_SPACE.LAYOUT.FORCES.CHARGE.STRENGTH.NAVIGATION : 0
            )
            .distanceMin(COORDINATE_SPACE.LAYOUT.FORCES.CHARGE.DISTANCE.MIN)
            .distanceMax(COORDINATE_SPACE.LAYOUT.FORCES.CHARGE.DISTANCE.MAX);

        // Collision prevention for navigation nodes
        const collision = d3.forceCollide<LayoutNode>()
            .radius(node => {
                if (node.type !== 'navigation') return 0;
                const baseRadius = COORDINATE_SPACE.NODES.SIZES.NAVIGATION / 2;
                return baseRadius + COORDINATE_SPACE.NODES.PADDING.COLLISION.NAVIGATION;
            })
            .strength(FORCE_SIMULATION.SIMULATION.BASE.VELOCITY_DECAY)
            .iterations(6);

        // Apply forces to simulation
        simulation
            .force('navigationRadial', navigationRadial)
            .force('navigationCharge', manyBody)
            .force('navigationCollision', collision);
    }
}