import * as d3 from 'd3';
import type { SimulationNodeDatum } from 'd3-force';
import type { GraphNode, NodePosition, GraphData, GraphEdge } from '$lib/types/graph';
import { LAYOUT_CONSTANTS } from './layoutConstants';
import { getVoteValue } from '../nodes/utils/nodeUtils';
import { NODE_CONSTANTS } from '../nodes/base/BaseNodeConstants';

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
        console.log('Starting configureDashboardAndNavigationLayout', {
            totalNodes: nodes.length,
            isPreviewMode: this.isPreviewMode
        });
    
        const navigationNodes = nodes.filter(n => n.group === 'navigation');
        const centerNode = nodes.find(n => n.group === 'central');
    
        console.log('Filtered nodes:', {
            navigationNodesCount: navigationNodes.length,
            hasCenterNode: !!centerNode,
            centerNodeType: centerNode?.type,
            centerNodeGroup: centerNode?.group
        });
    
        if (!centerNode) {
            console.log('No center node found, returning');
            return;
        }
    
        // Center node positioning
        centerNode.fx = 0;
        centerNode.fy = 0;
        centerNode.x = 0;
        centerNode.y = 0;
    
        console.log('Set center node position:', {
            fx: centerNode.fx,
            fy: centerNode.fy,
            x: centerNode.x,
            y: centerNode.y
        });
    
        // Clear existing forces
        this.simulation.force("center", null);
        this.simulation.force("charge", null);
        this.simulation.force("collision", null);
        this.simulation.force("radial", null);
    
        console.log('Cleared existing forces');
    
        const radius = this.isPreviewMode ? 
            LAYOUT_CONSTANTS.NAVIGATION.RADIUS.PREVIEW : 
            LAYOUT_CONSTANTS.NAVIGATION.RADIUS.DETAIL;
        
        const spacing = this.isPreviewMode ? 
            LAYOUT_CONSTANTS.NAVIGATION.SPACING.PREVIEW : 
            LAYOUT_CONSTANTS.NAVIGATION.SPACING.DETAIL;
    
        console.log('Calculated layout parameters:', {
            radius,
            spacing,
            isPreviewMode: this.isPreviewMode,
            previewRadius: LAYOUT_CONSTANTS.NAVIGATION.RADIUS.PREVIEW,
            detailRadius: LAYOUT_CONSTANTS.NAVIGATION.RADIUS.DETAIL
        });
    
        navigationNodes.forEach((node, i) => {
            const angle = (i / navigationNodes.length) * 2 * Math.PI - Math.PI / 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            const oldPosition = {
                x: node.x,
                y: node.y,
                fx: node.fx,
                fy: node.fy
            };
    
            node.fx = x;
            node.fy = y;
            node.x = x;
            node.y = y;
    
            console.log(`Navigation node ${i} position update:`, {
                nodeId: node.id,
                oldPosition,
                newPosition: { x, y, fx: x, fy: y },
                angle,
                radius
            });
        });
    
        // Configure new forces
        const collisionForce = d3.forceCollide<SimulationNode>()
            .radius(spacing)
            .strength(LAYOUT_CONSTANTS.NAVIGATION.STRENGTH.COLLISION);
    
        const centerForce = d3.forceCenter(0, 0);
    
        this.simulation
            .force("collision", collisionForce)
            .force("center", centerForce);
    
        console.log('Configured new forces:', {
            collisionRadius: spacing,
            collisionStrength: LAYOUT_CONSTANTS.NAVIGATION.STRENGTH.COLLISION
        });
    
        // Log final simulation state
        console.log('Final simulation state:', {
            alpha: this.simulation.alpha(),
            alphaTarget: this.simulation.alphaTarget(),
            velocityDecay: this.simulation.velocityDecay()
        });
    }

    private configureAlternativeDefinitionsLayout(nodes: SimulationNode[]): void {
        const wordNode = nodes.find(n => n.group === 'central');
        const liveDefNode = nodes.find(n => n.group === 'live-definition');
        const alternativeNodes = nodes.filter(n => n.group === 'alternative-definition');
    
        if (!wordNode || !liveDefNode) return;
    
        // Calculate word node radius based on preview/detail mode
        const wordRadius = this.isPreviewMode ?
            NODE_CONSTANTS.SIZES.WORD.preview / 2 :
            NODE_CONSTANTS.SIZES.WORD.detail / 2;
    
        // 1. Fix positions for word and live definition nodes
        wordNode.fx = 0;
        wordNode.fy = 0;
        wordNode.x = 0;
        wordNode.y = 0;
    
        // Maintain live definition angle but adjust radius based on mode
        const liveAngle = LAYOUT_CONSTANTS.RADIUS.LIVE_DEFINITION.ANGLE;
        const baseLiveRadius = this.isPreviewMode ?
            LAYOUT_CONSTANTS.RADIUS.LIVE_DEFINITION.PADDING.PREVIEW :
            LAYOUT_CONSTANTS.RADIUS.LIVE_DEFINITION.PADDING.DETAIL;
        
        // Calculate live definition position with smooth transition radius
        const liveRadius = baseLiveRadius + wordRadius;
        liveDefNode.fx = Math.cos(liveAngle) * liveRadius;
        liveDefNode.fy = Math.sin(liveAngle) * liveRadius;
        liveDefNode.x = liveDefNode.fx;
        liveDefNode.y = liveDefNode.fy;
    
        // 2. Reset and position alternative nodes
        alternativeNodes.forEach(node => {
            node.fx = undefined;
            node.fy = undefined;
        });
    
        // 3. Configure forces with mode-aware scaling
        const config = this.isPreviewMode ?
            LAYOUT_CONSTANTS.RADIUS.ALTERNATIVE_DEFINITIONS.PREVIEW :
            LAYOUT_CONSTANTS.RADIUS.ALTERNATIVE_DEFINITIONS.DETAIL;
    
        // 3a. Enhanced repulsion for better spacing in detail mode
        this.simulation.force('charge', d3.forceManyBody<SimulationNode>()
            .strength(d => {
                if (d.group === 'alternative-definition') {
                    const baseStrength = this.isPreviewMode ? 
                        LAYOUT_CONSTANTS.FORCES.CHARGE.DEFINITION.PREVIEW :
                        LAYOUT_CONSTANTS.FORCES.CHARGE.DEFINITION.ALTERNATIVE;
                    // Scale strength based on word size
                    return baseStrength * (this.isPreviewMode ? 1 : 1.5);
                }
                return 0;
            }));
    
        // 3b. Improved collision detection with dynamic padding
        const collisionPadding = this.isPreviewMode ?
            LAYOUT_CONSTANTS.FORCES.COLLISION.PADDING.PREVIEW :
            LAYOUT_CONSTANTS.FORCES.COLLISION.PADDING.NORMAL + wordRadius * 0.5;
    
        this.simulation.force('collision', d3.forceCollide<SimulationNode>()
            .radius(d => {
                if (d.group === 'alternative-definition') {
                    return config.SPACING + collisionPadding;
                }
                return wordRadius;
            })
            .strength(LAYOUT_CONSTANTS.FORCES.COLLISION.STRENGTH[
                this.isPreviewMode ? 'PREVIEW' : 'NORMAL'
            ]));
    
        // 3c. Enhanced radial force with dynamic radius calculation
        const baseMinRadius = this.isPreviewMode ? 
            config.MIN_RADIUS : 
            config.MIN_RADIUS + wordRadius;
        
        const baseMaxRadius = this.isPreviewMode ? 
            config.MAX_RADIUS : 
            config.MAX_RADIUS + wordRadius * 1.5;
    
        this.simulation.force('radial', d3.forceRadial<SimulationNode>(
            d => {
                if (d.group === 'alternative-definition' && 'votes' in d.data) {
                    const voteValue = getVoteValue(d.data.votes);
                    const normalizedVotes = Math.min(voteValue, 10);
                    const radiusRange = baseMaxRadius - baseMinRadius;
                    
                    const radius = baseMinRadius + 
                        (radiusRange * (normalizedVotes / 10)) +
                        (voteValue * LAYOUT_CONSTANTS.RADIUS.ALTERNATIVE_DEFINITIONS.VOTE_SCALE_FACTOR);
                    
                    return Math.min(radius, baseMaxRadius);
                }
                return 0;
            },
            0,
            0
        ).strength(LAYOUT_CONSTANTS.FORCES.RADIAL.STRENGTH[
            this.isPreviewMode ? 'PREVIEW' : 'NORMAL'
        ] * (this.isPreviewMode ? 1 : 1.2)));
    
        // 4. Maintain angular distribution with enhanced spacing
        const angularSeparation = this.isPreviewMode ?
            LAYOUT_CONSTANTS.RADIUS.ALTERNATIVE_DEFINITIONS.ANGULAR_SEPARATION :
            LAYOUT_CONSTANTS.RADIUS.ALTERNATIVE_DEFINITIONS.ANGULAR_SEPARATION * 1.2;
    
        alternativeNodes.forEach((node, i) => {
            const targetAngle = (i / alternativeNodes.length) * 2 * Math.PI;
            const currentAngle = Math.atan2(node.y ?? 0, node.x ?? 0);
            const angleForce = (targetAngle - currentAngle) * (this.isPreviewMode ? 0.1 : 0.15);
            
            if (node.x !== undefined && node.y !== undefined) {
                const distance = Math.sqrt((node.x * node.x) + (node.y * node.y));
                node.vx = (node.vx ?? 0) + Math.cos(angleForce) * distance * 0.02;
                node.vy = (node.vy ?? 0) + Math.sin(angleForce) * distance * 0.02;
            }
        });
    }

    public updatePreviewMode(isPreview: boolean): void {
        console.log('updatePreviewMode called:', { 
            currentMode: this.isPreviewMode, 
            newMode: isPreview 
        });
        
        if (this.isPreviewMode === isPreview) return;
        
        this.isPreviewMode = isPreview;
        
        if (this.simulation.nodes().length > 0) {
            // Reset simulation parameters
            this.simulation
                .alpha(1)                      // Reset alpha to full strength
                .alphaTarget(0)                // Ensure simulation will eventually settle
                .velocityDecay(0.4)            // Reduce velocity decay for smoother transition
                .restart();
    
            // Configure new layout
            this.configureDashboardAndNavigationLayout(this.simulation.nodes());
            
            // After a short delay, restore normal simulation parameters
            setTimeout(() => {
                this.simulation
                    .velocityDecay(LAYOUT_CONSTANTS.SIMULATION.VELOCITY_DECAY)
                    .alpha(0.3)
                    .restart();
            }, 100);
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