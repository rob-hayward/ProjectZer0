// src/lib/stores/graphStore.ts - Enhanced with Phantom Links Interface

import { derived, writable, get, type Readable } from 'svelte/store';
import type { 
    GraphData,
    GraphNode, 
    ViewType, 
    NodeMode, 
    RenderableNode, 
    RenderableLink, 
    LayoutUpdateConfig 
} from '$lib/types/graph/enhanced';
import { GraphManager } from '$lib/services/graph/GraphManager';
import { UniversalGraphManager } from '$lib/services/graph/UniversalGraphManager';

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
    
    // ENHANCED: Universal-specific methods (available when using UniversalGraphManager)
    syncDataGently?: (data: Partial<GraphData>) => void;
    updateState?: (newData?: Partial<GraphData>, wakePower?: number) => void;
    getPerformanceMetrics?: () => any;
    enableBatchRendering?: (enable: boolean) => void;
    getBatchDebugInfo?: () => any;
    getShouldRenderLinks?: () => boolean; 
    updateNavigationPositions?: (navigationNodes: GraphNode[]) => void;
    switchCentralNode?: (newCentralNode: GraphNode) => void;
}

/**
 * Type guard to check if manager is UniversalGraphManager
 */
function isUniversalGraphManager(manager: any): manager is UniversalGraphManager {
    return manager instanceof UniversalGraphManager;
}

/**
 * Interface that both managers must implement
 */
interface IGraphManager {
    // Core data management
    setData(data: GraphData, config?: LayoutUpdateConfig): void;
    
    // Node operations
    updateNodeMode(nodeId: string, mode: NodeMode): void;
    updateNodeVisibility(nodeId: string, isHidden: boolean, hiddenReason?: 'community' | 'user'): void;
    applyVisibilityPreferences(preferences: Record<string, boolean>): void;
    
    // Simulation control
    stop(): void;
    forceTick(ticks?: number): void;
    
    // View management
    updateViewType?(viewType: ViewType): void;
    
    // Store access - FIXED: Make these optional since interfaces differ
    renderableNodes?: any;
    renderableLinks?: any;
    viewType?: ViewType;
}

export function createGraphStore(initialViewType: ViewType): GraphStore {
    // ENHANCED: Direct manager instantiation without factory
    let manager: any; // Use any temporarily to debug interface issues
    
    if (initialViewType === 'universal') {
        console.log('[GraphStore] Creating specialized UniversalGraphManager for optimal performance');
        manager = new UniversalGraphManager();
        
        console.log('[GraphStore] UniversalGraphManager created, checking interface:', {
            hasSetData: typeof manager.setData === 'function',
            hasRenderableNodes: !!manager.renderableNodes,
            hasRenderableLinks: !!manager.renderableLinks,
            renderableNodesType: typeof manager.renderableNodes,
            renderableLinksType: typeof manager.renderableLinks,
            hasGetShouldRenderLinks: typeof manager.getShouldRenderLinks === 'function', // NEW
            getShouldRenderLinksResult: typeof manager.getShouldRenderLinks === 'function' ? manager.getShouldRenderLinks() : 'N/A'
        });
    } else {
        console.log(`[GraphStore] Creating standard GraphManager for view: ${initialViewType}`);
        manager = new GraphManager(initialViewType);
    }
    
    const viewTypeStore = writable<ViewType>(initialViewType);
    const isUpdatingStore = writable(false);

    // Log manager creation for debugging
    console.log(`[GraphStore] Created ${isUniversalGraphManager(manager) ? 'specialized' : 'standard'} manager for ${initialViewType}`);

    // ENHANCED: More robust store access with debugging
    let nodesStore: Readable<RenderableNode[]>;
    let linksStore: Readable<RenderableLink[]>;
    
    if (isUniversalGraphManager(manager)) {
        // Universal manager has readonly properties
        console.log('[GraphStore] Setting up UniversalGraphManager stores');
        
        if (manager.renderableNodes && manager.renderableLinks) {
            nodesStore = manager.renderableNodes;
            linksStore = manager.renderableLinks;
            console.log('[GraphStore] Successfully bound to UniversalGraphManager stores');
        } else {
            console.error('[GraphStore] UniversalGraphManager missing renderableNodes or renderableLinks!');
            nodesStore = writable([]);
            linksStore = writable([]);
        }
    } else {
        // Standard manager setup
        console.log('[GraphStore] Setting up StandardGraphManager stores');
        nodesStore = derived((manager as any).renderableNodes || writable([]), (nodes) => {
            if (!nodes) {
                console.warn('[GraphStore] No nodes available from standard manager');
                return [] as RenderableNode[];
            }
            return nodes as RenderableNode[];
        });
        
        linksStore = derived((manager as any).renderableLinks || writable([]), (links) => {
            if (!links) {
                console.warn('[GraphStore] No links available from standard manager');
                return [] as RenderableLink[];
            }
            return links as RenderableLink[];
        });
    }

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
            console.log('[GraphStore] setData called with:', {
                nodeCount: data.nodes?.length || 0,
                linkCount: data.links?.length || 0,
                managerType: isUniversalGraphManager(manager) ? 'Universal' : 'Standard',
                viewType: initialViewType,
                hasManagerSetData: typeof manager.setData === 'function'
            });
            
            isUpdatingStore.set(true);
            
            try {
                // Add debugging around the actual setData call
                console.log('[GraphStore] Calling manager.setData...');
                manager.setData(data, config);
                console.log('[GraphStore] manager.setData completed');
                
                // Check if data was processed
                if (isUniversalGraphManager(manager)) {
                    setTimeout(() => {
                        const metrics = manager.getPerformanceMetrics();
                        console.log('[GraphStore] Post-setData metrics:', metrics);
                    }, 100);
                }
            } catch (error) {
                console.error('[GraphStore] Error in manager.setData:', error);
                throw error;
            }
            
            isUpdatingStore.set(false);
            
            // ENHANCED: Log performance improvements for universal manager
            if (isUniversalGraphManager(manager)) {
                const metrics = manager.getPerformanceMetrics();
                console.log('[GraphStore] Universal manager performance:', metrics);
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
        }
    };

    // ENHANCED: Add universal-specific methods if this is a universal manager
    if (isUniversalGraphManager(manager)) {
        baseStore.syncDataGently = (data: Partial<GraphData>) => {
            manager.syncDataGently(data);
        };

        baseStore.updateState = (newData?: Partial<GraphData>, wakePower: number = 0.2) => {
            manager.updateState(newData, wakePower);
        };

        baseStore.getPerformanceMetrics = () => {
            return manager.getPerformanceMetrics();
        };

        baseStore.enableBatchRendering = (enable: boolean) => {
            manager.enableBatchRendering(enable);
        };

        baseStore.getBatchDebugInfo = () => {
            return manager.getBatchDebugInfo();
        };

        // NEW: Add phantom links support
        baseStore.getShouldRenderLinks = () => {
            return manager.getShouldRenderLinks();
        };

            baseStore.updateNavigationPositions = (navigationNodes: GraphNode[]) => {
            console.log('[GraphStore] updateNavigationPositions called, forwarding to manager');
            manager.updateNavigationPositions(navigationNodes);
        };

        baseStore.switchCentralNode = (newCentralNode: GraphNode) => {
        manager.switchCentralNode(newCentralNode);
    };

    }

    return baseStore;
}

// PRESERVED: Export the current global graph store instance (for backward compatibility)
export const graphStore = createGraphStore('dashboard');

// SIMPLIFIED: Direct manager type checking (no factory needed)
export function isUniversalManager(viewType: ViewType): boolean {
    return viewType === 'universal';
}

// SIMPLIFIED: Performance info without factory
export function getPerformanceInfo(viewType: ViewType) {
    if (viewType === 'universal') {
        return {
            managerType: 'specialized' as const,
            optimizations: [
                'Consolidated relationship processing',
                'Optimized D3 force simulation',
                'Performance metrics tracking',
                'Cached link path calculation',
                'Batch visibility updates',
                'Gentle sync for settled states',
                'Phantom links conditional rendering' // NEW
            ],
            expectedBenefits: [
                '70% reduction in rendered links',
                'Faster graph settling',
                'Smoother interactions',
                'Reduced memory usage',
                'Real-time performance monitoring',
                'Position preservation during updates',
                'Smooth link reveals post-settlement' // NEW
            ]
        };
    } else {
        return {
            managerType: 'standard' as const,
            optimizations: [
                'Multi-view support',
                'Dynamic layout strategies',
                'Comprehensive node type handling'
            ],
            expectedBenefits: [
                'Supports all graph view types',
                'Consistent behavior across views',
                'Full feature compatibility'
            ]
        };
    }
}

// ENHANCED: Function to create store with logging
export function createOptimizedGraphStore(viewType: ViewType): GraphStore {
    console.log(`[GraphStore] Creating ${isUniversalManager(viewType) ? 'optimized' : 'standard'} store for ${viewType} view`);
    return createGraphStore(viewType);
}