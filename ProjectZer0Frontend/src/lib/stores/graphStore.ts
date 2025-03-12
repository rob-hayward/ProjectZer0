// src/lib/stores/graphStore.ts
import { derived, writable, get, type Readable } from 'svelte/store';
import type { 
    GraphData, 
    ViewType, 
    NodeMode, 
    NodeType,
    GraphNode,
    GraphLink,
    EnhancedNode
} from '$lib/types/graph/enhanced';
import type { RenderableNode, RenderableLink, LayoutUpdateConfig } from '$lib/types/graph/enhanced';
import { GraphManager } from '$lib/services/graph/GraphManager';

export interface GraphState {
    nodes: RenderableNode[];
    links: RenderableLink[];
    viewType: ViewType;
    isUpdating: boolean;
}

export interface GraphStore {
    subscribe: Readable<GraphState>['subscribe'];
    setData: (data: GraphData, config?: LayoutUpdateConfig) => void;
    updateNodeMode: (nodeId: string, mode: NodeMode) => void;
    updateNodeVisibility: (nodeId: string, isHidden: boolean, hiddenReason?: 'community' | 'user') => void; 
    recalculateNodeVisibility: (nodeId: string, positiveVotes: number, negativeVotes: number, userPreference?: boolean) => void;
    applyVisibilityPreferences: (preferences: Record<string, boolean>) => void;
    setViewType: (viewType: ViewType) => void;
    getViewType: () => ViewType;
    fixNodePositions: () => void;
    stopSimulation: () => void;
    forceTick: (ticks?: number) => void; // Updated to accept an optional parameter
    dispose: () => void;
}

export function createGraphStore(initialViewType: ViewType): GraphStore {
    // Create manager and stores
    const manager = new GraphManager(initialViewType);
    const viewTypeStore = writable<ViewType>(initialViewType);
    const isUpdatingStore = writable(false);

    // Create derived store for complete graph state
    const graphState = derived(
        [manager.renderableNodes, manager.renderableLinks, viewTypeStore, isUpdatingStore],
        ([nodes, links, viewType, isUpdating]) => ({
            nodes,
            links,
            viewType,
            isUpdating
        })
    );

    return {
        subscribe: graphState.subscribe,

        setData: (data: GraphData, config?: LayoutUpdateConfig) => {
            isUpdatingStore.set(true);
            manager.setData(data, config);
            isUpdatingStore.set(false);
        },

        updateNodeMode: (nodeId: string, mode: NodeMode) => {
            isUpdatingStore.set(true);
            manager.updateNodeMode(nodeId, mode);
            isUpdatingStore.set(false);
        },
        
        updateNodeVisibility: (nodeId: string, isHidden: boolean, hiddenReason: 'community' | 'user' = 'user') => {
            isUpdatingStore.set(true);
            manager.updateNodeVisibility(nodeId, isHidden, hiddenReason);
            isUpdatingStore.set(false);
        },
        
        recalculateNodeVisibility: (nodeId: string, positiveVotes: number, negativeVotes: number, userPreference?: boolean) => {
            isUpdatingStore.set(true);
            manager.recalculateNodeVisibility(nodeId, positiveVotes, negativeVotes, userPreference);
            isUpdatingStore.set(false);
        },
        
        // Method to apply all visibility preferences
        applyVisibilityPreferences: (preferences: Record<string, boolean>) => {
            isUpdatingStore.set(true);
            // Use type assertion to avoid TypeScript errors
            (manager as any).applyVisibilityPreferences(preferences);
            isUpdatingStore.set(false);
        },

        setViewType: (viewType: ViewType) => {
            viewTypeStore.set(viewType);
            // Use type assertion to avoid TypeScript errors
            (manager as any).updateViewType(viewType);
        },

        getViewType: () => get(viewTypeStore),

        fixNodePositions: () => {
            manager.fixNodePositions();
        },
        
        stopSimulation: () => {
            manager.stopSimulation();
        },
        
        forceTick: (ticks = 1) => { // Updated to accept a parameter with default value
            manager.forceTick(ticks);
        },

        dispose: () => {
            manager.stop();
        }
    };
}

export const graphStore = createGraphStore('dashboard');