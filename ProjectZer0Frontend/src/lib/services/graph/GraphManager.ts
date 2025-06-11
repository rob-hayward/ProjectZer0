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
import { coordinateSystem } from './CoordinateSystem';
import { getNeo4jNumber } from '$lib/utils/neo4j-utils';
import { statementNetworkStore } from '$lib/stores/statementNetworkStore';
import { DiscussionLayout } from './layouts/DiscussionLayout';
import { OpenQuestionAnswerLayout } from './layouts/OpenQuestionAnswerLayout';

export class GraphManager {
    private simulation: d3.Simulation<any, any>;
    private nodesStore = writable<EnhancedNode[]>([]);
    private linksStore = writable<EnhancedLink[]>([]);
    private _viewType: ViewType;
    private managerId: string;
    private simulationActive = false;
    private currentLayoutStrategy: SingleNodeLayout | WordDefinitionLayout | StatementNetworkLayout | DiscussionLayout | OpenQuestionAnswerLayout | null = null;
    private isUpdatingStore = writable(false);
    
    // Caches for better performance
    private nodeVotesCache = new Map<string, number>();
    private nodeRadiusCache = new Map<string, number>();

    // Public derived stores for renderable data
    public readonly renderableNodes: Readable<RenderableNode[]>;
    public readonly renderableLinks: Readable<RenderableLink[]>;

    constructor(viewType: ViewType) {
        this.managerId = Math.random().toString(36).substring(2, 9);
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
        
        // Set up reply listeners for discussion view
        if (viewType === 'discussion') {
            this.setupReplyListener();
        }
    }

    get viewType(): ViewType {
        return this._viewType;
    }

    private setupReplyListener(): void {
        if (typeof window !== 'undefined') {
            console.log('[FORM_DEBUG] GraphManager - Setting up reply listener');
            window.addEventListener('discussion-reply-started', ((event: CustomEvent) => {
                if (!event.detail || !event.detail.commentId) {
                    console.warn('[FORM_DEBUG] GraphManager - Reply event missing commentId');
                    return;
                }
                
                const commentId = event.detail.commentId;
                console.log(`[FORM_DEBUG] GraphManager - Detected reply started to comment: ${commentId}`);
                
                // Update graph to reflect the new reply form
                this.handleReplyFormStarted(commentId);
            }) as EventListener);
        }
    }

    private handleReplyFormStarted(commentId: string): void {
        // Only process for discussion view
        if (this._viewType !== 'discussion') {
            console.log(`[FORM_DEBUG] GraphManager - Not processing reply form - view type is not discussion: ${this._viewType}`);
            return;
        }
        
        // Get current nodes
        const currentNodes = this.simulation.nodes() as unknown as EnhancedNode[];
        
        // Find the target comment
        const targetComment = currentNodes.find(n => n.id === commentId);
        if (!targetComment) {
            console.warn(`[FORM_DEBUG] GraphManager - Cannot find comment ${commentId} for reply form`);
            return;
        }
        
        console.log(`[FORM_DEBUG] GraphManager - Found target comment:`, {
            id: targetComment.id,
            type: targetComment.type,
            position: { x: targetComment.x, y: targetComment.y }
        });
        
        // If we have a DiscussionLayout, let it handle the positioning
        if (this.currentLayoutStrategy instanceof DiscussionLayout) {
            console.log(`[FORM_DEBUG] GraphManager - Notifying DiscussionLayout to handle reply start`);
            // Notify the layout strategy about the reply start
            (this.currentLayoutStrategy as any).handleReplyStart(commentId);
        } else {
            console.warn(`[FORM_DEBUG] GraphManager - No DiscussionLayout available for reply form positioning`);
        }
    }

    public setData(data: GraphData, config?: LayoutUpdateConfig): void {
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
        this.enforceFixedPositionsStrict();
        
        // Start simulation unless skipAnimation is true
        if (!config?.skipAnimation) {
            this.startSimulation();
        }
    }

    public updateNodeMode(nodeId: string, mode: NodeMode): void {
        // Get current nodes
        const currentNodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const nodeIndex = currentNodes.findIndex((n: EnhancedNode) => n.id === nodeId);
        
        if (nodeIndex === -1) {
            console.warn(`[GraphManager] Node ${nodeId} not found`);
            return;
        }
        
        // Get the node
        const node = currentNodes[nodeIndex];
        
        // Skip update if already in requested mode
        if (node.mode === mode) {
            console.log(`[GraphManager] Node ${nodeId} already in mode ${mode}`);
            return;
        }
        
        console.log(`[GraphManager] Updating node ${nodeId} mode from ${node.mode} to ${mode}`);
        
        // Stop simulation before updating
        this.simulation.alpha(0).alphaTarget(0);
        
        // Clear radius cache for this node to ensure fresh calculation
        const cacheKey = `${nodeId}-${node.type}-${mode}-${node.isHidden ? 'hidden' : 'visible'}`;
        this.nodeRadiusCache.delete(cacheKey);
        
        // Calculate new radius BEFORE creating the updated node
        const newRadius = this.getNodeRadius({
            ...node,
            mode: mode
        });
        
        console.log(`[GraphManager] Node ${nodeId} (type: ${node.type}) radius change: ${node.radius} -> ${newRadius}`);
        
        // Create a new node object with updated properties
        const updatedNode: EnhancedNode = {
            ...node,
            mode,
            expanded: mode === 'detail',
            radius: newRadius, // Use the calculated radius
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
        
        // If this is a central node, ensure its position is exactly at center
        if (node.group === 'central' || node.fixed) {
            updatedNode.x = 0;
            updatedNode.y = 0;
            updatedNode.fx = 0;
            updatedNode.fy = 0;
            updatedNode.vx = 0;
            updatedNode.vy = 0;
        }
        
        // If layout strategy exists, let it handle the mode change
        if (this.currentLayoutStrategy) {
            // CRITICAL: For OpenQuestionAnswerLayout, we need to call the right method
            if (this.currentLayoutStrategy instanceof OpenQuestionAnswerLayout) {
                console.log(`[GraphManager] Calling OpenQuestionAnswerLayout.handleNodeStateChange`);
                this.currentLayoutStrategy.handleNodeStateChange(nodeId, mode);
            } else if (typeof this.currentLayoutStrategy.handleNodeStateChange === 'function') {
                this.currentLayoutStrategy.handleNodeStateChange(nodeId, mode);
            }
        }
        
        // Ensure fixed positions are maintained
        this.enforceFixedPositionsStrict();
        
        // Force several ticks to immediately update positions
        const tickCount = this._viewType === 'statement-network' ? 5 : 3;
        for (let i = 0; i < tickCount; i++) {
            this.simulation.tick();
            this.enforceFixedPositionsStrict();
        }
        
        // Update store again after ticks
        this.nodesStore.set([...this.simulation.nodes() as unknown as EnhancedNode[]]);
        
        // Restart simulation with minimal alpha for smooth transition
        this.simulation.alpha(0.1).restart();
        this.simulationActive = true;
    }
    
    public updateNodeVisibility(nodeId: string, isHidden: boolean, hiddenReason: 'community' | 'user' = 'user'): void {
        // Use the simulation nodes directly
        const currentNodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const nodeIndex = currentNodes.findIndex((n: EnhancedNode) => n.id === nodeId);
        
        if (nodeIndex === -1) {
            console.warn(`[GraphManager] Node ${nodeId} not found for visibility update`);
            return;
        }
        
        // Get the old node
        const oldNode = currentNodes[nodeIndex];
        
        // Skip if already in correct state
        if (oldNode.isHidden === isHidden) {
            console.log(`[GraphManager] Node ${nodeId} already in correct visibility state: ${isHidden ? 'hidden' : 'visible'}`);
            return;
        }
        
        console.log(`[GraphManager] Updating visibility for ${oldNode.type} node ${nodeId}: ${isHidden ? 'hiding' : 'showing'} (${hiddenReason})`);
        
        // Clear all cache entries for this node
        for (const key of Array.from(this.nodeRadiusCache.keys())) {
            if (key.startsWith(`${nodeId}-`)) {
                this.nodeRadiusCache.delete(key);
            }
        }
        
        // CRITICAL: When transitioning from hidden to visible, ensure node returns to preview mode
        // This is the key part that matches the behavior of other node types
        let updatedMode = oldNode.mode;
        if (oldNode.isHidden && !isHidden) {
            // If we're transitioning from hidden to visible, set to preview mode
            updatedMode = 'preview';
            console.log(`[GraphManager] Node ${nodeId} transitioning from hidden to visible, setting mode to 'preview'`);
        }
        
        // Calculate new radius using the updated mode and visibility
        const newRadius = this.getNodeRadius({
            ...oldNode,
            mode: updatedMode,
            isHidden: isHidden
        });
        
        console.log(`[GraphManager] Node ${nodeId} radius: ${oldNode.radius} -> ${newRadius} (hidden: ${isHidden}, mode: ${updatedMode})`);
        
        // Create a new node object with updated properties
        const updatedNode: EnhancedNode = {
            ...oldNode,
            isHidden: isHidden,
            hiddenReason: hiddenReason,
            mode: updatedMode,
            radius: newRadius,
            expanded: updatedMode === 'detail'
        };
        
        // Create a new nodes array with the updated node
        const updatedNodes = [...currentNodes];
        updatedNodes[nodeIndex] = updatedNode;
        
        // Update the simulation with the new nodes array
        this.simulation.nodes(updatedNodes);
        this.nodesStore.set(updatedNodes);
        
        console.log(`[GraphManager] Updated ${oldNode.type} node ${nodeId} visibility state successfully. New radius: ${updatedNode.radius}, mode: ${updatedNode.mode}`);
        
        // If layout strategy exists, let it handle the visibility change
        if (this.currentLayoutStrategy) {
            if (typeof (this.currentLayoutStrategy as any).handleNodeVisibilityChange === 'function') {
                (this.currentLayoutStrategy as any).handleNodeVisibilityChange(nodeId, isHidden);
            }
        }
        
        // Ensure fixed positions are maintained
        this.enforceFixedPositionsStrict();
        
        // Force multiple ticks to immediately update positions
        this.forceTick(5);
        
        // Restart simulation with low alpha for smooth transition
        this.simulation.alpha(0.3).restart();
        this.simulationActive = true;
    }
    
    // Add this method to GraphManager.ts
    public logNodeRadius(nodeId: string): void {
        // First check the internal model
        const currentNodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const node = currentNodes.find((n: EnhancedNode) => n.id === nodeId);
        
        if (!node) {
            console.log(`[GraphManager] Node ${nodeId} not found in simulation`);
            return;
        }
        
        // Log the internal node radius
        console.log(`[GraphManager] Internal node ${nodeId} (type: ${node.type}) radius: ${node.radius}`);
        
        // Then check the DOM if we're in browser environment
        if (typeof document !== 'undefined') {
            // Try to find the SVG node element
            const nodeElem = document.querySelector(`[data-node-id="${nodeId}"]`);
            if (nodeElem) {
                // Get radius attributes
                const dataRadius = nodeElem.getAttribute('data-node-radius');
                
                // Try to find circle elements within the node
                const circles = nodeElem.querySelectorAll('circle');
                const radii = Array.from(circles).map(circle => circle.getAttribute('r'));
                
                console.log(`[GraphManager] DOM node ${nodeId} data-radius: ${dataRadius}`);
                console.log(`[GraphManager] DOM node ${nodeId} circle radii:`, radii);
            } else {
                console.log(`[GraphManager] Node ${nodeId} not found in DOM`);
            }
        }
    }

   // Update the recalculateNodeVisibility method to include comment nodes
    public recalculateNodeVisibility(
        nodeId: string, 
        positiveVotes: number, 
        negativeVotes: number,
        userPreference?: boolean
    ): void {
        // Get current nodes
        const currentNodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const node = currentNodes.find((n: EnhancedNode) => n.id === nodeId);
        
        if (!node) {
            return;
        }
        
        // FIXED: Include comment nodes in visibility calculations
        if (node.type !== 'word' && node.type !== 'definition' && node.type !== 'statement' && node.type !== 'comment') {
            return;
        }
        
        let netVotes: number;
        let shouldBeHiddenByCommunity: boolean;
        
        // For statements, get vote data from the statementNetworkStore (single source of truth)
        if (node.type === 'statement') {
            const voteData = statementNetworkStore.getVoteData(nodeId);
            netVotes = voteData.netVotes;
            shouldBeHiddenByCommunity = voteData.shouldBeHidden;
        } else {
            // Calculate net votes for non-statement nodes (including comments)
            netVotes = positiveVotes - negativeVotes;
            // Determine if node should be hidden based on community standards
            shouldBeHiddenByCommunity = netVotes < 0;
        }
        
        // If user preference is provided, it overrides community visibility
        if (userPreference !== undefined) {
            // userPreference = true means "show", so !userPreference = "hide"
            const shouldBeHidden = !userPreference;
            
            // Only update if visibility state would change
            if (node.isHidden !== shouldBeHidden) {
                // CRITICAL: Add debug log for comment nodes
                if (node.type === 'comment') {
                    console.log(`[GraphManager] Updating comment node ${nodeId} visibility from ${node.isHidden} to ${shouldBeHidden} by user preference`);
                }
                
                // Update node visibility with 'user' as the reason
                this.updateNodeVisibility(nodeId, shouldBeHidden, 'user');
            }
        } else {
            // If node has a user-defined visibility, don't override it
            if (node.hiddenReason === 'user') {
                return;
            }
            
            // Only update if visibility state would change
            if (node.isHidden !== shouldBeHiddenByCommunity) {
                // CRITICAL: Add debug log for comment nodes
                if (node.type === 'comment') {
                    console.log(`[GraphManager] Updating comment node ${nodeId} visibility from ${node.isHidden} to ${shouldBeHiddenByCommunity} by community standard`);
                }
                
                // Update node visibility with 'community' as the reason
                this.updateNodeVisibility(nodeId, shouldBeHiddenByCommunity, 'community');
            }
        }
    }
    // Method to apply all visibility preferences
    public applyVisibilityPreferences(preferences: Record<string, boolean>): void {
        if (Object.keys(preferences).length === 0) {
          return;
        }
        
        // Get current nodes
        const currentNodes = this.simulation.nodes() as unknown as EnhancedNode[];
        if (!currentNodes || currentNodes.length === 0) {
          return;
        }
        
        // Track if any changes were made
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
          // Update simulation nodes
          this.simulation.nodes(updatedNodes);
          
          // Update store
          this.nodesStore.set(updatedNodes);
          
          // Let the layout strategy handle visibility preferences
          if (this.currentLayoutStrategy && typeof (this.currentLayoutStrategy as any).applyVisibilityPreferences === 'function') {
            (this.currentLayoutStrategy as any).applyVisibilityPreferences(preferences);
          }
          
          // Ensure fixed positions are maintained
          this.enforceFixedPositionsStrict();
          
          // Force simulation ticks to immediately update positions
          this.forceTick(5);
          
          // Minimal simulation restart
          this.simulation.alpha(0.1).restart();
          this.simulationActive = true;
        }
    }

    public updateViewType(viewType: ViewType): void {
        if (this._viewType === viewType) return;
        
        this._viewType = viewType;
        
        // Apply new layout strategy
        this.applyLayoutStrategy();
        
        // Ensure fixed positions are maintained
        this.enforceFixedPositionsStrict();
        
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

    public forceTick(ticks: number = 1): void {
        // Stop any current animation
        this.simulation.alpha(0).alphaTarget(0);
        
        for (let i = 0; i < ticks; i++) {
            // Before each tick, ensure fixed positions
            this.enforceFixedPositionsStrict();
            
            // Tick the simulation
            this.simulation.tick();
            
            // After each tick, enforce positions again
            this.enforceFixedPositionsStrict();
        }
        
        // Update the store after manual ticks
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        this.nodesStore.set([...nodes]);
    }

    public enforceFixedPositionsStrict(): void {
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        
        // Force fixed nodes to stay at their assigned positions
        nodes.forEach(node => {
            if (node.fixed || node.group === 'central') {
                // CRITICAL: Set ALL position properties for central nodes
                node.x = 0;
                node.y = 0;
                node.fx = 0;
                node.fy = 0;
                // Ensure zero velocity
                node.vx = 0;
                node.vy = 0;
                
                // Flag as fixed to be extra sure
                node.fixed = true;
                if (node.metadata) {
                    node.metadata.fixed = true;
                }
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
            } else if (node.mode === 'detail' && !node.isHidden) {
                // Detail mode nodes should also be fixed
                if (node.fx === undefined || node.fy === undefined) {
                    node.fx = node.x;
                    node.fy = node.y;
                } else {
                    node.x = node.fx;
                    node.y = node.fy;
                }
                node.vx = 0;
                node.vy = 0;
            }
        });
        
        // Force zero alpha to prevent unwanted movement
        this.simulation.alpha(0).alphaTarget(0);
        
        // Update the store to reflect these fixed positions
        this.nodesStore.set([...nodes]);
    }

    public fixNodePositions(): void {
        this.enforceFixedPositionsStrict();
    }

    private startSimulation(): void {
        if (this.simulationActive) return;
        
        // Use lower alpha for statement network view
        const alpha = this._viewType === 'statement-network' ? 0.3 : 1;
        this.simulation.alpha(alpha).restart();
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
                
                // For detail mode nodes, maintain fixed positions if set
                if (node.mode === 'detail' && node.fx !== undefined && node.fy !== undefined) {
                    node.x = node.fx;
                    node.y = node.fy;
                    node.vx = 0;
                    node.vy = 0;
                }
            });
            
            // Update the store to trigger rerenders
            this.nodesStore.set([...nodes]);
        });
        
        return simulation;
    }

    //  applyLayoutStrategy method
    private applyLayoutStrategy(): void {
        // Add this at the start of the method
        console.log('[LAYOUT_DEBUG] Applying layout strategy for view type:', this._viewType);
        console.log('[LAYOUT_DEBUG] Current layoutStrategy type:', 
                    this.currentLayoutStrategy ? this.currentLayoutStrategy.constructor.name : 'none');
        
        // Stop current layout strategy if exists
        if (this.currentLayoutStrategy) {
            this.currentLayoutStrategy.stop();
            console.log('[LAYOUT_DEBUG] Stopped previous layout strategy');
        }
        
        // Select appropriate layout strategy
        if (this._viewType === 'statement-network') {
            console.log('[LAYOUT_DEBUG] Creating StatementNetworkLayout');
            this.currentLayoutStrategy = new StatementNetworkLayout(
                COORDINATE_SPACE.WORLD.WIDTH,
                COORDINATE_SPACE.WORLD.HEIGHT,
                this._viewType
            );
            
            // Apply extra strictness for statement network
            this.simulation.force('charge', null);
            this.simulation.force('collision', null);
            this.simulation.force('center', null);
            this.simulation.velocityDecay(0.8); // Higher value to dampen movement
            
            // Add a tick handler specifically for statement network view
            this.simulation.on('tick.fixedPosition', () => {
                this.enforceFixedPositionsStrict();
            });
        }
        else if (this._viewType === 'discussion') {
            // Add debug to verify this is executed
            console.log('[LAYOUT_DEBUG] Initializing DiscussionLayout');
            
            try {
                // Check if DiscussionLayout is available
                if (typeof DiscussionLayout === 'undefined') {
                    console.error('[LAYOUT_DEBUG] Error: DiscussionLayout class is not defined');
                } else {
                    console.log('[LAYOUT_DEBUG] DiscussionLayout class is available');
                }
                
                // Create the discussion layout
                this.currentLayoutStrategy = new DiscussionLayout(
                    COORDINATE_SPACE.WORLD.WIDTH,
                    COORDINATE_SPACE.WORLD.HEIGHT,
                    this._viewType
                );
                
                // Configure discussion-specific forces
                this.configureDiscussionForces();
                
                // Verify layout was created
                console.log('[LAYOUT_DEBUG] DiscussionLayout created:', 
                        !!this.currentLayoutStrategy,
                        'Type:', this.currentLayoutStrategy?.constructor.name);
            } catch (error) {
                console.error('[LAYOUT_DEBUG] Error creating DiscussionLayout:', error);
            }
        }
        else if (this._viewType === 'openquestion') {
            // OpenQuestion Answer Layout
            console.log('[LAYOUT_DEBUG] Creating OpenQuestionAnswerLayout');
            this.currentLayoutStrategy = new OpenQuestionAnswerLayout(
                COORDINATE_SPACE.WORLD.WIDTH,
                COORDINATE_SPACE.WORLD.HEIGHT,
                this._viewType
            );
        }
        else if (this._viewType === 'dashboard' || 
            this._viewType === 'edit-profile' || 
            this._viewType === 'create-node' ||
            this._viewType === 'statement' ||
            this._viewType === 'quantity') {
            // Single central node views - including statement and quantity views
            console.log('[LAYOUT_DEBUG] Creating SingleNodeLayout');
            this.currentLayoutStrategy = new SingleNodeLayout(
                COORDINATE_SPACE.WORLD.WIDTH,
                COORDINATE_SPACE.WORLD.HEIGHT,
                this._viewType
            );
        } 
        else if (this._viewType === 'word') {
            // Word definition view
            console.log('[LAYOUT_DEBUG] Creating WordDefinitionLayout');
            this.currentLayoutStrategy = new WordDefinitionLayout(
                COORDINATE_SPACE.WORLD.WIDTH,
                COORDINATE_SPACE.WORLD.HEIGHT,
                this._viewType
            );
        }
        else {
            // Default to SingleNodeLayout for any other view
            console.log('[LAYOUT_DEBUG] Creating default SingleNodeLayout for unknown view type:', this._viewType);
            this.currentLayoutStrategy = new SingleNodeLayout(
                COORDINATE_SPACE.WORLD.WIDTH,
                COORDINATE_SPACE.WORLD.HEIGHT,
                this._viewType
            );
        }
        
        // Apply the selected strategy
        if (this.currentLayoutStrategy) {
            console.log('[LAYOUT_DEBUG] Applying layout strategy:', this.currentLayoutStrategy.constructor.name);
            
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
            
            // Call enforceFixedPositionsStrict to ensure fixed positions
            this.enforceFixedPositionsStrict();
            
            console.log('[LAYOUT_DEBUG] Layout strategy application complete');
        } else {
            console.error('[LAYOUT_DEBUG] Failed to create layout strategy for view type:', this._viewType);
        }
        
        // Add at the end to verify final layout type
        console.log('[LAYOUT_DEBUG] Final layout strategy:', 
                    this.currentLayoutStrategy ? this.currentLayoutStrategy.constructor.name : 'none');
    }

    /**
     * Configure discussion-specific forces
     * This is critical for proper hierarchical comments
     */
    public configureDiscussionForces(): void {
        console.log('[COMMENT_HIERARCHY_GRAPHMANAGER] Configuring discussion-specific forces');
        
        // Clear any existing tick handlers that might interfere
        this.simulation.on('tick.fixedPosition', null);
        
        // Add our specialized tick handler for discussions
        this.simulation.on('tick.discussionLayout', () => {
            const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
            
            // Create a map for fast node lookups
            const nodeMap = new Map<string, EnhancedNode>();
            nodes.forEach(node => nodeMap.set(node.id, node));
            
            // Process each node individually based on its type and relationships
            nodes.forEach(node => {
                if (node.fixed || node.group === 'central') {
                    // Central node always at origin
                    node.x = 0;
                    node.y = 0;
                    node.fx = 0;
                    node.fy = 0;
                    node.vx = 0;
                    node.vy = 0;
                } 
                else if (node.type === 'navigation') {
                    // Navigation nodes stay at their fixed positions
                    if (node.fx !== undefined) node.x = node.fx;
                    if (node.fy !== undefined) node.y = node.fy;
                    node.vx = 0;
                    node.vy = 0;
                }
                else if (node.type === 'comment' && node.metadata?.parentCommentId) {
                    // For reply comments, ensure they stay reasonably close to their parent
                    const parentId = node.metadata.parentCommentId;
                    const parentNode = nodeMap.get(parentId);
                    
                    if (parentNode && !node.fixed) {
                        // Get current vector from parent to child
                        const dx = (node.x ?? 0) - (parentNode.x ?? 0);
                        const dy = (node.y ?? 0) - (parentNode.y ?? 0);
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        // Calculate ideal distance based on node radii
                        const idealDistance = parentNode.radius + node.radius + 50;
                        
                        // If too far or too close, adjust position
                        if (Math.abs(distance - idealDistance) > 20) {
                            // Create unit vector
                            const ux = dx / distance;
                            const uy = dy / distance;
                            
                            // Move node to ideal distance along same direction (with partial adjustment)
                            const adjustmentFactor = 0.2; // 20% adjustment per tick for smoothness
                            node.x = (parentNode.x ?? 0) + ux * (idealDistance * adjustmentFactor + distance * (1 - adjustmentFactor));
                            node.y = (parentNode.y ?? 0) + uy * (idealDistance * adjustmentFactor + distance * (1 - adjustmentFactor));
                            
                            // Set a small velocity to stabilize
                            node.vx = 0;
                            node.vy = 0;
                        }
                    }
                }
            });
        });
        
        // Adjust simulation parameters for discussion view
        this.simulation.velocityDecay(0.5); // Moderate velocity decay
        
        // Add strong collision force to prevent overlap
        this.simulation.force('collision', d3.forceCollide()
            .radius((node: any) => (node as EnhancedNode).radius * 1.5) // 50% buffer around nodes
            .strength(0.8)
            .iterations(3)
        );
        
        // Add a gentle charge force
        this.simulation.force('charge', d3.forceManyBody()
            .strength((node: any) => {
                // Different charge forces based on node type
                const n = node as EnhancedNode;
                if (n.type === 'comment') {
                    return n.metadata?.parentCommentId ? -150 : -200; // Stronger for root comments
                }
                return -50; // Default charge
            })
            .distanceMax(500) // Limit the distance of effect
        );
        
        // Use specialized link force for discussion
        this.simulation.force('link', d3.forceLink()
            .id((d: any) => (d as EnhancedNode).id)
            .strength((l: any) => {
                const link = l as EnhancedLink;
                // Customize strength based on link type
                if (link.type === 'comment') {
                    return 0.5; // Root comments to central node
                } else if (link.type === 'reply') {
                    return 0.7; // Replies to parent comments (stronger)
                } else if (link.type === 'comment-form' || link.type === 'reply-form') {
                    return 0.9; // Form connections (strongest)
                }
                return link.strength || 0.3; // Default
            })
            .distance((l: any) => {
                const link = l as EnhancedLink;
                
                // Try to get source and target nodes
                const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
                const targetId = typeof link.target === 'string' ? link.target : link.target.id;
                
                const sourceNode = this.simulation.nodes().find((n: any) => 
                    (n as EnhancedNode).id === sourceId
                ) as EnhancedNode;
                
                const targetNode = this.simulation.nodes().find((n: any) => 
                    (n as EnhancedNode).id === targetId
                ) as EnhancedNode;
                
                if (!sourceNode || !targetNode) return 100; // Default distance
                
                // Calculate distance based on node radii plus padding
                return sourceNode.radius + targetNode.radius + 50;
            })
        );
    }

    private transformNodes(nodes: GraphNode[]): EnhancedNode[] {
        // Reuse existing enhanced nodes when possible
        const enhancedNodeCache = new Map<string, EnhancedNode>();
        
        // If we have existing nodes in the simulation, cache them by ID
        const existingNodes = this.simulation?.nodes() as unknown as EnhancedNode[] || [];
        existingNodes.forEach(node => {
            enhancedNodeCache.set(node.id, node);
        });
        
        return nodes.map(node => {
            if (node.type === 'statement-answer-form') {
                console.log('[GraphManager] Processing statement-answer-form node:', {
                    id: node.id,
                    type: node.type,
                    group: node.group
                });
            }
            // Check if we already have this node
            const existing = enhancedNodeCache.get(node.id);
            if (existing && existing.type === node.type) {
                // Update only necessary properties
                existing.data = node.data;
                
                // CRITICAL FIX: For comment nodes, ensure visibility and radius are properly handled
                if (existing.type === 'comment' || existing.type === 'comment-form') {
                    // Get visibility state either from node input or calculate it
                    let isHidden = false;
                    
                    // If node has explicit isHidden property, use it
                    if ('isHidden' in node) {
                        isHidden = typeof node.isHidden === 'boolean' ? node.isHidden : false;
                    } 
                    // Otherwise, determine from votes for comments
                    else if (existing.type === 'comment') {
                        const netVotes = this.getNodeVotes(node);
                        // If user has set a preference, respect it
                        if (existing.hiddenReason === 'user') {
                            isHidden = existing.isHidden || false;
                        } 
                        // Otherwise use community standard
                        else {
                            isHidden = netVotes < 0;
                        }
                    }
                    
                    // Ensure mode is set (always 'preview' for comments)
                    existing.mode = 'preview';
                    
                    // Update node visibility property
                    existing.isHidden = isHidden;
                    
                    // Clear cache to ensure fresh calculation
                    this.nodeVotesCache.delete(node.id);
                    for (const key of Array.from(this.nodeRadiusCache.keys())) {
                        if (key.startsWith(`${node.id}-`)) {
                            this.nodeRadiusCache.delete(key);
                        }
                    }
                    
                    // CRITICAL: Set radius based on new visibility state
                    const newRadius = isHidden ? 
                        COORDINATE_SPACE.NODES.SIZES.HIDDEN / 2 : 
                        COORDINATE_SPACE.NODES.SIZES.COMMENT.PREVIEW / 2;
                        
                    // Force update the radius
                    existing.radius = newRadius;
                    
                    console.log(`[GraphManager:transformNodes] Updated existing ${existing.type} node ${node.id} radius: ${existing.radius} (hidden: ${isHidden})`);
                } 
                // For other node types, handle normally
                else {
                    // Ensure mode is updated if provided, otherwise preserve existing mode
                    if (node.mode) {
                        existing.mode = node.mode;
                    }
                    
                    // Clear cached values to ensure fresh calculation
                    this.nodeVotesCache.delete(node.id);
                    this.nodeRadiusCache.delete(node.id);
                }
                
                return existing;
            }
            
            // Get net votes for this node
            const netVotes = this.getNodeVotes(node);
            
            // Determine if node should be hidden based on community standard
            const isHidden = (node.type === 'word' || node.type === 'definition' || node.type === 'statement' || node.type === 'comment') && 
                netVotes < 0;
            
            // CRITICAL FIX: Different handling for comment nodes vs. other nodes
            let nodeRadius: number;
            let nodeMode: NodeMode | undefined;
            
            if (node.type === 'comment' || node.type === 'comment-form') {
                // Comments always use preview mode
                nodeMode = 'preview';
                
                // Set radius directly based on visibility
                nodeRadius = isHidden ? 
                    COORDINATE_SPACE.NODES.SIZES.HIDDEN / 2 : 
                    COORDINATE_SPACE.NODES.SIZES.COMMENT.PREVIEW / 2;
                    
                console.log(`[GraphManager:transformNodes] Created new ${node.type} node ${node.id} with radius: ${nodeRadius} (hidden: ${isHidden})`);
            } else {
                // For other node types, use normal mode handling
                // IMPORTANT: Default central nodes to detail mode
                if (node.group === 'central' && !node.mode) {
                    nodeMode = 'detail';
                    console.log(`[GraphManager:transformNodes] Defaulting central node ${node.id} to detail mode`);
                } else {
                    nodeMode = node.mode || undefined;
                }
                
                // Calculate radius through the standard method
                nodeRadius = this.getNodeRadius({
                    ...node,
                    mode: nodeMode,
                    isHidden: isHidden
                });
            }
            
            const enhancedNode: EnhancedNode = {
                id: node.id,
                type: node.type,
                data: node.data,
                group: node.group,
                mode: nodeMode,
                radius: nodeRadius, // Use pre-calculated radius
                fixed: node.group === 'central',
                expanded: nodeMode === 'detail',
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
                    isDetail: nodeMode === 'detail',
                    votes: node.type === 'definition' || node.type === 'statement' || node.type === 'comment' ? 
                        netVotes : undefined,
                    createdAt: 'createdAt' in node.data ? 
                        (node.data.createdAt instanceof Date ? 
                            node.data.createdAt.toISOString() : 
                            typeof node.data.createdAt === 'string' ? 
                                node.data.createdAt : 
                                undefined) : 
                            undefined,
                    parentCommentId: node.type === 'comment' && 'parentCommentId' in node.data ? 
                        (node.data as any).parentCommentId : 
                        node.metadata?.parentCommentId
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
        // Log incoming links for debugging comment hierarchy
        console.log('[COMMENT_HIERARCHY_GRAPHMANAGER] Transforming links:', 
            links.map(link => ({
                id: link.id,
                source: typeof link.source === 'string' ? link.source : link.source.id,
                target: typeof link.target === 'string' ? link.target : link.target.id,
                type: link.type,
                metadata: link.metadata
            }))
        );
        
        return links.map(link => {
            // Ensure proper handling of source/target which might be objects or strings
            const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
            const targetId = typeof link.target === 'string' ? link.target : link.target.id;
            
            // Determine relationship type and strength
            let relationshipType: 'direct' | 'keyword' = 'keyword';
            let strength = 0.3;
            
            // CRITICAL FIX: Adjust link strengths based on link type to maintain proper hierarchical structure
            if (link.type === 'related') {
                relationshipType = 'direct';
                strength = 0.7; // Stronger connections for direct relationships
            } else if (link.type === 'live') {
                strength = 0.7;
            } else if (link.type === 'comment') {
                // Root comments to central node - moderate strength
                strength = 0.5;
                relationshipType = 'direct';
            } else if (link.type === 'reply') {
                // Replies to parent comments - stronger to keep them close to parent
                strength = 0.7;
                relationshipType = 'direct';
                console.log(`[COMMENT_HIERARCHY_GRAPHMANAGER] Processing reply link: ${sourceId} -> ${targetId}`);
            } else if (link.type === 'comment-form' || link.type === 'reply-form') {
                // Form connections - strongest to keep forms right next to their targets
                strength = 0.9;
                relationshipType = 'direct';
            }
            
            // Preserve explicit link type in the metadata
            const linkMetadata = {
                ...(link.metadata || {}), // Keep existing metadata
                linkType: link.type,      // Add the link type for debugging
                sourceId,                 // Track the source ID
                targetId                  // Track the target ID
            };
            
            // Create enhanced link with the improved properties
            const enhancedLink: EnhancedLink = {
                id: link.id || `${sourceId}-${targetId}`, // Use provided ID or generate one
                source: sourceId, // Keep as string to prevent d3 from modifying it
                target: targetId, // Keep as string to prevent d3 from modifying it
                type: link.type,
                relationshipType: relationshipType,
                strength: strength,
                // Use the enhanced metadata
                metadata: linkMetadata
            };
            
            return enhancedLink;
        });
    }

    private createRenderableNodes(nodes: EnhancedNode[]): RenderableNode[] {
        return nodes.map(node => {
            // Use the current node.radius directly
            const radius = node.radius;
            
            // Calculate baseSize - the diameter
            const baseSize = radius;
            
            // CRITICAL FIX: For comment nodes, use the same size for preview and detail modes
            // This prevents the 2x scaling that causes the issue with comment nodes
            const detailSize = node.type === 'comment' || node.type === 'comment-form' 
                ? baseSize  // Same size for both modes (prevents 2x scaling)
                : baseSize;  // Default behavior for other node types
                
            // Simple position calculation with null checking
            const x = node.x ?? 0;
            const y = node.y ?? 0;
            
            // Create SVG transform string using coordinateSystem helper
            const svgTransform = coordinateSystem.createSVGTransform(x, y);
            
            // Get node color for highlighting
            const nodeColor = this.getNodeColor(node);
            
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
                    svgTransform
                },
                metadata: node.metadata,
                style: {
                    previewSize: baseSize,
                    detailSize: detailSize, // Use the fixed detailSize for comments
                    colors: {
                        background: this.getNodeBackground(node),
                        border: this.getNodeBorder(node),
                        text: COLORS.UI.TEXT.PRIMARY,
                        hover: this.getNodeHover(node),
                        gradient: {
                            start: this.getNodeGradientStart(node),
                            end: this.getNodeGradientEnd(node)
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
                    highlightColor: nodeColor
                }
            };
        });
    }

    private createRenderableLinks(nodes: EnhancedNode[], links: EnhancedLink[]): RenderableLink[] {
        // Skip link calculation entirely if we have no nodes or links
        if (nodes.length === 0 || links.length === 0) {
            return [];
        }
        
        // Create a node lookup map for faster access
        const nodeMap = new Map<string, EnhancedNode>();
        nodes.forEach(node => {
            nodeMap.set(node.id, node);
        });
        
        // Log links for debugging
        console.log('[COMMENT_HIERARCHY_GRAPHMANAGER] Creating renderable links from', links.length, 'links');
        
        return links.map(link => {
            const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
            const targetId = typeof link.target === 'string' ? link.target : link.target.id;
            
            // Look up nodes in our map
            const source = nodeMap.get(sourceId);
            const target = nodeMap.get(targetId);
            
            if (!source || !target) {
                console.warn(`[COMMENT_HIERARCHY_GRAPHMANAGER] Missing node for link: ${sourceId} -> ${targetId}`);
                return null;
            }
            
            // Skip calculation if either node is hidden
            if (source.isHidden || target.isHidden) {
                return null;
            }
            
            // Calculate link path
            const path = this.calculateLinkPath(source, target);
            
            // Create SVG transform strings for source and target positions
            const sourceTransform = coordinateSystem.createSVGTransform(source.x ?? 0, source.y ?? 0);
            const targetTransform = coordinateSystem.createSVGTransform(target.x ?? 0, target.y ?? 0);
            
            // Determine strength based on link type
            let strength = link.strength || 0.3;
            
            // Adjust strength for comment links
            if (link.type === 'comment') {
                strength = 0.5; // Root comments to central node
            } else if (link.type === 'reply') {
                strength = 0.7; // Replies to parent comments (stronger)
            } else if (link.type === 'comment-form' || link.type === 'reply-form') {
                strength = 0.9; // Form connections (strongest)
            }
            
            // CRITICAL: Preserve the existing metadata for statement relations
            // This ensures we don't lose relationCount or sharedWords
            const metadata = link.type === 'related' ? {
                // Use the existing metadata values directly
                sharedWords: link.metadata?.sharedWords || [],
                relationCount: link.metadata?.relationCount || 1,
                // Keep any other metadata properties
                ...link.metadata
            } : link.metadata;
            
            // Create the renderable link with improved metadata
            const renderableLink: RenderableLink = {
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
                    svgTransform: sourceTransform
                },
                targetPosition: { 
                    x: target.x ?? 0, 
                    y: target.y ?? 0,
                    svgTransform: targetTransform
                },
                strength,
                relationshipType: link.relationshipType,
                // Use the preserved metadata
                metadata
            };
            
            return renderableLink;
        }).filter(Boolean) as RenderableLink[];
    }

    private getNodeRadius(node: GraphNode | EnhancedNode): number {
        // Generate a cache key based on node properties that affect radius
        const cacheKey = `${node.id}-${node.type}-${node.mode || 'preview'}-${('isHidden' in node && node.isHidden) ? 'hidden' : 'visible'}`;
        
        // Use cached value if available
        if (this.nodeRadiusCache.has(cacheKey)) {
            return this.nodeRadiusCache.get(cacheKey) || 0;
        }
        
        // First check if node is hidden - hidden nodes have the smallest radius
        if ('isHidden' in node && node.isHidden) {
            const radius = COORDINATE_SPACE.NODES.SIZES.HIDDEN / 2;
            this.nodeRadiusCache.set(cacheKey, radius);
            return radius;
        }
        
        // If not hidden, calculate based on type and mode
        let radius = 0;
        switch(node.type) {
            case 'word':
                radius = node.mode === 'detail' ? 
                    COORDINATE_SPACE.NODES.SIZES.WORD.DETAIL / 2 : 
                    COORDINATE_SPACE.NODES.SIZES.WORD.PREVIEW / 2;
                break;
                    
            case 'definition':
                radius = node.mode === 'detail' ?
                    COORDINATE_SPACE.NODES.SIZES.DEFINITION.DETAIL / 2 :
                    COORDINATE_SPACE.NODES.SIZES.DEFINITION.PREVIEW / 2;
                break;
                    
            case 'statement':
                radius = node.mode === 'detail' ?
                    COORDINATE_SPACE.NODES.SIZES.STATEMENT.DETAIL / 2 :
                    COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW / 2;
                break;
                
            case 'openquestion':
                radius = node.mode === 'detail' ?
                    COORDINATE_SPACE.NODES.SIZES.OPENQUESTION.DETAIL / 2 :
                    COORDINATE_SPACE.NODES.SIZES.OPENQUESTION.PREVIEW / 2;
                break;
            
            case 'quantity':
                radius = node.mode === 'detail' ?
                    COORDINATE_SPACE.NODES.SIZES.QUANTITY.DETAIL / 2 :
                    COORDINATE_SPACE.NODES.SIZES.QUANTITY.PREVIEW / 2;
                break;
                
            case 'comment':
                radius = node.mode === 'detail' ?
                    COORDINATE_SPACE.NODES.SIZES.COMMENT.DETAIL / 2 :
                    COORDINATE_SPACE.NODES.SIZES.COMMENT.PREVIEW / 2;
                break;
                
            case 'comment-form':
                // Comment forms also follow the pattern
                radius = node.mode === 'detail' ?
                    COORDINATE_SPACE.NODES.SIZES.COMMENT.DETAIL / 2 :
                    COORDINATE_SPACE.NODES.SIZES.COMMENT.PREVIEW / 2;
                break;
                    
            case 'navigation':
                radius = COORDINATE_SPACE.NODES.SIZES.NAVIGATION / 2;
                break;
                    
            case 'dashboard':
                // Special case for the control node/dashboard view
                if (node.data && 'sub' in node.data && node.data.sub === 'controls') {
                    radius = node.mode === 'detail' ?
                        COORDINATE_SPACE.NODES.SIZES.CONTROL.DETAIL / 2 :
                        COORDINATE_SPACE.NODES.SIZES.CONTROL.PREVIEW / 2;
                } else {
                    radius = COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL / 2;
                }
                break;
                    
            case 'edit-profile':
            case 'create-node':
                radius = COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL / 2;
                break;
                    
            default:
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

    private getNodeVotes(node: GraphNode): number {
        // Use cached value if available
        if (this.nodeVotesCache.has(node.id)) {
            return this.nodeVotesCache.get(node.id) || 0;
        }
        
        let netVotes = 0;
        
        // For statement nodes, use the statementNetworkStore as single source of truth
        if (node.type === 'statement') {
            try {
                const voteData = statementNetworkStore.getVoteData(node.id);
                netVotes = voteData.netVotes;
            } catch (error) {
                const statement = node.data as { positiveVotes?: number | any; negativeVotes?: number | any };
                const posVotes = getNeo4jNumber(statement.positiveVotes);
                const negVotes = getNeo4jNumber(statement.negativeVotes);
                netVotes = posVotes - negVotes;
            }
        }
        // For comment nodes, calculate votes from comment data
        else if (node.type === 'comment' && 'data' in node) {
            const comment = node.data as { positiveVotes?: number | any; negativeVotes?: number | any };
            const posVotes = getNeo4jNumber(comment.positiveVotes);
            const negVotes = getNeo4jNumber(comment.negativeVotes);
            netVotes = posVotes - negVotes;
        }
        else if (node.type === 'definition' && 'data' in node) {
            const def = node.data as { positiveVotes?: number | any; negativeVotes?: number | any };
            const posVotes = getNeo4jNumber(def.positiveVotes);
            const negVotes = getNeo4jNumber(def.negativeVotes);
            netVotes = posVotes - negVotes;
        }
        else if (node.type === 'word' && 'data' in node) {
            const word = node.data as { positiveVotes?: number | any; negativeVotes?: number | any };
            const posVotes = getNeo4jNumber(word.positiveVotes);
            const negVotes = getNeo4jNumber(word.negativeVotes);
            netVotes = posVotes - negVotes;
        }
        
        // Cache the result
        this.nodeVotesCache.set(node.id, netVotes);
        return netVotes;
    }

    /**
     * Get the primary color for a node
     * UPDATED to use NODE_CONSTANTS instead of direct color references
     */
    private getNodeColor(node: EnhancedNode): string {
        switch (node.type) {
            case 'word':
                return this.extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.WORD);
            case 'definition':
                return node.subtype === 'live' ? 
                    this.extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.DEFINITION.live) : 
                    this.extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.DEFINITION.alternative);
            case 'statement':
                return this.extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.STATEMENT);
            case 'openquestion':
                return this.extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.OPENQUESTION);
            case 'quantity':
                return this.extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.QUANTITY);
            case 'comment':
                return this.extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.COMMENT);
            case 'comment-form':
                return this.extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.COMMENT);
            case 'navigation':
                return 'transparent';
            case 'dashboard':
            case 'edit-profile':
            case 'create-node':
                return COLORS.UI.TEXT.PRIMARY;
            default:
                return COLORS.UI.TEXT.PRIMARY;
        }
    }

    /**
     * Extract the base color from a node style definition
     */
    private extractBaseColorFromStyle(style: any): string {
        // If the style has a border property, use it (removing any alpha channel)
        if (style.border) {
            return style.border.substring(0, 7); // Extract the hex color without alpha
        }
        return COLORS.UI.TEXT.PRIMARY; // Default to white
    }

    /**
     * Get node background color
     * UPDATED to use NODE_CONSTANTS instead of hardcoded color references
     */
    private getNodeBackground(node: EnhancedNode): string {
        switch (node.type) {
            case 'word':
                return NODE_CONSTANTS.COLORS.WORD.background;
            case 'definition':
                return node.subtype === 'live' ? 
                    NODE_CONSTANTS.COLORS.DEFINITION.live.background : 
                    NODE_CONSTANTS.COLORS.DEFINITION.alternative.background;
            case 'statement':
                return NODE_CONSTANTS.COLORS.STATEMENT.background;
            case 'openquestion':
                return NODE_CONSTANTS.COLORS.OPENQUESTION.background;
            case 'quantity':
                return NODE_CONSTANTS.COLORS.QUANTITY.background;
            case 'comment':
                return NODE_CONSTANTS.COLORS.COMMENT.background;
            case 'comment-form':
                return NODE_CONSTANTS.COLORS.COMMENT.background;
            case 'dashboard':
                return NODE_CONSTANTS.COLORS.DASHBOARD.background;
            default:
                return 'rgba(0, 0, 0, 0.5)';
        }
    }

    /**
     * Get node border color
     * UPDATED to use NODE_CONSTANTS instead of hardcoded color references
     */
    private getNodeBorder(node: EnhancedNode): string {
        switch (node.type) {
            case 'word':
                return NODE_CONSTANTS.COLORS.WORD.border;
            case 'definition':
                return node.subtype === 'live' ? 
                    NODE_CONSTANTS.COLORS.DEFINITION.live.border : 
                    NODE_CONSTANTS.COLORS.DEFINITION.alternative.border;
            case 'statement':
                return NODE_CONSTANTS.COLORS.STATEMENT.border;
            case 'openquestion':
                return NODE_CONSTANTS.COLORS.OPENQUESTION.border;
            case 'quantity':
                return NODE_CONSTANTS.COLORS.QUANTITY.border;
            case 'comment':
                return NODE_CONSTANTS.COLORS.COMMENT.border;
            case 'comment-form':
                return NODE_CONSTANTS.COLORS.COMMENT.border;
            case 'dashboard':
                return NODE_CONSTANTS.COLORS.DASHBOARD.border;
            default:
                return 'rgba(255, 255, 255, 1)';
        }
    }

    /**
     * Get node hover color
     * UPDATED to use NODE_CONSTANTS instead of hardcoded color references
     */
    private getNodeHover(node: EnhancedNode): string {
        switch (node.type) {
            case 'word':
                return NODE_CONSTANTS.COLORS.WORD.hover;
            case 'definition':
                return node.subtype === 'live' ? 
                    NODE_CONSTANTS.COLORS.DEFINITION.live.hover : 
                    NODE_CONSTANTS.COLORS.DEFINITION.alternative.hover;
            case 'statement':
                return NODE_CONSTANTS.COLORS.STATEMENT.hover;
            case 'openquestion':
                return NODE_CONSTANTS.COLORS.OPENQUESTION.hover;
            case 'quantity':
                return NODE_CONSTANTS.COLORS.QUANTITY.hover;
            case 'comment':
                return NODE_CONSTANTS.COLORS.COMMENT.hover;
            case 'comment-form':
                return NODE_CONSTANTS.COLORS.COMMENT.hover;
            case 'dashboard':
                return NODE_CONSTANTS.COLORS.DASHBOARD.hover;
            default:
                return 'rgba(255, 255, 255, 1)';
        }
    }

    /**
     * Get node gradient start color
     * UPDATED to use NODE_CONSTANTS instead of hardcoded color references
     */
    private getNodeGradientStart(node: EnhancedNode): string {
        switch (node.type) {
            case 'word':
                return NODE_CONSTANTS.COLORS.WORD.gradient.start;
            case 'definition':
                return node.subtype === 'live' ? 
                    NODE_CONSTANTS.COLORS.DEFINITION.live.gradient.start : 
                    NODE_CONSTANTS.COLORS.DEFINITION.alternative.gradient.start;
            case 'statement':
                return NODE_CONSTANTS.COLORS.STATEMENT.gradient.start;
            case 'openquestion':
                return NODE_CONSTANTS.COLORS.OPENQUESTION.gradient.start;
            case 'quantity':
                return NODE_CONSTANTS.COLORS.QUANTITY.gradient.start;
            case 'comment':
                return NODE_CONSTANTS.COLORS.COMMENT.gradient.start;
            case 'comment-form':
                return NODE_CONSTANTS.COLORS.COMMENT.gradient.start;
            case 'dashboard':
                return NODE_CONSTANTS.COLORS.DASHBOARD.gradient.start;
            default:
                return 'rgba(255, 255, 255, 0.4)';
        }
    }

    /**
     * Get node gradient end color
     * UPDATED to use NODE_CONSTANTS instead of hardcoded color references
     */
    private getNodeGradientEnd(node: EnhancedNode): string {
        switch (node.type) {
            case 'word':
                return NODE_CONSTANTS.COLORS.WORD.gradient.end;
            case 'definition':
                return node.subtype === 'live' ? 
                    NODE_CONSTANTS.COLORS.DEFINITION.live.gradient.end : 
                    NODE_CONSTANTS.COLORS.DEFINITION.alternative.gradient.end;
            case 'statement':
                return NODE_CONSTANTS.COLORS.STATEMENT.gradient.end;
            case 'openquestion':
                return NODE_CONSTANTS.COLORS.OPENQUESTION.gradient.end;
            case 'quantity':
                return NODE_CONSTANTS.COLORS.QUANTITY.gradient.end;
            case 'comment':
                return NODE_CONSTANTS.COLORS.COMMENT.gradient.end;
            case 'comment-form':
                return NODE_CONSTANTS.COLORS.COMMENT.gradient.end;
            case 'dashboard':
                return NODE_CONSTANTS.COLORS.DASHBOARD.gradient.end;
            default:
                return 'rgba(255, 255, 255, 0.2)';
        }
    }

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
        
        // UPDATED: Always use straight lines for all links including comment-to-comment links
        // Use the original simple calculation with straight lines for all link types
        const sourceRadius = source.radius * 0.95; // 95% of radius
        const targetRadius = target.radius * 0.95; // 95% of radius
        
        // Calculate points on perimeter
        const startX = sourceX + (unitX * sourceRadius);
        const startY = sourceY + (unitY * sourceRadius);
        const endX = targetX - (unitX * targetRadius);
        const endY = targetY - (unitY * targetRadius);
        
        // Create a straight line path
        return `M${startX},${startY}L${endX},${endY}`;
    }
}