// src/lib/services/graph/GraphManager.ts
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
import { StatementNetworkLayout } from './layouts/StatementNetworkLayout';

// Enable debug mode only during development - set to false for production
const DEBUG_MODE = false;
const debugLog = DEBUG_MODE ? console.debug : () => {};

export class GraphManager {
    private simulation: d3.Simulation<any, any>;
    private nodesStore = writable<EnhancedNode[]>([]);
    private linksStore = writable<EnhancedLink[]>([]);
    private _viewType: ViewType;
    private managerId: string;
    private simulationActive = false;
    private currentLayoutStrategy: SingleNodeLayout | WordDefinitionLayout | StatementNetworkLayout | null = null;
    private isUpdatingStore = writable(false);
    
    // Caches for better performance
    private nodeVotesCache = new Map<string, number>();
    private nodeRadiusCache = new Map<string, number>();

    // Public derived stores for renderable data
    public readonly renderableNodes: Readable<RenderableNode[]>;
    public readonly renderableLinks: Readable<RenderableLink[]>;

    constructor(viewType: ViewType) {
        this.managerId = Math.random().toString(36).substring(2, 9);
        debugLog(`[GraphManager:${this.managerId}] Creating new manager`, { viewType });
        
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
        debugLog(`[GraphManager:${this.managerId}] Setting data`, {
            nodeCount: data.nodes.length,
            linkCount: data.links?.length || 0,
            viewType: this._viewType,
            config
        });
        
        // Stop any running simulation
        this.stopSimulation();
        
        // Clear caches for fresh start
        this.nodeVotesCache.clear();
        this.nodeRadiusCache.clear();
        
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

    /**
     * Update node mode (preview/detail) with improved performance
     */
    public updateNodeMode(nodeId: string, mode: NodeMode): void {
        // Get current nodes
        const currentNodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const nodeIndex = currentNodes.findIndex((n: EnhancedNode) => n.id === nodeId);
        
        if (nodeIndex === -1) {
            return;
        }
        
        // Get the node
        const node = currentNodes[nodeIndex];
        
        // Skip update if already in requested mode
        if (node.mode === mode) {
            return;
        }
        
        // Create a new node object with updated properties
        const updatedNode: EnhancedNode = {
            ...node,
            mode,
            expanded: mode === 'detail',
            radius: this.getNodeRadius({
                ...node, 
                mode
            }),
            metadata: {
                ...node.metadata,
                isDetail: mode === 'detail'
            }
        };
        
        // Create a new nodes array with the updated node
        const updatedNodes = [...currentNodes];
        updatedNodes[nodeIndex] = updatedNode;
        
        // Update the simulation with the new nodes array
        this.simulation.nodes(updatedNodes);
        
        // Update the store with the new nodes array
        this.nodesStore.set(updatedNodes);
        
        // If layout strategy exists, let it handle the mode change
        if (this.currentLayoutStrategy) {
            this.currentLayoutStrategy.handleNodeStateChange(nodeId, mode);
        }
        
        // Ensure fixed positions are maintained
        this.fixNodePositions();
        
        // Force a tick to immediately update positions
        const tickCount = this._viewType === 'statement-network' ? 3 : 2;
        this.forceTick(tickCount);
        
        // Restart simulation with low alpha for smooth transition
        this.simulation.alpha(0.1).restart();
        this.simulationActive = true;
    }
    
    /**
     * Get the central node (group === 'central')
     */
    public getCentralNode(): RenderableNode | null {
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const centralNode = nodes.find(node => node.group === 'central');
        
        if (!centralNode) {
            return null;
        }
        
        return this.createRenderableNodes([centralNode])[0];
    }
    
    /**
     * Update node visibility with optimized handling
     */
    public updateNodeVisibility(nodeId: string, isHidden: boolean, hiddenReason: 'community' | 'user' = 'user'): void {
        // Use the simulation nodes directly
        const currentNodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const nodeIndex = currentNodes.findIndex((n: EnhancedNode) => n.id === nodeId);
        
        if (nodeIndex === -1) {
            return;
        }
        
        // Get the old node
        const oldNode = currentNodes[nodeIndex];
        
        // Skip if already in correct state
        if (oldNode.isHidden === isHidden) {
            return;
        }
        
        // Create a completely new node object with updated properties
        const updatedNode: EnhancedNode = {
            ...oldNode,
            isHidden: isHidden,
            hiddenReason: hiddenReason,
            radius: this.getNodeRadius({
                ...oldNode,
                isHidden: isHidden
            })
        };
        
        // Create a new nodes array with the updated node
        const updatedNodes = [...currentNodes];
        updatedNodes[nodeIndex] = updatedNode;
        
        // Update the simulation with the new nodes array
        this.simulation.nodes(updatedNodes);
        this.nodesStore.set(updatedNodes);
        
        // If layout strategy exists, let it handle the visibility change
        if (this.currentLayoutStrategy) {
            if (typeof (this.currentLayoutStrategy as any).handleNodeVisibilityChange === 'function') {
                (this.currentLayoutStrategy as any).handleNodeVisibilityChange(nodeId, isHidden);
            }
        }
        
        // Ensure fixed positions are maintained
        this.fixNodePositions();
        
        // Force a tick to immediately update positions
        this.forceTick();
        
        // Restart simulation with low alpha for smooth transition
        this.simulation.alpha(0.3).restart();
        this.simulationActive = true;
    }

    /**
     * Recalculate visibility for a node based on its votes and user preferences
     */
    public recalculateNodeVisibility(
        nodeId: string, 
        positiveVotes: number, 
        negativeVotes: number,
        userPreference?: boolean  // Optional user preference override
    ): void {
        // Get current nodes
        const currentNodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const node = currentNodes.find((n: EnhancedNode) => n.id === nodeId);
        
        if (!node) {
            return;
        }
        
        // Only perform calculation for word, definition, and statement nodes
        if (node.type !== 'word' && node.type !== 'definition' && node.type !== 'statement') {
            return;
        }
        
        // If user preference is provided, it overrides community visibility
        if (userPreference !== undefined) {
            // Only update if value would change
            if (node.isHidden === userPreference) {
                return;
            }
            
            // Update node visibility
            this.updateNodeVisibility(nodeId, !userPreference, 'user');
        } else {
            // Calculate net votes
            const netVotes = positiveVotes - negativeVotes;
            
            // Update visibility based on votes
            const shouldBeHidden = netVotes < 0;
            
            // If node has a user-defined visibility, don't override it
            if (node.hiddenReason === 'user') {
                return;
            }
            
            // Only update if visibility state would change
            if (node.isHidden !== shouldBeHidden) {
                // Update node visibility
                this.updateNodeVisibility(nodeId, shouldBeHidden, 'community');
            }
        }
    }

    /**
     * Apply visibility preferences to nodes in batch (optimized)
     */
    public applyVisibilityPreferences(preferences: Record<string, boolean>): void {
        if (Object.keys(preferences).length === 0) {
            return;
        }
        
        // Get current nodes
        const currentNodes = this.simulation.nodes() as unknown as EnhancedNode[];
        let changedNodeCount = 0;
        
        // Create a new array only if we need to modify nodes
        let updatedNodes = [...currentNodes];
        let needsUpdatedArray = false;
        
        // Apply preferences to all nodes
        Object.entries(preferences).forEach(([nodeId, isVisible]) => {
            const nodeIndex = updatedNodes.findIndex((n: EnhancedNode) => n.id === nodeId);
            if (nodeIndex >= 0) {
                const node = updatedNodes[nodeIndex];
                
                // Only update if this would change visibility
                const newHiddenState = !isVisible;
                if (node.isHidden !== newHiddenState) {
                    // Create a new node object only if we haven't already
                    if (!needsUpdatedArray) {
                        needsUpdatedArray = true;
                        updatedNodes = [...currentNodes]; // Create a new array for reactivity
                    }
                    
                    // Create a new node with updated properties
                    const updatedNode: EnhancedNode = {
                        ...node,
                        isHidden: newHiddenState,
                        hiddenReason: 'user',
                        radius: this.getNodeRadius({
                            ...node,
                            isHidden: newHiddenState
                        })
                    };
                    
                    // Update the node in the array
                    updatedNodes[nodeIndex] = updatedNode;
                    changedNodeCount++;
                }
            }
        });
        
        // Only update the simulation and store if changes were made
        if (changedNodeCount > 0) {
            debugLog(`[GraphManager] Applied visibility preferences to ${changedNodeCount} nodes`);
            
            // Update simulation nodes
            this.simulation.nodes(updatedNodes);
            
            // Update store
            this.nodesStore.set(updatedNodes);
            
            // Let the layout strategy handle visibility preferences
            if (this.currentLayoutStrategy && typeof (this.currentLayoutStrategy as any).applyVisibilityPreferences === 'function') {
                (this.currentLayoutStrategy as any).applyVisibilityPreferences(preferences);
            }
            
            // Minimal simulation restart
            this.simulation.alpha(0.1).restart();
            this.simulationActive = true;
        }
    }

    public updateViewType(viewType: ViewType): void {
        if (this._viewType === viewType) return;
        
        debugLog(`[GraphManager:${this.managerId}] Updating view type`, {
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
        this.stopSimulation();
        if (this.currentLayoutStrategy) {
            this.currentLayoutStrategy.stop();
            this.currentLayoutStrategy = null;
        }
    }

    /**
     * Completely stop the simulation
     */
    public stopSimulation(): void {
        if (!this.simulationActive) return;
        
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
     */
    public forceTick(ticks: number = 1): void {
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
        this.nodesStore.set([...nodes]);
    }

    /**
     * Ensure all fixed nodes stay fixed
     */
    public fixNodePositions(): void {
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        
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
            } else if (node.type === 'navigation') {
                // Navigation nodes fixed at their assigned positions
                if (node.fx !== null && node.fx !== undefined) {
                    node.x = node.fx;
                }
                if (node.fy !== null && node.fy !== undefined) {
                    node.y = node.fy;
                }
                
                // Ensure zero velocity for all navigation nodes
                node.vx = 0;
                node.vy = 0;
            }
        });
        
        // Update the store to reflect these fixed positions
        this.nodesStore.set([...nodes]);
        
        // If we have a WordDefinitionLayout, call its enforceFixedPositions method too
        if (this.currentLayoutStrategy instanceof WordDefinitionLayout) {
            (this.currentLayoutStrategy as WordDefinitionLayout).enforceFixedPositions();
        }
    }

    private startSimulation(): void {
        if (this.simulationActive) return;
        
        this.simulation.alpha(1).restart();
        this.simulationActive = true;
    }

    private initializeSimulation(): d3.Simulation<any, any> {
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
                    // ALWAYS enforce central node position on EVERY tick
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
            
            // Update the store to trigger rerenders
            this.nodesStore.set([...nodes]);
        });
        
        return simulation;
    }

    private applyLayoutStrategy(): void {
        // Stop current layout strategy if exists
        if (this.currentLayoutStrategy) {
            this.currentLayoutStrategy.stop();
        }
        
        debugLog(`[GraphManager:${this.managerId}] Applying layout strategy for ${this._viewType} view`);
        
        // Select appropriate layout strategy
        if (this._viewType === 'statement-network') {
            this.currentLayoutStrategy = new StatementNetworkLayout(
                COORDINATE_SPACE.WORLD.WIDTH,
                COORDINATE_SPACE.WORLD.HEIGHT,
                this._viewType
            );
        }
        else if (this._viewType === 'dashboard' || 
            this._viewType === 'edit-profile' || 
            this._viewType === 'create-node' ||
            this._viewType === 'statement') {
            // Single central node views - including statement view
            this.currentLayoutStrategy = new SingleNodeLayout(
                COORDINATE_SPACE.WORLD.WIDTH,
                COORDINATE_SPACE.WORLD.HEIGHT,
                this._viewType
            );
        } 
        else if (this._viewType === 'word') {
            // Word definition view
            this.currentLayoutStrategy = new WordDefinitionLayout(
                COORDINATE_SPACE.WORLD.WIDTH,
                COORDINATE_SPACE.WORLD.HEIGHT,
                this._viewType
            );
        }
        else {
            // Default to SingleNodeLayout for any other view
            this.currentLayoutStrategy = new SingleNodeLayout(
                COORDINATE_SPACE.WORLD.WIDTH,
                COORDINATE_SPACE.WORLD.HEIGHT,
                this._viewType
            );
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
            
            // Call fixNodePositions to ensure fixed positions
            this.fixNodePositions();
        }
    }

    /**
     * Optimized node transformation with better caching
     */
    private transformNodes(nodes: GraphNode[]): EnhancedNode[] {
        // Reuse existing enhanced nodes when possible
        const enhancedNodeCache = new Map<string, EnhancedNode>();
        
        // If we have existing nodes in the simulation, cache them by ID
        const existingNodes = this.simulation?.nodes() as unknown as EnhancedNode[] || [];
        existingNodes.forEach(node => {
            enhancedNodeCache.set(node.id, node);
        });
        
        return nodes.map(node => {
            // Check if we already have this node
            const existing = enhancedNodeCache.get(node.id);
            if (existing && existing.type === node.type) {
                // Update only necessary properties
                existing.data = node.data;
                existing.mode = node.mode;
                
                // Reset cached values
                this.nodeVotesCache.delete(node.id);
                this.nodeRadiusCache.delete(node.id);
                
                return existing;
            }
            
            // Get net votes for this node
            const netVotes = this.getNodeVotes(node);
            
            // Determine if node should be hidden based on community standard
            const isHidden = (node.type === 'word' || node.type === 'definition' || node.type === 'statement') && 
                netVotes < 0;
                
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
                    votes: node.type === 'definition' || node.type === 'statement' ? 
                        netVotes : undefined,
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
            }
            
            return enhancedNode;
        });
    }

    private transformLinks(links: GraphLink[]): EnhancedLink[] {
        return links.map(link => {
            const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
            const targetId = typeof link.target === 'string' ? link.target : link.target.id;
            
            // Determine relationship type and strength based on link type
            let relationshipType: 'direct' | 'keyword' = 'keyword';
            let strength = 0.3;
            
            if (link.type === 'related') {
                relationshipType = 'direct';
                strength = 0.7; // Stronger connections for direct relationships
            } else if (link.type === 'live') {
                strength = 0.7;
            }
            
            return {
                id: link.id || `${sourceId}-${targetId}`, // Use provided ID or generate one
                source: sourceId,
                target: targetId,
                type: link.type,
                relationshipType: relationshipType,
                strength: strength
            };
        });
    }

    private createRenderableNodes(nodes: EnhancedNode[]): RenderableNode[] {
        return nodes.map(node => {
            // Use the current node.radius directly
            const radius = node.radius;
            const baseSize = radius * 2;
            
            // Simple position calculation with null checking
            const x = node.x ?? 0;
            const y = node.y ?? 0;
            
            return {
                id: node.id,
                type: node.type,
                group: node.group,
                mode: node.mode,
                data: node.data,
                radius: radius,
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

    /**
     * Get node radius with improved caching
     */
    private getNodeRadius(node: GraphNode | EnhancedNode): number {
        // Generate a cache key based on node properties that affect radius
        const cacheKey = `${node.id}-${node.type}-${node.mode || 'preview'}-${('isHidden' in node && node.isHidden) ? 'hidden' : 'visible'}`;
        
        // Use cached value if available
        if (this.nodeRadiusCache.has(cacheKey)) {
            return this.nodeRadiusCache.get(cacheKey) || 0;
        }
        
        let radius = 0;
        
        // First check if node is hidden - hidden nodes have the smallest radius
        if ('isHidden' in node && node.isHidden) {
            radius = COORDINATE_SPACE.NODES.SIZES.HIDDEN / 2;
        }
        // Then check node type and mode
        else if (node.type === 'word') {
            radius = node.mode === 'detail' ? 
                COORDINATE_SPACE.NODES.SIZES.WORD.DETAIL / 2 : 
                COORDINATE_SPACE.NODES.SIZES.WORD.PREVIEW / 2;
        } else if (node.type === 'definition') {
            radius = node.mode === 'detail' ?
                COORDINATE_SPACE.NODES.SIZES.DEFINITION.DETAIL / 2 :
                COORDINATE_SPACE.NODES.SIZES.DEFINITION.PREVIEW / 2;
        } else if (node.type === 'statement') {
            radius = node.mode === 'detail' ?
                COORDINATE_SPACE.NODES.SIZES.STATEMENT.DETAIL / 2 :
                COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW / 2;
        } else if (node.type === 'navigation') {
            radius = COORDINATE_SPACE.NODES.SIZES.NAVIGATION / 2;
        } else {
            // Dashboard, edit-profile, etc.
            radius = COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL / 2;
        }
        
        // Cache the result
        this.nodeRadiusCache.set(cacheKey, radius);
        return radius;
    }

    private getLayoutGroup(node: GraphNode): "central" | "word" | "definition" | "navigation" | "statement" {
        if (node.group === 'central') return 'central';
        if (node.group === 'live-definition' || node.group === 'alternative-definition') return 'definition';
        return node.type as "word" | "navigation" | "statement";
    }

    /**
     * Get node votes with optimized caching
     */
    private getNodeVotes(node: GraphNode): number {
        // Use cached value if available
        if (this.nodeVotesCache.has(node.id)) {
            return this.nodeVotesCache.get(node.id) || 0;
        }
        
        let netVotes = 0;
        
        if (node.type === 'definition' && 'data' in node) {
            const def = node.data as { positiveVotes?: number | any; negativeVotes?: number | any };
            const posVotes = this.getNeo4jNumber(def.positiveVotes);
            const negVotes = this.getNeo4jNumber(def.negativeVotes);
            netVotes = posVotes - negVotes;
        }
        else if (node.type === 'word' && 'data' in node) {
            const word = node.data as { positiveVotes?: number | any; negativeVotes?: number | any };
            const posVotes = this.getNeo4jNumber(word.positiveVotes);
            const negVotes = this.getNeo4jNumber(word.negativeVotes);
            netVotes = posVotes - negVotes;
        }
        else if (node.type === 'statement' && 'data' in node) {
            const statement = node.data as { positiveVotes?: number | any; negativeVotes?: number | any };
            const posVotes = this.getNeo4jNumber(statement.positiveVotes);
            const negVotes = this.getNeo4jNumber(statement.negativeVotes);
            netVotes = posVotes - negVotes;
        }
        
        // Cache the result
        this.nodeVotesCache.set(node.id, netVotes);
        return netVotes;
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
            case 'statement':
                return COLORS.PRIMARY.GREEN;
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
    
    /**
     * Calculate link path with improved performance
     */
    private createRenderableLinks(nodes: EnhancedNode[], links: EnhancedLink[]): RenderableLink[] {
        return links.map(link => {
            const source = typeof link.source === 'string' 
                ? nodes.find(n => n.id === link.source) 
                : link.source as EnhancedNode;
                
            const target = typeof link.target === 'string' 
                ? nodes.find(n => n.id === link.target)
                : link.target as EnhancedNode;
            
            if (!source || !target) {
                return null;
            }
            
            // Calculate link path
            const path = this.calculateLinkPath(source, target);
            
            return {
                id: link.id,
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
                strength: link.strength,
                relationshipType: link.relationshipType
            };
        }).filter(Boolean) as RenderableLink[];
    }

    /**
     * Calculate path for a link with improved performance
     */
    private calculateLinkPath(source: EnhancedNode, target: EnhancedNode): string {
        // Get positions with null safety
        const sourceX = source.x ?? 0;
        const sourceY = source.y ?? 0;
        const targetX = target.x ?? 0;
        const targetY = target.y ?? 0;
        
        // Skip calculation if nodes are at the same position
        if (sourceX === targetX && sourceY === targetY) {
            return '';
        }
        
        // Calculate vector
        const dx = targetX - sourceX;
        const dy = targetY - sourceY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Calculate unit vector
        const unitX = dx / distance;
        const unitY = dy / distance;
        
        // Simpler scaling factor calculation - use a fixed percentage of radius
        const sourceRadius = source.radius * 0.95; // 95% of radius
        const targetRadius = target.radius * 0.95; // 95% of radius
        
        // Calculate points on perimeter
        const startX = sourceX + (unitX * sourceRadius);
        const startY = sourceY + (unitY * sourceRadius);
        const endX = targetX - (unitX * targetRadius);
        const endY = targetY - (unitY * targetRadius);
        
        return `M${startX},${startY}L${endX},${endY}`;
    }
}