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
    updateNodeVisibility: (nodeId: string, isHidden: boolean) => void; // New method
    setViewType: (viewType: ViewType) => void;
    getViewType: () => ViewType;
    fixNodePositions: () => void;
    stopSimulation: () => void;
    forceTick: () => void;
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
        
        // New method to update node visibility
        updateNodeVisibility: (nodeId: string, isHidden: boolean) => {
            isUpdatingStore.set(true);
            manager.updateNodeVisibility(nodeId, isHidden);
            isUpdatingStore.set(false);
        },

        setViewType: (viewType: ViewType) => {
            viewTypeStore.set(viewType);
            manager.updateViewType(viewType);
        },

        getViewType: () => get(viewTypeStore),

        // Method to enforce fixed positions
        fixNodePositions: () => {
            manager.fixNodePositions();
        },
        
        // Method to completely stop the simulation
        stopSimulation: () => {
            manager.stopSimulation();
        },
        
        // Method to force simulation ticks for immediate updates
        forceTick: () => {
            manager.forceTick();
        },

        dispose: () => {
            manager.stop();
        }
    };
}

export const graphStore = createGraphStore('dashboard');