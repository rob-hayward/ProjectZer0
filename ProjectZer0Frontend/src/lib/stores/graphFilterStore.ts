// src/lib/stores/graphFilterStore.ts
import { writable, derived, get } from 'svelte/store';
import { statementNetworkStore, type NetworkSortType } from './statementNetworkStore';
// Future imports for other network stores could go here:
// import { wordNetworkStore } from './wordNetworkStore';
// import { definitionNetworkStore } from './definitionNetworkStore';

export type FilterOperator = 'AND' | 'OR';
export type SortDirection = 'asc' | 'desc';
export type GraphViewType = 'statement-network' | 'word-network' | 'definition-network';

// Generic sort types that could be used across different views
export type GraphSortType = NetworkSortType | 'alphabetical' | 'definitionCount';

// Interface for network stores to enforce type safety
interface NetworkStore {
    applyKeywordFilter: (keywords: string[], operator: FilterOperator) => Promise<void>;
    applyUserFilter: (userId?: string) => Promise<void>;
    applyNodeTypeFilter?: (nodeTypes: string[], operator: FilterOperator) => Promise<void>;
    setSorting: (sortType: any, sortDirection: SortDirection) => Promise<void>;
    clearFilters: () => Promise<void>;
}

export interface GraphFilterState {
    // Current view type
    viewType: GraphViewType;
    
    // Sorting
    sortType: string;
    sortDirection: SortDirection;
    
    // Filtering
    keywords: string[];
    keywordOperator: FilterOperator;
    nodeTypes: string[];
    nodeTypeOperator: FilterOperator;
    userId?: string;
    
    // UI State
    isPanelExpanded: boolean;
    isLoading: boolean;
}

function createGraphFilterStore() {
    // Initialize with default values
    const initialState: GraphFilterState = {
        viewType: 'statement-network',
        sortType: 'netPositive',
        sortDirection: 'desc',
        keywords: [],
        keywordOperator: 'OR',
        nodeTypes: [],
        nodeTypeOperator: 'OR',
        userId: undefined,
        isPanelExpanded: true,
        isLoading: false
    };
    
    const { subscribe, set, update } = writable<GraphFilterState>(initialState);
    
    // Helper to determine which store to use based on view type
    function getStoreForViewType(viewType: GraphViewType): NetworkStore {
        switch (viewType) {
            case 'statement-network':
                return statementNetworkStore as unknown as NetworkStore;
            // Add other stores as they become available:
            // case 'word-network':
            //     return wordNetworkStore as unknown as NetworkStore;
            // case 'definition-network':
            //     return definitionNetworkStore as unknown as NetworkStore;
            default:
                return statementNetworkStore as unknown as NetworkStore; // Fallback to statement store
        }
    }
    
    // Apply all current filters to the appropriate network store
    async function applyFilters() {
        const state = get({ subscribe });
        const targetStore = getStoreForViewType(state.viewType);
        
        update(s => ({ ...s, isLoading: true }));
        
        try {
            // Apply keyword filter
            await targetStore.applyKeywordFilter(state.keywords, state.keywordOperator);
            
            // Apply user filter
            await targetStore.applyUserFilter(state.userId);
            
            // Apply node type filter (if supported)
            if (targetStore.applyNodeTypeFilter && state.nodeTypes.length > 0) {
                await targetStore.applyNodeTypeFilter(state.nodeTypes, state.nodeTypeOperator);
            }
            
            console.log('[GraphFilterStore] Applied filters:', { 
                keywords: state.keywords, 
                user: state.userId, 
                nodeTypes: state.nodeTypes
            });
        } catch (error) {
            console.error('[GraphFilterStore] Error applying filters:', error);
        } finally {
            update(s => ({ ...s, isLoading: false }));
        }
    }
    
    return {
        subscribe,
        
        /**
         * Set the view type and reset filters if needed
         */
        setViewType: (viewType: GraphViewType, resetFilters = true) => {
            update(state => {
                // If resetting filters or changing to a different view type, clear existing filters
                if (resetFilters || state.viewType !== viewType) {
                    return {
                        ...initialState,
                        viewType
                    };
                }
                return {
                    ...state,
                    viewType
                };
            });
        },
        
        /**
         * Set sort type and direction
         */
        setSorting: async (sortType: string, sortDirection: SortDirection = 'desc') => {
            update(state => ({
                ...state,
                sortType,
                sortDirection,
                isLoading: true
            }));
            
            try {
                const newState = get({ subscribe });
                const targetStore = getStoreForViewType(newState.viewType);
                
                // Apply sorting if store supports it
                // We need to cast the sortType to any because each store might expect a different type
                await targetStore.setSorting(sortType as any, sortDirection);
                
                console.log('[GraphFilterStore] Applied sorting:', { 
                    type: sortType, 
                    direction: sortDirection 
                });
            } catch (error) {
                console.error('[GraphFilterStore] Error applying sorting:', error);
            } finally {
                update(s => ({ ...s, isLoading: false }));
            }
        },
        
        /**
         * Set keyword filter
         */
        setKeywordFilter: async (keywords: string[], operator: FilterOperator = 'OR') => {
            update(state => ({
                ...state,
                keywords,
                keywordOperator: operator
            }));
            
            await applyFilters();
        },
        
        /**
         * Set node type filter
         */
        setNodeTypeFilter: async (nodeTypes: string[], operator: FilterOperator = 'OR') => {
            update(state => ({
                ...state,
                nodeTypes,
                nodeTypeOperator: operator
            }));
            
            await applyFilters();
        },
        
        /**
         * Set user filter
         */
        setUserFilter: async (userId?: string) => {
            update(state => ({
                ...state,
                userId
            }));
            
            await applyFilters();
        },
        
        /**
         * Apply all current filters
         */
        applyAllFilters: async () => {
            await applyFilters();
        },
        
        /**
         * Clear all filters
         */
        clearFilters: async () => {
            update(state => ({
                ...state,
                keywords: [],
                keywordOperator: 'OR',
                nodeTypes: [],
                nodeTypeOperator: 'OR',
                userId: undefined
            }));
            
            const newState = get({ subscribe });
            const targetStore = getStoreForViewType(newState.viewType);
            
            await targetStore.clearFilters();
        },
        
        /**
         * Toggle panel expanded state
         */
        togglePanel: () => {
            update(state => ({
                ...state,
                isPanelExpanded: !state.isPanelExpanded
            }));
        },
        
        /**
         * Reset to default state
         */
        reset: () => {
            set(initialState);
        },
        
        /**
         * Apply entire filter configuration at once (useful for initial setup)
         */
        applyConfiguration: async (config: Partial<GraphFilterState>) => {
            update(state => ({
                ...state,
                ...config
            }));
            
            await applyFilters();
        }
    };
}

export const graphFilterStore = createGraphFilterStore();