import * as d3 from 'd3';
import type { GraphNode, GraphEdge, NodePosition, GraphData } from '$lib/types/graph';
import type { WordNode, Definition } from '$lib/types/nodes';
import { NODE_CONSTANTS } from '../nodes/base/BaseNodeConstants';
import { LAYOUT_CONSTANTS } from './layoutConstants';

// Extend GraphNode with D3 simulation properties
interface SimulationNode extends GraphNode, d3.SimulationNodeDatum {}

// Create a custom type for links that's compatible with both D3 and our needs
interface SimulationLink extends Omit<GraphEdge, 'source' | 'target'> {
    source: string | SimulationNode;
    target: string | SimulationNode;
}

// Type guard for GraphNode objects
function isGraphNode(value: any): value is GraphNode {
    return value && typeof value === 'object' && 'id' in value;
}

export class ForceLayout {
    private simulation: d3.Simulation<SimulationNode, SimulationLink>;
    private width: number = 0;
    private height: number = 0;
    private nodes: SimulationNode[] = [];
    private links: SimulationLink[] = [];
    
    constructor() {
        this.simulation = d3.forceSimulation<SimulationNode>();
        this.initializeForces();
    }

    private initializeForces() {
        this.simulation
            .force("charge", d3.forceManyBody<SimulationNode>()
                .strength((d: SimulationNode) => d.type === 'word' ? 0 : -400))
            .force("collide", d3.forceCollide<SimulationNode>()
                .radius(this.getCollisionRadius)
                .strength(0.5))
            .force("center", d3.forceCenter())
            .velocityDecay(0.4)
            .alphaDecay(0.01);
    }

    private getCollisionRadius(node: SimulationNode): number {
        const baseSize = node.type === 'word' ? 
            NODE_CONSTANTS.SIZES.WORD.preview : 
            NODE_CONSTANTS.SIZES.DEFINITION.live.preview;
        return (baseSize / 2) + 20;
    }

    private getRadialDistance(node: SimulationNode): number {
        if (node.type === 'word') return 0;
        return LAYOUT_CONSTANTS.RADIUS.ALTERNATIVE_BASE;
    }

    private getNodeId(value: string | GraphNode | undefined): string {
        if (!value) return '';
        if (typeof value === 'string') return value;
        if (isGraphNode(value)) return value.id;
        return '';
    }

    calculateLayout(
        graphData: GraphData,
        width: number,
        height: number
    ): Map<string, NodePosition> {
        console.log('Starting layout calculation with data:', graphData);
        
        this.width = width;
        this.height = height;

        // Create simulation nodes with proper typing
        this.nodes = graphData.nodes.map(node => ({
            ...node,
            x: undefined,
            y: undefined,
            vx: undefined,
            vy: undefined
        }));

        // Create simulation links with proper typing
        this.links = graphData.links.map(link => ({
            ...link,
            source: this.getNodeId(link.source),
            target: this.getNodeId(link.target)
        }));

        // Update force center
        const centerForce = this.simulation.force("center") as d3.ForceCenter<SimulationNode>;
        centerForce.x(0).y(0);

        // Configure link force
        const linkForce = d3.forceLink<SimulationNode, SimulationLink>()
            .links(this.links)
            .id((d: SimulationNode) => d.id)
            .distance((d: SimulationLink) => {
                const targetNode = typeof d.target === 'string' ? 
                    this.nodes.find(n => n.id === d.target) : 
                    d.target;
                return targetNode ? this.getRadialDistance(targetNode) : 0;
            })
            .strength(0.5);

        // Add radial force for alternative definitions
        const radialForce = d3.forceRadial<SimulationNode>(
            d => this.getRadialDistance(d),
            0,
            0
        ).strength(1.0);

        // Update simulation
        this.simulation
            .nodes(this.nodes)
            .force("link", linkForce)
            .force("radial", radialForce)
            .alpha(1)
            .restart();

        // Fix word node position and find live definition
        const wordNode = this.nodes.find(n => n.type === 'word');
        if (wordNode) {
            console.log('Found word node:', wordNode);
            
            // Fix word node at center
            wordNode.fx = 0;
            wordNode.fy = 0;
            wordNode.x = 0;
            wordNode.y = 0;

            // Find live definition (first definition in the word's definitions array)
            const wordData = wordNode.data as WordNode;
            const firstDefId = wordData.definitions[0]?.id;
            console.log('First definition ID:', firstDefId);

            const liveDefNode = this.nodes.find(n => 
                n.type === 'definition' && 
                n.data.id === firstDefId
            );

            if (liveDefNode) {
                console.log('Found live definition node:', liveDefNode);
                
                // Calculate position based on node sizes
                const wordRadius = NODE_CONSTANTS.SIZES.WORD.preview / 3;
                const liveDefRadius = NODE_CONSTANTS.SIZES.DEFINITION.live.preview / 3;
                const minDistance = wordRadius + liveDefRadius + 20;
                
                const distance = minDistance;
                const angle = -Math.PI / 7;
                
                // Calculate and set position
                const fx = distance * Math.cos(angle);
                const fy = distance * Math.sin(angle);
                
                liveDefNode.fx = fx;
                liveDefNode.fy = fy;
                liveDefNode.x = fx;
                liveDefNode.y = fy;
            
                console.log('Set live definition position:', { fx, fy, distance, wordRadius, liveDefRadius });
            } else {
                console.log('Live definition node not found!');
            }
        } else {
            console.log('Word node not found!');
        }

        // Run simulation for remaining nodes
        for (let i = 0; i < 300; ++i) {
            this.simulation.tick();
        }

        const positions = this.getPositionsMap();
        console.log('Final node positions:', Array.from(positions.entries()));
        
        return positions;
    }

    private getPositionsMap(): Map<string, NodePosition> {
        return new Map(this.nodes.map(node => [
            node.id,
            {
                x: node.x ?? 0,
                y: node.y ?? 0,
                scale: node.type === 'word' ? 1 : 0.9,
                ring: node.type === 'word' ? 0 : 1,
                ringPosition: Math.atan2(node.y ?? 0, node.x ?? 0) / (2 * Math.PI) + 0.5,
                distanceFromCenter: Math.sqrt((node.x ?? 0) ** 2 + (node.y ?? 0) ** 2),
                rotation: Math.atan2(node.y ?? 0, node.x ?? 0) * 180 / Math.PI,
                svgTransform: `translate(${node.x ?? 0},${node.y ?? 0}) scale(${node.type === 'word' ? 1 : 0.9})`,
                renderOrder: node.type === 'word' ? 0 : 1
            }
        ]));
    }

    resize(width: number, height: number): void {
        this.width = width;
        this.height = height;
        const centerForce = this.simulation.force("center") as d3.ForceCenter<SimulationNode>;
        centerForce.x(0).y(0);
        this.simulation.alpha(0.3).restart();
    }

    tick(): Map<string, NodePosition> {
        return this.getPositionsMap();
    }

    stop(): void {
        this.simulation.stop();
    }

    destroy(): void {
        this.stop();
        this.nodes = [];
        this.links = [];
    }
}