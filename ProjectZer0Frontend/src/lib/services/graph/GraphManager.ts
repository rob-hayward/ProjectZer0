// ProjectZer0Frontend/src/lib/services/graph/GraphManager.ts
import * as d3 from 'd3';
import { writable, derived, type Readable } from 'svelte/store';
import type { 
    GraphData, 
    ViewType, 
    NodeMode, 
    NodeType,
    GraphNode,
    GraphLink,
    EnhancedNode
} from '$lib/types/graph/enhanced';
import type { EnhancedLink, RenderableNode, RenderableLink, LayoutUpdateConfig } from '$lib/types/graph/enhanced';
import { asD3Nodes, asD3Links } from '$lib/types/graph/enhanced';
import { COORDINATE_SPACE, NODE_CONSTANTS } from '$lib/constants/graph';
import { COLORS } from '$lib/constants/colors';
import { SingleNodeLayout } from './layouts/SingleNodeLayout';
import { WordDefinitionLayout } from './layouts/WordDefinitionLayout';

export class GraphManager {
    private simulation: d3.Simulation<any, any>;
    private nodesStore = writable<EnhancedNode[]>([]);
    private linksStore = writable<EnhancedLink[]>([]);
    private _viewType: ViewType;
    private managerId: string;
    private simulationActive = false;
    private currentLayoutStrategy: SingleNodeLayout | WordDefinitionLayout | null = null;

    // Public derived stores for renderable data
    public readonly renderableNodes: Readable<RenderableNode[]>;
    public readonly renderableLinks: Readable<RenderableLink[]>;

    constructor(viewType: ViewType) {
        this.managerId = Math.random().toString(36).substring(2, 9);
        console.debug(`[GraphManager:${this.managerId}] Creating new manager`, { viewType });
        
        this._viewType = viewType;
        this.simulation = this.initializeSimulation();

        // Create derived stores for renderable data
        this.renderableNodes = derived(this.nodesStore, (nodes) => 
            this.createRenderableNodes(nodes)
        );
        
        this.renderableLinks = derived(
            [this.nodesStore, this.linksStore], 
            ([nodes, links]) => this.createRenderableLinks(nodes, links)
        );
    }

    get viewType(): ViewType {
        return this._viewType;
    }

    public setData(data: GraphData, config?: LayoutUpdateConfig): void {
        console.debug(`[GraphManager:${this.managerId}] Setting data`, {
            nodeCount: data.nodes.length,
            linkCount: data.links?.length || 0,
            config
        });
        
        // Stop any running simulation
        this.stopSimulation();
        
        // Transform input data
        const enhancedNodes = this.transformNodes(data.nodes);
        const enhancedLinks = this.transformLinks(data.links || []);
        
        // Update stores
        this.nodesStore.set(enhancedNodes);
        this.linksStore.set(enhancedLinks);
        
        // Configure simulation
        this.simulation.nodes(asD3Nodes(enhancedNodes));
        
        const linkForce = this.simulation.force('link') as d3.ForceLink<any, any>;
        if (linkForce && enhancedLinks.length > 0) {
            linkForce.links(asD3Links(enhancedLinks));
        }
        
        // Apply layout strategy for current view type
        this.applyLayoutStrategy();
        
        // Ensure fixed positions are maintained
        this.fixNodePositions();
        
        // Start simulation unless skipAnimation is true
        if (!config?.skipAnimation) {
            this.startSimulation();
        }
    }

    public updateNodeMode(nodeId: string, mode: NodeMode): void {
        console.debug(`[GraphManager:${this.managerId}] Updating node mode`, { nodeId, mode });
        
        // Use the simulation nodes instead of trying to get from the store
        const currentNodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const nodeIndex = currentNodes.findIndex((n: EnhancedNode) => n.id === nodeId);
        
        if (nodeIndex === -1) {
            console.warn(`[GraphManager:${this.managerId}] Node not found for mode update`, { nodeId });
            return;
        }
        
        const node = currentNodes[nodeIndex];
        const oldMode = node.mode;
        node.mode = mode;
        
        // Update radius and expansion state
        const oldRadius = node.radius;
        node.radius = this.getNodeRadius(node);
        node.expanded = mode === 'detail';
        node.metadata.isDetail = mode === 'detail';
        
        console.debug(`[GraphManager:${this.managerId}] Node mode updated`, {
            nodeId,
            oldMode,
            newMode: mode,
            oldRadius,
            newRadius: node.radius
        });
        
        // Update the nodes store to trigger rerender and link recalculation
        this.nodesStore.update(() => [...currentNodes]);
        
        // Log that this will trigger link recalculation via the derived store
        console.debug(`[GraphManager:${this.managerId}] Node update triggered - link paths will recalculate`);
        
        // If layout strategy exists, let it handle the mode change
        if (this.currentLayoutStrategy) {
            this.currentLayoutStrategy.handleNodeStateChange(nodeId, mode);
        }
        
        // Ensure fixed positions are maintained
        this.fixNodePositions();
        
        // Restart simulation with low alpha for smooth transition
        this.simulation.alpha(0.3).restart();
        this.simulationActive = true;
    }
    
    public updateNodeVisibility(nodeId: string, isHidden: boolean, hiddenReason: 'community' | 'user' = 'user'): void {
        console.debug(`[GraphManager:${this.managerId}] Updating node visibility`, {
            nodeId,
            isHidden,
            hiddenReason
        });
        
        // Use the simulation nodes instead of trying to get from the store
        const currentNodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const nodeIndex = currentNodes.findIndex((n: EnhancedNode) => n.id === nodeId);
        
        if (nodeIndex === -1) {
            console.warn(`[GraphManager:${this.managerId}] Node not found for visibility update`, { nodeId });
            return;
        }
        
        // Update the node
        const node = currentNodes[nodeIndex];
        node.isHidden = isHidden;
        node.hiddenReason = hiddenReason; // Use the provided reason
        
        console.debug(`[GraphManager:${this.managerId}] Node visibility updated`, {
            nodeId,
            isHidden,
            hiddenReason
        });
        
        // Update the nodes store
        this.nodesStore.update(() => [...currentNodes]);
        
        // No need to restart the simulation for visibility changes
        // But we should ensure fixed positions are maintained
        this.fixNodePositions();
    }

    /**
     * Recalculate visibility for a node based on its votes and user preferences
     * This can be called after votes are loaded asynchronously or when preferences change
     */
    public recalculateNodeVisibility(
        nodeId: string, 
        positiveVotes: number, 
        negativeVotes: number,
        userPreference?: boolean  // Optional user preference override
    ): void {
        console.debug(`[GraphManager:${this.managerId}] Recalculating node visibility based on votes`, {
            nodeId,
            positiveVotes,
            negativeVotes,
            userPreference
        });
        
        // Get current nodes
        const currentNodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const node = currentNodes.find((n: EnhancedNode) => n.id === nodeId);
        
        if (!node) {
            console.warn(`[GraphManager:${this.managerId}] Node not found for visibility recalculation`, { nodeId });
            return;
        }
        
        // Only perform calculation for word and definition nodes
        if (node.type !== 'word' && node.type !== 'definition') {
            return;
        }
        
        // If user preference is provided, it overrides community visibility
        if (userPreference !== undefined) {
            // Only update if value would change
            if (node.isHidden === userPreference) {
                return;
            }
            
            console.debug(`[GraphManager:${this.managerId}] Setting user-defined visibility for node ${nodeId}:`, {
                isHidden: !userPreference,
                hiddenReason: 'user'
            });
            
            // Update node visibility
            node.isHidden = !userPreference;
            node.hiddenReason = 'user';
        } else {
            // Calculate net votes
            const netVotes = positiveVotes - negativeVotes;
            
            console.debug(`[GraphManager:${this.managerId}] Vote calculation for node ${nodeId}:`, {
                positiveVotes,
                negativeVotes,
                netVotes,
                shouldBeHidden: netVotes < 0
            });
            
            // Update visibility based on votes
            const shouldBeHidden = netVotes < 0;
            
            // If node has a user-defined visibility, don't override it
            if (node.hiddenReason === 'user') {
                console.debug(`[GraphManager:${this.managerId}] Skipping community visibility update - user preference exists`);
                return;
            }
            
            // Only update if visibility state would change
            if (node.isHidden !== shouldBeHidden) {
                console.debug(`[GraphManager:${this.managerId}] Updating node visibility based on votes`, {
                    nodeId,
                    isHidden: shouldBeHidden,
                    hiddenReason: 'community',
                    netVotes
                });
                
                // Update node visibility
                node.isHidden = shouldBeHidden;
                node.hiddenReason = 'community';
            }
        }
        
        // Update store to trigger rerender
        this.nodesStore.update(() => [...currentNodes]);
    }

    /**
     * Apply user visibility preferences to all nodes
     * Call this when preferences are loaded or updated
     */
    public applyVisibilityPreferences(preferences: Record<string, boolean>): void {
        console.debug(`[GraphManager:${this.managerId}] Applying visibility preferences to nodes`, {
            preferenceCount: Object.keys(preferences).length
        });
        
        if (Object.keys(preferences).length === 0) {
            console.debug(`[GraphManager:${this.managerId}] No preferences to apply`);
            return;
        }
        
        // Get current nodes
        const currentNodes = this.simulation.nodes() as unknown as EnhancedNode[];
        let changedNodeCount = 0;
        
        // Apply preferences to all nodes
        Object.entries(preferences).forEach(([nodeId, isVisible]) => {
            const node = currentNodes.find((n: EnhancedNode) => n.id === nodeId);
            
            if (node) {
                // Only update if this would change visibility
                const newHiddenState = !isVisible;
                if (node.isHidden !== newHiddenState) {
                    node.isHidden = newHiddenState;
                    node.hiddenReason = 'user';
                    changedNodeCount++;
                    
                    console.debug(`[GraphManager:${this.managerId}] Applied preference to node ${nodeId}:`, {
                        isVisible,
                        isHidden: node.isHidden
                    });
                }
            }
        });
        
        if (changedNodeCount > 0) {
            console.debug(`[GraphManager:${this.managerId}] Updated ${changedNodeCount} nodes with preferences`);
            // Update store to trigger rerender
            this.nodesStore.update(() => [...currentNodes]);
        }
    }

    public updateViewType(viewType: ViewType): void {
        if (this._viewType === viewType) return;
        
        console.debug(`[GraphManager:${this.managerId}] Updating view type`, {
            from: this._viewType,
            to: viewType
        });
        
        this._viewType = viewType;
        
        // Apply new layout strategy
        this.applyLayoutStrategy();
        
        // Ensure fixed positions are maintained
        this.fixNodePositions();
        
        // Restart simulation
        this.startSimulation();
    }

    public stop(): void {
        console.debug(`[GraphManager:${this.managerId}] Stopping manager`);
        this.stopSimulation();
        if (this.currentLayoutStrategy) {
            this.currentLayoutStrategy.stop();
            this.currentLayoutStrategy = null;
        }
    }

    /**
     * Completely stop the simulation
     * This is more aggressive than the regular stop method
     */
    public stopSimulation(): void {
        if (!this.simulationActive) return;
        
        console.debug(`[GraphManager:${this.managerId}] Forcefully stopping simulation`);
        this.simulation.stop();
        
        // Set alpha to absolute zero
        this.simulation.alpha(0);
        this.simulation.alphaTarget(0);
        
        // Remove any velocities
        const nodes = this.simulation.nodes();
        nodes.forEach((node: any) => {
            node.vx = 0;
            node.vy = 0;
        });
        
        this.simulationActive = false;
    }

    /**
     * Force simulation ticks for immediate position updates
     * @param ticks Number of ticks to force (default: 1)
     */
    public forceTick(ticks: number = 1): void {
        console.debug(`[GraphManager:${this.managerId}] Forcing ${ticks} simulation ticks`);
        
        for (let i = 0; i < ticks; i++) {
            // Before each tick, ensure central node positions are fixed
            const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
            nodes.forEach(node => {
                if (node.fixed || node.group === 'central') {
                    node.x = 0;
                    node.y = 0;
                    node.fx = 0;
                    node.fy = 0;
                    node.vx = 0;
                    node.vy = 0;
                }
            });
            
            // Tick the simulation
            this.simulation.tick();
        }
        
        // After all ticks, fix node positions again
        this.fixNodePositions();
        
        // Update the store after manual ticks
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        this.nodesStore.update(() => [...nodes]);
    }

    /**
     * Ensure all fixed nodes stay fixed
     * Call this after any interaction that might affect node positions
     */
    public fixNodePositions(): void {
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        
        console.debug(`[GraphManager:${this.managerId}] Enforcing fixed positions for ${nodes.length} nodes`);
        
        // Force fixed nodes to stay at their assigned positions
        nodes.forEach(node => {
            if (node.fixed || node.group === 'central') {
                // Central nodes always at origin with VERY explicit position setting
                node.x = 0;
                node.y = 0;
                node.fx = 0;
                node.fy = 0;
                // Ensure zero velocity
                node.vx = 0;
                node.vy = 0;
                
                // Flag as fixed to be extra sure
                node.fixed = true;
                
                // Log central node position for debugging
                console.debug(`[GraphManager:${this.managerId}] Fixed central node at origin`, {
                    id: node.id,
                    type: node.type,
                    position: { x: node.x, y: node.y },
                    fixed: { fx: node.fx, fy: node.fy }
                });
            } else if (node.type === 'navigation') {
                // Navigation nodes fixed at their assigned positions
                if (node.fx !== null && node.fx !== undefined) {
                    node.x = node.fx;
                }
                if (node.fy !== null && node.fy !== undefined) {
                    node.y = node.fy;
                }
                
                // Special handling for bottom-half nodes (positive y-coordinates)
                // These seem more susceptible to movement during interaction
                if ((node.y || 0) > 0) {
                    // Extra enforcement for bottom nodes
                    if (node.fx !== null && node.fx !== undefined) {
                        node.x = node.fx;
                    }
                    if (node.fy !== null && node.fy !== undefined) {
                        node.y = node.fy;
                    }
                }
                
                // Ensure zero velocity for all navigation nodes
                node.vx = 0;
                node.vy = 0;
            }
        });
        
        // Stop the simulation completely to prevent any movement
        this.simulation.alpha(0);
        this.simulation.alphaTarget(0);
        
        // Update the store to reflect these fixed positions
        this.nodesStore.update(() => [...nodes]);
        
        // IMPORTANT: If we have a WordDefinitionLayout, call its enforceFixedPositions method too
        if (this.currentLayoutStrategy instanceof WordDefinitionLayout) {
            (this.currentLayoutStrategy as WordDefinitionLayout).enforceFixedPositions();
        }
    }

    private startSimulation(): void {
        if (this.simulationActive) return;
        
        console.debug(`[GraphManager:${this.managerId}] Starting simulation`);
        this.simulation.alpha(1).restart();
        this.simulationActive = true;
    }

    private initializeSimulation(): d3.Simulation<any, any> {
        console.debug(`[GraphManager:${this.managerId}] Initializing simulation`);
        
        const simulation = d3.forceSimulation()
            .force('link', d3.forceLink()
                .id((d: any) => (d as EnhancedNode).id)
                .strength((l: any) => (l as EnhancedLink).strength || 0.3))
            .force('charge', d3.forceManyBody()
                .strength(COORDINATE_SPACE.LAYOUT.FORCES.CHARGE.STRENGTH.WORD))
            .force('collision', d3.forceCollide((d: any) => 
                (d as EnhancedNode).radius + COORDINATE_SPACE.NODES.PADDING.COLLISION.BASE))
            .velocityDecay(COORDINATE_SPACE.ANIMATION.VELOCITY_DECAY)
            .alphaDecay(COORDINATE_SPACE.ANIMATION.ALPHA_DECAY)
            .alphaMin(COORDINATE_SPACE.ANIMATION.ALPHA_MIN);
        
        // Update store on simulation tick
        simulation.on('tick', () => {
            // Force fixed nodes to stay at their assigned positions
            const nodes = simulation.nodes() as unknown as EnhancedNode[];
            
            nodes.forEach(node => {
                if (node.fixed || node.group === 'central') {
                    // IMPORTANT: ALWAYS enforce central node position on EVERY tick
                    node.x = 0;
                    node.y = 0;
                    node.fx = 0;
                    node.fy = 0;
                    // Zero velocity
                    node.vx = 0;
                    node.vy = 0;
                } else if (node.type === 'navigation') {
                    // Ensure navigation nodes keep their fixed positions
                    if (node.fx !== null && node.fx !== undefined) {
                        node.x = node.fx;
                    }
                    if (node.fy !== null && node.fy !== undefined) {
                        node.y = node.fy;
                    }
                    // Zero velocity
                    node.vx = 0;
                    node.vy = 0;
                }
            });
            
            // Debug central node position on lower alpha values to reduce noise
            if (simulation.alpha() < 0.1) {
                const centralNode = nodes.find(n => n.fixed || n.group === 'central');
                if (centralNode) {
                    console.debug(`[GraphManager:${this.managerId}] Central node position:`, {
                        id: centralNode.id,
                        x: centralNode.x,
                        y: centralNode.y,
                        fx: centralNode.fx,
                        fy: centralNode.fy
                    });
                }
            }
            
            // Update the store to trigger rerenders
            this.nodesStore.update(() => [...nodes]);
        });
        
        return simulation;
    }

    private applyLayoutStrategy(): void {
        console.debug(`[GraphManager:${this.managerId}] Applying layout strategy for view: ${this._viewType}`);
        
        // Stop current layout strategy if exists
        if (this.currentLayoutStrategy) {
            this.currentLayoutStrategy.stop();
        }
        
        // Select appropriate layout strategy
        if (this._viewType === 'dashboard' || 
            this._viewType === 'edit-profile' || 
            this._viewType === 'create-node') {
            // Single central node views
            this.currentLayoutStrategy = new SingleNodeLayout(
                COORDINATE_SPACE.WORLD.WIDTH,
                COORDINATE_SPACE.WORLD.HEIGHT,
                this._viewType
            );
            
            console.debug(`[GraphManager:${this.managerId}] Applied SingleNodeLayout for ${this._viewType}`);
        } 
        else if (this._viewType === 'word') {
            // Word definition view
            this.currentLayoutStrategy = new WordDefinitionLayout(
                COORDINATE_SPACE.WORLD.WIDTH,
                COORDINATE_SPACE.WORLD.HEIGHT,
                this._viewType
            );
            
            console.debug(`[GraphManager:${this.managerId}] Applied WordDefinitionLayout`);
        }
        else {
            // Default to SingleNodeLayout for any other view
            this.currentLayoutStrategy = new SingleNodeLayout(
                COORDINATE_SPACE.WORLD.WIDTH,
                COORDINATE_SPACE.WORLD.HEIGHT,
                this._viewType
            );
            
            console.debug(`[GraphManager:${this.managerId}] Applied default SingleNodeLayout`);
        }
        
        // Apply the selected strategy
        if (this.currentLayoutStrategy) {
            // Get current nodes
            const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
            
            // Get links if available
            const linkForce = this.simulation.force('link') as d3.ForceLink<any, any>;
            const links = linkForce ? linkForce.links() as unknown as EnhancedLink[] : [];
            
            // Set the simulation for the strategy
            this.currentLayoutStrategy.setSimulation(this.simulation as any);
            
            // Let the strategy initialize positions and forces
            this.currentLayoutStrategy.initializeNodePositions(nodes);
            this.currentLayoutStrategy.configureForces();
            
            // Update simulation with strategy-applied nodes
            this.simulation.nodes(asD3Nodes(nodes));
            
            // IMPORTANT: Call fixNodePositions here to ensure fixed positions
            // are enforced after layout initialization
            this.fixNodePositions();
        }
    }

    private transformNodes(nodes: GraphNode[]): EnhancedNode[] {
        console.debug(`[GraphManager:${this.managerId}] Transforming nodes:`, {
            nodeCount: nodes.length,
            types: nodes.map(n => n.type),
            firstNodeId: nodes[0]?.id
        });
        
        return nodes.map(node => {
            // Calculate net votes for the node
            const netVotes = this.getNodeVotes(node);
            
            // Determine if node should be hidden based on community standard
            const isHidden = (node.type === 'word' || node.type === 'definition') && 
                netVotes < 0;
                
            console.debug(`[GraphManager:${this.managerId}] Visibility check for node ${node.id}:`, {
                type: node.type,
                netVotes,
                isHidden
            });
                
            const enhancedNode: EnhancedNode = {
                id: node.id,
                type: node.type,
                data: node.data,
                group: node.group,
                mode: node.mode,
                radius: this.getNodeRadius(node),
                fixed: node.group === 'central',
                expanded: node.mode === 'detail',
                subtype: node.type === 'definition' ? 
                    (node.group === 'live-definition' ? 'live' : 'alternative') : 
                    undefined,
                // Add visibility properties
                isHidden,
                hiddenReason: isHidden ? 'community' : undefined,
                // Initialize D3 positioning properties
                x: null,
                y: null,
                vx: null,
                vy: null,
                fx: null,
                fy: null,
                metadata: {
                    group: this.getLayoutGroup(node),
                    fixed: node.group === 'central',
                    isDetail: node.mode === 'detail',
                    votes: node.type === 'definition' ? this.getNodeVotes(node) : undefined,
                    createdAt: 'createdAt' in node.data ? 
                        (node.data.createdAt instanceof Date ? 
                            node.data.createdAt.toISOString() : 
                            typeof node.data.createdAt === 'string' ? 
                                node.data.createdAt : 
                                undefined) : 
                        undefined
                }
            };
            
            // If this is a central/fixed node, explicitly set position
            if (enhancedNode.fixed || enhancedNode.group === 'central') {
                enhancedNode.fx = 0; // Force X position to center
                enhancedNode.fy = 0; // Force Y position to center
                enhancedNode.x = 0;  // Initial X position
                enhancedNode.y = 0;  // Initial Y position
                
                console.debug(`[GraphManager:${this.managerId}] Fixed central node at origin:`, {
                    id: enhancedNode.id,
                    type: enhancedNode.type
                });
            }
            
            return enhancedNode;
        });
    }

    private transformLinks(links: GraphLink[]): EnhancedLink[] {
        return links.map(link => {
            const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
            const targetId = typeof link.target === 'string' ? link.target : link.target.id;
            
            return {
                id: `${sourceId}-${targetId}`, // Add unique ID for each link
                source: sourceId,
                target: targetId,
                type: link.type,
                strength: link.type === 'live' ? 0.7 : 0.3
            };
        });
    }

    private createRenderableNodes(nodes: EnhancedNode[]): RenderableNode[] {
        return nodes.map(node => {
            const baseSize = this.getNodeRadius(node) * 2;
            
            // Simple, direct position calculation with null checking
            const x = node.x ?? 0;
            const y = node.y ?? 0;
            
            // For debugging
            if (node.group === 'central' || node.fixed) {
                console.debug(`[GraphManager] Central node position:`, { 
                    id: node.id, 
                    x, 
                    y,
                    fixed: { fx: node.fx, fy: node.fy }
                });
            }
            
            return {
                id: node.id,
                type: node.type,
                group: node.group,
                mode: node.mode,
                data: node.data,
                radius: node.radius,
                isHidden: node.isHidden,
                hiddenReason: node.hiddenReason,
                position: {
                    x,
                    y,
                    svgTransform: `translate(${x}, ${y})`
                },
                metadata: node.metadata,
                style: {
                    previewSize: baseSize,
                    detailSize: baseSize * 2,
                    colors: {
                        background: this.getNodeColor(node),
                        border: this.getNodeColor(node),
                        text: COLORS.UI.TEXT.PRIMARY,
                        hover: this.getNodeColor(node),
                        gradient: {
                            start: `${this.getNodeColor(node)}66`,
                            end: `${this.getNodeColor(node)}33`
                        }
                    },
                    padding: {
                        preview: COORDINATE_SPACE.NODES.PADDING.PREVIEW,
                        detail: COORDINATE_SPACE.NODES.PADDING.DETAIL
                    },
                    lineHeight: {
                        preview: NODE_CONSTANTS.LINE_HEIGHT.preview,
                        detail: NODE_CONSTANTS.LINE_HEIGHT.detail
                    },
                    stroke: {
                        preview: {
                            normal: NODE_CONSTANTS.STROKE.preview.normal,
                            hover: NODE_CONSTANTS.STROKE.preview.hover
                        },
                        detail: {
                            normal: NODE_CONSTANTS.STROKE.detail.normal,
                            hover: NODE_CONSTANTS.STROKE.detail.hover
                        }
                    },
                    highlightColor: this.getNodeColor(node)
                }
            };
        });
    }

    private getNodeRadius(node: GraphNode | EnhancedNode): number {
        if (node.type === 'word') {
            return node.mode === 'detail' ? 
                COORDINATE_SPACE.NODES.SIZES.WORD.DETAIL / 2 : 
                COORDINATE_SPACE.NODES.SIZES.WORD.PREVIEW / 2;
        } else if (node.type === 'definition') {
            return node.mode === 'detail' ?
                COORDINATE_SPACE.NODES.SIZES.DEFINITION.DETAIL / 2 :
                COORDINATE_SPACE.NODES.SIZES.DEFINITION.PREVIEW / 2;
        } else if (node.type === 'navigation') {
            return COORDINATE_SPACE.NODES.SIZES.NAVIGATION / 2;
        } else {
            return COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL / 2;
        }
    }

    private getLayoutGroup(node: GraphNode): "central" | "word" | "definition" | "navigation" {
        if (node.group === 'central') return 'central';
        if (node.group === 'live-definition' || node.group === 'alternative-definition') return 'definition';
        return node.type as "word" | "navigation";
    }

    private getNodeVotes(node: GraphNode): number {
        if (node.type === 'definition' && 'data' in node) {
            const def = node.data as { positiveVotes?: number | any; negativeVotes?: number | any };
            const posVotes = this.getNeo4jNumber(def.positiveVotes);
            const negVotes = this.getNeo4jNumber(def.negativeVotes);
            
            console.debug(`[GraphManager:${this.managerId}] Vote calculation for definition:`, {
                id: node.id,
                posVotes,
                negVotes,
                netVotes: posVotes - negVotes
            });
            
            return posVotes - negVotes;
        }
        else if (node.type === 'word' && 'data' in node) {
            const word = node.data as { positiveVotes?: number | any; negativeVotes?: number | any };
            const posVotes = this.getNeo4jNumber(word.positiveVotes);
            const negVotes = this.getNeo4jNumber(word.negativeVotes);
            
            console.debug(`[GraphManager:${this.managerId}] Vote calculation for word:`, {
                id: node.id,
                posVotes,
                negVotes,
                netVotes: posVotes - negVotes
            });
            
            return posVotes - negVotes;
        }
        return 0;
    }
    
    /**
     * Helper to extract number from Neo4j number objects
     */
    private getNeo4jNumber(value: any): number {
        if (value && typeof value === 'object' && 'low' in value) {
            return Number(value.low);
        }
        return Number(value || 0);
    }

    private getNodeColor(node: EnhancedNode): string {
        switch (node.type) {
            case 'word':
                return COLORS.PRIMARY.BLUE;
            case 'definition':
                return node.subtype === 'live' ? 
                    COLORS.PRIMARY.BLUE : 
                    COLORS.PRIMARY.PURPLE;
            case 'navigation':
                return 'transparent'; // Remove the colored border
            case 'dashboard':
            case 'edit-profile':
            case 'create-node':
                return COLORS.UI.TEXT.PRIMARY; // White color for dashboard nodes
            default:
                return COLORS.UI.TEXT.PRIMARY; // Default to white
        }
    }
    
    private createRenderableLinks(nodes: EnhancedNode[], links: EnhancedLink[]): RenderableLink[] {
        return links.map(link => {
            const source = typeof link.source === 'string' 
                ? nodes.find(n => n.id === link.source) 
                : link.source as EnhancedNode;
                
            const target = typeof link.target === 'string' 
                ? nodes.find(n => n.id === link.target)
                : link.target as EnhancedNode;
            
            if (!source || !target) {
                console.warn(`[GraphManager:${this.managerId}] Missing node reference for link`, {
                    sourceId: typeof link.source === 'string' ? link.source : (link.source as EnhancedNode).id,
                    targetId: typeof link.target === 'string' ? link.target : (link.target as EnhancedNode).id,
                });
                return null;
            }
            
            // Calculate link path
            const path = this.calculateLinkPath(source, target);
            
            return {
                id: `${source.id}-${target.id}`,
                type: link.type,
                sourceId: source.id,
                targetId: target.id,
                sourceType: source.type,
                targetType: target.type,
                path,
                sourcePosition: { 
                    x: source.x ?? 0, 
                    y: source.y ?? 0,
                    svgTransform: `translate(${source.x ?? 0}, ${source.y ?? 0})`
                },
                targetPosition: { 
                    x: target.x ?? 0, 
                    y: target.y ?? 0,
                    svgTransform: `translate(${target.x ?? 0}, ${target.y ?? 0})`
                },
                strength: link.strength
            };
        }).filter(Boolean) as RenderableLink[];
    }

    /**
     * Calculate path for a link between two nodes
     * Using empirical scaling factor for accurate endpoint positioning
     */
    private calculateLinkPath(source: EnhancedNode, target: EnhancedNode): string {
        // Get positions
        const sourceX = source.x ?? 0;
        const sourceY = source.y ?? 0;
        const targetX = target.x ?? 0;
        const targetY = target.y ?? 0;
        
        // Calculate vector
        const dx = targetX - sourceX;
        const dy = targetY - sourceY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance === 0) return '';
        
        // Calculate unit vector
        const unitX = dx / distance;
        const unitY = dy / distance;
        
        // Apply empirical scaling factor to radii (1/9)
        // This factor is also used in CoordinateSystem and NavigationNode
        const RADIUS_SCALE_FACTOR = 1/9;
        const sourceEffectiveRadius = source.radius * RADIUS_SCALE_FACTOR;
        const targetEffectiveRadius = target.radius * RADIUS_SCALE_FACTOR;
        
        // Calculate points on perimeter using effective radii
        const startX = sourceX + (unitX * sourceEffectiveRadius);
        const startY = sourceY + (unitY * sourceEffectiveRadius);
        const endX = targetX - (unitX * targetEffectiveRadius);
        const endY = targetY - (unitY * targetEffectiveRadius);
        
        return `M${startX},${startY}L${endX},${endY}`;
    }
}