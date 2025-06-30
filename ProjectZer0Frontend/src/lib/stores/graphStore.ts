// src/lib/stores/graphStore.ts - Enhanced with Universal Manager support and Batch Rendering interface

import { derived, writable, get, type Readable } from 'svelte/store';
import type { 
    GraphData, 
    ViewType, 
    NodeMode, 
    RenderableNode, 
    RenderableLink, 
    LayoutUpdateConfig 
} from '$lib/types/graph/enhanced';
import { GraphManagerFactory, type IGraphManager, isUniversalGraphManager } from '$lib/services/graph/GraphManagerFactory';

export interface GraphState {
    nodes: RenderableNode[];
    links: RenderableLink[];
    viewType: ViewType;
    isUpdating: boolean;
}

export interface GraphStore {
    getState(): unknown;
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
    forceTick: (ticks?: number) => void;
    dispose: () => void;
    
    // ENHANCED: Performance metrics for specialized managers
    getPerformanceMetrics?: () => any;
    
    // NEW: Batch rendering methods (optional - only available on UniversalGraphManager)
    enableBatchRendering?: (enable: boolean) => void;
    getBatchDebugInfo?: () => any;
}

export function createGraphStore(initialViewType: ViewType): GraphStore {
    // ENHANCED: Create manager using factory pattern
    const manager = GraphManagerFactory.createManager(initialViewType);
    const viewTypeStore = writable<ViewType>(initialViewType);
    const isUpdatingStore = writable(false);

    // Log manager creation for debugging
    const performanceInfo = GraphManagerFactory.getPerformanceInfo(initialViewType);
    console.log(`[GraphStore] Created ${performanceInfo.managerType} manager for ${initialViewType}:`, performanceInfo.optimizations);

    // FIXED: Create properly typed derived stores
    const nodesStore = derived(manager.renderableNodes, (nodes) => nodes as RenderableNode[]);
    const linksStore = derived(manager.renderableLinks, (links) => links as RenderableLink[]);

    // Create derived store for complete graph state
    const graphState = derived(
        [nodesStore, linksStore, viewTypeStore, isUpdatingStore],
        ([nodes, links, viewType, isUpdating]): GraphState => ({
            nodes,
            links,
            viewType,
            isUpdating
        })
    );

    // Base store implementation
    const baseStore: GraphStore = {
        getState: () => {
            const state = get(graphState);
            
            // ENHANCED: Include performance metrics if available
            if (isUniversalGraphManager(manager)) {
                return {
                    ...state,
                    performanceMetrics: manager.getPerformanceMetrics()
                };
            }
            
            return state;
        },

        subscribe: graphState.subscribe,

        setData: (data: GraphData, config?: LayoutUpdateConfig) => {
            isUpdatingStore.set(true);
            manager.setData(data, config);
            isUpdatingStore.set(false);
            
            // ENHANCED: Log performance improvements for universal manager
            if (isUniversalGraphManager(manager)) {
                const metrics = manager.getPerformanceMetrics();
                if (metrics.consolidationRatio > 1) {
                    console.log(`[GraphStore] Universal graph optimized: ${metrics.consolidationRatio.toFixed(2)}x relationship reduction (${metrics.originalRelationshipCount} → ${metrics.consolidatedRelationshipCount})`);
                }
            }
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
            // Only available on standard GraphManager
            if (!isUniversalGraphManager(manager) && (manager as any).recalculateNodeVisibility) {
                isUpdatingStore.set(true);
                (manager as any).recalculateNodeVisibility(nodeId, positiveVotes, negativeVotes, userPreference);
                isUpdatingStore.set(false);
            } else {
                console.warn('[GraphStore] recalculateNodeVisibility not available on current manager type');
            }
        },
        
        // Method to apply all visibility preferences
        applyVisibilityPreferences: (preferences: Record<string, boolean>) => {
            isUpdatingStore.set(true);
            manager.applyVisibilityPreferences(preferences);
            isUpdatingStore.set(false);
        },

        setViewType: (viewType: ViewType) => {
            const currentViewType = get(viewTypeStore);
            if (currentViewType === viewType) return;
            
            viewTypeStore.set(viewType);
            
            // ENHANCED: Handle view type changes intelligently
            if (isUniversalGraphManager(manager)) {
                // Universal manager only handles universal view
                if (viewType !== 'universal') {
                    console.warn('[GraphStore] Universal manager cannot handle non-universal views. Consider recreating store.');
                }
            } else {
                // Standard manager can handle view type changes
                if ((manager as any).updateViewType) {
                    (manager as any).updateViewType(viewType);
                }
            }
        },

        getViewType: () => {
            if (isUniversalGraphManager(manager)) {
                return 'universal';
            } else if ((manager as any).viewType) {
                return (manager as any).viewType;
            }
            return get(viewTypeStore);
        },

        fixNodePositions: () => {
            // Available on standard GraphManager, not needed on Universal (has optimized positioning)
            if (!isUniversalGraphManager(manager) && (manager as any).fixNodePositions) {
                (manager as any).fixNodePositions();
            } else if (isUniversalGraphManager(manager)) {
                // Universal manager handles positioning automatically
                manager.forceTick(1);
            }
        },
        
        stopSimulation: () => {
            manager.stop();
        },
        
        forceTick: (ticks = 1) => {
            manager.forceTick(ticks);
        },

        dispose: () => {
            manager.stop();
        },
        
        // ENHANCED: Performance metrics access
        getPerformanceMetrics: isUniversalGraphManager(manager) ? () => {
            return manager.getPerformanceMetrics();
        } : undefined
    };

    // NEW: Add batch rendering methods if this is a universal manager
    if (isUniversalGraphManager(manager)) {
        baseStore.enableBatchRendering = (enable: boolean) => {
            manager.enableBatchRendering(enable);
        };

        baseStore.getBatchDebugInfo = () => {
            return manager.getBatchDebugInfo();
        };
    }

    return baseStore;
}

// PRESERVED: Export the current global graph store instance (for backward compatibility)
export const graphStore = createGraphStore('dashboard');

// ENHANCED: Utility functions for performance monitoring
export function getGraphPerformanceInfo(viewType: ViewType) {
    return GraphManagerFactory.getPerformanceInfo(viewType);
}

export function hasOptimizedGraphManager(viewType: ViewType): boolean {
    return GraphManagerFactory.hasSpecializedManager(viewType);
}

// ENHANCED: Function to create optimized store for specific view types
export function createOptimizedGraphStore(viewType: ViewType): GraphStore {
    const store = createGraphStore(viewType);
    
    // Log optimization status
    if (hasOptimizedGraphManager(viewType)) {
        console.log(`[GraphStore] Created optimized store for ${viewType} view with specialized manager`);
    } else {
        console.log(`[GraphStore] Created standard store for ${viewType} view`);
    }
    
    return store;
}