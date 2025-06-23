// src/lib/stores/universalGraphStore.ts
import { writable, derived, get } from 'svelte/store';
import type { UserProfile } from '$lib/types/domain/user';
import { getAuth0User } from '$lib/services/auth0';

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
    metadata: {
        keywords: Array<{ word: string; frequency: number }>;
        votes?: { positive: number; negative: number; net: number };
        responses?: { count: number; mean?: number; std_dev?: number; min?: number; max?: number };
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

// Sort types for universal graph
export type UniversalSortType = 'consensus' | 'chronological' | 'participants' | 'net_positive';
export type UniversalSortDirection = 'asc' | 'desc';

// Filter types
export interface UniversalGraphFilters {
    node_types?: Array<'statement' | 'openquestion' | 'quantity'>;
    keywords?: string[];
    keyword_operator?: 'AND' | 'OR';
    min_consensus?: number;
    max_consensus?: number;
    min_participants?: number;
    user_id?: string;
    date_from?: string;
    date_to?: string;
}

// Store state interface
interface UniversalGraphState {
    nodes: UniversalNodeData[];
    relationships: UniversalRelationshipData[];
    loading: boolean;
    error: string | null;
    totalCount: number;
    hasMore: boolean;
    sortType: UniversalSortType;
    sortDirection: UniversalSortDirection;
    filters: UniversalGraphFilters;
    limit: number;
    offset: number;
}

// Create the store
function createUniversalGraphStore() {
    const initialState: UniversalGraphState = {
        nodes: [],
        relationships: [],
        loading: false,
        error: null,
        totalCount: 0,
        hasMore: false,
        sortType: 'consensus',
        sortDirection: 'desc',
        filters: {
            node_types: ['statement', 'openquestion', 'quantity'],
            keywords: [],
            keyword_operator: 'OR'
        },
        limit: 200,
        offset: 0
    };

    const { subscribe, set, update } = writable<UniversalGraphState>(initialState);

    // Build query parameters from state
    function buildQueryParams(state: UniversalGraphState): URLSearchParams {
        const params = new URLSearchParams();
        
        // Sorting
        params.append('sort_by', state.sortType);
        params.append('sort_direction', state.sortDirection);
        
        // Pagination
        params.append('limit', state.limit.toString());
        params.append('offset', state.offset.toString());
        
        // Filters
        if (state.filters.node_types && state.filters.node_types.length > 0) {
            state.filters.node_types.forEach(type => params.append('node_types', type));
        }
        
        if (state.filters.keywords && state.filters.keywords.length > 0) {
            state.filters.keywords.forEach(keyword => params.append('keywords', keyword));
            if (state.filters.keyword_operator) {
                params.append('keyword_operator', state.filters.keyword_operator);
            }
        }
        
        if (state.filters.min_consensus !== undefined) {
            params.append('min_consensus', state.filters.min_consensus.toString());
        }
        
        if (state.filters.max_consensus !== undefined) {
            params.append('max_consensus', state.filters.max_consensus.toString());
        }
        
        if (state.filters.min_participants !== undefined) {
            params.append('min_participants', state.filters.min_participants.toString());
        }
        
        if (state.filters.user_id) {
            params.append('user_id', state.filters.user_id);
        }
        
        if (state.filters.date_from) {
            params.append('date_from', state.filters.date_from);
        }
        
        if (state.filters.date_to) {
            params.append('date_to', state.filters.date_to);
        }
        
        return params;
    }

    // Load nodes from the API
    async function loadNodes(user: UserProfile | null) {
        console.log('[UniversalGraphStore] loadNodes called with user:', user?.sub);
        
        if (!user) {
            console.error('[UniversalGraphStore] No user provided');
            return;
        }

        update(state => ({ ...state, loading: true, error: null }));

        try {
            const state = get({ subscribe });
            const params = buildQueryParams(state);
            const url = `/api/graph/universal/nodes?${params.toString()}`;
            
            console.log('[UniversalGraphStore] Loading nodes with URL:', url);
            console.log('[UniversalGraphStore] Query params:', params.toString());
            
            // Get access token
            const accessToken = await getAuth0User().then(() => {
                const tokenMeta = document.querySelector('meta[name="auth0-token"]');
                return tokenMeta?.getAttribute('content') || '';
            });
            
            console.log('[UniversalGraphStore] Got access token:', accessToken ? 'yes' : 'no');
            
            const response = await fetch(`http://localhost:3000${url}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('[UniversalGraphStore] Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[UniversalGraphStore] Error response:', errorText);
                throw new Error(`Failed to load universal graph data: ${response.statusText}`);
            }

            // First, let's see what the raw response looks like
            const responseText = await response.text();
            console.log('[UniversalGraphStore] Raw response text:', responseText);
            
            let data: UniversalGraphResponse;
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error('[UniversalGraphStore] Failed to parse JSON:', parseError);
                console.error('[UniversalGraphStore] Response was:', responseText);
                throw new Error('Invalid JSON response from server');
            }
            
            console.log('[UniversalGraphStore] Raw response data:', data);
            console.log('[UniversalGraphStore] Response data type:', typeof data);
            console.log('[UniversalGraphStore] Response data keys:', data ? Object.keys(data) : 'null');
            
            // Validate response structure
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid response format: expected object');
            }
            
            // Check if data has the expected properties
            const nodes = data.nodes || [];
            const relationships = data.relationships || [];
            const totalCount = data.total_count || nodes.length;
            const hasMore = data.has_more || false;
            
            console.log('[UniversalGraphStore] Parsed data:', {
                nodeCount: nodes.length,
                relationshipCount: relationships.length,
                totalCount: totalCount,
                hasMore: hasMore
            });

            // TEMPORARY: If no relationships but we have nodes, log a warning
            if (nodes.length > 0 && relationships.length === 0) {
                console.warn('[UniversalGraphStore] WARNING: Backend returned nodes but no relationships. Links will not be displayed.');
                console.warn('[UniversalGraphStore] This suggests the backend universal graph endpoint needs to implement relationship fetching.');
                
                // Log the first few nodes to see their structure
                console.log('[UniversalGraphStore] Sample nodes:', nodes.slice(0, 3));
            }

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
    async function loadMore(user: UserProfile | null) {
        const state = get({ subscribe });
        if (!user || state.loading || !state.hasMore) {
            return;
        }

        update(s => ({ ...s, offset: s.offset + s.limit }));
        await loadNodes(user);
    }

    // Update sort type
    function setSortType(sortType: UniversalSortType) {
        update(state => ({ ...state, sortType, offset: 0 }));
    }

    // Update sort direction
    function setSortDirection(sortDirection: UniversalSortDirection) {
        update(state => ({ ...state, sortDirection, offset: 0 }));
    }

    // Update filters
    function setFilters(filters: Partial<UniversalGraphFilters>) {
        update(state => ({
            ...state,
            filters: { ...state.filters, ...filters },
            offset: 0
        }));
    }

    // Set specific filter
    function setNodeTypeFilter(nodeTypes: Array<'statement' | 'openquestion' | 'quantity'>) {
        setFilters({ node_types: nodeTypes });
    }

    function setKeywordFilter(keywords: string[], operator: 'AND' | 'OR' = 'OR') {
        setFilters({ keywords, keyword_operator: operator });
    }

    function setConsensusFilter(min?: number, max?: number) {
        setFilters({ min_consensus: min, max_consensus: max });
    }

    function setUserFilter(userId?: string) {
        setFilters({ user_id: userId });
    }

    function setDateFilter(dateFrom?: string, dateTo?: string) {
        setFilters({ date_from: dateFrom, date_to: dateTo });
    }

    // Reset filters
    function resetFilters() {
        update(state => ({
            ...state,
            filters: {
                node_types: ['statement', 'openquestion', 'quantity'],
                keywords: [],
                keyword_operator: 'OR'
            },
            offset: 0
        }));
    }

    // Reset store
    function reset() {
        set(initialState);
    }

    return {
        subscribe,
        loadNodes,
        loadMore,
        setSortType,
        setSortDirection,
        setFilters,
        setNodeTypeFilter,
        setKeywordFilter,
        setConsensusFilter,
        setUserFilter,
        setDateFilter,
        resetFilters,
        reset
    };
}

// Create and export the store instance
export const universalGraphStore = createUniversalGraphStore();

// Derived stores for convenient access
export const universalNodes = derived(
    universalGraphStore,
    $store => $store.nodes
);

export const universalRelationships = derived(
    universalGraphStore,
    $store => $store.relationships
);

export const universalGraphLoading = derived(
    universalGraphStore,
    $store => $store.loading
);

export const universalGraphError = derived(
    universalGraphStore,
    $store => $store.error
);