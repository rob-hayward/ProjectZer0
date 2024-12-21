// src/lib/components/graph/layouts/GraphLayout.ts
import * as d3 from 'd3';
import type { SimulationNodeDatum } from 'd3-force';
import type { GraphNode, NodePosition, GraphData } from '$lib/types/graph';
import { LAYOUT_CONSTANTS } from './layoutConstants';

interface SimulationNode extends GraphNode, SimulationNodeDatum {}

export class GraphLayout {
   private simulation: d3.Simulation<SimulationNode, undefined>;
   private width: number;
   private height: number;

   constructor(width: number, height: number) {
       this.width = width;
       this.height = height;
       this.simulation = this.initializeSimulation();
   }

   private initializeSimulation(): d3.Simulation<SimulationNode, undefined> {
       return d3.forceSimulation<SimulationNode>()
           .velocityDecay(LAYOUT_CONSTANTS.SIMULATION.VELOCITY_DECAY)
           .alphaDecay(LAYOUT_CONSTANTS.SIMULATION.ALPHA_DECAY);
   }

   private configureSingleNodeLayout(node: SimulationNode): void {
       // Remove all forces for single node
       this.simulation.force("center", null);
       this.simulation.force("charge", null);
       this.simulation.force("collision", null);
       this.simulation.force("radial", null);

       // Fix node position at center
       node.fx = 0;
       node.fy = 0;
       node.x = 0;
       node.y = 0;
   }

   private configureDashboardAndNavigationLayout(nodes: SimulationNode[]): void {
        const navigationNodes = nodes.filter(n => n.group === 'navigation');
        const centerNode = nodes.find(n => n.group === 'central');

        console.log('Configuring navigation layout:', {
            totalNodes: nodes.length,
            navigationNodes: navigationNodes.length,
            hasCenterNode: !!centerNode
        });

        if (!centerNode) return;

        // Fix center node position
        centerNode.fx = 0;
        centerNode.fy = 0;
        centerNode.x = 0;
        centerNode.y = 0;

        // Clear existing forces
        this.simulation.force("center", null);
        this.simulation.force("charge", null);
        this.simulation.force("collision", null);
        this.simulation.force("radial", null);

        // Pre-position navigation nodes in a circle and fix their positions
        navigationNodes.forEach((node, i) => {
            const angle = (i / navigationNodes.length) * 2 * Math.PI - Math.PI / 2;
            const x = Math.cos(angle) * LAYOUT_CONSTANTS.NAVIGATION.RADIUS;
            const y = Math.sin(angle) * LAYOUT_CONSTANTS.NAVIGATION.RADIUS;
            
            // Fix the positions of navigation nodes
            node.fx = x;
            node.fy = y;
            node.x = x;
            node.y = y;

            console.log(`Fixed position for node ${i}:`, { x, y });
        });

        // Configure forces with fixed positions
        this.simulation
            .force("collision", d3.forceCollide<SimulationNode>()
                .radius(LAYOUT_CONSTANTS.NAVIGATION.SPACING)
                .strength(LAYOUT_CONSTANTS.NAVIGATION.STRENGTH.COLLISION))
            .force("center", d3.forceCenter(0, 0));

        // Let's add a check if positions are maintained
        console.log('Node positions after force configuration:', 
            nodes.map(n => ({ id: n.id, x: n.x, y: n.y, fx: n.fx, fy: n.fy }))
        );
    }

   public updateLayout(data: GraphData): Map<string, NodePosition> {
       const nodes = data.nodes as SimulationNode[];
       console.log('Updating layout with nodes:', nodes);

       if (nodes.length === 1) {
           this.configureSingleNodeLayout(nodes[0]);
       } else if (nodes.some(n => n.group === 'navigation')) {
           this.configureDashboardAndNavigationLayout(nodes);
       }

       // Update simulation with nodes
       this.simulation.nodes(nodes);
       
       // Run simulation with more iterations for multi-node layouts
       if (nodes.length === 1) {
           this.simulation.tick();
           this.simulation.stop();
       } else {
           this.simulation.alpha(1).restart();
           // Increase iterations for better settling
           for (let i = 0; i < 500; ++i) {
               this.simulation.tick();
           }
       }

       return this.getNodePositions(nodes);
   }

   private getNodePositions(nodes: SimulationNode[]): Map<string, NodePosition> {
    nodes.forEach(node => {
        console.log(`Position for ${node.id}:`, {
            x: node.x,
            y: node.y,
            group: node.group,
            fixed: { fx: node.fx, fy: node.fy }
        });
    });

    return new Map(
        nodes.map(node => {
            const position = {
                x: node.x ?? 0,
                y: node.y ?? 0,
                scale: node.group === 'central' ? 1 : 0.9,
                svgTransform: `translate(${node.x ?? 0}, ${node.y ?? 0})`,
                angle: node.group === 'navigation' ? 
                    Math.atan2(node.y ?? 0, node.x ?? 0) : undefined,
                distanceFromCenter: node.group === 'navigation' ?
                    Math.sqrt(Math.pow(node.x ?? 0, 2) + Math.pow(node.y ?? 0, 2)) : undefined
            };
            console.log(`Position for node ${node.id}:`, position);
            return [node.id, position];
        })
    );
}

   public resize(width: number, height: number): void {
       this.width = width;
       this.height = height;
       
       const centerForce = this.simulation.force("center") as d3.ForceCenter<SimulationNode>;
       if (centerForce) {
           centerForce.x(0).y(0);
       }
   }

   public stop(): void {
       this.simulation.stop();
   }
}