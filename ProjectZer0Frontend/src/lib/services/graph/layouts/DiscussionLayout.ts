// src/lib/services/graph/layouts/DiscussionLayout.ts
import * as d3 from 'd3';
import { BaseLayoutStrategy } from './BaseLayoutStrategy';
import { NavigationNodeLayout } from './common/NavigationNodeLayout';
import type { EnhancedNode, EnhancedLink } from '../../../types/graph/enhanced';
import { asD3Nodes, asD3Links } from '../../../types/graph/enhanced';
import type { 
    GraphData, 
    ViewType, 
    NodeMode, 
    NodeType,
    GraphNode,
    GraphLink
} from '$lib/types/graph/enhanced';
import { COORDINATE_SPACE } from '../../../constants/graph';

/**
 * Layout strategy for discussion view showing comments
 * 
 * Features:
 * - Central node (word, definition, statement, quantity) fixed at the center (0,0)
 * - Navigation nodes in a circle around the central node
 * - Root comments positioned around the central node in a circle
 * - Reply comments positioned around their parent comments in a smaller circle
 * - Support for sorting by popularity, newest, oldest
 * - Support for hidden nodes with smaller size and adjusted positioning
 */
export class DiscussionLayout extends BaseLayoutStrategy {
    private readonly GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
    private readonly FIRST_COMMENT_ANGLE = Math.PI / 2; // Start at top
    private commentAngles: Map<string, number> = new Map();
    private expansionState: Map<string, boolean> = new Map();
    private expandedComments: Map<string, { ringIndex: number, adjustment: number }> = new Map();
    private hiddenNodes: Map<string, { ringIndex: number, adjustment: number }> = new Map();
    private parentChildMap: Map<string, string[]> = new Map();
    private commentRingIndices: Map<string, number> = new Map();
    
    // Separate lookup for comment nodes vs other types
    private nodeTypeMap: Map<string, NodeType> = new Map();

    constructor(width: number, height: number, viewType: ViewType) {
        super(width, height, viewType);
        console.debug('[DiscussionLayout] Initializing with dimensions:', {
            width: COORDINATE_SPACE.WORLD.WIDTH,
            height: COORDINATE_SPACE.WORLD.HEIGHT,
            viewType
        });
    }

    /**
     * Clear ALL forces from the simulation
     * This ensures no forces can affect node positions
     */
    private clearAllForces(): void {
        console.debug('[DiscussionLayout] Clearing all forces');
        
        // Get all force names
        const sim = this.simulation as any;
        
        // List all forces that might be present
        const potentialForceNames = [
            'charge', 'collision', 'link', 'center', 'x', 'y',
            'manyBody', 'radial', 'navigationRadial', 'navigationCharge',
            'navigationCollision', 'centralCharge', 'centralCollision',
            'positioning', 'custom'
        ];
        
        // Remove all forces
        potentialForceNames.forEach(name => {
            try {
                sim.force(name, null);
            } catch (e) {
                // Ignore errors
            }
        });
        
        // Check if there are still any forces left
        const remainingForces = Object.keys(sim._forces || {});
        if (remainingForces.length > 0) {
            console.warn('[DiscussionLayout] Some forces still remain:', remainingForces);
            
            // Try to remove these as well
            remainingForces.forEach(name => {
                try {
                    sim.force(name, null);
                } catch (e) {
                    console.warn(`[DiscussionLayout] Cannot remove force: ${name}`);
                }
            });
        }
    }

    /**
     * Set initial positions for all nodes
     */
    initializeNodePositions(nodes: EnhancedNode[]): void {
        console.debug('[DiscussionLayout] Initializing node positions', {
            nodeCount: nodes.length,
            nodeTypes: nodes.map(n => ({ id: n.id, type: n.type, subtype: n.subtype }))
        });

        // Stop simulation during initialization
        this.simulation.stop();
        
        // CRITICAL: Clear all forces before positioning nodes
        this.clearAllForces();

        // Reset maps
        this.nodeTypeMap.clear();
        this.commentRingIndices.clear();
        this.parentChildMap.clear();
        
        // Update expansion state tracking
        this.updateExpansionState(nodes);
        
        // Update hidden node tracking
        this.updateHiddenState(nodes);
        
        // Build lookup maps for node types and parent-child relationships
        this.buildNodeMaps(nodes);

        // Reset velocities but preserve existing positions
        nodes.forEach(node => {
            node.vx = 0;
            node.vy = 0;

            // Clear fixed positions for non-central nodes
            if (!node.fixed && node.group !== 'central') {
                node.fx = undefined;
                node.fy = undefined;
            }
            
            // Store node type for quick lookup
            this.nodeTypeMap.set(node.id, node.type);
        });

        // Position navigation nodes using NavigationNodeLayout
        NavigationNodeLayout.positionNavigationNodes(
            nodes, 
            this.getNodeRadius.bind(this)
        );

        // Find and position central node
        const centralNode = nodes.find(n => n.fixed || n.group === 'central');
        if (!centralNode) {
            console.warn('[DiscussionLayout] No central node found');
            return;
        }

        // Center the central node with EXPLICIT POSITION FIXING
        centralNode.fx = 0;
        centralNode.fy = 0;
        centralNode.x = 0;
        centralNode.y = 0;
        centralNode.vx = 0;
        centralNode.vy = 0;
        centralNode.fixed = true; // Ensure fixed flag is set
        
        // Ensure metadata reflects this
        if (centralNode.metadata) {
            centralNode.metadata.fixed = true;
        }

        console.debug('[DiscussionLayout] Central node positioned at center with fixed constraints', {
            id: centralNode.id,
            position: { x: centralNode.x, y: centralNode.y },
            fixed: { fx: centralNode.fx, fy: centralNode.fy },
            velocity: { vx: centralNode.vx, vy: centralNode.vy }
        });
        
        // Calculate position for the "New Comment" form if present
        const commentFormNode = nodes.find(n => n.type === 'comment-form' && !n.metadata?.parentCommentId);
        if (commentFormNode) {
            // Position the comment form at the bottom of the layout
            commentFormNode.x = 0;
            commentFormNode.y = 300; // Position below central node
            console.debug('[DiscussionLayout] Positioned comment form node', {
                id: commentFormNode.id,
                position: { x: commentFormNode.x, y: commentFormNode.y }
            });
        }

        // Position root comments (comments that connect directly to the central node)
        const rootComments = nodes.filter(n => 
            n.type === 'comment' && 
            // Look at parent-child map to find root comments
            !this.getParentId(n.id)
        );
        
        console.debug('[DiscussionLayout] Found root comments:', {
            count: rootComments.length,
            ids: rootComments.map(c => c.id)
        });
        
        // Position root comments with golden angle distribution
        this.positionRootComments(rootComments);
        
        // Position reply comments (comments that connect to other comments)
        const replyComments = nodes.filter(n => 
            n.type === 'comment' && 
            this.getParentId(n.id) !== null
        );
        
        console.debug('[DiscussionLayout] Found reply comments:', {
            count: replyComments.length,
            ids: replyComments.map(c => c.id)
        });
        
        // Position reply comments around their parents
        this.positionReplyComments(replyComments);
        
        // Final enforcement of fixed positions
        this.enforceFixedPositions();
    }
    
    /**
     * Build lookup maps for node relations
     */
    private buildNodeMaps(nodes: EnhancedNode[]): void {
        // First reset existing maps
        this.parentChildMap.clear();
        this.commentRingIndices.clear();
        
        // Map of child comments to their parent ids
        const childToParent = new Map<string, string>();
        
        // First pass - identify parent-child relationships
        nodes.forEach(node => {
            // Store node type in type map for later
            this.nodeTypeMap.set(node.id, node.type);
            
            // Check if this is a comment node with a parent
            if (node.type === 'comment' && node.metadata?.parentCommentId) {
                const parentId = node.metadata.parentCommentId;
                childToParent.set(node.id, parentId);
                
                // Initialize parent's children array if needed
                if (!this.parentChildMap.has(parentId)) {
                    this.parentChildMap.set(parentId, []);
                }
                
                // Add this node to parent's children
                this.parentChildMap.get(parentId)!.push(node.id);
            }
            
            // Check if this is a comment form node with a parent
            if (node.type === 'comment-form' && node.metadata?.parentCommentId) {
                const parentId = node.metadata.parentCommentId;
                childToParent.set(node.id, parentId);
                
                // Initialize parent's children array if needed
                if (!this.parentChildMap.has(parentId)) {
                    this.parentChildMap.set(parentId, []);
                }
                
                // Add this node to parent's children
                this.parentChildMap.get(parentId)!.push(node.id);
            }
        });
        
        // Second pass - calculate ring indices
        // Root comments are ring index 1
        // Their direct replies are ring index 2, etc.
        const calculateRingIndex = (nodeId: string, depth: number = 1): void => {
            this.commentRingIndices.set(nodeId, depth);
            
            // Process children recursively
            const children = this.parentChildMap.get(nodeId) || [];
            children.forEach(childId => {
                calculateRingIndex(childId, depth + 1);
            });
        };
        
        // Find all root comments (comments without parents)
        const rootComments = nodes.filter(node => 
            node.type === 'comment' && 
            !childToParent.has(node.id)
        );
        
        // Calculate ring indices starting from each root comment
        rootComments.forEach(node => {
            calculateRingIndex(node.id);
        });
        
        console.debug('[DiscussionLayout] Built node maps:', {
            nodeTypes: this.nodeTypeMap.size,
            parentChild: this.parentChildMap.size,
            ringIndices: this.commentRingIndices.size
        });
    }
    
    /**
     * Get parent ID for a comment
     */
    private getParentId(nodeId: string): string | null {
        // Iterate through parent-child map to find parent
        for (const [parentId, children] of this.parentChildMap.entries()) {
            if (children.includes(nodeId)) {
                return parentId;
            }
        }
        return null;
    }
    
    /**
     * Get children IDs for a comment
     */
    private getChildrenIds(nodeId: string): string[] {
        return this.parentChildMap.get(nodeId) || [];
    }
    
    /**
     * Get ring index for a comment (distance from central node)
     */
    private getRingIndex(nodeId: string): number {
        return this.commentRingIndices.get(nodeId) || 1;
    }

    /**
     * Configure forces for this layout
     */
    configureForces(): void {
        console.debug('[DiscussionLayout] Configuring forces');

        // CRITICAL: Start with no forces at all
        this.clearAllForces();
        
        // Configure minimal forces for navigation nodes
        NavigationNodeLayout.configureNoForces(this.simulation);

        // NO FORCES: We don't add any forces to the simulation,
        // relying completely on fixed positions instead
        
        // Add a tick handler that enforces central node position on EVERY tick
        this.simulation.on('tick.fixedPosition', () => {
            const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
            
            // Find central node and fix its position on every tick
            const centralNode = nodes.find(n => n.fixed || n.group === 'central');
            if (centralNode) {
                // Aggressively reset position to origin
                centralNode.x = 0;
                centralNode.y = 0;
                centralNode.fx = 0;
                centralNode.fy = 0;
                centralNode.vx = 0;
                centralNode.vy = 0;
            }
            
            // Also fix navigation nodes
            nodes.forEach(node => {
                if (node.type === 'navigation' && node.fx !== undefined && node.fy !== undefined) {
                    node.x = node.fx;
                    node.y = node.fy;
                    node.vx = 0;
                    node.vy = 0;
                }
            });
        });
        
        // Start with a VERY mild alpha - just avoid movement
        this.simulation.alpha(0.01).restart();
    }

    /**
     * Position root comments using golden angle distribution
     */
    private positionRootComments(comments: EnhancedNode[]): void {
        // Sort comments by popularity (if available) or creation date
        const sortedComments = comments.sort((a, b) => {
            // If popularity metrics exist, use them
            if (a.metadata?.votes !== undefined && b.metadata?.votes !== undefined) {
                return (b.metadata.votes as number) - (a.metadata.votes as number);
            }
            
            // Otherwise sort by creation date (newest first)
            const dateA = a.metadata?.createdAt ? new Date(a.metadata.createdAt).getTime() : 0;
            const dateB = b.metadata?.createdAt ? new Date(b.metadata.createdAt).getTime() : 0;
            return dateB - dateA;
        });
        
        // Calculate positions with golden angle
        sortedComments.forEach((comment, index) => {
            // Store ring index (1 for root comments)
            this.commentRingIndices.set(comment.id, 1);
            
            // Calculate angle using golden ratio for even distribution
            const angle = this.FIRST_COMMENT_ANGLE + (this.GOLDEN_ANGLE * index);
            
            // Store angle for consistency
            this.commentAngles.set(comment.id, angle);
            
            // Calculate position with all adjustments
            const position = this.calculateCommentPosition(comment, angle, 1);
            
            // Apply position
            comment.x = position.x;
            comment.y = position.y;
            
            console.debug('[DiscussionLayout] Positioned root comment:', {
                id: comment.id,
                index,
                angle: angle * (180 / Math.PI), // Convert to degrees for readability
                position: { x: comment.x, y: comment.y },
                isDetail: comment.mode === 'detail',
                isHidden: comment.isHidden
            });
            
            // Position any reply form associated with this comment
            const replyForm = (this.simulation.nodes() as unknown as EnhancedNode[]).find(n => 
                n.type === 'comment-form' && 
                n.metadata?.parentCommentId === comment.id
            );
            
            if (replyForm) {
                // Position slightly offset from parent comment
                const replyAngle = angle + (Math.PI / 8); // Offset angle
                const replyRadius = position.radius * 1.2; // Slightly larger radius
                
                replyForm.x = Math.cos(replyAngle) * replyRadius;
                replyForm.y = Math.sin(replyAngle) * replyRadius;
                
                console.debug('[DiscussionLayout] Positioned reply form:', {
                    id: replyForm.id,
                    parentId: comment.id,
                    position: { x: replyForm.x, y: replyForm.y }
                });
            }
        });
    }
    
    /**
     * Position reply comments around their parent comments
     */
    private positionReplyComments(comments: EnhancedNode[]): void {
        // Build a map of comments by parent ID for easier lookup
        const commentsByParent = new Map<string, EnhancedNode[]>();
        
        comments.forEach(comment => {
            const parentId = this.getParentId(comment.id);
            if (!parentId) return;
            
            if (!commentsByParent.has(parentId)) {
                commentsByParent.set(parentId, []);
            }
            
            commentsByParent.get(parentId)!.push(comment);
        });
        
        // Process each parent's replies
        commentsByParent.forEach((replies, parentId) => {
            const parent = (this.simulation.nodes() as unknown as EnhancedNode[])
                .find(n => n.id === parentId);
                
            if (!parent) return;
            
            // Sort replies by popularity or creation date
            const sortedReplies = replies.sort((a, b) => {
                // If popularity metrics exist, use them
                if (a.metadata?.votes !== undefined && b.metadata?.votes !== undefined) {
                    return (b.metadata.votes as number) - (a.metadata.votes as number);
                }
                
                // Otherwise sort by creation date (newest first)
                const dateA = a.metadata?.createdAt ? new Date(a.metadata.createdAt).getTime() : 0;
                const dateB = b.metadata?.createdAt ? new Date(b.metadata.createdAt).getTime() : 0;
                return dateB - dateA;
            });
            
            // Get parent angle from map or calculate it
            const parentAngle = this.commentAngles.get(parentId) || 0;
            
            // Get parent ring index
            const parentRingIndex = this.getRingIndex(parentId);
            
            // Position replies around parent with golden angle distribution
            sortedReplies.forEach((reply, index) => {
                // Set ring index (parent's index + 1)
                const ringIndex = parentRingIndex + 1;
                this.commentRingIndices.set(reply.id, ringIndex);
                
                // Calculate angle based on parent's angle and child index
                // We want replies to be distributed around their parent
                const baseAngle = parentAngle;
                const replyAngle = baseAngle + (this.GOLDEN_ANGLE * index * 0.5);
                
                // Store angle for consistency and future use
                this.commentAngles.set(reply.id, replyAngle);
                
                // Calculate position with all adjustments
                const position = this.calculateCommentPosition(reply, replyAngle, ringIndex);
                
                // Apply position
                reply.x = position.x;
                reply.y = position.y;
                
                console.debug('[DiscussionLayout] Positioned reply comment:', {
                    id: reply.id,
                    parentId,
                    ringIndex,
                    angle: replyAngle * (180 / Math.PI), // Convert to degrees for readability
                    position: { x: reply.x, y: reply.y },
                    isDetail: reply.mode === 'detail',
                    isHidden: reply.isHidden
                });
                
                // Position any reply form associated with this comment
                const replyForm = (this.simulation.nodes() as unknown as EnhancedNode[]).find(n => 
                    n.type === 'comment-form' && 
                    n.metadata?.parentCommentId === reply.id
                );
                
                if (replyForm) {
                    // Position slightly offset from parent comment
                    const formAngle = replyAngle + (Math.PI / 8); // Offset angle
                    const formRadius = position.radius * 1.15; // Slightly larger radius
                    
                    replyForm.x = Math.cos(formAngle) * formRadius;
                    replyForm.y = Math.sin(formAngle) * formRadius;
                    
                    console.debug('[DiscussionLayout] Positioned nested reply form:', {
                        id: replyForm.id,
                        parentId: reply.id,
                        position: { x: replyForm.x, y: replyForm.y }
                    });
                }
            });
        });
    }
    
    /**
     * Calculate position for a comment with all adjustments
     */
    private calculateCommentPosition(node: EnhancedNode, angle: number, ringIndex: number): { x: number, y: number, radius: number } {
        // Calculate base radius from coordinate space constants - larger for deeper nesting
        const baseRadius = COORDINATE_SPACE.LAYOUT.RING_SPACING.INITIAL * 
            (1 + (ringIndex * COORDINATE_SPACE.LAYOUT.RING_SPACING.INCREMENT));

        // Retrieve the central node to check its state
        const centralNode = (this.simulation.nodes() as unknown as EnhancedNode[])
            .find(n => n.fixed || n.group === 'central');
        
        // Calculate central node adjustment (inward when central node is in preview mode)
        const centralAdjustment = centralNode?.mode === 'preview' ?
            (this.getCentralNodeDetailSize() - this.getCentralNodePreviewSize()) / 2 :
            0;
            
        // Additional inward adjustment if central node is hidden
        const centralHiddenAdjustment = centralNode?.isHidden ?
            (this.getCentralNodePreviewSize() - COORDINATE_SPACE.NODES.SIZES.HIDDEN) / 2 :
            0;
            
        // Calculate expansion adjustment - move outward if expanded
        const expansionAdjustment = node.mode === 'detail' ?
            (COORDINATE_SPACE.NODES.SIZES.DEFINITION.DETAIL - COORDINATE_SPACE.NODES.SIZES.DEFINITION.PREVIEW) / 2 :
            0;
            
        // Calculate hidden adjustment - move inward if hidden
        const hiddenAdjustment = node.isHidden ?
            -(COORDINATE_SPACE.NODES.SIZES.DEFINITION.PREVIEW - COORDINATE_SPACE.NODES.SIZES.HIDDEN) / 2 :
            0;
        
        // Calculate adjustment from inner expanded nodes
        let innerExpandedAdjustment = 0;
        this.expandedComments.forEach((data, id) => {
            // If this is an inner ring that's expanded, add its adjustment
            if (data.ringIndex < ringIndex) {
                innerExpandedAdjustment += data.adjustment;
            }
        });
        
        // Calculate adjustment from inner hidden nodes
        let innerHiddenAdjustment = 0;
        this.hiddenNodes.forEach((data, id) => {
            // If this is an inner ring that's hidden, add its adjustment (negative)
            if (data.ringIndex < ringIndex) {
                innerHiddenAdjustment += data.adjustment;
            }
        });
        
        // Calculate final radius with all adjustments
        const radius = baseRadius + 
                      expansionAdjustment + 
                      hiddenAdjustment - 
                      centralAdjustment - 
                      centralHiddenAdjustment + 
                      innerExpandedAdjustment + 
                      innerHiddenAdjustment;

        // Calculate position using angle and radius
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        
        return { x, y, radius };
    }
    
    /**
     * Get detail size for central node based on its type
     */
    private getCentralNodeDetailSize(): number {
        const centralNode = (this.simulation.nodes() as unknown as EnhancedNode[])
            .find(n => n.fixed || n.group === 'central');
            
        if (!centralNode) return COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL;
        
        switch(centralNode.type) {
            case 'word':
                return COORDINATE_SPACE.NODES.SIZES.WORD.DETAIL;
            case 'definition':
                return COORDINATE_SPACE.NODES.SIZES.DEFINITION.DETAIL;
            case 'statement':
                return COORDINATE_SPACE.NODES.SIZES.STATEMENT.DETAIL;
            case 'quantity':
                return COORDINATE_SPACE.NODES.SIZES.QUANTITY.DETAIL;
            default:
                return COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL;
        }
    }
    
    /**
     * Get preview size for central node based on its type
     */
    private getCentralNodePreviewSize(): number {
        const centralNode = (this.simulation.nodes() as unknown as EnhancedNode[])
            .find(n => n.fixed || n.group === 'central');
            
        if (!centralNode) return COORDINATE_SPACE.NODES.SIZES.STANDARD.PREVIEW;
        
        switch(centralNode.type) {
            case 'word':
                return COORDINATE_SPACE.NODES.SIZES.WORD.PREVIEW;
            case 'definition':
                return COORDINATE_SPACE.NODES.SIZES.DEFINITION.PREVIEW;
            case 'statement':
                return COORDINATE_SPACE.NODES.SIZES.STATEMENT.PREVIEW;
            case 'quantity':
                return COORDINATE_SPACE.NODES.SIZES.QUANTITY.PREVIEW;
            default:
                return COORDINATE_SPACE.NODES.SIZES.STANDARD.PREVIEW;
        }
    }

    /**
     * Handle node mode changes
     */
    public handleNodeStateChange(nodeId: string, mode: NodeMode): void {
        console.debug('[DiscussionLayout] Node state change', {
            nodeId,
            mode
        });

        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const node = nodes.find(n => n.id === nodeId);
        
        if (!node) {
            console.warn('[DiscussionLayout] Node not found for state change:', nodeId);
            return;
        }

        // Update node mode
        const oldMode = node.mode;
        node.mode = mode;
        node.expanded = mode === 'detail';
        
        // Update radius based on new mode
        const oldRadius = node.radius;
        node.radius = this.getNodeRadius(node);

        console.debug('[DiscussionLayout] Node mode updated', {
            nodeId,
            oldMode,
            newMode: mode,
            oldRadius,
            newRadius: node.radius
        });

        // Update expansion state tracking
        this.expansionState.set(nodeId, mode === 'detail');

        // If this is a comment node, update expanded tracking
        if (node.type === 'comment') {
            // Get ring index
            const ringIndex = this.getRingIndex(nodeId);
            
            // Calculate adjustment for this node (radius difference between detail and preview)
            const adjustment = (COORDINATE_SPACE.NODES.SIZES.DEFINITION.DETAIL - 
                              COORDINATE_SPACE.NODES.SIZES.DEFINITION.PREVIEW) / 2 +
                              COORDINATE_SPACE.LAYOUT.RING_SPACING.DEFINITION_EXPANSION_BUFFER;
                
            // Update tracking
            if (mode === 'detail') {
                this.expandedComments.set(nodeId, { ringIndex, adjustment });
                console.debug('[DiscussionLayout] Added expanded comment:', {
                    nodeId,
                    ringIndex,
                    adjustment
                });
            } else {
                this.expandedComments.delete(nodeId);
                console.debug('[DiscussionLayout] Removed expanded comment:', {
                    nodeId
                });
            }
        }

        // For central node, we need to update all nodes
        if (node.group === 'central') {
            console.debug('[DiscussionLayout] Central node mode changed, repositioning all nodes');
            
            // First update navigation nodes to ensure they adapt to the central node's new size
            NavigationNodeLayout.positionNavigationNodes(
                nodes, 
                this.getNodeRadius.bind(this)
            );
            
            // Then reposition comments
            this.repositionAllComments(nodes);
        }
        
        // If a comment changes mode, we need to adjust all comments
        else if (node.type === 'comment') {
            console.debug('[DiscussionLayout] Comment node mode changed, repositioning all comments');
            this.repositionAllComments(nodes);
        }
        
        // CRITICAL: Stop simulation and enforce fixed positions
        this.simulation.stop();
        this.enforceFixedPositions();
        
        // Restart with VERY minimal alpha to avoid movement
        this.simulation.alpha(0.01).restart();
    }

    /**
     * Handle node visibility changes
     */
    public handleNodeVisibilityChange(nodeId: string, isHidden: boolean): void {
        console.debug('[DiscussionLayout] Node visibility change', {
            nodeId,
            isHidden
        });

        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const node = nodes.find(n => n.id === nodeId);
        
        if (!node) {
            console.warn('[DiscussionLayout] Node not found for visibility change:', nodeId);
            return;
        }

        // Update node visibility
        const oldHiddenState = node.isHidden;
        node.isHidden = isHidden;
        
        // Update radius based on new visibility
        const oldRadius = node.radius;
        node.radius = this.getNodeRadius(node);

        console.debug('[DiscussionLayout] Node visibility updated', {
            nodeId,
            oldHiddenState,
            newHiddenState: isHidden,
            oldRadius,
            newRadius: node.radius
        });

        // If this is a comment node, update hidden nodes tracking
        if (node.type === 'comment') {
            // Get ring index
            const ringIndex = this.getRingIndex(nodeId);
            
            // Calculate adjustment for this node when hidden (negative to pull inward)
            const adjustment = -(COORDINATE_SPACE.NODES.SIZES.DEFINITION.PREVIEW - 
                               COORDINATE_SPACE.NODES.SIZES.HIDDEN) / 2;
                
            // Update tracking
            if (isHidden) {
                this.hiddenNodes.set(nodeId, { ringIndex, adjustment });
                console.debug('[DiscussionLayout] Added hidden comment:', {
                    nodeId,
                    ringIndex,
                    adjustment
                });
            } else {
                this.hiddenNodes.delete(nodeId);
                console.debug('[DiscussionLayout] Removed hidden comment:', {
                    nodeId
                });
            }
        }

        // For central node, we need to update all nodes
        if (node.group === 'central') {
            console.debug('[DiscussionLayout] Central node visibility changed, repositioning all nodes');
            
            // First update navigation nodes to ensure they adapt to the central node's new size
            NavigationNodeLayout.positionNavigationNodes(
                nodes, 
                this.getNodeRadius.bind(this)
            );
            
            // Then reposition comments
            this.repositionAllComments(nodes);
        }
        
        // If a comment changes visibility, we need to adjust all comments
        else if (node.type === 'comment') {
            console.debug('[DiscussionLayout] Comment node visibility changed, repositioning all comments');
            this.repositionAllComments(nodes);
        }
        
        // CRITICAL: Stop simulation and enforce fixed positions
        this.simulation.stop();
        this.enforceFixedPositions();
        
        // Restart with VERY minimal alpha to avoid movement
        this.simulation.alpha(0.01).restart();
    }

    /**
     * Update expansion state changes
     */
    private updateExpansionState(nodes: EnhancedNode[]): void {
        // Update our expansion state map
        nodes.forEach(node => {
            if (node.type === 'comment' || node.group === 'central') {
                const wasExpanded = this.expansionState.get(node.id) || false;
                const isExpanded = node.mode === 'detail';
                
                if (wasExpanded !== isExpanded) {
                    console.debug('[DiscussionLayout] Node expansion state changed:', {
                        nodeId: node.id,
                        from: wasExpanded,
                        to: isExpanded
                    });
                }
                
                this.expansionState.set(node.id, isExpanded);
                
                // Also update expanded comments tracking for comment nodes
                if (node.type === 'comment') {
                    if (isExpanded) {
                        // Get ring index
                        const ringIndex = this.getRingIndex(node.id);
                        
                        // Calculate adjustment
                        const adjustment = (COORDINATE_SPACE.NODES.SIZES.DEFINITION.DETAIL - 
                                          COORDINATE_SPACE.NODES.SIZES.DEFINITION.PREVIEW) / 2 +
                                          COORDINATE_SPACE.LAYOUT.RING_SPACING.DEFINITION_EXPANSION_BUFFER;
                                          
                        this.expandedComments.set(node.id, { ringIndex, adjustment });
                    } else {
                        this.expandedComments.delete(node.id);
                    }
                }
            }
        });
    }

    /**
     * Track hidden node state changes
     */
    private updateHiddenState(nodes: EnhancedNode[]): void {
        // Update our hidden nodes map
        nodes.forEach(node => {
            if (node.type === 'comment' || node.group === 'central') {
                const wasHidden = this.hiddenNodes.has(node.id);
                const isHidden = node.isHidden || false;
                
                if (wasHidden !== isHidden) {
                    console.debug('[DiscussionLayout] Node hidden state changed:', {
                        nodeId: node.id,
                        from: wasHidden,
                        to: isHidden
                    });
                }
                
                // Update hidden nodes tracking for comment nodes
                if (node.type === 'comment') {
                    if (isHidden) {
                        // Get ring index
                        const ringIndex = this.getRingIndex(node.id);
                        
                        // Calculate adjustment (negative value to pull inward)
                        const adjustment = -(COORDINATE_SPACE.NODES.SIZES.DEFINITION.PREVIEW - 
                                          COORDINATE_SPACE.NODES.SIZES.HIDDEN) / 2;
                                          
                        this.hiddenNodes.set(node.id, { ringIndex, adjustment });
                        
                        console.debug('[DiscussionLayout] Added hidden node tracking:', {
                            nodeId: node.id,
                            ringIndex,
                            adjustment
                        });
                    } else {
                        if (this.hiddenNodes.has(node.id)) {
                            this.hiddenNodes.delete(node.id);
                            console.debug('[DiscussionLayout] Removed hidden node tracking:', {
                                nodeId: node.id
                            });
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Reposition all comments
     */
    private repositionAllComments(nodes: EnhancedNode[]): void {
        // Find root comments
        const rootComments = nodes.filter(n => 
            n.type === 'comment' && 
            !this.getParentId(n.id)
        );
        
        // Reposition root comments
        this.positionRootComments(rootComments);
        
        // Find reply comments
        const replyComments = nodes.filter(n => 
            n.type === 'comment' && 
            this.getParentId(n.id) !== null
        );
        
        // Reposition reply comments
        this.positionReplyComments(replyComments);
        
        // Position comment forms
        const commentForms = nodes.filter(n => n.type === 'comment-form');
        
        commentForms.forEach(form => {
            const parentId = form.metadata?.parentCommentId;
            
            if (!parentId) {
                // Root comment form - position at bottom
                form.x = 0;
                form.y = 300;
            } else {
                // Reply form - position near parent
                const parent = nodes.find(n => n.id === parentId);
                
                if (parent) {
                    const parentAngle = this.commentAngles.get(parentId) || 0;
                    const formAngle = parentAngle + (Math.PI / 8);
                    
                    // Safe access to parent.x and parent.y with proper null/undefined checks
                    if (parent.x !== null && parent.x !== undefined && 
                        parent.y !== null && parent.y !== undefined) {
                        const formRadius = Math.sqrt(parent.x * parent.x + parent.y * parent.y) * 1.15;
                        form.x = Math.cos(formAngle) * formRadius;
                        form.y = Math.sin(formAngle) * formRadius;
                    } else {
                        // Fallback positioning if parent position is invalid
                        const defaultRadius = 200; // Default distance from center
                        form.x = Math.cos(formAngle) * defaultRadius;
                        form.y = Math.sin(formAngle) * defaultRadius;
                    }
                }
            }
        });
    }

    /**
     * Additional function to call after layout is applied to ensure positions are fixed
     */
    public enforceFixedPositions(): void {
        if (!this.simulation) return;
        
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        
        // Find and fix central node
        const centralNode = nodes.find(n => n.fixed || n.group === 'central');
        if (centralNode) {
            centralNode.x = 0;
            centralNode.y = 0;
            centralNode.fx = 0;
            centralNode.fy = 0;
            centralNode.vx = 0;
            centralNode.vy = 0;
            centralNode.fixed = true;
            
            // Ensure index 0 for central node (might help with stability)
            if (typeof centralNode.index === 'number') {
                centralNode.index = 0;
            }
            
            console.debug('[DiscussionLayout] Enforced central node position at (0,0)');
        }
        
        // Also enforce navigation node positions
        NavigationNodeLayout.enforceFixedPositions(nodes);
        
        // Force simulation to honor these positions
        this.simulation.alpha(0).alphaTarget(0);
    }

    /**
     * Update data and handle mode changes
     * ALWAYS skip animation like SingleNodeLayout
     */
    public updateData(nodes: EnhancedNode[], links: EnhancedLink[], skipAnimation: boolean = false): void {
        console.debug('[DiscussionLayout] Updating layout data', {
            nodeCount: nodes.length,
            linkCount: links.length
        });

        // Always stop simulation during update
        this.simulation.stop();
        
        // Track expansion state changes
        this.updateExpansionState(nodes);
        
        // Track hidden state changes
        this.updateHiddenState(nodes);
        
        // Rebuild node maps
        this.buildNodeMaps(nodes);

        // Clear all forces
        this.clearAllForces();
        
        // Initialize positions
        this.initializeNodePositions(nodes);
        
        // Update nodes
        this.simulation.nodes(asD3Nodes(nodes));
        
        // Configure forces (which adds no actual forces)
        this.configureForces();

        // ALWAYS skip animation by setting alpha to 0
        this.simulation.alpha(0).alphaTarget(0);
            
        // Ensure fixed positions after update
        this.enforceFixedPositions();
    }
    
    /**
     * Stops the layout strategy and clears all forces
     */
    public stop(): void {
        console.debug('[DiscussionLayout] Stopping layout');
        
        // Call parent stop
        super.stop();
        
        // Also clear all forces
        if (this.simulation) {
            this.clearAllForces();
        }
    }
}