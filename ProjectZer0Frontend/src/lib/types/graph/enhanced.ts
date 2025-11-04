// src/lib/types/graph/enhanced.ts - UPDATED for consolidated relationships and D3-native opacity + Category support + Evidence support

import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
import type { Definition, WordNode, NodeStyle, StatementNode, OpenQuestionNode, QuantityNode, CommentNode, CommentFormData, CategoryNode, AnswerNode, EvidenceNode } from '../domain/nodes';
import type { UserProfile } from '../domain/user';
import type { NavigationOption } from '../domain/navigation';

// Control node data interface
export interface ControlNodeData {
    id: string;
    sortType?: string;
    sortDirection?: string;
    keywords?: string[];
    keywordOperator?: string;
    showOnlyMyItems?: boolean;
}

// View and group types
export type ViewType = 'dashboard' | 'edit-profile' | 'create-node' | 'word' | 'statement' | 'openquestion' | 'network' | 'create-definition' | 'statement-network' | 'quantity' | 'discussion'| 'universal' | 'category';
export type NodeType = 'dashboard' | 'edit-profile' | 'create-node' | 'navigation' | 'word' | 'definition' | 'statement' | 'statement-answer-form' | 'openquestion' | 'quantity' |'comment' | 'comment-form' | 'control' | 'category' | 'answer' | 'evidence';
export type NodeGroup = 'central' | 'navigation' | 'word' | 'live-definition' | 'alternative-definition' | 'statement' | 'statement-answer-form' | 'openquestion' | 'quantity' | 'comment' | 'comment-form' | 'control' | 'category' | 'answer' | 'evidence';
// ENHANCED: Updated link types with consolidated support
export type LinkType = 'live' | 'alternative' | 'related' | 'comment' | 'reply' | 'comment-form' | 'reply-form' | 'answers' | 'shared_keyword' | 'responds_to' | 'related_to' | 'composed_of' | 'tagged_with';
export type NodeMode = 'preview' | 'detail';

// NEW: Consolidated keyword metadata interface
export interface ConsolidatedKeywordMetadata {
    sharedWords: string[];
    totalStrength: number;
    relationCount: number;
    primaryKeyword: string;
    strengthsByKeyword: { [keyword: string]: number };
    averageStrength: number;
}

export interface NodeMetadata {
    centralRadius?: number;
    group: 'central' | 'word' | 'definition' | 'navigation' | 'statement' | 'openquestion' | 'quantity'| 'comment' | 'comment-form' | 'control' | 'category' | 'answer' | 'evidence';
    fixed?: boolean;
    isDetail?: boolean;
    votes?: number;
    createdAt?: string;
    angle?: number;
    radius?: number;
    golden?: number;
    parentCommentId?: string;
    depth?: number;
    isExpanded?: boolean;
    
    // Universal graph properties
    consensus_ratio?: number;
    participant_count?: number;
    net_votes?: number;
    
    // User-specific voting data from backend
    // For nodes with SINGLE voting type (Word, OpenQuestion, Comment, Category)
    userVoteStatus?: {
        status: 'agree' | 'disagree' | null;
    };
    
    // For nodes with DUAL voting types (Definition, Statement, Answer, Quantity, Evidence)
    inclusionVoteStatus?: {
        status: 'agree' | 'disagree' | null;
    };
    contentVoteStatus?: {
        status: 'agree' | 'disagree' | null;
    };
    
    // ADDED: For Evidence peer review
    userReview?: {
        id?: string;
        qualityScore: number;
        independenceScore: number;
        relevanceScore: number;
    } | null;
    
    userVisibilityPreference?: {
        isVisible: boolean;
        source: string;
        timestamp: number;
    };

    // Additional metadata
    answer_count?: number;
    related_statements_count?: number;
}

// Core node interface for initial data
export interface GraphNode {
    id: string;
    type: NodeType;
    data: UserProfile | NavigationOption | WordNode | Definition | StatementNode | OpenQuestionNode | QuantityNode | CommentNode | CommentFormData | ControlNodeData | CategoryNode | AnswerNode | EvidenceNode;
    group: NodeGroup;
    mode?: NodeMode;
    metadata?: NodeMetadata; // Make metadata optional in GraphNode
}

// Core link interface for initial data
export interface GraphLink {
    id: string; // Added for consistent identification
    source: string | GraphNode;
    target: string | GraphNode;
    type: LinkType;
    metadata?: Record<string, any>;
}

// D3 compatible node interface
export interface EnhancedNode {
    // Core identity
    id: string;
    type: NodeType;
    data: UserProfile | NavigationOption | WordNode | Definition | StatementNode | OpenQuestionNode | QuantityNode | CommentNode | CommentFormData | ControlNodeData | CategoryNode | AnswerNode | EvidenceNode;
    group: NodeGroup;
    mode?: NodeMode;
    isHidden?: boolean;
    hiddenReason?: 'community' | 'user';

    // Physical properties
    radius: number;
    fixed?: boolean;
    expanded?: boolean;
    subtype?: 'live' | 'alternative';

    // D3 simulation properties
    index?: number;
    x?: number | null;
    y?: number | null;
    vx?: number | null;
    vy?: number | null;
    fx?: number | null;
    fy?: number | null;

    // Layout metadata - UPDATED to include user-specific data
    metadata: NodeMetadata;
}

// ENHANCED: Enhanced link for D3 simulation with consolidated support
export type EnhancedLink = {
    id: string;
    source: string | EnhancedNode;
    target: string | EnhancedNode;
    type: LinkType;
    strength?: number;
    index?: number;
    relationshipType?: 'direct' | 'keyword';
    metadata?: {
        // Backward compatibility fields
        sharedWords?: string[];
        relationCount?: number;
        keyword?: string; // Will be primaryKeyword for consolidated relationships
        
        // NEW: Consolidated keyword metadata for optimized relationships
        consolidatedKeywords?: ConsolidatedKeywordMetadata;
        
        // NEW: Opacity support for link reveal animations
        opacity?: number;
        
        // Other metadata
        [key: string]: any;
    };
};

// ENHANCED: Ready-to-render link with consolidated relationship support
export interface RenderableLink {
    id: string;
    type: LinkType;
    sourceId: string;
    targetId: string;
    sourceType: NodeType;
    targetType: NodeType;
    path: string;
    sourcePosition: NodePosition;
    targetPosition: NodePosition;
    strength?: number; 
    relationshipType?: 'direct' | 'keyword';
    opacity?: number; // NEW: D3-controlled opacity for smooth reveals
    
    // ENHANCED: Metadata with consolidated support
    metadata?: {
        // Legacy fields (maintained for backward compatibility)
        sharedWords?: string[];
        relationCount?: number;
        keyword?: string; // Primary keyword for consolidated relationships
        
        // NEW: Rich consolidated metadata
        consolidatedKeywords?: ConsolidatedKeywordMetadata;
        
        // Performance tracking
        isConsolidated?: boolean; // Quick check for rendering optimizations
        originalRelationshipCount?: number; // How many relationships this represents
        
        // NEW: Opacity support
        opacity?: number;
        
        // Other metadata
        [key: string]: any;
    };
}

export interface LayoutLink {
    source: string;
    target: string;
    type: string;
    strength?: number;
    metadata?: {
        sharedWords?: string[];
        relationCount?: number;
        keyword?: string;
        consolidatedKeywords?: ConsolidatedKeywordMetadata; // NEW
        [key: string]: any;
    };
}

// Position type for consistent positioning
export interface NodePosition {
    x: number;
    y: number;
    svgTransform: string;
}

// UPDATED: Ready-to-render node with all display information including D3-native opacity
export interface RenderableNode {
    id: string;
    type: NodeType;
    group: NodeGroup;
    mode?: NodeMode;
    isHidden?: boolean;
    hiddenReason?: 'community' | 'user';
    data: UserProfile | NavigationOption | WordNode | Definition | StatementNode | OpenQuestionNode | QuantityNode | CommentNode | CommentFormData | ControlNodeData | CategoryNode | AnswerNode | EvidenceNode;
    radius: number;
    position: NodePosition;
    style: NodeStyle;
    metadata: NodeMetadata; // UPDATED: Now includes user-specific data
    opacity?: number; // NEW: D3-controlled opacity for smooth reveals
}

export interface LayoutNode {
    id: string;
    type: string;
    subtype?: string;
    metadata: {
        group: string;
        fixed?: boolean;
        votes?: number;
        createdAt?: string;
        // Other metadata properties
        [key: string]: any;
    };
}

// Force configuration types
export interface ForceConfig {
    charge: {
        strength: number;
        distanceMin?: number;
        distanceMax?: number;
    };
    collision: {
        radius: number;
        strength: number;
    };
    radial?: {
        radius: number;
        strength: number;
        center?: { x: number; y: number };
    };
    link?: {
        distance: number;
        strength: number;
    };
}

// Configuration for layout updates
export interface LayoutUpdateConfig {
    skipAnimation?: boolean;
    forceRefresh?: boolean;
    preservePositions?: boolean;
}

// Main graph data structure
export interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}

// Page data interface
export interface GraphPageData {
    view: ViewType;
    viewType: ViewType;
    wordData: WordNode | null;
    statementData: StatementNode | null;
    openQuestionData?: OpenQuestionNode | null;
    quantityData?: QuantityNode | null;
    categoryData?: CategoryNode | null;
    nodes?: GraphNode[];
    links?: GraphLink[];
    _routeKey?: string; // Added for forcing re-renders on navigation
}

// FIXED: ConsolidatedRelationshipUtils class with missing methods added
// This should replace the existing class in: src/lib/types/graph/enhanced.ts

/**
 * NEW: Utility class for working with consolidated relationships
 * 
 * FIXES:
 * - Added missing getRelationshipCount() method
 * - Added missing getTooltipText() method
 * - Updated getVisualProperties() to use getRelationshipCount() method
 */
export class ConsolidatedRelationshipUtils {
    /**
     * Check if a relationship is consolidated (has multiple keywords)
     */
    static isConsolidated(link: RenderableLink | EnhancedLink): boolean {
        return Boolean(
            link.type === 'shared_keyword' &&
            link.metadata?.consolidatedKeywords &&
            link.metadata.consolidatedKeywords.relationCount > 1
        );
    }

    /**
     * ADDED: Get the number of relationships consolidated into this link
     */
    static getRelationshipCount(link: RenderableLink | EnhancedLink): number {
        if (link.metadata?.consolidatedKeywords) {
            return link.metadata.consolidatedKeywords.relationCount;
        }
        // Fallback to legacy relationCount or default to 1
        return link.metadata?.relationCount || 1;
    }

    /**
     * Get the primary display keyword for a relationship
     */
    static getPrimaryKeyword(link: RenderableLink | EnhancedLink): string {
        if (link.metadata?.consolidatedKeywords) {
            return link.metadata.consolidatedKeywords.primaryKeyword;
        }
        return link.metadata?.keyword || '';
    }

    /**
     * Get all keywords for a relationship (for tooltips, detailed views)
     */
    static getAllKeywords(link: RenderableLink | EnhancedLink): string[] {
        if (link.metadata?.consolidatedKeywords) {
            return link.metadata.consolidatedKeywords.sharedWords;
        }
        // Fallback to legacy sharedWords or single keyword
        if (link.metadata?.sharedWords) {
            return link.metadata.sharedWords;
        }
        return link.metadata?.keyword ? [link.metadata.keyword] : [];
    }

    /**
     * Get the effective strength for visual rendering (stroke width, etc.)
     */
    static getEffectiveStrength(link: RenderableLink | EnhancedLink): number {
        // If consolidated metadata exists, use its totalStrength
        if (link.metadata?.consolidatedKeywords) {
            return link.metadata.consolidatedKeywords.totalStrength;
        }
        // Fallback to direct strength or default
        return link.strength || 1.0;
    }

    /**
     * ADDED: Get tooltip text for a relationship
     */
    static getTooltipText(link: RenderableLink | EnhancedLink): string {
        const isConsolidated = this.isConsolidated(link);
        const keywords = this.getAllKeywords(link);
        const relationCount = this.getRelationshipCount(link);
        const effectiveStrength = this.getEffectiveStrength(link);
        
        if (isConsolidated) {
            return `Shared keywords: ${keywords.join(', ')} (${relationCount} relationships, strength: ${effectiveStrength.toFixed(2)})`;
        }
        
        const keyword = keywords[0] || 'connection';
        return `Shared keyword: ${keyword} (strength: ${effectiveStrength.toFixed(2)})`;
    }

    /**
     * Calculate visual rendering properties based on consolidated relationship
     * UPDATED: Now uses getRelationshipCount() method instead of direct access
     */
    static getVisualProperties(link: RenderableLink | EnhancedLink): {
        strokeWidth: number;
        opacity: number;
        dashArray: string;
        glowIntensity: number;
    } {
        const isConsolidated = this.isConsolidated(link);
        const effectiveStrength = this.getEffectiveStrength(link);
        const relationCount = this.getRelationshipCount(link); // FIXED: Use method instead of direct access
        
        // Calculate stroke width - consolidated relationships get thicker base
        const baseStrokeWidth = isConsolidated ? 2.0 : 1.5;
        const strokeWidth = Math.min(3.0, baseStrokeWidth + effectiveStrength * 1.5);
        
        // Calculate opacity - consolidated relationships get slight boost
        const baseOpacity = 0.6;
        const strengthBonus = effectiveStrength * 0.3;
        const consolidationBonus = isConsolidated ? 0.1 : 0;
        const opacity = Math.min(0.95, baseOpacity + strengthBonus + consolidationBonus);
        
        // Dash pattern for consolidated relationships
        const dashArray = isConsolidated ? '3,2' : 'none';
        
        // Glow intensity based on relationship count
        const glowIntensity = Math.min(8, 2 + (relationCount - 1) * 0.5);
        
        return {
            strokeWidth,
            opacity,
            dashArray,
            glowIntensity
        };
    }
}

// Utility functions for type compatibility with D3
export function asD3Nodes(nodes: EnhancedNode[]): SimulationNodeDatum[] {
    // This cast tells TypeScript to treat our nodes as compatible with D3
    return nodes as unknown as SimulationNodeDatum[];
}

export function asD3Links(links: EnhancedLink[]): SimulationLinkDatum<SimulationNodeDatum>[] {
    // This cast tells TypeScript to treat our links as compatible with D3
    return links as unknown as SimulationLinkDatum<SimulationNodeDatum>[];
}

// Data type guards
export const isUserProfileData = (data: any): data is UserProfile =>
    data && 'sub' in data;

export const isWordNodeData = (data: any): data is WordNode =>
    data && 'word' in data && 'definitions' in data;

export const isDefinitionData = (data: any): data is Definition =>
    data && 'definitionText' in data && 'createdBy' in data;

export const isNavigationData = (data: any): data is NavigationOption =>
    data && 'label' in data && 'icon' in data;

export const isStatementData = (data: any): data is StatementNode =>
    data && 'statement' in data && typeof data.statement === 'string';

export const isOpenQuestionData = (data: any): data is OpenQuestionNode =>
    data && 'questionText' in data && typeof data.questionText === 'string';

export const isQuantityData = (data: any): data is QuantityNode =>
    data && 'question' in data && 'unitCategoryId' in data && 'defaultUnitId' in data;

export const isCommentData = (data: any): data is CommentNode =>
    data && 'commentText' in data && 'createdBy' in data;

export const isCommentFormData = (data: any): data is CommentFormData =>
    data && 'id' in data && ('parentCommentId' in data || data.parentCommentId === null);

export const isControlNodeData = (data: any): data is ControlNodeData =>
    data && 'id' in data && !('word' in data) && !('statement' in data) && !('questionText' in data) && !('commentText' in data);

export const isAnswerData = (data: any): data is AnswerNode =>
    data && 'answerText' in data && typeof data.answerText === 'string' && 'questionId' in data;

export const isEvidenceData = (data: any): data is EvidenceNode =>
    data && 'title' in data && 'url' in data && 'evidenceType' in data && 'parentNodeId' in data;

export const isCategoryData = (data: any): data is CategoryNode =>
    typeof data === 'object' &&
    data !== null &&
    'name' in data &&
    typeof data.name === 'string';

// Node type guards
export const isDashboardNode = (node: RenderableNode): node is RenderableNode & { data: UserProfile } =>
    node.type === 'dashboard' && isUserProfileData(node.data);

export const isEditProfileNode = (node: RenderableNode): node is RenderableNode & { data: UserProfile } =>
    node.type === 'edit-profile' && isUserProfileData(node.data);

export const isCreateNodeNode = (node: RenderableNode): node is RenderableNode & { data: UserProfile } =>
    node.type === 'create-node' && isUserProfileData(node.data);

export const isWordNode = (node: RenderableNode): node is RenderableNode & { data: WordNode } =>
    node.type === 'word' && isWordNodeData(node.data);

export const isDefinitionNode = (node: RenderableNode): node is RenderableNode & { data: Definition } =>
    node.type === 'definition' && isDefinitionData(node.data);

export const isNavigationNode = (node: RenderableNode): node is RenderableNode & { data: NavigationOption } =>
    node.type === 'navigation' && isNavigationData(node.data);

export const isStatementNode = (node: RenderableNode): node is RenderableNode & { data: StatementNode } =>
    node.type === 'statement' && isStatementData(node.data);

export const isOpenQuestionNode = (node: RenderableNode): node is RenderableNode & { data: OpenQuestionNode } =>
    node.type === 'openquestion' && isOpenQuestionData(node.data);

export const isQuantityNode = (node: RenderableNode): node is RenderableNode & { data: QuantityNode } =>
    node.type === 'quantity' && isQuantityData(node.data);

export const isCommentNode = (node: RenderableNode): node is RenderableNode & { data: CommentNode } =>
    node.type === 'comment' && isCommentData(node.data);
    
export const isCommentFormNode = (node: RenderableNode): boolean =>
    node.type === 'comment-form' && isCommentFormData(node.data);

export const isControlNode = (node: RenderableNode): node is RenderableNode & { data: ControlNodeData } =>
    node.type === 'control' && isControlNodeData(node.data);

export const isCategoryNode = (node: RenderableNode): node is RenderableNode & { data: CategoryNode } =>
    node.type === 'category' && isCategoryData(node.data);

export const isAnswerNode = (node: RenderableNode): node is RenderableNode & { data: AnswerNode } =>
    node.type === 'answer' && isAnswerData(node.data);

export const isEvidenceNode = (node: RenderableNode): node is RenderableNode & { data: EvidenceNode } =>
    node.type === 'evidence' && isEvidenceData(node.data);

export const isStatementAnswerFormNode = (node: RenderableNode): boolean =>
    node.type === 'statement-answer-form' && isUserProfileData(node.data);

// Link type guards
export const isLiveLink = (link: RenderableLink): boolean =>
    link.type === 'live';

export const isAlternativeLink = (link: RenderableLink): boolean =>
    link.type === 'alternative';

export const isRelatedLink = (link: RenderableLink): boolean =>
    link.type === 'related';

export const isAnswersLink = (link: RenderableLink): boolean =>
    link.type === 'answers';

// ENHANCED: Universal graph link type guards with consolidated support
export const isSharedKeywordLink = (link: RenderableLink): boolean =>
    link.type === 'shared_keyword';

export const isConsolidatedSharedKeywordLink = (link: RenderableLink): boolean =>
    link.type === 'shared_keyword' && ConsolidatedRelationshipUtils.isConsolidated(link);

export const isRespondsToLink = (link: RenderableLink): boolean =>
    link.type === 'responds_to';

export const isRelatedToLink = (link: RenderableLink): boolean =>
    link.type === 'related_to';

export const isComposedOfLink = (link: RenderableLink): boolean =>
    link.type === 'composed_of';

export const isTaggedWithLink = (link: RenderableLink): boolean =>
    link.type === 'tagged_with';