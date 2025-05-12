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
    GraphLink,
    NodeMetadata
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
        console.debug('[COMMENT_HIERARCHY_LAYOUT] Clearing all forces');
        
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
            console.warn('[COMMENT_HIERARCHY_LAYOUT] Some forces still remain:', remainingForces);
            
            // Try to remove these as well
            remainingForces.forEach(name => {
                try {
                    sim.force(name, null);
                } catch (e) {
                    console.warn(`[COMMENT_HIERARCHY_LAYOUT] Cannot remove force: ${name}`);
                }
            });
        }
    }

    /**
     * Set initial positions for all nodes
     */
    initializeNodePositions(nodes: EnhancedNode[]): void {
        console.debug('[COMMENT_HIERARCHY_LAYOUT] Initializing node positions', {
            nodeCount: nodes.length,
            nodeTypeBreakdown: this.countNodesByType(nodes)
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
            console.warn('[COMMENT_HIERARCHY_LAYOUT] No central node found');
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

        console.debug('[COMMENT_HIERARCHY_LAYOUT] Central node positioned at center with fixed constraints', {
            id: centralNode.id,
            position: { x: centralNode.x, y: centralNode.y },
            fixed: { fx: centralNode.fx, fy: centralNode.fy }
        });
        
        // Calculate position for the "New Comment" form if present
        const commentFormNode = nodes.find(n => n.type === 'comment-form' && !n.metadata?.parentCommentId);
        if (commentFormNode) {
            // Position the comment form at the bottom of the layout
            commentFormNode.x = 0;
            commentFormNode.y = 300; // Position below central node
            console.debug('[COMMENT_HIERARCHY_LAYOUT] Positioned comment form node', {
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
        
        console.debug('[COMMENT_HIERARCHY_LAYOUT] Found root comments:', {
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
        
        console.debug('[COMMENT_HIERARCHY_LAYOUT] Found reply comments:', {
            count: replyComments.length,
            ids: replyComments.map(c => c.id)
        });
        
        // Position reply comments around their parents
        this.positionReplyComments(replyComments);
        
        // Final enforcement of fixed positions
        this.enforceFixedPositions();
    }
    
    /**
     * Count nodes by type for debugging
     */
    private countNodesByType(nodes: EnhancedNode[]): Record<string, number> {
        const counts: Record<string, number> = {};
        nodes.forEach(node => {
            if (!counts[node.type]) {
                counts[node.type] = 0;
            }
            counts[node.type]++;
        });
        return counts;
    }
    
    /**
     * Build lookup maps for node relations - IMPROVED VERSION
     */
    private buildNodeMaps(nodes: EnhancedNode[]): void {
        // Reset existing maps
        this.parentChildMap.clear();
        this.commentRingIndices.clear();
        
        // Create node ID map for validation
        const nodeIdSet = new Set<string>();
        nodes.forEach(node => nodeIdSet.add(node.id));
        
        console.debug('[COMMENT_HIERARCHY_LAYOUT] Building node maps from', nodes.length, 'nodes');
        
        // First pass - identify parent-child relationships
        nodes.forEach(node => {
            // Store node type in type map for later lookup
            this.nodeTypeMap.set(node.id, node.type);
            
            // Check if this is a comment node with a parent
            if (node.type === 'comment') {
                // IMPROVED: Check both metadata and data for parentCommentId
                let parentId = node.metadata?.parentCommentId;
                
                // If not in metadata, try to get from data
                if (!parentId && node.data && 'parentCommentId' in node.data) {
                    parentId = (node.data as any).parentCommentId;
                    
                    // If found in data but not in metadata, repair the metadata
                    if (parentId && !node.metadata?.parentCommentId) {
                        console.debug(`[COMMENT_HIERARCHY_LAYOUT] Repairing missing parentCommentId in metadata for node ${node.id}`);
                        if (!node.metadata) node.metadata = { group: 'comment' as NodeMetadata['group'] };
                        node.metadata.parentCommentId = parentId;
                    }
                }
                
                // Only process valid parent IDs that exist in our node set
                if (parentId && nodeIdSet.has(parentId)) {
                    // Initialize parent's children array if needed
                    if (!this.parentChildMap.has(parentId)) {
                        this.parentChildMap.set(parentId, []);
                    }
                    
                    // Add this node to parent's children
                    this.parentChildMap.get(parentId)!.push(node.id);
                    
                    console.debug(`[COMMENT_HIERARCHY_LAYOUT] Added parent-child relationship: ${parentId} -> ${node.id}`);
                } else if (parentId) {
                    console.warn(`[COMMENT_HIERARCHY_LAYOUT] Parent node ${parentId} not found for comment ${node.id}`);
                }
            }
            
            // Also handle comment forms
            if (node.type === 'comment-form' && node.metadata?.parentCommentId) {
                const parentId = node.metadata.parentCommentId;
                
                // Only process if parent exists
                if (nodeIdSet.has(parentId)) {
                    // Initialize parent's children array if needed
                    if (!this.parentChildMap.has(parentId)) {
                        this.parentChildMap.set(parentId, []);
                    }
                    
                    // Add this node to parent's children
                    this.parentChildMap.get(parentId)!.push(node.id);
                }
            }
        });
        
        // Second pass - calculate ring indices (depth in the comment tree)
        // Root comments (directly attached to central node) have ring index 1
        // Their replies have ring index 2, etc.
        const calculateRingIndex = (nodeId: string, depth: number = 1): void => {
            this.commentRingIndices.set(nodeId, depth);
            
            // Process children recursively
            const children = this.parentChildMap.get(nodeId) || [];
            children.forEach(childId => {
                calculateRingIndex(childId, depth + 1);
            });
        };
        
        // Find central node
        const centralNode = nodes.find(n => n.group === 'central');
        if (!centralNode) {
            console.warn('[COMMENT_HIERARCHY_LAYOUT] No central node found for ring calculation');
            // Instead of returning, assign all comments as ring index 1 (root level)
            nodes.filter(n => n.type === 'comment').forEach(node => {
                this.commentRingIndices.set(node.id, 1);
            });
            return;
        }
        
        // Get all comments that are direct children of the central node (root comments)
        const rootCommentIds = this.parentChildMap.get(centralNode.id) || [];
        
        // Also include any comment nodes without a parent as root comments
        const orphanRootComments = nodes.filter(node => 
            node.type === 'comment' && 
            !node.metadata?.parentCommentId &&
            (!node.data || !('parentCommentId' in node.data) || !(node.data as any).parentCommentId)
        );
        
        orphanRootComments.forEach(node => {
            if (!rootCommentIds.includes(node.id)) {
                rootCommentIds.push(node.id);
            }
        });
        
        // Calculate ring indices starting from each root comment
        rootCommentIds.forEach(commentId => {
            calculateRingIndex(commentId, 1);
        });
        
        console.debug('[COMMENT_HIERARCHY_LAYOUT] Built node maps:', {
            nodeTypes: this.nodeTypeMap.size,
            parentChild: this.parentChildMap.size,
            ringIndices: this.commentRingIndices.size,
            rootCommentCount: rootCommentIds.length
        });
    }
    
    /**
     * Get parent ID for a comment - improved with multiple sources
     */
    private getParentId(nodeId: string): string | null {
        // First check our parent-child map
        for (const [parentId, children] of this.parentChildMap.entries()) {
            if (children.includes(nodeId)) {
                return parentId;
            }
        }
        
        // If not found, check the nodes directly
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const node = nodes.find(n => n.id === nodeId);
        
        if (node) {
            // Check metadata first
            if (node.metadata?.parentCommentId) {
                return node.metadata.parentCommentId;
            }
            
            // Then check data
            if (node.data && 'parentCommentId' in node.data) {
                return (node.data as any).parentCommentId;
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
        console.debug('[COMMENT_HIERARCHY_LAYOUT] Configuring forces');

        // CRITICAL: Start with no forces at all
        this.clearAllForces();

        // Add collision detection - this helps prevent overlapping
        this.simulation.force('collision', d3.forceCollide()
            .radius((node: any) => (node as EnhancedNode).radius * 1.8) // 80% buffer around nodes
            .strength(0.8) // Strong enough to prevent overlap
            .iterations(4) // More iterations = more accurate
        );
        
        // Add very weak charge force to help separate nodes
        this.simulation.force('charge', d3.forceManyBody()
                    .strength((node: any) => {
                        const n = node as EnhancedNode;
                        if (n.type === 'comment') {
                            // Stronger repulsion for comments based on whether they're replies
                            return n.metadata?.parentCommentId ? -150 : -200;
                        }
                        return -50; // Default for other nodes
                    })
                    .distanceMax(600) // Limit the distance to avoid nodes flying away
                );
                
                // Configure minimal forces for navigation nodes
                NavigationNodeLayout.configureNoForces(this.simulation);

                // Add a tick handler that enforces parent-child positioning on EVERY tick
                this.simulation.on('tick.parentChildPositioning', () => {
                    const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
                    
                    // Create node lookup map
                    const nodeMap = new Map<string, EnhancedNode>();
                    nodes.forEach(node => nodeMap.set(node.id, node));
                    
                    // Find central node and fix its position
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
                    
                    // Fix navigation nodes
                    nodes.forEach(node => {
                        if (node.type === 'navigation' && node.fx !== undefined && node.fy !== undefined) {
                            node.x = node.fx;
                            node.y = node.fy;
                            node.vx = 0;
                            node.vy = 0;
                        }
                        
                        // CRITICAL: For comment nodes, maintain relationship with parent
                        if (node.type === 'comment' && node.metadata?.parentCommentId && !node.fixed) {
                            const parentId = node.metadata.parentCommentId;
                            const parentNode = nodeMap.get(parentId);
                            
                            if (parentNode) {
                                // Calculate current distance from parent
                                const dx = (node.x ?? 0) - (parentNode.x ?? 0);
                                const dy = (node.y ?? 0) - (parentNode.y ?? 0);
                                const distance = Math.sqrt(dx * dx + dy * dy);
                                
                                // Calculate ideal distance based on node radii plus spacing
                                const idealDistance = parentNode.radius + node.radius + 60;
                                
                                // If too far or too close, adjust gradually
                                if (Math.abs(distance - idealDistance) > 30) {
                                    // Calculate unit vector
                                    const ux = dx / distance;
                                    const uy = dy / distance;
                                    
                                    // Apply adjustment (partial to avoid abrupt movements)
                                    const adjustmentFactor = 0.3; // 30% adjustment per tick
                                    node.x = (parentNode.x ?? 0) + ux * (idealDistance * adjustmentFactor + distance * (1 - adjustmentFactor));
                                    node.y = (parentNode.y ?? 0) + uy * (idealDistance * adjustmentFactor + distance * (1 - adjustmentFactor));
                                }
                            }
                        }
                    });
                });
                
                // Start with a VERY mild alpha - just avoid movement
                this.simulation.alpha(0.1).restart();
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
                
                // Calculate base radius for root comments
                const baseRadius = COORDINATE_SPACE.LAYOUT.DISCUSSION?.COMMENT_RINGS?.ROOT_RADIUS || 400;
                
                // Calculate spacing angle based on number of comments
                // More comments = smaller spacing to fit them all
                const totalComments = sortedComments.length;
                
                // Increase the spacing factor to further separate nodes
                // Higher spacing factor = more space between nodes
                const spacingFactor = Math.max(1.5, Math.min(3.0, 10 / totalComments));
                
                // Position each comment around the circle
                sortedComments.forEach((comment, index) => {
                    // Store ring index (1 for root comments)
                    this.commentRingIndices.set(comment.id, 1);
                    
                    // Calculate angle with better distribution based on comment count
                    // Using index * spacingFactor * GOLDEN_ANGLE gives better spacing
                    const angle = this.FIRST_COMMENT_ANGLE + (this.GOLDEN_ANGLE * index * spacingFactor);
                    
                    // Store angle for consistency
                    this.commentAngles.set(comment.id, angle);
                    
                    // Calculate additional spacing adjustment based on node radius
                    // Larger spacing multiplier to ensure nodes don't overlap
                    const nodeRadiusAdjustment = comment.radius * 1.2;
                    
                    // Apply position using angle and adjusted radius
                    // Larger base radius to provide more room for comments
                    const adjustedRadius = baseRadius + nodeRadiusAdjustment + (totalComments * 5); // Scale with comment count
                    comment.x = Math.cos(angle) * adjustedRadius;
                    comment.y = Math.sin(angle) * adjustedRadius;
                    
                    console.debug('[COMMENT_HIERARCHY_LAYOUT] Positioned root comment:', {
                        id: comment.id,
                        index,
                        angle: angle * (180 / Math.PI), // Convert to degrees for readability
                        position: { x: comment.x, y: comment.y },
                        adjustedRadius
                    });
                    
                    // Position any reply form associated with this comment
                    const replyForm = (this.simulation.nodes() as unknown as EnhancedNode[]).find(n => 
                        n.type === 'comment-form' && 
                        n.metadata?.parentCommentId === comment.id
                    );
                    
                    if (replyForm) {
                        // Position slightly offset from parent comment
                        const replyAngle = angle + (Math.PI / 8); // Offset angle
                        const replyRadius = adjustedRadius * 1.2; // Slightly larger radius
                        
                        replyForm.x = Math.cos(replyAngle) * replyRadius;
                        replyForm.y = Math.sin(replyAngle) * replyRadius;
                        
                        console.debug('[COMMENT_HIERARCHY_LAYOUT] Positioned reply form:', {
                            id: replyForm.id,
                            parentId: comment.id,
                            position: { x: replyForm.x, y: replyForm.y }
                        });
                    }
                });
            }
            
            /**
             * Position reply comments around their parent comments - IMPROVED VERSION
             */
            private positionReplyComments(comments: EnhancedNode[]): void {
                // Skip entirely if no comments to process
                if (comments.length === 0) {
                    return;
                }
                
                // Filter for ONLY comments that actually have a parentCommentId
                const actualReplyComments = comments.filter(node => 
                    node.type === 'comment' && 
                    (node.metadata?.parentCommentId || 
                    (node.data && (node.data as any)?.parentCommentId))
                );
                
                if (actualReplyComments.length === 0) {
                    console.debug('[COMMENT_HIERARCHY_LAYOUT] No reply comments found with parentCommentId');
                    return; // Early return if no actual replies
                }
                
                // Get comments grouped by parent with validation
                const commentsByParent = new Map<string, EnhancedNode[]>();
                
                // First validate each comment's parent reference
                actualReplyComments.forEach(comment => {
                    // Look in both metadata and data for parentCommentId
                    const parentId = comment.metadata?.parentCommentId || 
                                    (comment.data && (comment.data as any)?.parentCommentId);
                    
                    if (!parentId) {
                        console.warn(`[COMMENT_HIERARCHY_LAYOUT] Reply comment ${comment.id} is missing parentCommentId`);
                        return;
                    }
                    
                    // Ensure parent exists in the simulation
                    const parentExists = (this.simulation.nodes() as unknown as EnhancedNode[])
                        .some(n => n.id === parentId);
                        
                    if (!parentExists) {
                        console.warn(`[COMMENT_HIERARCHY_LAYOUT] Parent comment ${parentId} not found for reply ${comment.id}`);
                        return;
                    }
                    
                    // Group by parent
                    if (!commentsByParent.has(parentId)) {
                        commentsByParent.set(parentId, []);
                    }
                    
                    commentsByParent.get(parentId)!.push(comment);
                });
                
                // Log the grouped comments
                console.debug('[COMMENT_HIERARCHY_LAYOUT] Comments grouped by parent:', 
                    Array.from(commentsByParent.entries()).map(([parentId, children]) => ({
                        parentId, 
                        childCount: children.length,
                        childIds: children.map(c => c.id)
                    }))
                );
                
                // Process each parent's replies
                commentsByParent.forEach((replies, parentId) => {
                    const parent = (this.simulation.nodes() as unknown as EnhancedNode[])
                        .find(n => n.id === parentId);
                        
                    if (!parent) {
                        console.warn(`[COMMENT_HIERARCHY_LAYOUT] Parent comment ${parentId} not found for replies`);
                        return;
                    }
                    
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
                    
                    // Get parent angle and ring index
                    const parentAngle = this.commentAngles.get(parentId) || 0;
                    const parentRingIndex = this.getRingIndex(parentId);
                    
                    // Calculate how to distribute replies around the parent
                    // More replies = wider arc
                    const replyCount = sortedReplies.length;
                    
                    // Ensure non-zero count for calculation
                    if (replyCount === 0) return;
                    
                    // Increase arc size to provide more space between reply nodes
                    const arcSize = Math.min(Math.PI * 1.5, Math.max(Math.PI / 2, replyCount * 0.3 * Math.PI));
                    
                    // Position replies around parent with better distribution
                    sortedReplies.forEach((reply, index) => {
                        // Double check we have a valid reply
                        if (!reply || !reply.id) {
                            console.warn('[COMMENT_HIERARCHY_LAYOUT] Invalid reply node encountered');
                            return;
                        }
                        
                        // Set ring index (parent's index + 1)
                        const ringIndex = parentRingIndex + 1;
                        this.commentRingIndices.set(reply.id, ringIndex);
                        
                        // Calculate angle based on position in the replies arc
                        // This creates a "fan" of replies around the parent
                        const fraction = replyCount > 1 ? index / (replyCount - 1) : 0.5;
                        const replyAngle = parentAngle + (arcSize * (fraction - 0.5));
                        
                        // Store angle for consistency and future use
                        this.commentAngles.set(reply.id, replyAngle);
                        
                        // Calculate position from parent's position instead of center
                        // This creates better clustering of related comments
                        if (parent.x !== undefined && parent.y !== undefined) {
                            // Add extra spacing for larger nodes
                            const nodeRadiusAdjustment = reply.radius * 1.5;
                            
                            // Calculate distance based on parent and reply radius plus padding
                            // This ensures replies stay close to their parents but don't overlap
                            const replyDistance = parent.radius + reply.radius + 50;
                            
                            // Calculate position relative to parent - THIS IS CRITICAL
                            const posX = (parent.x ?? 0) + Math.cos(replyAngle) * replyDistance;
                            const posY = (parent.y ?? 0) + Math.sin(replyAngle) * replyDistance;
                            
                            // Apply position
                            reply.x = posX;
                            reply.y = posY;
                            
                            console.debug('[COMMENT_HIERARCHY_LAYOUT] Positioned reply comment (relative):', {
                                id: reply.id,
                                parentId,
                                ringIndex,
                                angle: replyAngle * (180 / Math.PI),
                                position: { x: reply.x, y: reply.y },
                                distance: replyDistance,
                                parentPosition: { x: parent.x, y: parent.y }
                            });
                        } else {
                            // Fallback to absolute positioning if parent position is not available
                            const baseRadius = COORDINATE_SPACE.LAYOUT.DISCUSSION?.COMMENT_RINGS?.ROOT_RADIUS || 400;
                            const radiusIncrement = COORDINATE_SPACE.LAYOUT.DISCUSSION?.COMMENT_RINGS?.REPLY_RADIUS_INCREMENT || 200;
                            
                            // Increase the radius increment based on the depth of nesting
                            const adjustedRadiusIncrement = radiusIncrement * (1 + (ringIndex * 0.1));
                            
                            const nestingRadius = baseRadius + ((ringIndex - 1) * adjustedRadiusIncrement);
                            
                            // Add extra spacing for larger nodes
                            const nodeRadiusAdjustment = reply.radius * 1.5;
                            const adjustedRadius = nestingRadius + nodeRadiusAdjustment;
                            
                            // Apply position
                            reply.x = Math.cos(replyAngle) * adjustedRadius;
                            reply.y = Math.sin(replyAngle) * adjustedRadius;
                            
                            console.debug('[COMMENT_HIERARCHY_LAYOUT] Positioned reply comment (absolute fallback):', {
                                id: reply.id,
                                parentId,
                                ringIndex,
                                angle: replyAngle * (180 / Math.PI),
                                position: { x: reply.x, y: reply.y },
                                adjustedRadius
                            });
                        }
                        
                        // Position any reply form associated with this comment
                        const replyForm = (this.simulation.nodes() as unknown as EnhancedNode[]).find(n => 
                            n.type === 'comment-form' && 
                            n.metadata?.parentCommentId === reply.id
                        );
                        
                        if (replyForm && reply.x !== undefined && reply.y !== undefined && 
                            reply.x !== null && reply.y !== null) {
                            // Position slightly offset from reply
                            const formAngle = replyAngle + (Math.PI / 8);
                            const formDistance = reply.radius + 30;
                            
                            replyForm.x = reply.x + Math.cos(formAngle) * formDistance;
                            replyForm.y = reply.y + Math.sin(formAngle) * formDistance;
                            
                            console.debug('[COMMENT_HIERARCHY_LAYOUT] Positioned nested reply form (relative):', {
                                id: replyForm.id,
                                parentId: reply.id,
                                position: { x: replyForm.x, y: replyForm.y }
                            });
                        }
                        
                        // Recursively position nested replies
                        // Check if this reply has its own replies
                        const nestedReplies = (this.simulation.nodes() as unknown as EnhancedNode[])
                            .filter(n => n.metadata?.parentCommentId === reply.id);
                            
                        if (nestedReplies.length > 0) {
                            console.debug(`[COMMENT_HIERARCHY_LAYOUT] Found ${nestedReplies.length} nested replies for comment ${reply.id}`);
                            // Position nested replies around this reply
                            this.positionNestedReplies(nestedReplies, reply, replyAngle, ringIndex);
                        }
                    });
                });
            }

            /**
             * Position nested replies (replies to replies)
             */
            private positionNestedReplies(
                replies: EnhancedNode[], 
                parent: EnhancedNode, 
                parentAngle: number, 
                parentRingIndex: number
            ): void {
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
                
                const replyCount = sortedReplies.length;
                
                // Use a narrower arc for nested replies to keep them closer to parent
                const arcSize = Math.min(Math.PI * 1.0, Math.max(Math.PI / 3, replyCount * 0.2 * Math.PI));
                
                sortedReplies.forEach((reply, index) => {
                    // Set ring index (parent's index + 1)
                    const ringIndex = parentRingIndex + 1;
                    this.commentRingIndices.set(reply.id, ringIndex);
                    
                    // Calculate angle based on position in the replies arc
                    const fraction = replyCount > 1 ? index / (replyCount - 1) : 0.5;
                    const replyAngle = parentAngle + (arcSize * (fraction - 0.5));
                    
                    // Store angle for consistency
                    this.commentAngles.set(reply.id, replyAngle);
                    
                    // Calculate position from parent's position
                    if (parent.x !== undefined && parent.y !== undefined) {
                        // Use shorter distance for nested replies to keep them closer
                        const replyDistance = parent.radius + reply.radius + 30;
                        
                        // Calculate position relative to parent
                        const posX = (parent.x ?? 0) + Math.cos(replyAngle) * replyDistance;
                        const posY = (parent.y ?? 0) + Math.sin(replyAngle) * replyDistance;
                        
                        // Apply position
                        reply.x = posX;
                        reply.y = posY;
                        
                        console.debug('[COMMENT_HIERARCHY_LAYOUT] Positioned nested reply:', {
                            id: reply.id,
                            parentId: parent.id,
                            ringIndex,
                            angle: replyAngle * (180 / Math.PI),
                            position: { x: reply.x, y: reply.y },
                            distance: replyDistance
                        });
                    }
                    
                    // Position any reply form for this nested reply
                    const replyForm = (this.simulation.nodes() as unknown as EnhancedNode[]).find(n => 
                        n.type === 'comment-form' && 
                        n.metadata?.parentCommentId === reply.id
                    );
                    
                    if (replyForm && reply.x !== undefined && reply.y !== undefined && 
                        reply.x !== null && reply.y !== null) {
                        // Position slightly offset from reply
                        const formAngle = replyAngle + (Math.PI / 8);
                        const formDistance = reply.radius + 30;
                        
                        replyForm.x = reply.x + Math.cos(formAngle) * formDistance;
                        replyForm.y = reply.y + Math.sin(formAngle) * formDistance;
                    }
                    
                    // Recursively position deeper nested replies (if any)
                    const deeperReplies = (this.simulation.nodes() as unknown as EnhancedNode[])
                        .filter(n => n.metadata?.parentCommentId === reply.id);
                        
                    if (deeperReplies.length > 0) {
                        this.positionNestedReplies(deeperReplies, reply, replyAngle, ringIndex);
                    }
                });
            }
            
            // Changes needed in ProjectZer0Frontend/src/lib/services/graph/layouts/DiscussionLayout.ts
// Update the calculateLinkPath method to ensure all links are straight

/**
 * Calculate the path for a link between two nodes
 * Always use straight lines for all links in discussion view
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
    
    // Use a straight line path for ALL links in discussion view
    // Calculate points on perimeter based on node radii
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
            
            /**
             * Calculate position for a comment with all adjustments
             */
            private calculateCommentPosition(node: EnhancedNode, angle: number, ringIndex: number): { x: number, y: number, radius: number } {
                // Get constants from COORDINATE_SPACE
                const baseRadius = COORDINATE_SPACE.LAYOUT.DISCUSSION?.COMMENT_RINGS?.ROOT_RADIUS || 400;
                const radiusIncrement = COORDINATE_SPACE.LAYOUT.DISCUSSION?.COMMENT_RINGS?.REPLY_RADIUS_INCREMENT || 200;
                
                // Calculate radius based on ring index - with more spacing for higher ring indices
                const ringRadius = baseRadius + ((ringIndex - 1) * radiusIncrement * 1.5);

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
                
                // Add spacing adjustment based on node radius to prevent overlap
                const nodeRadiusAdjustment = node.radius * 2;
                
                // Calculate final radius with all adjustments
                const radius = ringRadius + 
                            expansionAdjustment + 
                            hiddenAdjustment - 
                            centralAdjustment - 
                            centralHiddenAdjustment + 
                            innerExpandedAdjustment + 
                            innerHiddenAdjustment +
                            nodeRadiusAdjustment;

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
                console.debug('[COMMENT_HIERARCHY_LAYOUT] Node state change', {
                    nodeId,
                    mode
                });

                const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
                const node = nodes.find(n => n.id === nodeId);
                
                if (!node) {
                    console.warn('[COMMENT_HIERARCHY_LAYOUT] Node not found for state change:', nodeId);
                    return;
                }

                // Update node mode
                const oldMode = node.mode;
                node.mode = mode;
                node.expanded = mode === 'detail';
                
                // Update radius based on new mode
                const oldRadius = node.radius;
                node.radius = this.getNodeRadius(node);

                console.debug('[COMMENT_HIERARCHY_LAYOUT] Node mode updated', {
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
                        console.debug('[COMMENT_HIERARCHY_LAYOUT] Added expanded comment:', {
                            nodeId,
                            ringIndex,
                            adjustment
                        });
                    } else {
                        this.expandedComments.delete(nodeId);
                        console.debug('[COMMENT_HIERARCHY_LAYOUT] Removed expanded comment:', {
                            nodeId
                        });
                    }
                }

        // For central node, we need to update all nodes
        if (node.group === 'central') {
            console.debug('[COMMENT_HIERARCHY_LAYOUT] Central node visibility changed, repositioning all nodes');
            
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
            console.debug('[COMMENT_HIERARCHY_LAYOUT] Comment node visibility changed, repositioning all comments');
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
                    console.debug('[COMMENT_HIERARCHY_LAYOUT] Node expansion state changed:', {
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
                    console.debug('[COMMENT_HIERARCHY_LAYOUT] Node hidden state changed:', {
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
                        
                        console.debug('[COMMENT_HIERARCHY_LAYOUT] Added hidden node tracking:', {
                            nodeId: node.id,
                            ringIndex,
                            adjustment
                        });
                    } else {
                        if (this.hiddenNodes.has(node.id)) {
                            this.hiddenNodes.delete(node.id);
                            console.debug('[COMMENT_HIERARCHY_LAYOUT] Removed hidden node tracking:', {
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
            
            console.debug('[COMMENT_HIERARCHY_LAYOUT] Enforced central node position at (0,0)');
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
        console.debug('[COMMENT_HIERARCHY_LAYOUT] Updating layout data', {
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
        
        // Update simulation with nodes
        this.simulation.nodes(asD3Nodes(nodes));
        
        // Add link forces if we have links
        if (links.length > 0) {
            this.simulation.force('link', d3.forceLink()
                .id((d: any) => (d as EnhancedNode).id)
                .links(asD3Links(links))
                .strength((l: any) => {
                    const link = l as EnhancedLink;
                    if (link.type === 'comment') {
                        return 0.5; // Root comments to central node (moderate)
                    } else if (link.type === 'reply') {
                        return 0.7; // Replies to parent comments (stronger)
                    }
                    return link.strength || 0.3; // Default
                })
            );
        }
        
        // Configure all other forces
        this.configureForces();

        // ALWAYS skip animation by setting alpha to 0
        this.simulation.alpha(0).alphaTarget(0);
            
        // Ensure fixed positions after update
        this.enforceFixedPositions();
    }

    /**
     * Apply visibility preferences to nodes
     */
    public applyVisibilityPreferences(preferences: Record<string, boolean>): void {
        if (Object.keys(preferences).length === 0) {
            return;
        }
        
        // Get current nodes
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        if (!nodes || nodes.length === 0) {
            return;
        }
        
        console.debug('[COMMENT_HIERARCHY_LAYOUT] Applying visibility preferences', {
            preferencesCount: Object.keys(preferences).length,
            nodesCount: nodes.length
        });
        
        // Track changes
        let changedNodes = 0;
        
        // Apply preferences
        Object.entries(preferences).forEach(([nodeId, isVisible]) => {
            const node = nodes.find(n => n.id === nodeId);
            if (node) {
                const newHiddenState = !isVisible;
                if (node.isHidden !== newHiddenState) {
                    node.isHidden = newHiddenState;
                    node.hiddenReason = 'user';
                    node.radius = this.getNodeRadius(node);
                    changedNodes++;
                    
                    console.debug('[COMMENT_HIERARCHY_LAYOUT] Applied visibility preference', {
                        nodeId,
                        isVisible,
                        isHidden: node.isHidden
                    });
                }
            }
        });
        
        if (changedNodes > 0) {
            console.debug(`[COMMENT_HIERARCHY_LAYOUT] Changed visibility for ${changedNodes} nodes`);
            
            // Update hidden state tracking
            this.updateHiddenState(nodes);
            
            // Reposition all comments
            this.repositionAllComments(nodes);
            
            // Enforce fixed positions
            this.enforceFixedPositions();
            
            // Minimal simulation restart
            this.simulation.alpha(0.1).restart();
        }
    }

    /**
     * Stops the layout strategy and clears all forces
     */
    public stop(): void {
        console.debug('[COMMENT_HIERARCHY_LAYOUT] Stopping layout');
        
        // Call parent stop
        super.stop();
        
        // Also clear all forces
        if (this.simulation) {
            this.clearAllForces();
        }
    }
}