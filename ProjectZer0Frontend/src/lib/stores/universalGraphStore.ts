// src/lib/stores/universalGraphStore.ts

import { writable, derived, get } from 'svelte/store';
import type { Writable, Readable } from 'svelte/store';
import { fetchWithAuth } from '$lib/services/api';

// Types for universal graph data
export interface UniversalNodeData {
    id: string;
    type: 'statement' | 'openquestion' | 'quantity';
    content: string;
    consensus_ratio: number;
    participant_count: number;
    created_at: string;
    updated_at?: string;
    created_by: string;
    public_credit: boolean;
    
    // Type-specific metadata
    metadata: {
        keywords: Array<{ word: string; frequency: number }>;
        
        // For binary voting nodes (statement, openquestion)
        votes?: {
            positive: number;
            negative: number;
            net: number;
        };
        
        // For quantity nodes
        responses?: {
            count: number;
            mean?: number;
            std_dev?: number;
            min?: number;
            max?: number;
        };
        
        // For open questions
        answer_count?: number;
    };
}

export interface UniversalRelationshipData {
    id: string;
    source: string;
    target: string;
    type: 'shared_keyword' | 'answers' | 'responds_to' | 'related_to';
    metadata?: {
        keyword?: string;
        strength?: number;
        created_at?: string;
    };
}

export interface UniversalGraphResponse {
    nodes: UniversalNodeData[];
    relationships: UniversalRelationshipData[];
    total_count: number;
    has_more: boolean;
}

export type UniversalSortType = 'consensus' | 'chronological' | 'participants';
export type UniversalSortDirection = 'asc' | 'desc';
export type FilterOperator = 'AND' | 'OR';

interface UniversalGraphFilters {
    node_types: Array<'statement' | 'openquestion' | 'quantity'>;
    keywords: string[];
    keyword_operator: FilterOperator;
    user_id?: string;
    consensus_min: number;
    consensus_max: number;
    date_from?: string;
    date_to?: string;
}

interface UniversalGraphState {
    nodes: UniversalNodeData[];
    relationships: UniversalRelationshipData[];
    totalCount: number;
    hasMore: boolean;
    loading: boolean;
    error: string | null;
    
    // Pagination
    limit: number;
    offset: number;
    
    // Sorting
    sortBy: UniversalSortType;
    sortDirection: UniversalSortDirection;
    
    // Filters
    filters: UniversalGraphFilters;
}

function createUniversalGraphStore() {
    const initialState: UniversalGraphState = {
        nodes: [],
        relationships: [],
        totalCount: 0,
        hasMore: false,
        loading: false,
        error: null,
        
        limit: 200,
        offset: 0,
        
        sortBy: 'consensus',
        sortDirection: 'desc',
        
        filters: {
            node_types: ['statement', 'openquestion', 'quantity'],
            keywords: [],
            keyword_operator: 'OR',
            consensus_min: 0,
            consensus_max: 1,
        }
    };

    const { subscribe, set, update }: Writable<UniversalGraphState> = writable(initialState);

    // Build query parameters from state
    function buildQueryParams(state: UniversalGraphState): URLSearchParams {
        const params = new URLSearchParams();
        
        // Pagination
        params.append('limit', state.limit.toString());
        params.append('offset', state.offset.toString());
        
        // Sorting
        params.append('sort_by', state.sortBy);
        params.append('sort_direction', state.sortDirection);
        
        // Node type filters
        state.filters.node_types.forEach(type => {
            params.append('node_types', type);
        });
        
        // Consensus filter
        params.append('min_consensus', state.filters.consensus_min.toString());
        params.append('max_consensus', state.filters.consensus_max.toString());
        
        // Keywords filter
        if (state.filters.keywords.length > 0) {
            state.filters.keywords.forEach(keyword => {
                params.append('keywords', keyword);
            });
            params.append('keyword_operator', state.filters.keyword_operator);
        }
        
        // User filter
        if (state.filters.user_id) {
            params.append('user_id', state.filters.user_id);
        }
        
        // Date filters
        if (state.filters.date_from) {
            params.append('date_from', state.filters.date_from);
        }
        
        if (state.filters.date_to) {
            params.append('date_to', state.filters.date_to);
        }
        
        return params;
    }

    // Load nodes from the API
    async function loadNodes(user: any) {
        if (!user) {
            console.error('[UniversalGraphStore] No user provided');
            return;
        }

        update(state => ({ ...state, loading: true, error: null }));

        try {
            const state = get({ subscribe });
            const params = buildQueryParams(state);
            const url = `/graph/universal/nodes?${params.toString()}`;
            
            // Use fetchWithAuth which handles JWT authentication properly
            const data = await fetchWithAuth(url);
            
            // Validate response structure
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid response format: expected object');
            }
            
            // Check if data has the expected properties
            const nodes = data.nodes || [];
            const relationships = data.relationships || [];
            const totalCount = data.total_count || nodes.length;
            const hasMore = data.has_more || false;

            update(state => ({
                ...state,
                nodes: nodes,
                relationships: relationships,
                totalCount: totalCount,
                hasMore: hasMore,
                loading: false
            }));
        } catch (error) {
            console.error('[UniversalGraphStore] Error loading nodes:', error);
            update(state => ({
                ...state,
                loading: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            }));
        }
    }

    // Load more nodes (pagination)
    async function loadMore(user: any) {
        const state = get({ subscribe });
        if (!state.hasMore || state.loading) return;
        
        update(s => ({ ...s, offset: s.offset + s.limit }));
        await loadNodes(user);
    }

    // Reset and reload
    async function reset(user: any) {
        update(s => ({ ...s, offset: 0, nodes: [], relationships: [] }));
        await loadNodes(user);
    }

    // Filter setters
    function setNodeTypeFilter(types: Array<'statement' | 'openquestion' | 'quantity'>) {
        update(s => ({ ...s, filters: { ...s.filters, node_types: types } }));
    }

    function setKeywordFilter(keywords: string[], operator: FilterOperator = 'OR') {
        update(s => ({ 
            ...s, 
            filters: { 
                ...s.filters, 
                keywords,
                keyword_operator: operator 
            } 
        }));
    }

    function setUserFilter(userId?: string) {
        update(s => ({ ...s, filters: { ...s.filters, user_id: userId } }));
    }

    function setConsensusFilter(min: number, max: number) {
        update(s => ({ 
            ...s, 
            filters: { 
                ...s.filters, 
                consensus_min: Math.max(0, Math.min(1, min)),
                consensus_max: Math.max(0, Math.min(1, max))
            } 
        }));
    }

    function setDateFilter(from?: string, to?: string) {
        update(s => ({ 
            ...s, 
            filters: { 
                ...s.filters, 
                date_from: from,
                date_to: to
            } 
        }));
    }

    // Sort setters
    function setSortType(sortBy: UniversalSortType) {
        update(s => ({ ...s, sortBy }));
    }

    function setSortDirection(direction: UniversalSortDirection) {
        update(s => ({ ...s, sortDirection: direction }));
    }

    // Pagination setters
    function setLimit(limit: number) {
        update(s => ({ ...s, limit: Math.max(1, Math.min(500, limit)) }));
    }

    return {
        subscribe,
        loadNodes,
        loadMore,
        reset,
        setNodeTypeFilter,
        setKeywordFilter,
        setUserFilter,
        setConsensusFilter,
        setDateFilter,
        setSortType,
        setSortDirection,
        setLimit
    };
}

export const universalGraphStore = createUniversalGraphStore();