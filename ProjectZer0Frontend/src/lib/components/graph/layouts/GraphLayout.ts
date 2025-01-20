// ProjectZer0Frontend/src/lib/components/graph/layouts/GraphLayout.ts
import * as d3 from 'd3';
import type { 
  GraphNode, 
  GraphEdge,
  GraphData, 
  NodePosition, 
  ViewType, 
  LayoutConfig 
} from '$lib/types/graph';
import { VIEW_CONFIGS } from './viewConfigs';

export class GraphLayout {
    private simulation: d3.Simulation<GraphNode, GraphEdge>;
    private readonly viewType: ViewType;
    private readonly config: LayoutConfig;
    private _width: number;
    private _height: number;
    private isPreviewMode: boolean;
    private definitionNodeModes: Map<string, 'preview' | 'detail'>;
    private readonly logger = console;

    constructor(
        width: number,
        height: number,
        viewType: ViewType,
        isPreviewMode = false
    ) {
        this._width = width;
        this._height = height;
        this.viewType = viewType;
        this.config = VIEW_CONFIGS[viewType];
        this.isPreviewMode = isPreviewMode;
        this.definitionNodeModes = new Map();
        this.simulation = this.initializeSimulation();
        this.logger.debug('GraphLayout initialized', { width, height, viewType, isPreviewMode });
    }

    public get width(): number {
        return this._width;
    }

    public get height(): number {
        return this._height;
    }

    private initializeSimulation(): d3.Simulation<GraphNode, GraphEdge> {
        return d3.forceSimulation<GraphNode>()
            .velocityDecay(0.4)
            .alphaDecay(0.01);
    }

    // Helper method to safely get link force
    private getLinkForce(): d3.ForceLink<GraphNode, GraphEdge> | null {
        return this.simulation.force("link") as d3.ForceLink<GraphNode, GraphEdge> | null;
    }

    // Use this when accessing links
    private getLinks(): GraphEdge[] {
        const linkForce = this.getLinkForce();
        return (linkForce?.links?.() as GraphEdge[]) || [];
    }

    private configureDashboardLayout(nodes: GraphNode[]): void {
        const centerNode = nodes.find(n => n.group === 'central');
        const navigationNodes = nodes.filter(n => n.group === 'navigation');
    
        // Fix center node at exact center, matching the word node logic
        if (centerNode) {
            centerNode.fx = 0;
            centerNode.fy = 0;
            centerNode.x = 0;  // Add this
            centerNode.y = 0;  // Add this
        }
    
        // Configure navigation nodes with precise positioning
        if (navigationNodes.length > 0) {
            const radius = this.isPreviewMode ? 
                this.config.navigationRadius.preview : 
                this.config.navigationRadius.detail;
    
            navigationNodes.forEach((node, i) => {
                const angle = (i / navigationNodes.length) * 2 * Math.PI - Math.PI / 2;
                node.fx = Math.cos(angle) * radius;
                node.fy = Math.sin(angle) * radius;
                node.x = node.fx;  // Ensure current position matches fixed position
                node.y = node.fy;  // Ensure current position matches fixed position
            });
        }
    
        // Minimal forces just for stability
        this.simulation
            .force("collision", d3.forceCollide<GraphNode>()
                .radius(60)
                .strength(1.0)
                .iterations(4));
        
        // Remove center force as we're handling positioning explicitly
        // .force("center", d3.forceCenter(0, 0));
    }
    
    private configureWordDefinitionLayout(nodes: GraphNode[], links: GraphEdge[]) {
        const wordNode = nodes.find(n => n.type === 'word');
        const definitionNodes = nodes.filter(n => n.type === 'definition');
    
        // Fix word node at exact center
        if (wordNode) {
            wordNode.fx = 0;
            wordNode.fy = 0;
            wordNode.x = 0;
            wordNode.y = 0;
        }
    
        // Configure forces for definitions with more space
        this.simulation
            .force("link", d3.forceLink<GraphNode, GraphEdge>(links)
                .id(d => (d as GraphNode).id)
                .distance(link => {
                    const targetNode = typeof link.target === 'string' ? 
                        nodes.find(n => n.id === link.target) : 
                        link.target as GraphNode;
                    
                    const isDetail = targetNode && 
                        this.definitionNodeModes.get((targetNode as GraphNode).id) === 'detail';
                    return isDetail ? 800 : 600; // Much larger distances
                })
                .strength(0.3)) // Reduced strength for more flexibility
            .force("charge", d3.forceManyBody()
                .strength(d => {
                    const node = d as GraphNode;
                    return node.type === 'word' ? -1000 : -800;
                }))
            .force("collision", d3.forceCollide<GraphNode>()
                .radius(d => {
                    const node = d as GraphNode;
                    if (node.type === 'word') return 200;
                    return this.definitionNodeModes.get(node.id) === 'detail' ? 300 : 150;
                })
                .strength(1)
                .iterations(10))
            .force("radial", d3.forceRadial<GraphNode>(
                d => {
                    const node = d as GraphNode;
                    if (node.type === 'word') return 0;
                    
                    const votes = this.getNodeVotes(node);
                    const baseRadius = this.isPreviewMode ? 400 : 600;
                    const voteScale = 40;
                    
                    return baseRadius - (Math.max(0, votes) * voteScale);
                },
                0,
                0
            ).strength(1)); // Increased strength
    
        // Handle navigation nodes if present
        const navigationNodes = nodes.filter(n => n.group === 'navigation');
        if (navigationNodes.length > 0) {
            this.configureNavigationNodes(navigationNodes);
        }
    }

    private configureNavigationNodes(navNodes: GraphNode[]): void {
        const radius = this.isPreviewMode ? 
            this.config.navigationRadius.preview : 
            this.config.navigationRadius.detail;

        navNodes.forEach((node, i) => {
            const angle = (i / navNodes.length) * 2 * Math.PI - Math.PI / 2;
            node.fx = Math.cos(angle) * radius;
            node.fy = Math.sin(angle) * radius;
        });
    }

    private getNodeVotes(node: GraphNode): number {
        if (!node.data || !('positiveVotes' in node.data)) return 0;
        const data = node.data as { positiveVotes?: number; negativeVotes?: number };
        return (data.positiveVotes || 0) - (data.negativeVotes || 0);
    }

    public updateLayout(data: GraphData): Map<string, NodePosition> {
        // Create copies to avoid mutation
        const nodes = data.nodes.map(n => ({...n}));
        const links = data.links?.map(l => ({...l})) || [];

        // Reset forces
        this.simulation.nodes(nodes);
        this.simulation.force("link", null);
        this.simulation.force("charge", null);
        this.simulation.force("collision", null);
        this.simulation.force("radial", null);
        this.simulation.force("center", null);

        // Apply view-specific configuration
        if (this.viewType === 'word') {
            this.configureWordDefinitionLayout(nodes, links);
        } else {
            this.configureDashboardLayout(nodes);
        }

        // Run simulation
        this.simulation.alpha(1).restart();
        for (let i = 0; i < 300; ++i) {
            this.simulation.tick();
        }

        return this.getNodePositions(nodes);
    }

    private getNodePositions(nodes: GraphNode[]): Map<string, NodePosition> {
        return new Map(nodes.map(node => [
            node.id,
            {
                x: node.x ?? 0,
                y: node.y ?? 0,
                scale: this.isPreviewMode ? 
                    0.6 : // Preview mode scale
                    this.definitionNodeModes.get(node.id) === 'detail' ? 1.5 : 1,
                svgTransform: `translate(${node.x ?? 0}, ${node.y ?? 0})`,
                angle: node.group === 'navigation' ? 
                    Math.atan2(node.y ?? 0, node.x ?? 0) : undefined,
                distanceFromCenter: node.group === 'navigation' ?
                    Math.sqrt(Math.pow(node.x ?? 0, 2) + Math.pow(node.y ?? 0, 2)) : undefined
            }
        ]));
    }

    public setNodeDetail(nodeId: string, isDetail: boolean): void {
        if (isDetail) {
            this.definitionNodeModes.set(nodeId, 'detail');
        } else {
            this.definitionNodeModes.delete(nodeId);
        }

        const nodes = this.simulation.nodes();
        const links = this.getLinks();
        
        if (this.viewType === 'word') {
            this.configureWordDefinitionLayout(nodes, links);
        }
        
        this.simulation.alpha(0.3).restart();
    }

    public updatePreviewMode(isPreview: boolean): void {
        if (this.isPreviewMode === isPreview) return;
        this.isPreviewMode = isPreview;
        
        const nodes = this.simulation.nodes();
        const links = this.getLinks();
        
        if (this.viewType === 'word') {
            this.configureWordDefinitionLayout(nodes, links);
        } else {
            this.configureDashboardLayout(nodes);
        }
        
        this.simulation.alpha(0.3).restart();
    }

    public updateDefinitionModes(modes: Map<string, 'preview' | 'detail'>): void {
        this.definitionNodeModes = new Map(modes);
        if (this.simulation.nodes().length > 0) {
            this.simulation.alpha(1).restart();
        }
    }

    public resize(width: number, height: number): void {
        this._width = width;
        this._height = height;
        this.simulation.alpha(0.3).restart();
    }

    public stop(): void {
        this.simulation.stop();
    }
}