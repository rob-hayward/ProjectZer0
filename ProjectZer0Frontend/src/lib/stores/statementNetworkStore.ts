// src/lib/stores/statementNetworkStore.ts
import { writable, get } from 'svelte/store';
import { fetchWithAuth } from '$lib/services/api';
import type { StatementNode } from '$lib/types/domain/nodes';
import { getNeo4jNumber } from '$lib/utils/neo4j-utils';

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

// Vote data cache interface
export interface VoteData {
    positiveVotes: number;
    negativeVotes: number;
    netVotes: number;
    shouldBeHidden: boolean;
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
    
    // Cache for vote data to ensure consistent values across components
    const voteCache = new Map<string, VoteData>();
    
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
                const aNet = getVoteData(a.id).netVotes;
                const bNet = getVoteData(b.id).netVotes;
                comparison = aNet - bNet;
            } 
            else if (sortType === 'totalVotes') {
                const aData = getVoteData(a.id);
                const bData = getVoteData(b.id);
                const aTotal = aData.positiveVotes + aData.negativeVotes;
                const bTotal = bData.positiveVotes + bData.negativeVotes;
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
    
    /**
     * Helper function to normalize Neo4j data during import
     * This handles all normalization in one pass, including vote calculations
     */
    function normalizeNeo4jData(statement: any): StatementNode {
        // Make a deep copy to avoid mutating the original
        const result = {...statement};
        
        // Process vote fields with explicit error handling
        try {
            // Handle positiveVotes
            if (statement.positiveVotes === undefined || statement.positiveVotes === null) {
                result.positiveVotes = 0;
            } else {
                result.positiveVotes = getNeo4jNumber(statement.positiveVotes);
            }
            
            // Handle negativeVotes
            if (statement.negativeVotes === undefined || statement.negativeVotes === null) {
                result.negativeVotes = 0;
            } else {
                result.negativeVotes = getNeo4jNumber(statement.negativeVotes);
            }
            
            // Handle netVotes (calculate if missing)
            if (statement.netVotes === undefined || statement.netVotes === null) {
                result.netVotes = result.positiveVotes - result.negativeVotes;
            } else {
                result.netVotes = getNeo4jNumber(statement.netVotes);
                
                // If netVotes is zero but we have pos/neg votes, recalculate
                if (result.netVotes === 0 && (result.positiveVotes > 0 || result.negativeVotes > 0)) {
                    result.netVotes = result.positiveVotes - result.negativeVotes;
                }
            }
            
            // Cache the vote data immediately after normalization
            cacheVoteData(result.id, result.positiveVotes, result.negativeVotes, result.netVotes);
        } catch (error) {
            // Set fallback values if extraction fails
            result.positiveVotes = 0;
            result.negativeVotes = 0;
            result.netVotes = 0;
            
            // Cache default values
            cacheVoteData(result.id, 0, 0, 0);
        }
        
        return result as StatementNode;
    }
    
    /**
     * Helper function to cache vote data without re-normalizing
     * This avoids redundant normalization
     */
    function cacheVoteData(
        statementId: string, 
        positiveVotes: number, 
        negativeVotes: number, 
        netVotes?: number
    ): VoteData {
        // Calculate net votes if not provided
        const calculatedNetVotes = netVotes !== undefined ? 
            netVotes : positiveVotes - negativeVotes;
        
        const shouldBeHidden = calculatedNetVotes < 0;
        
        const voteData = {
            positiveVotes,
            negativeVotes,
            netVotes: calculatedNetVotes,
            shouldBeHidden
        };
        
        // Cache the values
        voteCache.set(statementId, voteData);
        
        return voteData;
    }
    
    /**
     * Get vote data from cache or calculate and cache if not present
     * This is the primary method that components should call to get vote data
     */
    function getVoteData(statementId: string): VoteData {
        // Check cache first
        if (voteCache.has(statementId)) {
            return voteCache.get(statementId)!;
        }
        
        // If not in cache, try to find in statements
        const state = get({ subscribe });
        const statement = state.allStatements.find(s => s.id === statementId);
        
        if (!statement) {
            // Return default values if statement not found
            return { positiveVotes: 0, negativeVotes: 0, netVotes: 0, shouldBeHidden: false };
        }
        
        // Cache and return the vote data
        return cacheVoteData(
            statementId,
            statement.positiveVotes as number,
            statement.negativeVotes as number,
            (statement as any).netVotes
        );
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
                
                const rawStatements = await fetchWithAuth(`/nodes/statement/network${queryString}`);
                
                // Check if we received a valid response
                if (!rawStatements) {
                    throw new Error('No response from API');
                }
                
                // Clear vote cache when loading new data
                voteCache.clear();
                
                // CRITICAL: Normalize Neo4j integers at the API boundary
                // This also caches vote data in a single pass
                const statements = rawStatements.map(normalizeNeo4jData);
                
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
            voteCache.clear();
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
        },
        
        // Get vote data for a statement
        getVoteData,
        
        // Update vote data for a specific statement
        updateVoteData: (statementId: string, positiveVotes: number, negativeVotes: number) => {
            const currentState = get({ subscribe });
            const statement = currentState.allStatements.find(s => s.id === statementId);
            
            if (statement) {
                // Ensure we're working with numbers
                const posVotes = getNeo4jNumber(positiveVotes);
                const negVotes = getNeo4jNumber(negativeVotes);
                
                // Update the vote data in the statement
                statement.positiveVotes = posVotes;
                statement.negativeVotes = negVotes;
                
                // If statement has a netVotes property, update it too
                if ('netVotes' in statement) {
                    (statement as any).netVotes = posVotes - negVotes;
                }
                
                // Cache the updated vote data (without redundant normalization)
                cacheVoteData(statementId, posVotes, negVotes, posVotes - negVotes);
                
                // Re-sort statements if needed
                if (currentState.sortType === 'netPositive' || currentState.sortType === 'totalVotes') {
                    update(state => {
                        const sorted = sortStatements(state.allStatements, state.sortType, state.sortDirection);
                        const filtered = applyFilters(
                            sorted, 
                            state.filterKeywords, 
                            state.filterKeywordOperator,
                            state.filterUserId
                        );
                        
                        return {
                            ...state,
                            allStatements: sorted,
                            filteredStatements: filtered
                        };
                    });
                }
            }
        },
        
        // Clear vote cache for a specific statement
        clearVoteCache: (statementId?: string) => {
            if (statementId) {
                voteCache.delete(statementId);
            } else {
                voteCache.clear();
            }
        }
    };
}

export const statementNetworkStore = createStatementNetworkStore();