import * as d3 from 'd3';
import type { SimulationNodeDatum } from 'd3-force';
import type { GraphNode, NodePosition, GraphData, GraphEdge } from '$lib/types/graph';
import { LAYOUT_CONSTANTS } from './layoutConstants';
import { getVoteValue } from '../nodes/utils/nodeUtils';

interface SimulationNode extends GraphNode, SimulationNodeDatum {}

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

    constructor(width: number, height: number, isPreviewMode: boolean = false) {
        this.width = width;
        this.height = height;
        this.isPreviewMode = isPreviewMode;
        this.simulation = this.initializeSimulation();
    }

    private initializeSimulation(): d3.Simulation<SimulationNode, SimulationLink> {
        return d3.forceSimulation<SimulationNode>()
            .velocityDecay(LAYOUT_CONSTANTS.SIMULATION.VELOCITY_DECAY)
            .alphaDecay(LAYOUT_CONSTANTS.SIMULATION.ALPHA_DECAY)
            .force('link', d3.forceLink<SimulationNode, SimulationLink>()
                .id(d => d.id));
    }

    private configureDashboardAndNavigationLayout(nodes: SimulationNode[]): void {
        const navigationNodes = nodes.filter(n => n.group === 'navigation');
        const centerNode = nodes.find(n => n.group === 'central');

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
        });

        this.simulation
            .force("collision", d3.forceCollide<SimulationNode>()
                .radius(spacing)
                .strength(LAYOUT_CONSTANTS.NAVIGATION.STRENGTH.COLLISION))
            .force("center", d3.forceCenter(0, 0));
    }

    private configureAlternativeDefinitionsLayout(nodes: SimulationNode[]): void {
        const wordNode = nodes.find(n => n.group === 'central');
        const liveDefNode = nodes.find(n => n.group === 'live-definition');
        const alternativeNodes = nodes.filter(n => n.group === 'alternative-definition');
    
        if (!wordNode || !liveDefNode) return;
    
        // 1. Fix positions for word and live definition nodes
        wordNode.fx = 0;
        wordNode.fy = 0;
        wordNode.x = 0;
        wordNode.y = 0;
    
        const liveAngle = LAYOUT_CONSTANTS.RADIUS.LIVE_DEFINITION.ANGLE;
        const liveRadius = LAYOUT_CONSTANTS.RADIUS.LIVE_DEFINITION.PADDING;
        liveDefNode.fx = Math.cos(liveAngle) * liveRadius;
        liveDefNode.fy = Math.sin(liveAngle) * liveRadius;
        liveDefNode.x = liveDefNode.fx;
        liveDefNode.y = liveDefNode.fy;
    
        // 2. Reset alternative nodes' fixed positions
        alternativeNodes.forEach(node => {
            node.fx = undefined;
            node.fy = undefined;
        });
    
        // 3. Configure forces for alternative definitions
        const config = this.isPreviewMode ?
            LAYOUT_CONSTANTS.RADIUS.ALTERNATIVE_DEFINITIONS.PREVIEW :
            LAYOUT_CONSTANTS.RADIUS.ALTERNATIVE_DEFINITIONS.DETAIL;
    
        // 3a. Repulsion between nodes
        this.simulation.force('charge', d3.forceManyBody<SimulationNode>()
            .strength(d => {
                if (d.group === 'alternative-definition') {
                    return this.isPreviewMode ? 
                        LAYOUT_CONSTANTS.FORCES.CHARGE.DEFINITION.PREVIEW :
                        LAYOUT_CONSTANTS.FORCES.CHARGE.DEFINITION.ALTERNATIVE;
                }
                return 0;
            }));
    
        // 3b. Collision detection with padding
        this.simulation.force('collision', d3.forceCollide<SimulationNode>()
            .radius(d => {
                if (d.group === 'alternative-definition') {
                    const baseSpacing = config.SPACING;
                    return baseSpacing + LAYOUT_CONSTANTS.FORCES.COLLISION.PADDING[
                        this.isPreviewMode ? 'PREVIEW' : 'NORMAL'
                    ];
                }
                return 0;
            })
            .strength(LAYOUT_CONSTANTS.FORCES.COLLISION.STRENGTH[
                this.isPreviewMode ? 'PREVIEW' : 'NORMAL'
            ]));
    
        // 3c. Radial force for vote-based positioning
        this.simulation.force('radial', d3.forceRadial<SimulationNode>(
            d => {
                if (d.group === 'alternative-definition' && 'votes' in d.data) {
                    const voteValue = getVoteValue(d.data.votes);
                    const normalizedVotes = Math.min(voteValue, 10); // Cap at 10 votes for scaling
                    const radiusRange = config.MAX_RADIUS - config.MIN_RADIUS;
                    const radius = config.MIN_RADIUS + 
                        (radiusRange * (normalizedVotes / 10)) +
                        (voteValue * LAYOUT_CONSTANTS.RADIUS.ALTERNATIVE_DEFINITIONS.VOTE_SCALE_FACTOR);
                    return Math.min(radius, config.MAX_RADIUS);
                }
                return 0;
            },
            0,
            0
        ).strength(LAYOUT_CONSTANTS.FORCES.RADIAL.STRENGTH[
            this.isPreviewMode ? 'PREVIEW' : 'NORMAL'
        ]));
    
        // 4. Add angular separation force for better distribution
        const angularSeparation = LAYOUT_CONSTANTS.RADIUS.ALTERNATIVE_DEFINITIONS.ANGULAR_SEPARATION;
        alternativeNodes.forEach((node, i) => {
            const targetAngle = (i / alternativeNodes.length) * 2 * Math.PI;
            const currentAngle = Math.atan2(node.y ?? 0, node.x ?? 0);
            const angleForce = (targetAngle - currentAngle) * 0.1;
            
            if (node.x !== undefined && node.y !== undefined) {
                const distance = Math.sqrt((node.x * node.x) + (node.y * node.y));
                node.vx = (node.vx ?? 0) + Math.cos(angleForce) * distance * 0.02;
                node.vy = (node.vy ?? 0) + Math.sin(angleForce) * distance * 0.02;
            }
        });
    }

    public updatePreviewMode(isPreview: boolean): void {
        if (this.isPreviewMode === isPreview) return;
        this.isPreviewMode = isPreview;
        if (this.simulation.nodes().length > 0) {
            this.configureDashboardAndNavigationLayout(this.simulation.nodes());
            if (this.simulation.nodes().some(n => n.group === 'live-definition')) {
                this.configureAlternativeDefinitionsLayout(this.simulation.nodes());
            }
            this.simulation.alpha(1).restart();
        }
    }

    public updateLayout(data: GraphData): Map<string, NodePosition> {
        // First, clear ALL forces
        this.simulation.force('charge', null);
        this.simulation.force('collision', null);
        this.simulation.force('radial', null);
        this.simulation.force('link', null);
        this.simulation.force('center', null);
    
        const nodes = data.nodes as SimulationNode[];
        const links = (data.links || []) as SimulationLink[];
    
        // Reset any previous fixed positions
        nodes.forEach(node => {
            node.fx = undefined;
            node.fy = undefined;
            node.x = undefined;
            node.y = undefined;
        });
    
        this.simulation.nodes(nodes);
    
        console.log('Configuring layout for nodes:', nodes.map(n => ({
            id: n.id,
            group: n.group,
            type: n.type
        })));
    
        if (nodes.length === 1) {
            this.configureSingleNodeLayout(nodes[0]);
        } else if (nodes.some(n => n.group === 'navigation')) {
            this.configureDashboardAndNavigationLayout(nodes);
            if (nodes.some(n => n.group === 'live-definition')) {
                this.configureAlternativeDefinitionsLayout(nodes);
            }
        }
    
        // Configure links after node positioning
        if (links.length > 0) {
            const linkForce = d3.forceLink<SimulationNode, SimulationLink>()
                .id(d => d.id)
                .links(links);
            this.simulation.force('link', linkForce);
        }
    
        // Run simulation
        this.simulation.alpha(1).restart();
        for (let i = 0; i < LAYOUT_CONSTANTS.SIMULATION.ITERATIONS; ++i) {
            this.simulation.tick();
        }
    
        return this.getNodePositions(nodes);
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