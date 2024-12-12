import * as d3 from 'd3';
import type { GraphNode, GraphEdge, NodePosition } from '$lib/types/graph';
import { NODE_CONSTANTS } from '../nodes/base/BaseNodeConstants';

export class ForceLayout {
    private simulation: d3.Simulation<GraphNode, GraphEdge>;
    private width: number = 0;
    private height: number = 0;

    constructor() {
        this.simulation = d3.forceSimulation<GraphNode>()
            .alphaDecay(0.1)
            .velocityDecay(0.4);
    }

    private setupForces() {
        const linkForce = d3.forceLink<GraphNode, GraphEdge>()
            .id(d => d.id)
            .distance(NODE_CONSTANTS.LAYOUT.RADIUS.LIVE_DEFINITION)
            .strength(0.5);

        this.simulation
            .force('radial', d3.forceRadial<GraphNode>(
                node => node.type === 'word' ? 0 : NODE_CONSTANTS.LAYOUT.RADIUS.LIVE_DEFINITION,
                0,
                0
            ).strength(0.8))
            .force('collide', d3.forceCollide<GraphNode>()
                .radius(node => {
                    const baseRadius = node.type === 'word' 
                        ? NODE_CONSTANTS.SIZES.WORD.preview / 2
                        : NODE_CONSTANTS.SIZES.DEFINITION.base.preview / 2;
                    return baseRadius + 20;
                })
                .strength(0.9)
                .iterations(2))
            .force('center', d3.forceCenter(0, 0))
            .force('link', linkForce);
    }

    calculateLayout(
        nodes: GraphNode[],
        edges: GraphEdge[],
        width: number,
        height: number
    ): Map<string, NodePosition> {
        this.width = width;
        this.height = height;

        this.setupForces();

        nodes.forEach(node => {
            if (node.type === 'word') {
                node.fx = 0;
                node.fy = 0;
                node.x = 0;
                node.y = 0;
            } else {
                const angle = 2 * Math.PI * Math.random();
                const radius = NODE_CONSTANTS.LAYOUT.RADIUS.LIVE_DEFINITION;
                node.x = radius * Math.cos(angle);
                node.y = radius * Math.sin(angle);
                node.fx = null;
                node.fy = null;
            }
        });

        const linkForce = this.simulation.force('link') as d3.ForceLink<GraphNode, GraphEdge>;
        
        this.simulation
            .nodes(nodes);
            
        if (linkForce) {
            linkForce.links(edges);
        }

        this.simulation
            .alpha(1)
            .restart()
            .tick(300);

        return new Map(nodes.map(node => {
            const x = node.x ?? 0;
            const y = node.y ?? 0;
            const scale = node.type === 'word' ? 1 : 0.9;

            const distance = Math.sqrt(x * x + y * y);
            const angle = Math.atan2(y, x);

            return [
                node.id,
                {
                    x,
                    y,
                    scale,
                    ring: node.type === 'word' ? 0 : 1,
                    ringPosition: (angle / (2 * Math.PI)) + 0.5,
                    distanceFromCenter: distance,
                    rotation: (angle * 180) / Math.PI,
                    svgTransform: `translate(${x},${y}) scale(${scale})`,
                    renderOrder: node.type === 'word' ? 0 : 1
                }
            ];
        }));
    }

    stop(): void {
        this.simulation.stop();
    }
}