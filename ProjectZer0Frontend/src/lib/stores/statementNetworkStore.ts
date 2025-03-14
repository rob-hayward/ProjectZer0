// src/lib/stores/statementNetworkStore.ts
import { writable, derived, get } from 'svelte/store';
import { fetchWithAuth } from '$lib/services/api';
import type { StatementNode } from '$lib/types/domain/nodes';

export type NetworkSortType = 'netPositive' | 'totalVotes' | 'chronological';
export type NetworkSortDirection = 'asc' | 'desc';

export interface NetworkFilter {
    type: 'keyword' | 'user' | 'date';
    value: string | number | boolean;
    operator?: 'AND' | 'OR';
}

export interface StatementNetworkState {
    statements: StatementNode[];
    isLoading: boolean;
    sortType: NetworkSortType;
    sortDirection: NetworkSortDirection;
    filters: NetworkFilter[];
    error: string | null;
}

function createStatementNetworkStore() {
    // Initial state
    const initialState: StatementNetworkState = {
        statements: [],
        isLoading: false,
        sortType: 'netPositive',
        sortDirection: 'desc',
        filters: [],
        error: null
    };
    
    const { subscribe, set, update } = writable<StatementNetworkState>(initialState);
    
    return {
        subscribe,
        
        // Load statements with optional filtering/sorting
        loadStatements: async (options?: {
            limit?: number;
            offset?: number;
            keywords?: string[];
            userId?: string;
        }) => {
            update(state => ({ ...state, isLoading: true, error: null }));
            
            try {
                // Build query parameters
                const params = new URLSearchParams();
                if (options?.limit) params.append('limit', options.limit.toString());
                if (options?.offset) params.append('offset', options.offset.toString());
                if (options?.keywords?.length) {
                    options.keywords.forEach(k => params.append('keyword', k));
                }
                if (options?.userId) params.append('userId', options.userId);
                
                // Get current state for sort info
                const currentState = get({ subscribe });
                params.append('sortBy', currentState.sortType);
                params.append('sortDirection', currentState.sortDirection);
                
                // Make API request
                const queryString = params.toString() ? `?${params.toString()}` : '';
                const statements = await fetchWithAuth(`/nodes/statement/network${queryString}`) as StatementNode[];
                
                update(state => ({ ...state, statements, isLoading: false }));
            } catch (error) {
                console.error('[StatementNetworkStore] Error loading statements:', error);
                update(state => ({ 
                    ...state, 
                    isLoading: false, 
                    error: error instanceof Error ? error.message : 'Unknown error loading statements'
                }));
            }
        },
        
        // Update sorting configuration
        setSorting: (sortType: NetworkSortType, sortDirection: NetworkSortDirection = 'desc') => {
            update(state => ({ ...state, sortType, sortDirection }));
        },
        
        // Add a new filter
        addFilter: (filter: NetworkFilter) => {
            update(state => ({ 
                ...state, 
                filters: [...state.filters, filter]
            }));
        },
        
        // Remove a filter by index
        removeFilter: (index: number) => {
            update(state => ({
                ...state,
                filters: state.filters.filter((_, i) => i !== index)
            }));
        },
        
        // Clear all filters
        clearFilters: () => {
            update(state => ({ ...state, filters: [] }));
        },
        
        // Reset the store to initial state
        reset: () => {
            set(initialState);
        }
    };
}

export const statementNetworkStore = createStatementNetworkStore();