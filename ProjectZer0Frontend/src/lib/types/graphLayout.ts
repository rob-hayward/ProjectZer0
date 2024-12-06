// src/lib/types/layout.ts

import type { Definition, WordNode } from './nodes';

// Sort mode type for alternative definitions
export type SortMode = 'newest' | 'popular';

// Node type for layout identification
export type NodeType = 'word' | 'liveDefinition' | 'alternativeDefinition';

// Props interfaces for preview components
export interface BasePreviewProps {
    isZoomed?: boolean;  
}

export interface WordPreviewProps extends BasePreviewProps {
    wordData: WordNode;
}

export interface DefinitionPreviewProps extends BasePreviewProps {
    definition: Definition;
    word: string;
}

// Props interface for ConcentricLayout
export interface ConcentricLayoutProps {
    wordData: WordNode;
    sortMode?: SortMode;
}

// Base position interface for any node
export interface NodePosition {
    x: number;
    y: number;
    scale: number;
    rotation?: number;
}

// Specific position interface for nodes in concentric layout
export interface ConcentricNodePosition extends NodePosition {
    ring: number;         // Which ring from center (0 is center)
    ringPosition: number; // Position within the ring (0 to 1)
    distanceFromCenter: number;
}

// Configuration for the concentric layout
export interface ConcentricLayoutConfig {
    centerRadius: number;     // Radius for center node
    ringSpacing: number;      // Space between rings
    minNodeSize: number;      // Minimum size for nodes
    maxNodeSize: number;      // Maximum size for nodes
    initialZoom: number;      // Initial zoom level
    minZoom: number;         // Minimum zoom level
    maxZoom: number;         // Maximum zoom level
}

// Layout state including zoom and pan
export interface LayoutState {
    zoom: number;
    panX: number;
    panY: number;
    sortMode: SortMode;
    isTransitioning: boolean;
}

// Transition configuration
export interface TransitionConfig {
    duration: number;         // Duration in milliseconds
    easingFunction: string;   // CSS easing function
}

// Combined layout context
export interface LayoutContext {
    config: ConcentricLayoutConfig;
    state: LayoutState;
    transitions: TransitionConfig;
}

// Node metadata for layout calculations
export interface NodeLayoutMetadata {
    id: string;
    timestamp: Date;
    votesCount: number;
    size: number;            // Calculated size based on importance
    nodeType: NodeType;     // Identifies the type of node for layout
    position: ConcentricNodePosition;
}