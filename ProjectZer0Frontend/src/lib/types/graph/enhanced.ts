// src/lib/types/graph/enhanced.ts
import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
import type { Definition, WordNode, NodeStyle, StatementNode, OpenQuestionNode, QuantityNode, CommentNode, CommentFormData } from '../domain/nodes';
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
export type ViewType = 'dashboard' | 'edit-profile' | 'create-node' | 'word' | 'statement' | 'openquestion' | 'network' | 'create-definition' | 'statement-network' | 'quantity' | 'discussion';
export type NodeType = 'dashboard' | 'edit-profile' | 'create-node' | 'navigation' | 'word' | 'definition' | 'statement' | 'statement-answer-form' | 'openquestion' | 'quantity' |'comment' | 'comment-form' | 'control';
export type NodeGroup = 'central' | 'navigation' | 'word' | 'live-definition' | 'alternative-definition' | 'statement' | 'statement-answer-form' | 'openquestion' | 'quantity' | 'comment' | 'comment-form' | 'control';
export type LinkType = 'live' | 'alternative' | 'related' | 'comment' | 'reply' | 'comment-form' | 'reply-form' | 'answers';
export type NodeMode = 'preview' | 'detail';

// Metadata type for enhanced nodes
export interface NodeMetadata {
    centralRadius?: number;
    group: 'central' | 'word' | 'definition' | 'navigation' | 'statement' | 'openquestion' | 'quantity'| 'comment' | 'comment-form' | 'control';
    fixed?: boolean;
    isDetail?: boolean;
    votes?: number;
    createdAt?: string;
    angle?: number;    // For navigation node positioning
    radius?: number;   // For radial positioning
    golden?: number;   // For golden ratio-based layouts
    parentCommentId?: string; // Added for comment threading
    depth?: number;    // Added for comment nesting level
    isExpanded?: boolean; // Added for expanded comments
}

// Core node interface for initial data
export interface GraphNode {
    id: string;
    type: NodeType;
    data: UserProfile | NavigationOption | WordNode | Definition | StatementNode | OpenQuestionNode | QuantityNode | CommentNode | CommentFormData | ControlNodeData;
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
    data: UserProfile | NavigationOption | WordNode | Definition | StatementNode | OpenQuestionNode | QuantityNode | CommentNode | CommentFormData | ControlNodeData;
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

    // Layout metadata
    metadata: NodeMetadata;
}

// Enhanced link for D3 simulation
// We use a type assertion to make it compatible with D3
export type EnhancedLink = {
    id: string;
    source: string | EnhancedNode;
    target: string | EnhancedNode;
    type: LinkType;
    strength?: number;
    index?: number;
    relationshipType?: 'direct' | 'keyword';
    metadata?: {
        sharedWords?: string[];
        relationCount?: number;
        [key: string]: any;
    };
};

// Ready-to-render link with pre-calculated path
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
    metadata?: {
        sharedWords?: string[];
        relationCount?: number;
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
        [key: string]: any;
    };
}

// Position type for consistent positioning
export interface NodePosition {
    x: number;
    y: number;
    svgTransform: string;
}

// Ready-to-render node with all display information
export interface RenderableNode {
    id: string;
    type: NodeType;
    group: NodeGroup;
    mode?: NodeMode;
    isHidden?: boolean;
    hiddenReason?: 'community' | 'user';
    data: UserProfile | NavigationOption | WordNode | Definition | StatementNode | OpenQuestionNode | QuantityNode | CommentNode | CommentFormData | ControlNodeData;
    radius: number;
    position: NodePosition;
    style: NodeStyle;
    metadata: NodeMetadata; // Added for consistent access
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
    openQuestionData?: OpenQuestionNode | null; // Add openQuestion data
    quantityData?: QuantityNode | null; // Add quantity data
    nodes?: GraphNode[];
    links?: GraphLink[];
    _routeKey?: string; // Added for forcing re-renders on navigation
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