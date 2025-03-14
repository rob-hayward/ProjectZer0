// src/lib/stores/statementNetworkStore.ts
import { writable, derived, get } from 'svelte/store';
import { fetchWithAuth } from '$lib/services/api';
import type { StatementNode, Keyword } from '$lib/types/domain/nodes';

export type NetworkSortType = 'netPositive' | 'totalVotes' | 'chronological';
export type NetworkSortDirection = 'asc' | 'desc';
export type NetworkFilterOperator = 'AND' | 'OR';

export interface NetworkFilter {
    type: 'keyword' | 'user' | 'date';
    value: string | number | boolean;
}

export interface StatementNetworkState {
    // All statements fetched from the API
    allStatements: StatementNode[];
    // Filtered statements based on active filters
    filteredStatements: StatementNode[];
    // Current state
    isLoading: boolean;
    sortType: NetworkSortType;
    sortDirection: NetworkSortDirection;
    filterKeywords: string[];
    filterKeywordOperator: NetworkFilterOperator;
    filterUserId?: string;
    error: string | null;
}

function createStatementNetworkStore() {
    // Initial state
    const initialState: StatementNetworkState = {
        allStatements: [],
        filteredStatements: [],
        isLoading: false,
        sortType: 'netPositive',
        sortDirection: 'desc',
        filterKeywords: [],
        filterKeywordOperator: 'OR',
        error: null
    };
    
    const { subscribe, set, update } = writable<StatementNetworkState>(initialState);
    
    // Apply filters to get filtered statements
    function applyFilters(
        statements: StatementNode[], 
        keywords: string[], 
        operator: NetworkFilterOperator,
        userId?: string
    ): StatementNode[] {
        if (keywords.length === 0 && !userId) {
            return statements;
        }
        
        return statements.filter(statement => {
            // User filter
            if (userId && statement.createdBy !== userId) {
                return false;
            }
            
            // No keyword filters
            if (keywords.length === 0) {
                return true;
            }
            
            // Extract all keywords from statement
            const statementKeywords = (statement.keywords || []).map(k => k.word.toLowerCase());
            
            // Apply keyword filter with the specified operator
            if (operator === 'AND') {
                return keywords.every(keyword => 
                    statementKeywords.includes(keyword.toLowerCase())
                );
            } else {
                return keywords.some(keyword => 
                    statementKeywords.includes(keyword.toLowerCase())
                );
            }
        });
    }
    
    // Helper to sort statements
    function sortStatements(
        statements: StatementNode[], 
        sortType: NetworkSortType, 
        direction: NetworkSortDirection
    ): StatementNode[] {
        return [...statements].sort((a, b) => {
            let comparison = 0;
            
            if (sortType === 'netPositive') {
                const aNet = (a.positiveVotes || 0) - (a.negativeVotes || 0);
                const bNet = (b.positiveVotes || 0) - (b.negativeVotes || 0);
                comparison = aNet - bNet;
            } 
            else if (sortType === 'totalVotes') {
                const aTotal = (a.positiveVotes || 0) + (a.negativeVotes || 0);
                const bTotal = (b.positiveVotes || 0) + (b.negativeVotes || 0);
                comparison = aTotal - bTotal;
            }
            else if (sortType === 'chronological') {
                const aDate = new Date(a.createdAt).getTime();
                const bDate = new Date(b.createdAt).getTime();
                comparison = aDate - bDate;
            }
            
            return direction === 'desc' ? -comparison : comparison;
        });
    }
    
    return {
        subscribe,
        
        // Load statements from the database
        loadStatements: async (options?: {
            sortType?: NetworkSortType;
            sortDirection?: NetworkSortDirection;
        }) => {
            update(state => ({ 
                ...state, 
                isLoading: true, 
                error: null,
                sortType: options?.sortType || state.sortType,
                sortDirection: options?.sortDirection || state.sortDirection 
            }));
            
            try {
                // Prepare API request
                const currentState = get({ subscribe });
                const params = new URLSearchParams();
                
                // Add sort parameters
                params.append('sortBy', currentState.sortType);
                params.append('sortDirection', currentState.sortDirection);
                
                // Make API request
                const queryString = params.toString() ? `?${params.toString()}` : '';
                console.log(`[StatementNetworkStore] Fetching all statements: /nodes/statement/network${queryString}`);
                
                const startTime = Date.now();
                const statements = await fetchWithAuth(`/nodes/statement/network${queryString}`);
                const endTime = Date.now();
                console.log(`[StatementNetworkStore] API request completed in ${endTime - startTime}ms`);
                
                // Check if we received a valid response
                if (!statements) {
                    throw new Error('No response from API');
                }
                
                console.log(`[StatementNetworkStore] Loaded ${statements.length} statements from API`);
                
                // Log first statement for debugging
                if (statements.length > 0) {
                    console.log('[StatementNetworkStore] First statement:', {
                        id: statements[0].id,
                        statement: statements[0].statement?.substring(0, 50) + '...',
                        keywordCount: statements[0].keywords?.length || 0,
                        relatedCount: statements[0].relatedStatements?.length || 0
                    });
                }
                
                // Update the store
                update(state => {
                    const filtered = applyFilters(
                        statements, 
                        state.filterKeywords, 
                        state.filterKeywordOperator,
                        state.filterUserId
                    );
                    
                    return { 
                        ...state, 
                        allStatements: statements, 
                        filteredStatements: filtered,
                        isLoading: false 
                    };
                });
            } catch (error) {
                console.error('[StatementNetworkStore] Error loading statements:', error);
                
                update(state => ({
                    ...state,
                    isLoading: false,
                    error: error instanceof Error ? error.message : 'Unknown error loading statements'
                }));
            }
        },
        
        // Client-side filtering
        applyKeywordFilter: (keywords: string[], operator: NetworkFilterOperator = 'OR') => {
            update(state => {
                const filtered = applyFilters(
                    state.allStatements, 
                    keywords, 
                    operator,
                    state.filterUserId
                );
                
                return {
                    ...state,
                    filterKeywords: keywords,
                    filterKeywordOperator: operator,
                    filteredStatements: filtered
                };
            });
        },
        
        // Apply user filter
        applyUserFilter: (userId?: string) => {
            update(state => {
                const filtered = applyFilters(
                    state.allStatements, 
                    state.filterKeywords, 
                    state.filterKeywordOperator,
                    userId
                );
                
                return {
                    ...state,
                    filterUserId: userId,
                    filteredStatements: filtered
                };
            });
        },
        
        // Change sort type/direction - just client-side
        setSorting: (sortType: NetworkSortType, sortDirection: NetworkSortDirection = 'desc') => {
            update(state => {
                const sorted = sortStatements(state.allStatements, sortType, sortDirection);
                const filtered = applyFilters(
                    sorted, 
                    state.filterKeywords, 
                    state.filterKeywordOperator,
                    state.filterUserId
                );
                
                return { 
                    ...state, 
                    sortType, 
                    sortDirection,
                    allStatements: sorted,
                    filteredStatements: filtered
                };
            });
        },
        
        // Clear all filters
        clearFilters: () => {
            update(state => ({
                ...state,
                filterKeywords: [],
                filterKeywordOperator: 'OR',
                filterUserId: undefined,
                filteredStatements: state.allStatements
            }));
        },
        
        // Reset the store to initial state
        reset: () => {
            set(initialState);
        },
        
        // Get unique keywords for filter UI
        getUniqueKeywords: () => {
            const state = get({ subscribe });
            const keywordSet = new Set<string>();
            
            state.allStatements.forEach(statement => {
                statement.keywords?.forEach(keyword => {
                    keywordSet.add(keyword.word.toLowerCase());
                });
            });
            
            return Array.from(keywordSet).sort();
        }
    };
}

export const statementNetworkStore = createStatementNetworkStore();