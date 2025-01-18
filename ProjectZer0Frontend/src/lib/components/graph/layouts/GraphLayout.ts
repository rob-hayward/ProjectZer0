// Nav nodes are placed in a circle around the central node correctly
import * as d3 from 'd3';
import type { SimulationNodeDatum } from 'd3-force';
import type { GraphNode, NodePosition, GraphData, GraphEdge } from '$lib/types/graph';
import { LAYOUT_CONSTANTS } from './layoutConstants';
import { getVoteValue } from '../nodes/utils/nodeUtils';
import { NODE_CONSTANTS } from '../nodes/base/BaseNodeConstants';

interface SimulationNode extends SimulationNodeDatum {
    id: string;
    group: 'central' | 'live-definition' | 'alternative-definition' | 'navigation';
    type: string;
    data: any;
}

type SimulationLink = Omit<d3.SimulationLinkDatum<SimulationNode>, 'source' | 'target'> & {
    source: string;
    target: string;
    type: 'live' | 'alternative';
    value: number;
};

export class GraphLayout {
    private simulation: d3.Simulation<SimulationNode, SimulationLink>;
    private width: number;
    private height: number;
    private isPreviewMode: boolean;
    private definitionNodeModes: Map<string, 'preview' | 'detail'>;

    constructor(
        width: number, 
        height: number, 
        isPreviewMode: boolean = false,
        definitionNodeModes?: Map<string, 'preview' | 'detail'>
    ) {
        this.width = width;
        this.height = height;
        this.isPreviewMode = isPreviewMode;
        this.definitionNodeModes = definitionNodeModes || new Map();
        this.simulation = this.initializeSimulation();
    }

    private initializeSimulation(): d3.Simulation<SimulationNode, SimulationLink> {
        return d3.forceSimulation<SimulationNode>()
            .velocityDecay(LAYOUT_CONSTANTS.SIMULATION.VELOCITY_DECAY)
            .alphaDecay(LAYOUT_CONSTANTS.SIMULATION.ALPHA_DECAY)
            .nodes([]) as d3.Simulation<SimulationNode, SimulationLink>;
    }
    
    private configureDashboardAndNavigationLayout(nodes: SimulationNode[]): void {
        const navigationNodes = nodes.filter(n => n.group === 'navigation');
        const centerNode = nodes.find(n => n.group === 'central');
    
        if (!centerNode) return;
    
        centerNode.fx = 0;
        centerNode.fy = 0;
        centerNode.x = 0;
        centerNode.y = 0;
    
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
        });
    
        this.simulation
            .force('collision', d3.forceCollide<SimulationNode>()
                .radius(spacing)
                .strength(LAYOUT_CONSTANTS.NAVIGATION.STRENGTH.COLLISION))
            .force('center', d3.forceCenter(0, 0));
    }

    private getNodeSize(node: SimulationNode): number {
        const isDetailMode = this.definitionNodeModes.get(node.id) === 'detail';
        
        switch (node.group) {
            case 'central':
                return NODE_CONSTANTS.SIZES.WORD.detail / 2;
            case 'live-definition':
                return isDetailMode ? 
                    NODE_CONSTANTS.SIZES.DEFINITION.live.detail / 2 :
                    NODE_CONSTANTS.SIZES.DEFINITION.live.preview / 2;
            case 'alternative-definition':
                return isDetailMode ? 
                    NODE_CONSTANTS.SIZES.DEFINITION.alternative.detail / 2 :
                    NODE_CONSTANTS.SIZES.DEFINITION.alternative.preview / 2;
            default:
                return 0;
        }
    }

    private configureAlternativeDefinitionsLayout(nodes: SimulationNode[], links: SimulationLink[]): void {
        const wordNode = nodes.find(n => n.group === 'central');
        if (!wordNode) return;
    
        // Fix central word node position
        wordNode.fx = 0;
        wordNode.fy = 0;
        wordNode.x = 0;
        wordNode.y = 0;
    
        this.simulation
            .nodes(nodes)
            .force('link', d3.forceLink<SimulationNode, SimulationLink>()
                .id(d => d.id)
                .links(links)
                .distance(link => {
                    const source = nodes.find(n => n.id === link.source);
                    const target = nodes.find(n => n.id === link.target);
                    if (!source || !target) return 0;
    
                    const sourceSize = this.getNodeSize(source);
                    const targetSize = this.getNodeSize(target);
                    
                    // Base distance varies by link type and node state
                    const baseDistance = link.type === 'live' ? 
                        LAYOUT_CONSTANTS.FORCES.LINK.DISTANCE.LIVE.PREVIEW : 
                        LAYOUT_CONSTANTS.FORCES.LINK.DISTANCE.ALTERNATIVE.PREVIEW;
                    
                    // Add additional distance for detail mode
                    const detailModeBonus = (
                        this.definitionNodeModes.get(source.id) === 'detail' || 
                        this.definitionNodeModes.get(target.id) === 'detail'
                    ) ? 200 : 0;
    
                    return baseDistance + sourceSize + targetSize + detailModeBonus;
                })
                .strength(link => link.type === 'live' ? 
                    LAYOUT_CONSTANTS.FORCES.LINK.STRENGTH.LIVE : 
                    LAYOUT_CONSTANTS.FORCES.LINK.STRENGTH.ALTERNATIVE
                ))
            .force('collision', d3.forceCollide<SimulationNode>()
                .radius(d => {
                    const baseRadius = this.getNodeSize(d);
                    const padding = this.definitionNodeModes.get(d.id) === 'detail' ? 
                        LAYOUT_CONSTANTS.FORCES.COLLISION.PADDING.DETAIL : 
                        LAYOUT_CONSTANTS.FORCES.COLLISION.PADDING.NORMAL;
                    return baseRadius + padding;
                })
                .strength(1)
                .iterations(4))
            .force('charge', d3.forceManyBody()
                .strength(d => {
                    const isDetail = this.definitionNodeModes.get(d.id) === 'detail';
                    return isDetail ? -2000 : -1000;
                }));
    }

    public updatePreviewMode(isPreview: boolean): void {
        if (this.isPreviewMode === isPreview) return;
        this.isPreviewMode = isPreview;
        
        if (this.simulation.nodes().length > 0) {
            this.simulation
                .alpha(1)
                .alphaTarget(0)
                .velocityDecay(0.4)
                .restart();
        }
    }

    public updateDefinitionModes(modes: Map<string, 'preview' | 'detail'>) {
        this.definitionNodeModes = modes;
        if (this.simulation.nodes().length > 0) {
            this.simulation.alpha(1).restart();
        }
    }

    public updateLayout(data: GraphData): Map<string, NodePosition> {
        // Clear all forces
        this.simulation.force('link', null);
        this.simulation.force('charge', null);
        this.simulation.force('collision', null);
        this.simulation.force('radial', null);
        this.simulation.force('center', null);

        const nodes = data.nodes as SimulationNode[];
        const links = (data.links || []) as SimulationLink[];

        // Reset node positions
        nodes.forEach(node => {
            node.fx = undefined;
            node.fy = undefined;
            node.x = undefined;
            node.y = undefined;
        });

        this.simulation.nodes(nodes);

        // Configure layout based on node types
        if (nodes.length === 1) {
            this.configureSingleNodeLayout(nodes[0]);
        } else if (nodes.some(n => n.group === 'navigation')) {
            this.configureDashboardAndNavigationLayout(nodes);
            if (nodes.some(n => n.group === 'live-definition')) {
                this.configureAlternativeDefinitionsLayout(nodes, links);
            }
        }

        // Run simulation
        this.simulation.alpha(1).restart();
        for (let i = 0; i < LAYOUT_CONSTANTS.SIMULATION.ITERATIONS; ++i) {
            this.simulation.tick();
        }

        return this.getNodePositions(nodes);
    }

    private configureSingleNodeLayout(node: SimulationNode): void {
        node.fx = 0;
        node.fy = 0;
        node.x = 0;
        node.y = 0;
    }

    private getNodePositions(nodes: SimulationNode[]): Map<string, NodePosition> {
        return new Map(
            nodes.map(node => {
                const position = {
                    x: node.x ?? 0,
                    y: node.y ?? 0,
                    scale: this.calculateNodeScale(node),
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

    private calculateNodeScale(node: SimulationNode): number {
        if (node.group === 'central') return 1;
        if (this.isPreviewMode) {
            return LAYOUT_CONSTANTS.RADIUS.ALTERNATIVE_DEFINITIONS.PREVIEW.SCALE;
        }
        return LAYOUT_CONSTANTS.RADIUS.ALTERNATIVE_DEFINITIONS.DETAIL.SCALE;
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