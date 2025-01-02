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
   private isPreviewMode: boolean;

   constructor(width: number, height: number, isPreviewMode: boolean = false) {
       this.width = width;
       this.height = height;
       this.isPreviewMode = isPreviewMode;
       this.simulation = this.initializeSimulation();
   }

   private initializeSimulation(): d3.Simulation<SimulationNode, undefined> {
       return d3.forceSimulation<SimulationNode>()
           .velocityDecay(LAYOUT_CONSTANTS.SIMULATION.VELOCITY_DECAY)
           .alphaDecay(LAYOUT_CONSTANTS.SIMULATION.ALPHA_DECAY);
   }

   public updatePreviewMode(isPreview: boolean): void {
        console.log('GraphLayout.ts - Updating preview mode:', isPreview);
        if (this.isPreviewMode === isPreview) return;
        
        this.isPreviewMode = isPreview;
        if (this.simulation.nodes().length > 0) {
            this.configureDashboardAndNavigationLayout(this.simulation.nodes());
            this.simulation.alpha(1).restart();
        }
    }

   private configureSingleNodeLayout(node: SimulationNode): void {
       this.simulation.force("center", null);
       this.simulation.force("charge", null);
       this.simulation.force("collision", null);
       this.simulation.force("radial", null);

       node.fx = 0;
       node.fy = 0;
       node.x = 0;
       node.y = 0;
   }

   private configureDashboardAndNavigationLayout(nodes: SimulationNode[]): void {
        // Clear any existing fixed positions first
        nodes.forEach(node => {
            if (node.group === 'navigation') {
                node.fx = undefined;
                node.fy = undefined;
            }
        });

        const navigationNodes = nodes.filter(n => n.group === 'navigation');
        const centerNode = nodes.find(n => n.group === 'central');

        console.log('GraphLayout.ts - Configure layout with isPreviewMode:', this.isPreviewMode);
        console.log('Configuring navigation layout:', {
            totalNodes: nodes.length,
            navigationNodes: navigationNodes.length,
            hasCenterNode: !!centerNode,
            isPreviewMode: this.isPreviewMode
        });

        if (!centerNode) return;

        centerNode.fx = 0;
        centerNode.fy = 0;
        centerNode.x = 0;
        centerNode.y = 0;

        this.simulation.force("center", null);
        this.simulation.force("charge", null);
        this.simulation.force("collision", null);
        this.simulation.force("radial", null);

        const radius = this.isPreviewMode ? 
            LAYOUT_CONSTANTS.NAVIGATION.RADIUS.PREVIEW : 
            LAYOUT_CONSTANTS.NAVIGATION.RADIUS.DETAIL;
        
        const spacing = this.isPreviewMode ? 
            LAYOUT_CONSTANTS.NAVIGATION.SPACING.PREVIEW : 
            LAYOUT_CONSTANTS.NAVIGATION.SPACING.DETAIL;

        navigationNodes.forEach((node, i) => {
            const angle = (i / navigationNodes.length) * 2 * Math.PI - Math.PI / 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            node.fx = x;
            node.fy = y;
            node.x = x;
            node.y = y;

            console.log(`Fixed position for node ${i}:`, { 
                id: node.id, 
                x, 
                y, 
                radius,
                spacing,
                isPreviewMode: this.isPreviewMode 
            });
        });

        this.simulation
            .force("collision", d3.forceCollide<SimulationNode>()
                .radius(spacing)
                .strength(LAYOUT_CONSTANTS.NAVIGATION.STRENGTH.COLLISION))
            .force("center", d3.forceCenter(0, 0));

        console.log('Layout configuration:', { 
            radius, 
            spacing, 
            isPreviewMode: this.isPreviewMode,
            nodePositions: nodes.map(n => ({ 
                id: n.id, 
                x: n.x, 
                y: n.y, 
                fx: n.fx, 
                fy: n.fy 
            }))
        });
    }

   public updateLayout(data: GraphData): Map<string, NodePosition> {
       const nodes = data.nodes as SimulationNode[];
       console.log('Updating layout with nodes:', nodes);

       if (nodes.length === 1) {
           this.configureSingleNodeLayout(nodes[0]);
       } else if (nodes.some(n => n.group === 'navigation')) {
           this.configureDashboardAndNavigationLayout(nodes);
       }

       this.simulation.nodes(nodes);
       
       if (nodes.length === 1) {
           this.simulation.tick();
           this.simulation.stop();
       } else {
           this.simulation.alpha(1).restart();
           for (let i = 0; i < LAYOUT_CONSTANTS.SIMULATION.ITERATIONS; ++i) {
               this.simulation.tick();
           }
       }

       return this.getNodePositions(nodes);
   }

   private getNodePositions(nodes: SimulationNode[]): Map<string, NodePosition> {
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