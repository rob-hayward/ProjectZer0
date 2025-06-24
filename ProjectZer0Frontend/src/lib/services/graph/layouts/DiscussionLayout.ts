// src/lib/services/graph/layouts/DiscussionLayout.ts
import * as d3 from 'd3';
import { BaseLayoutStrategy } from './BaseLayoutStrategy';
import { NavigationNodeLayout } from './common/NavigationNodeLayout';
import type { EnhancedNode, EnhancedLink } from '../../../types/graph/enhanced';
import { asD3Nodes, asD3Links } from '../../../types/graph/enhanced';
import type { 
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
 * - Central node (word, definition, statement, quantity, openquestion) fixed at the center (0,0)
 * - Navigation nodes in a circle around the central node
 * - Root comments positioned around the central node in a circle
 * - Reply comments positioned to the outer side of their parent comments
 * - Clear visualization of comment hierarchies
 * - Support for hidden nodes with smaller size
 */
export class DiscussionLayout extends BaseLayoutStrategy {
    private readonly GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
    private readonly FIRST_COMMENT_ANGLE = Math.PI / 2; // Start at top
    
    // Tracking maps for node positions and relationships
    private commentAngles: Map<string, number> = new Map();
    private commentDistances: Map<string, number> = new Map();
    private parentChildMap: Map<string, string[]> = new Map();
    private childParentMap: Map<string, string> = new Map();
    private commentDepthMap: Map<string, number> = new Map();
    private nodeTypeMap: Map<string, NodeType> = new Map();
    
    // Tracking for expanded/hidden states
    private expansionState: Map<string, boolean> = new Map();

    private _pendingReplyForm: {
        parentId: string;
        position: { x: number; y: number };
        angle: number;
        distance: number;
    } | null = null;
    
    // Base configuration parameters 
    private readonly BASE_RADIUS = COORDINATE_SPACE.LAYOUT.DISCUSSION?.COMMENT_RINGS?.ROOT_RADIUS || 400;
    private readonly RADIUS_INCREMENT = COORDINATE_SPACE.LAYOUT.DISCUSSION?.COMMENT_RINGS?.REPLY_RADIUS_INCREMENT || 150;
    
    // Arc configuration for child distribution
    private readonly ROOT_ARC_ANGLE = Math.PI * 0.3; // Angle for distributing children around parent
    private readonly MAX_ROOT_SPACING = Math.PI * 0.1; // Max spacing between root nodes

    constructor(width: number, height: number, viewType: ViewType) {
        super(width, height, viewType);
        console.debug('[DiscussionLayout] Initializing with dimensions:', {
            width: COORDINATE_SPACE.WORLD.WIDTH,
            height: COORDINATE_SPACE.WORLD.HEIGHT,
            viewType
        });
    }

    /**
     * Check if a node can be a central node in discussion view
     */
    private isCentralNodeType(node: EnhancedNode): boolean {
        // FIXED: Add openquestion to the list of valid central node types
        const validCentralTypes = ['word', 'definition', 'statement', 'quantity', 'openquestion'];
        return validCentralTypes.includes(node.type) || 
               node.group === 'central' || 
               (node.fixed === true);
    }

    /**
     * Clear ALL forces from the simulation
     * This ensures no forces affect node positions
     */
    private clearAllForces(): void {
        // Get simulation instance
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
        
        // Check for any remaining forces and clear them too
        const remainingForces = Object.keys(sim._forces || {});
        if (remainingForces.length > 0) {
            remainingForces.forEach(name => {
                try {
                    sim.force(name, null);
                } catch (e) {
                    // Ignore errors
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
            nodeTypeBreakdown: this.countNodesByType(nodes)
        });

        // Stop simulation during initialization
        this.simulation.stop();
        
        // Clear all forces before positioning nodes
        this.clearAllForces();

        // Reset maps
        this.resetDataStructures();
        
        // Build node maps, including parent-child relationships
        this.buildNodeMaps(nodes);
        
        // Update expansion state tracking
        this.updateExpansionState(nodes);

        // Reset velocities for all nodes
        nodes.forEach(node => {
            node.vx = 0;
            node.vy = 0;

            // Clear fixed positions except for central and navigation nodes
            if (!node.fixed && node.group !== 'central' && node.type !== 'navigation') {
                node.fx = undefined;
                node.fy = undefined;
            }
        });

        // Position navigation nodes first (around central node)
        NavigationNodeLayout.positionNavigationNodes(
            nodes, 
            this.getNodeRadius.bind(this)
        );

        // Find and position central node - UPDATED to include openquestion
        const centralNode = nodes.find(n => this.isCentralNodeType(n));
        if (!centralNode) {
            console.warn('[DiscussionLayout] No central node found');
            console.debug('[DiscussionLayout] Available nodes:', nodes.map(n => ({ id: n.id, type: n.type, group: n.group, fixed: n.fixed })));
            return;
        }

        // Center the central node with explicit position fixing
        centralNode.fx = 0;
        centralNode.fy = 0;
        centralNode.x = 0;
        centralNode.y = 0;
        centralNode.vx = 0;
        centralNode.vy = 0;
        centralNode.fixed = true;
        
        if (centralNode.metadata) {
            centralNode.metadata.fixed = true;
        }

        console.debug('[DiscussionLayout] Central node positioned at center', {
            id: centralNode.id,
            type: centralNode.type,
            position: { x: centralNode.x, y: centralNode.y },
            fixed: { fx: centralNode.fx, fy: centralNode.fy }
        });
        
        // Position the "New Comment" form if present
        this.positionCommentForm(nodes, centralNode);

        // Now build the complete comment hierarchy based on parent-child relationships
        this.buildCommentHierarchy(centralNode.id);
        
        // Position all comments statically
        this.positionAllComments(centralNode);
        
        // Enforce fixed positions at the end
        this.fixPositions(nodes);
        
        console.debug('[DiscussionLayout] Finished initializing node positions, hierarchy depth:', this.getMaxDepth());
    }
    
    /**
     * Reset all data structures used for tracking the comment hierarchy
     */
    private resetDataStructures(): void {
        this.nodeTypeMap.clear();
        this.commentAngles.clear();
        this.commentDistances.clear();
        this.parentChildMap.clear();
        this.childParentMap.clear();
        this.commentDepthMap.clear();
        this.expansionState.clear();
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
     * Build lookup maps for node relations
     */
    private buildNodeMaps(nodes: EnhancedNode[]): void {
        // Create node ID map for validation
        const nodeIdSet = new Set<string>();
        nodes.forEach(node => nodeIdSet.add(node.id));
        
        console.debug('[DiscussionLayout] Building node maps from', nodes.length, 'nodes');
        
        // Create maps for type lookup and hierarchical relationships
        nodes.forEach(node => {
            // Store node type for quick lookup
            this.nodeTypeMap.set(node.id, node.type);
            
            // Process comments to build the parent-child relationship maps
            if (node.type === 'comment' || node.type === 'comment-form') {
                // First, try to find the parent ID from various sources
                let parentId = this.extractParentId(node);
                
                // Only process valid parent IDs that exist in our node set
                if (parentId && nodeIdSet.has(parentId)) {
                    // Register the parent-child relationship
                    if (!this.parentChildMap.has(parentId)) {
                        this.parentChildMap.set(parentId, []);
                    }
                    
                    this.parentChildMap.get(parentId)!.push(node.id);
                    this.childParentMap.set(node.id, parentId);
                    
                    console.debug(`[DiscussionLayout] Registered parent-child: ${parentId} -> ${node.id}`);
                } else if (parentId) {
                    console.warn(`[DiscussionLayout] Parent node ${parentId} not found for node ${node.id}, will be treated as root comment`);
                }
            }
        });
        
        // Log for debugging
        this.logParentChildStructure();
    }
    
    /**
     * Position the comment form for adding new comments
     */
    private positionCommentForm(nodes: EnhancedNode[], centralNode: EnhancedNode): void {
        // Find comment form without parent (root comment form)
        const commentFormNode = nodes.find(n => 
            n.type === 'comment-form' && 
            !this.extractParentId(n)
        );
        
        if (commentFormNode) {
            // Position below central node
            commentFormNode.x = 0;
            commentFormNode.y = centralNode.radius * 3;
            commentFormNode.fx = commentFormNode.x;
            commentFormNode.fy = commentFormNode.y;
            
            console.debug('[DiscussionLayout] Positioned root comment form', {
                id: commentFormNode.id,
                position: { x: commentFormNode.x, y: commentFormNode.y }
            });
        }
    }
    
    /**
     * Extract parentId from a node using multiple sources
     */
    private extractParentId(node: EnhancedNode): string | null {
        // Try to get from metadata first
        if (node.metadata?.parentCommentId) {
            return node.metadata.parentCommentId;
        }
        
        // Then try from data
        if (node.data && typeof node.data === 'object' && 'parentCommentId' in node.data) {
            return (node.data as any).parentCommentId;
        }
        
        // Check our mapping as a last resort
        return this.childParentMap.get(node.id) || null;
    }

    /**
     * Build the comment hierarchy depth map
     */
    private buildCommentHierarchy(centralNodeId: string): void {
        // For any node without a parent, it's a root comment (depth 1)
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const commentNodes = nodes.filter(n => n.type === 'comment' || n.type === 'comment-form');
        
        // First, identify all root comments (direct children of central node)
        const rootCommentIds: string[] = [];
        
        commentNodes.forEach(node => {
            const parentId = this.extractParentId(node);
            
            if (!parentId || parentId === centralNodeId) {
                // This is a root comment (directly connected to central node)
                rootCommentIds.push(node.id);
                this.commentDepthMap.set(node.id, 1); // Depth 1 for root comments
                
                // Ensure they're properly linked to central node in our maps
                if (!this.parentChildMap.has(centralNodeId)) {
                    this.parentChildMap.set(centralNodeId, []);
                }
                
                if (!this.parentChildMap.get(centralNodeId)!.includes(node.id)) {
                    this.parentChildMap.get(centralNodeId)!.push(node.id);
                }
                
                this.childParentMap.set(node.id, centralNodeId);
            }
        });
        
        // Log root comments
        console.debug('[DiscussionLayout] Identified root comments:', rootCommentIds);
        
        // Now recursively compute depth for all comments
        const calculateDepth = (nodeId: string, depth: number): void => {
            this.commentDepthMap.set(nodeId, depth);
            
            // Process all children
            const children = this.parentChildMap.get(nodeId) || [];
            children.forEach(childId => {
                calculateDepth(childId, depth + 1);
            });
        };
        
        // Start calculation from each root comment
        rootCommentIds.forEach(commentId => {
            calculateDepth(commentId, 1);
        });
        
        // Log depth map statistics
        console.debug('[DiscussionLayout] Built comment hierarchy depth map:', {
            total: this.commentDepthMap.size,
            maxDepth: this.getMaxDepth(),
            distribution: this.getDepthDistribution()
        });
    }
    
    /**
     * Get the maximum depth in the comment hierarchy
     */
    private getMaxDepth(): number {
        let maxDepth = 0;
        this.commentDepthMap.forEach(depth => {
            if (depth > maxDepth) maxDepth = depth;
        });
        return maxDepth;
    }
    
    /**
     * Get distribution of comments by depth
     */
    private getDepthDistribution(): Record<number, number> {
        const distribution: Record<number, number> = {};
        this.commentDepthMap.forEach(depth => {
            if (!distribution[depth]) distribution[depth] = 0;
            distribution[depth]++;
        });
        return distribution;
    }
    
    /**
     * Log the parent-child structure for debugging
     */
    private logParentChildStructure(): void {
        console.group('[DiscussionLayout] Parent-Child Hierarchy');
        
        // Count nodes by parent
        let totalRelationships = 0;
        this.parentChildMap.forEach((children, parentId) => {
            console.debug(`Parent ${parentId} has ${children.length} children: ${children.join(', ')}`);
            totalRelationships += children.length;
        });
        
        console.debug(`Total parent-child relationships: ${totalRelationships}`);
        console.debug(`Total parent nodes: ${this.parentChildMap.size}`);
        console.debug(`Total child nodes: ${this.childParentMap.size}`);
        
        console.groupEnd();
    }
    
    /**
     * Check if a node is a root comment (directly connected to central node)
     */
    private isRootComment(node: EnhancedNode): boolean {
        if (node.type !== 'comment') return false;
        
        const parentId = this.getParentId(node.id);
        if (!parentId) return true;
        
        // Check if parent is the central node
        const parent = (this.simulation.nodes() as unknown as EnhancedNode[])
            .find(n => n.id === parentId);
            
        return parent?.group === 'central' || this.isCentralNodeType(parent!);
    }
    
    /**
     * Get parent ID for a comment - improved with multiple sources
     */
    private getParentId(nodeId: string): string | null {
        // First check our child-parent map (most reliable)
        if (this.childParentMap.has(nodeId)) {
            return this.childParentMap.get(nodeId)!;
        }
        
        // Then check if it exists in the parent-child map
        for (const [parentId, children] of this.parentChildMap.entries()) {
            if (children.includes(nodeId)) {
                return parentId;
            }
        }
        
        // If not found, check the node directly
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
     * Get children IDs for a node
     */
    private getChildrenIds(nodeId: string): string[] {
        return this.parentChildMap.get(nodeId) || [];
    }
    
    /**
     * Get depth for a comment (distance from central node in the hierarchy)
     */
    private getDepth(nodeId: string): number {
        return this.commentDepthMap.get(nodeId) || 1;
    }

    /**
     * Configure forces for this layout - USING NO FORCES APPROACH
     */
    configureForces(): void {
        // Start with no forces at all
        this.clearAllForces();

        // Add only a minimal collision force to prevent complete overlap
        this.simulation.force('collision', d3.forceCollide()
            .radius((node: any) => {
                const n = node as EnhancedNode;
                return n.radius * 1.1; // Just 10% buffer
            })
            .strength(0.5)
            .iterations(2)
        );
        
        // Add fixed position enforcer on tick
        this.simulation.on('tick.fixPosition', () => {
            const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
            this.fixPositions(nodes);
        });
        
        // Start with a very mild alpha - no real simulation needed
        this.simulation.alpha(0.01).restart();
    }
    
    /**
     * Fix all node positions - no simulation needed
     */
    private fixPositions(nodes: EnhancedNode[]): void {
        // Fix all nodes at their current positions
        nodes.forEach(node => {
            // For central node, ensure it stays at origin
            if (node.group === 'central' || node.fixed || this.isCentralNodeType(node)) {
                node.x = 0;
                node.y = 0;
                node.fx = 0;
                node.fy = 0;
                node.vx = 0;
                node.vy = 0;
            } 
            // For navigation nodes, ensure they keep their positions
            else if (node.type === 'navigation') {
                if (node.fx !== undefined) node.x = node.fx;
                if (node.fy !== undefined) node.y = node.fy;
                node.vx = 0;
                node.vy = 0;
            }
            // For all other nodes, fix them at their assigned positions
            else {
                if (node.fx === undefined) node.fx = node.x;
                if (node.fy === undefined) node.fy = node.y;
                node.vx = 0;
                node.vy = 0;
            }
        });
    }

/**
 * Position all comments in a static manner with vote-based distance
 */
private positionAllComments(centralNode: EnhancedNode): void {
    // Get all nodes
    const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
    
    // First, get root comments directly connected to central node
    const rootCommentIds = this.getChildrenIds(centralNode.id);
    const rootComments = nodes.filter(n => rootCommentIds.includes(n.id));
    
    console.debug('[DiscussionLayout] Positioning', rootComments.length, 'root comments');
    
    // Sort root comments by net votes (highest to lowest)
    const sortedRootComments = rootComments.sort((a, b) => {
        // Get net votes from metadata or direct properties
        const aVotes = a.metadata?.votes !== undefined ? a.metadata.votes as number : 
                     (a.data && 'netVotes' in a.data ? (a.data as any).netVotes : 0);
        const bVotes = b.metadata?.votes !== undefined ? b.metadata.votes as number : 
                     (b.data && 'netVotes' in b.data ? (b.data as any).netVotes : 0);
        
        // Sort by net votes (highest first)
        return bVotes - aVotes;
    });
    
    // Pre-calculate the number of replies for each comment and its descendants
    const replyCountMap = new Map<string, number>();
    this.calculateTotalDescendants(nodes, replyCountMap);
    
    // Create an array to track the angular sectors occupied by each comment and its replies
    // This helps prevent overlaps by reserving enough space in each direction
    type ReservedSector = { 
        startAngle: number;
        endAngle: number;
        distance: number;
        commentId: string;
    };
    const reservedSectors: ReservedSector[] = [];
    
    // Split the top comment from the rest
    const topComment = sortedRootComments.length > 0 ? sortedRootComments[0] : null;
    const otherRootComments = sortedRootComments.slice(1);
    
    // Position top comment to the right of central node (like live definition)
    if (topComment) {
        // Fixed position at 0 degrees (to the right)
        const topAngle = 0; // Right side
        
        // Store angle for future reference
        this.commentAngles.set(topComment.id, topAngle);
        
        // Position at a fixed distance similar to live definition
        const baseDistance = this.BASE_RADIUS * 0.75; // 25% closer than standard
        
        // Add extra spacing based on number of replies
        const replySpacingFactor = 40; // Increased from 20
        const replyCount = replyCountMap.get(topComment.id) || 0;
        const replySpacing = replyCount * replySpacingFactor;
        
        // Calculate final distance
        const distance = baseDistance + replySpacing;
        
        // Store distance for future reference
        this.commentDistances.set(topComment.id, distance);
        
        // Calculate position using angle and distance
        topComment.x = Math.cos(topAngle) * distance;
        topComment.y = Math.sin(topAngle) * distance;
        topComment.fx = topComment.x;
        topComment.fy = topComment.y;
        
        console.debug(`[DiscussionLayout] Positioned top comment ${topComment.id} at fixed angle 0°, distance ${distance}, with ${replyCount} total replies`);
        
        // Reserve this sector
        const sectorWidth = Math.PI / 3; // 60 degrees for top comment
        reservedSectors.push({
            startAngle: topAngle - sectorWidth/2,
            endAngle: topAngle + sectorWidth/2,
            distance: distance + (replyCount > 0 ? this.RADIUS_INCREMENT * 2 : 0), 
            commentId: topComment.id
        });
        
        // Position any reply form attached to this comment
        this.positionReplyForm(topComment);
        
        // Now recursively position this comment's children
        const childIds = this.getChildrenIds(topComment.id);
        if (childIds.length > 0) {
            this.positionChildComments(nodes.filter(n => childIds.includes(n.id)), topComment, topAngle, replyCountMap, reservedSectors);
        }
    }
    
    // Position remaining root comments in a way that avoids overlaps
    // Start at a position away from the top comment
    let currentAngle = Math.PI / 2; // Start at the top
    
    otherRootComments.forEach((comment, index) => {
        // Calculate next angle using golden ratio
        let candidateAngle = currentAngle + this.GOLDEN_ANGLE;
        
        // Normalize angle to 0-2π range
        while (candidateAngle < 0) candidateAngle += 2 * Math.PI;
        while (candidateAngle >= 2 * Math.PI) candidateAngle -= 2 * Math.PI;
        
        // Check if this angle overlaps with any reserved sector
        // If it does, find a better angle
        let isSafe = false;
        let attempts = 0;
        const maxAttempts = 12; // Try up to 12 different angles
        
        while (!isSafe && attempts < maxAttempts) {
            isSafe = true;
            
            // Check against all reserved sectors
            for (const sector of reservedSectors) {
                // Check if angle falls within the sector
                let isInSector = false;
                
                if (sector.startAngle <= sector.endAngle) {
                    // Normal sector
                    isInSector = candidateAngle >= sector.startAngle && candidateAngle <= sector.endAngle;
                } else {
                    // Sector crosses the 0/2π boundary
                    isInSector = candidateAngle >= sector.startAngle || candidateAngle <= sector.endAngle;
                }
                
                if (isInSector) {
                    isSafe = false;
                    // Move by a larger angle to try to find a gap
                    candidateAngle += Math.PI / 6; // 30 degrees
                    // Normalize angle again
                    while (candidateAngle >= 2 * Math.PI) candidateAngle -= 2 * Math.PI;
                    attempts++;
                    break;
                }
            }
        }
        
        // Use the safe angle (or best attempt)
        const angle = candidateAngle;
        currentAngle = angle; // Update for next iteration
        
        // Store angle for future reference
        this.commentAngles.set(comment.id, angle);
        
        // Calculate base distance with more space
        // Higher index (lower votes) = further out
        const rankFactor = Math.sqrt(index + 1) / Math.sqrt(otherRootComments.length + 1);
        let baseDistance = this.BASE_RADIUS * (1 + (rankFactor * 0.4)); // Increased factor
        
        // Add extra spacing based on number of replies - much more aggressive
        const replyCount = replyCountMap.get(comment.id) || 0;
        const replySpacingFactor = 50; // Doubled from 25
        const replySpacing = replyCount * replySpacingFactor;
        
        // Check for sector proximity and add spacing if needed
        for (const sector of reservedSectors) {
            // Calculate angular distance (minimum distance in either direction)
            let angularDistance = Math.min(
                Math.abs(angle - sector.startAngle),
                Math.abs(angle - sector.endAngle)
            );
            
            // Handle wrap-around case (near 0/2π boundary)
            angularDistance = Math.min(angularDistance, 2 * Math.PI - angularDistance);
            
            // If angle is close to a sector, ensure distance is greater than the sector's distance
            if (angularDistance < Math.PI / 4) { // Within 45 degrees
                const minDistance = sector.distance + 100; // Add extra buffer
                baseDistance = Math.max(baseDistance, minDistance);
            }
        }
        
        // Calculate final distance with reply adjustment
        const distance = baseDistance + replySpacing;
        
        // Store distance for future reference
        this.commentDistances.set(comment.id, distance);
        
        // Calculate position using angle and distance
        comment.x = Math.cos(angle) * distance;
        comment.y = Math.sin(angle) * distance;
        comment.fx = comment.x;
        comment.fy = comment.y;
        
        console.debug(`[DiscussionLayout] Positioned root comment ${comment.id} at angle ${(angle * 180 / Math.PI).toFixed(1)}°, distance ${distance}, with ${replyCount} total replies`);
        
        // Reserve this sector
        const sectorWidth = Math.PI / 4 + (replyCount * Math.PI / 36); // 45 degrees + extra for replies
        reservedSectors.push({
            startAngle: angle - sectorWidth/2,
            endAngle: angle + sectorWidth/2,
            distance: distance + (replyCount > 0 ? this.RADIUS_INCREMENT * 2 : 0),
            commentId: comment.id
        });
        
        // Position any reply form attached to this comment
        this.positionReplyForm(comment);
        
        // Now recursively position this comment's children
        const childIds = this.getChildrenIds(comment.id);
        if (childIds.length > 0) {
            this.positionChildComments(
                nodes.filter(n => childIds.includes(n.id)), 
                comment, 
                angle, 
                replyCountMap,
                reservedSectors
            );
        }
    });
}

/**
 * Position child comments (replies) with overlap prevention
 */
private positionChildComments(
    children: EnhancedNode[], 
    parentNode: EnhancedNode, 
    parentAngle: number,
    replyCountMap: Map<string, number>,
    reservedSectors: Array<{ startAngle: number; endAngle: number; distance: number; commentId: string; }>
): void {
    if (children.length === 0) return;
    
    console.debug(`[DiscussionLayout] Positioning ${children.length} child comments for parent ${parentNode.id}`);
    
    // Sort children by votes (highest first)
    const sortedChildren = children.sort((a, b) => {
        // Get net votes from metadata or direct properties
        const aVotes = a.metadata?.votes !== undefined ? a.metadata.votes as number : 
                     (a.data && 'netVotes' in a.data ? (a.data as any).netVotes : 0);
        const bVotes = b.metadata?.votes !== undefined ? b.metadata.votes as number : 
                     (b.data && 'netVotes' in b.data ? (b.data as any).netVotes : 0);
        
        // Sort by net votes (highest first)
        return bVotes - aVotes;
    });
    
    // Get depth of parent and its distance
    const parentDepth = this.getDepth(parentNode.id);
    const childDepth = parentDepth + 1;
    const parentDistance = this.commentDistances.get(parentNode.id) || this.BASE_RADIUS;
    
    // Determine arc size based on number of children and depth
    // Deeper nesting = smaller arcs to avoid spreading too far
    const maxArcSize = Math.max(0.8, 1.2 - (childDepth * 0.2)) * Math.PI; // Scale down with depth
    
    const arcAngle = Math.min(
        maxArcSize, // Max size scales with depth
        Math.max(
            Math.PI / 5, // Min 36 degrees
            (children.length * 0.08) * Math.PI // Scale with number of children
        )
    );
    
    // Create a min distance from parent based on depth
    const baseIncrement = this.RADIUS_INCREMENT * (1.3 + (childDepth * 0.2)); // Increase with depth
    
    // Single child case - position along parent's angle
    if (sortedChildren.length === 1) {
        const child = sortedChildren[0];
        const childAngle = parentAngle; // Same as parent
        
        this.commentAngles.set(child.id, childAngle);
        
        // Calculate distance with extra space for replies
        const replyCount = replyCountMap.get(child.id) || 0;
        const replySpacingFactor = 60; // Increased for better separation
        const replySpacing = replyCount * replySpacingFactor;
        
        const childDistance = parentDistance + baseIncrement + replySpacing;
        this.commentDistances.set(child.id, childDistance);
        
        // Set position
        child.x = Math.cos(childAngle) * childDistance;
        child.y = Math.sin(childAngle) * childDistance;
        child.fx = child.x; 
        child.fy = child.y;
        
        console.debug(`[DiscussionLayout] Positioned single child ${child.id} at angle ${(childAngle * 180 / Math.PI).toFixed(1)}°, distance ${childDistance}, with ${replyCount} replies`);
        
        // Reserve this sector
        const sectorWidth = Math.PI / 5 + (replyCount * Math.PI / 45); // Base + extra for replies
        reservedSectors.push({
            startAngle: childAngle - sectorWidth/2,
            endAngle: childAngle + sectorWidth/2,
            distance: childDistance + (replyCount > 0 ? this.RADIUS_INCREMENT : 0),
            commentId: child.id
        });
        
        // Position reply form
        this.positionReplyForm(child);
        
        // Recursively position any grandchildren
        const grandchildIds = this.getChildrenIds(child.id);
        if (grandchildIds.length > 0) {
            const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
            this.positionChildComments(
                nodes.filter(n => grandchildIds.includes(n.id)),
                child,
                childAngle,
                replyCountMap,
                reservedSectors
            );
        }
    }
    // Multiple children case - distribute in an arc
    else {
        // Calculate start and end of arc
        const startAngle = parentAngle - (arcAngle / 2);
        const angleStep = arcAngle / (sortedChildren.length - 1);
        
        // Position each child with spacing based on reply count
        sortedChildren.forEach((child, index) => {
            // Distribute evenly
            const rawAngle = startAngle + (index * angleStep);
            
            // Add small jitter to prevent perfect alignment
            const jitter = (Math.random() - 0.5) * (Math.PI / 90); // ±1 degree
            const childAngle = rawAngle + jitter;
            
            this.commentAngles.set(child.id, childAngle);
            
            // Calculate distance with multi-factor spacing:
            // 1. Base increment that increases with depth
            // 2. Rank-based adjustment (less popular = further out)
            // 3. Reply spacing based on number of replies
            
            // 1. Base increment (increases with depth)
            const depthFactor = 1 + (childDepth * 0.15);
            let childBaseIncrement = baseIncrement * depthFactor;
            
            // 2. Rank-based adjustment
            if (index > 0) { // Skip top-ranked comment
                const rankFactor = Math.sqrt(index) / Math.sqrt(sortedChildren.length);
                childBaseIncrement += rankFactor * 40; // Add up to 40 units based on rank
            }
            
            // 3. Reply-based spacing
            const replyCount = replyCountMap.get(child.id) || 0;
            const replySpacingFactor = 60 + (childDepth * 10); // Increase with depth
            const replySpacing = replyCount * replySpacingFactor;
            
            // Calculate total distance
            const childDistance = parentDistance + childBaseIncrement + replySpacing;
            this.commentDistances.set(child.id, childDistance);
            
            // Set position
            child.x = Math.cos(childAngle) * childDistance;
            child.y = Math.sin(childAngle) * childDistance;
            child.fx = child.x;
            child.fy = child.y;
            
            console.debug(`[DiscussionLayout] Positioned child ${child.id} at angle ${(childAngle * 180 / Math.PI).toFixed(1)}°, distance ${childDistance}, index ${index}, with ${replyCount} replies`);
            
            // Reserve sector for this child and its replies
            // Scale sector width based on depth and replies
            const baseSectorWidth = Math.PI / 6; // 30 degrees base
            const depthShrink = Math.max(0.5, 1 - (childDepth * 0.15)); // Shrink sectors at deeper levels
            const replySectorExpansion = replyCount * (Math.PI / 60); // Add 3 degrees per reply
            
            const sectorWidth = (baseSectorWidth * depthShrink) + replySectorExpansion;
            
            reservedSectors.push({
                startAngle: childAngle - sectorWidth/2,
                endAngle: childAngle + sectorWidth/2,
                distance: childDistance + (replyCount > 0 ? this.RADIUS_INCREMENT : 0),
                commentId: child.id
            });
            
            // Position reply form
            this.positionReplyForm(child);
            
            // Recursively position grandchildren
            const grandchildIds = this.getChildrenIds(child.id);
            if (grandchildIds.length > 0) {
                const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
                this.positionChildComments(
                    nodes.filter(n => grandchildIds.includes(n.id)),
                    child,
                    childAngle,
                    replyCountMap,
                    reservedSectors
                );
            }
        });
    }
}

/**
 * Pre-calculate the total number of descendants (replies and nested replies) for each comment
 * This is used to adjust spacing to prevent overlaps
 */
private calculateTotalDescendants(nodes: EnhancedNode[], resultMap: Map<string, number>): void {
    // Create a recursive function to count descendants
    const countDescendants = (nodeId: string): number => {
        // Get direct children
        const childIds = this.getChildrenIds(nodeId);
        if (childIds.length === 0) {
            resultMap.set(nodeId, 0);
            return 0;
        }
        
        // Count direct children + all their descendants
        let totalDescendants = childIds.length;
        
        // Add descendants of each child
        childIds.forEach(childId => {
            totalDescendants += countDescendants(childId);
        });
        
        // Store the result
        resultMap.set(nodeId, totalDescendants);
        return totalDescendants;
    };
    
    // Calculate for all comment nodes
    const commentNodes = nodes.filter(n => n.type === 'comment');
    commentNodes.forEach(node => {
        // Only calculate for nodes that haven't been processed yet
        if (!resultMap.has(node.id)) {
            countDescendants(node.id);
        }
    });
}
    
    /**
     * Sort comments by importance (votes or recency)
     */
    private sortCommentsByImportance(comments: EnhancedNode[]): EnhancedNode[] {
        return [...comments].sort((a, b) => {
            // First try to sort by votes if available
            if (a.metadata?.votes !== undefined && b.metadata?.votes !== undefined) {
                return (b.metadata.votes as number) - (a.metadata.votes as number);
            }
            
            // Fall back to creation date
            const dateA = a.metadata?.createdAt ? new Date(a.metadata.createdAt).getTime() : 0;
            const dateB = b.metadata?.createdAt ? new Date(b.metadata.createdAt).getTime() : 0;
            return dateB - dateA; // Newest first
        });
    }


    /**
     * Handle the start of a reply to a specific comment
     * This is called when the reply button is clicked
     */
    public handleReplyStart(commentId: string): void {
        console.log(`[DiscussionLayout] Handling reply start for comment: ${commentId}`);
        
        // Get current nodes
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        
        // Find the target comment
        const targetComment = nodes.find(n => n.id === commentId);
        if (!targetComment) {
            console.warn(`[DiscussionLayout] Target comment ${commentId} not found`);
            return;
        }
        
        // Create a reply form node if it doesn't exist yet
        // (The actual node creation happens in the GraphManager or page component)
        
        // Find any existing reply form for this comment
        const existingForm = nodes.find(n => 
            n.type === 'comment-form' && 
            this.extractParentId(n) === commentId
        );
        
        if (existingForm) {
            console.log(`[DiscussionLayout] Reply form already exists for comment ${commentId}`);
            
            // Make sure it's positioned properly
            this.positionReplyForm(targetComment);
            return;
        }
        
        // Otherwise, prepare for the new form by:
        // - Updating internal data structures
        // - Reserving space for the form
        // - Shifting other nodes if needed
        
        // Update parent-child map to anticipate the form
        // The actual form node will be created elsewhere and added later
        
        // Get the parent angle and location for positioning
        const parentAngle = this.commentAngles.get(commentId);
        const parentDistance = this.commentDistances.get(commentId);
        
        if (parentAngle === undefined || parentDistance === undefined) {
            console.warn(`[DiscussionLayout] Cannot determine position for reply form - missing angle/distance for comment ${commentId}`);
            return;
        }
        
        // Get parent's location
        const parentX = targetComment.x || 0;
        const parentY = targetComment.y || 0;
        
        // Calculate position for reply form - at 45° angle from parent
        // This aligns with where the reply button would be
        const buttonAngle = Math.PI / 4; // 45 degrees = 1:30 position
        const offsetAngle = parentAngle + buttonAngle;
        
        // Get parent radius and calculate appropriate distance
        const parentRadius = targetComment.radius || 90;
        const formRadius = 90; // Default comment form radius
        const offsetDistance = parentRadius + formRadius + 20; // 20px gap
        
        // Calculate position
        const formX = parentX + Math.cos(offsetAngle) * offsetDistance;
        const formY = parentY + Math.sin(offsetAngle) * offsetDistance;
        
        // Store this information for use when the form is actually created
        this._pendingReplyForm = {
            parentId: commentId,
            position: { x: formX, y: formY },
            angle: offsetAngle,
            distance: parentDistance + offsetDistance
        };
        
        console.log(`[DiscussionLayout] Prepared for reply form for comment ${commentId} at position (${formX}, ${formY})`);
    }
    
    /**
     * Position a reply form relative to its parent comment
     * This is specifically for the form that appears when the reply button is clicked
     */
    private positionReplyForm(parentComment: EnhancedNode): void {
        // Get all nodes
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        
        // Find the reply form for this comment
        const replyForm = nodes.find(n => 
            n.type === 'comment-form' && 
            this.extractParentId(n) === parentComment.id
        );
        
        if (!replyForm) return;
        
        // Get parent's angle and distance if available
        const parentAngle = this.commentAngles.get(parentComment.id);
        const parentDistance = this.commentDistances.get(parentComment.id);
        
        if (parentAngle === undefined || parentDistance === undefined) {
            // Fallback: Position based on parent coordinates directly
            const parentX = parentComment.x || 0;
            const parentY = parentComment.y || 0;
            
            // Calculate angle from origin to parent
            const baseAngle = Math.atan2(parentY, parentX);
            
            // Position at 45 degrees (1:30 position) relative to parent - where reply button is
            const offsetAngle = Math.PI / 4; // 45 degrees
            
            // Calculate radius values
            const parentRadius = parentComment.radius || 90;
            const formRadius = replyForm.radius || 90;
            
            // Calculate offset distance
            const offsetDistance = parentRadius + formRadius + 20; // 20px spacing
            
            // Calculate final position
            replyForm.x = parentX + Math.cos(baseAngle + offsetAngle) * offsetDistance;
            replyForm.y = parentY + Math.sin(baseAngle + offsetAngle) * offsetDistance;
        } else {
            // Better method: Use the tracked angles and distances
            // Position at 45° from parent angle
            const formAngle = parentAngle + (Math.PI / 4); // 45 degrees = 1:30 position
            const formDistance = parentDistance + 100; // Further out than parent
            
            // Calculate position directly
            replyForm.x = Math.cos(formAngle) * formDistance;
            replyForm.y = Math.sin(formAngle) * formDistance;
        }
        
        // Fix form position
        replyForm.fx = replyForm.x;
        replyForm.fy = replyForm.y;
        replyForm.vx = 0;
        replyForm.vy = 0;
        
        console.log(`[DiscussionLayout] Positioned reply form at (${replyForm.x}, ${replyForm.y}) for comment ${parentComment.id}`);
    }

    
    /**
     * Update expansion state tracking
     */
    private updateExpansionState(nodes: EnhancedNode[]): void {
        // Update our expansion state map
        nodes.forEach(node => {
            if (node.type === 'comment' || node.group === 'central' || this.isCentralNodeType(node)) {
                const wasExpanded = this.expansionState.get(node.id) || false;
                const isExpanded = node.mode === 'detail';
                
                this.expansionState.set(node.id, isExpanded);
                
                // For detail mode nodes, fix position
                if (isExpanded && !node.fixed) {
                    node.fx = node.x;
                    node.fy = node.y;
                }
            }
        });
    }

    /**
     * Handle node mode changes - simplified version that doesn't change layout
     */
    public handleNodeStateChange(nodeId: string, mode: NodeMode): void {
        console.debug(`[DiscussionLayout] Node state change: ${nodeId} -> ${mode}`);

        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const node = nodes.find(n => n.id === nodeId);
        
        if (!node) {
            console.warn(`[DiscussionLayout] Node not found for state change: ${nodeId}`);
            return;
        }

        // Update node mode
        node.mode = mode;
        node.expanded = mode === 'detail';
        
        // Update radius based on new mode
        node.radius = this.getNodeRadius(node);

        // Fix position for detail mode, release for preview mode
        if (mode === 'detail' && !node.fixed) {
            node.fx = node.x;
            node.fy = node.y;
        } else if (mode === 'preview' && !node.fixed && node.group !== 'central' && !this.isCentralNodeType(node)) {
            // Don't release fixed position - keep static layout
        }
        
        // Update expansion state tracking
        this.expansionState.set(nodeId, mode === 'detail');
        
        // No position recalculation needed - fixed layout
        
        // Force fixed positions
        this.fixPositions(nodes);
    }
    
    /**
     * Handle node visibility changes - simplified version that doesn't change layout
     */
    public handleNodeVisibilityChange(nodeId: string, isHidden: boolean): void {
        console.debug(`[DiscussionLayout] Node visibility change: ${nodeId} -> ${isHidden ? 'hidden' : 'visible'}`);
        
        const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
        const node = nodes.find(n => n.id === nodeId);
        
        if (!node) {
            console.warn(`[DiscussionLayout] Node not found for visibility change: ${nodeId}`);
            return;
        }
        
        // Update node visibility
        node.isHidden = isHidden;
        
        // Update radius based on new visibility
        node.radius = this.getNodeRadius(node);
        
        // No position recalculation needed - fixed layout
        
        // Force fixed positions
        this.fixPositions(nodes);
    }
    
    /**
    * Apply visibility preferences to nodes
    */
   public applyVisibilityPreferences(preferences: Record<string, boolean>): void {
    if (Object.keys(preferences).length === 0) return;
    
    // Get current nodes
    const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
    if (!nodes || nodes.length === 0) return;
    
    console.debug(`[DiscussionLayout] Applying visibility preferences (${Object.keys(preferences).length} preferences)`);
    
    // Apply preferences
    Object.entries(preferences).forEach(([nodeId, isVisible]) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
            const newHiddenState = !isVisible;
            if (node.isHidden !== newHiddenState) {
                node.isHidden = newHiddenState;
                node.hiddenReason = 'user';
                node.radius = this.getNodeRadius(node);
            }
        }
    });
    
    // No position recalculation needed - fixed layout
    
    // Force fixed positions
    this.fixPositions(nodes);
}

/**
 * Additional function to call after layout is applied to ensure positions are fixed
 */
public enforceFixedPositions(): void {
    if (!this.simulation) return;
    
    const nodes = this.simulation.nodes() as unknown as EnhancedNode[];
    this.fixPositions(nodes);
    
    // Force simulation to honor these positions
    this.simulation.alpha(0).alphaTarget(0);
}

/**
 * Updates data and handle mode changes
 */
public updateData(nodes: EnhancedNode[], links: EnhancedLink[], skipAnimation: boolean = true): void {
    console.debug(`[DiscussionLayout] Updating layout data (${nodes.length} nodes, ${links.length} links)`);

    // Always stop simulation during update
    this.simulation.stop();
    
    // Reset data structures
    this.resetDataStructures();
    
    // Track expansion state
    this.updateExpansionState(nodes);
    
    // Rebuild node maps
    this.buildNodeMaps(nodes);
    
    // Clear all forces
    this.clearAllForces();
    
    // Build comment hierarchy
    // Find central node for this - UPDATED to use new method
    const centralNode = nodes.find(n => this.isCentralNodeType(n));
    if (centralNode) {
        this.buildCommentHierarchy(centralNode.id);
        
        // Initialize positions
        this.initializeNodePositions(nodes);
    }
    
    // Update simulation with nodes
    this.simulation.nodes(asD3Nodes(nodes));
    
    // Update link force if it exists and we have links
    if (links.length > 0) {
        // Use a simple link force just to maintain connections visually
        this.simulation.force('link', d3.forceLink()
            .id((d: any) => (d as EnhancedNode).id)
            .links(asD3Links(links))
            .strength(0.1) // Very weak strength - not affecting layout
            .distance(100) // Default distance
        );
    }
    
    // Configure forces (which adds minimal forces)
    this.configureForces();

    // Always skip animation
    this.simulation.alpha(0).alphaTarget(0);
    
    // Enforce fixed positions
    this.enforceFixedPositions();
    
    // Force tick to ensure positions are applied
    this.forceTick(2);
}

/**
 * Force simulation to tick a specified number of times
 */
public forceTick(ticks: number = 1): void {
    // Stop any current animation
    this.simulation.alpha(0).alphaTarget(0);
    
    for (let i = 0; i < ticks; i++) {
        // Enforce fixed positions before tick
        this.enforceFixedPositions();
        
        // Tick the simulation
        this.simulation.tick();
        
        // Enforce fixed positions after tick
        this.enforceFixedPositions();
    }
}

/**
 * Stops the layout strategy and clears all forces
 */
public stop(): void {
    // Call parent stop
    super.stop();
    
    // Clear all forces
    if (this.simulation) {
        this.clearAllForces();
    }
}
}