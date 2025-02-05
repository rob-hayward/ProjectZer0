// src/lib/types/graph/props.ts
import type { GraphData, ViewType } from './core';
import type { BackgroundConfig } from './background';
import type { NodeMode } from '$lib/types/nodes';

export interface GraphProps {
    data: GraphData;
    width?: number;
    height?: number;
    viewType: ViewType;
    backgroundConfig?: Partial<BackgroundConfig>;
    isPreviewMode?: boolean;
}

export interface GraphLayoutProps {
    data: GraphData;
    width: number;
    height: number;
    viewType: ViewType;
    isPreviewMode: boolean;
}

export interface LayoutEngineConfig {
    width: number;
    height: number;
    viewType: ViewType;
    isPreviewMode?: boolean;
}

// Update Graph.svelte props
export interface GraphEvents {
    modechange: CustomEvent<{ nodeId: string; mode: NodeMode }>;
}

export interface LayoutStrategyConfig {
    width: number;
    height: number;
    viewType: ViewType;
    isPreviewMode?: boolean;
}