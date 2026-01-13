// src/lib/stores/universalGraphStore.ts
// Universal Graph Store - Central state management for Universal Graph
// UPDATED: Fixed buildQueryParams to use correct backend parameter names

import { writable, derived, get, type Writable } from 'svelte/store';
import type { NodeMode } from '$lib/types/graph/enhanced';
import type { ConsolidatedKeywordMetadata } from '$lib/types/graph/enhanced';
import { fetchWithAuth } from '$lib/services/api';

// UPDATED: Node data structure for universal graph - supports all 5 content node types
export interface UniversalNodeData {
    id: string;
    type: 'openquestion' | 'statement' | 'answer' | 'quantity' | 'evidence' | 'category' | 'word' | 'definition';
    mode: NodeMode;
    group: string;
    data: any;
    position?: {
        x: number;
        y: number;
    };
    metadata: {
        votes?: any;
        group?: string;
        fixed?: boolean;
        isDetail?: boolean;
        consensus_ratio?: number;
        participant_count?: number;
        net_votes?: number;
        answer_count?: number;
        related_statements_count?: number;
        userVoteStatus?: { status: 'agree' | 'disagree' | null };
        userVisibilityPreference?: {
            isVisible: boolean;
            source: string;
            timestamp: number;
        };
    };
}

// ENHANCED: Relationship data with consolidated keyword support
export interface UniversalRelationshipData {
    id: string;
    source: string;
    target: string;
    type: 'shared_keyword' | 'responds_to' | 'related_to' | 'answers' | 'evidence_for';
    metadata?: {
        keyword?: string;
        strength?: number;
        created_at?: string;
        
        // ENHANCED: Consolidated keyword metadata for optimized relationships
        consolidatedKeywords?: ConsolidatedKeywordMetadata;
        
        // Performance tracking
        isConsolidated?: boolean;
        originalRelationshipCount?: number;
    };
}

export interface UniversalGraphResponse {
    nodes: UniversalNodeData[];
    relationships: UniversalRelationshipData[];
    total_count: number;
    has_more: boolean;
    // ENHANCED: Performance metrics from backend
    performance_metrics?: {
        node_count: number;
        relationship_count: number;
        relationship_density: number;
        consolidation_ratio: number;
    };
}

export type UniversalSortType = 'netVotes' | 'chronological' | 'participants';
export type UniversalSortDirection = 'asc' | 'desc';
export type FilterOperator = 'AND' | 'OR';

// Vote data interface matching other stores
export interface VoteData {
    positiveVotes: number;
    negativeVotes: number;
    netVotes: number;
    shouldBeHidden: boolean;
}

interface UniversalGraphFilters {
    node_types: Array<'openquestion' | 'statement' | 'answer' | 'quantity' | 'evidence' |'word' | 'category' | 'definition'>;
    keywords: string[];
    keyword_operator: FilterOperator;
    user_id?: string;
    net_votes_min: number;
    net_votes_max: number;
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
    
    limit: number;
    offset: number;
    
    sortBy: UniversalSortType;
    sortDirection: UniversalSortDirection;
    
    filters: UniversalGraphFilters;
    
    // ENHANCED: Performance metrics from backend
    performanceMetrics?: {
        node_count: number;
        relationship_count: number;
        relationship_density: number;
        consolidation_ratio: number;
    };
    
    // BULLETPROOF: Request tracking to prevent stale updates
    currentRequestId: number;
}

export interface UniversalGraphStore {
    subscribe: (run: (value: UniversalGraphState) => void) => () => void;
    user_data: any;
    loadNodes: (user: any, requestId?: number) => Promise<void>;
    loadMore: (user: any) => Promise<void>;
    reset: () => void;
    setNodeTypeFilter: (types: Array<'openquestion' | 'statement' | 'answer' | 'quantity' | 'evidence'| 
                 'word' | 'category' | 'definition'>) => void;
    setKeywordFilter: (keywords: string[], operator: FilterOperator) => void;
    setUserFilter: (userId?: string) => void;
    setNetVotesFilter: (min: number, max: number) => void;
    setConsensusFilter: (min: number, max: number) => void;
    setDateFilter: (from?: string, to?: string) => void;
    setSortType: (sortBy: UniversalSortType) => void;
    setSortDirection: (direction: UniversalSortDirection) => void;
    setLimit: (limit: number) => void;
    getVoteData: (nodeId: string) => VoteData;
    updateVoteData: (nodeId: string, positiveVotes: number, negativeVotes: number) => void;
    clearVoteCache: (nodeId?: string) => void;
    getUserData: (nodeId: string) => any;
    updateUserVoteStatus: (nodeId: string, voteStatus: 'agree' | 'disagree' | null) => void;
    updateUserVisibilityPreference: (nodeId: string, isVisible: boolean, source?: string) => void;
    // ENHANCED: Performance metrics access
    getPerformanceMetrics: () => any;
}

function createUniversalGraphStore(): UniversalGraphStore {
    const initialState: UniversalGraphState = {
        nodes: [],
        relationships: [],
        totalCount: 0,
        hasMore: false,
        loading: false,
        error: null,
        
        limit: 200,
        offset: 0,
        
        sortBy: 'netVotes',
        sortDirection: 'desc',
        
        filters: {
            node_types: [
                'openquestion', 
                'statement', 
                'answer', 
                'quantity', 
                'evidence',
                'word',        
                'category',    
                'definition'   
            ],
            keywords: [],
            keyword_operator: 'OR',
            net_votes_min: -50,
            net_votes_max: 50,
        },
        
        currentRequestId: 0
    };

    const { subscribe, set, update }: Writable<UniversalGraphState> = writable(initialState);

    // Derived store for user_data to match expected interface from other stores
    const user_data = derived({ subscribe }, (state) => {
        const userData: Record<string, any> = {};
        
        state.nodes.forEach(node => {
            if (node.metadata.userVoteStatus || node.metadata.userVisibilityPreference) {
                userData[node.id] = {
                    userVoteStatus: node.metadata.userVoteStatus,
                    userVisibilityPreference: node.metadata.userVisibilityPreference
                };
            }
        });
        
        return userData;
    });

    // Vote cache for universal graph - independent of other stores
    const voteCache = new Map<string, VoteData>();

    // Helper function to cache vote data
    function cacheVoteData(
        nodeId: string,
        positiveVotes: number,
        negativeVotes: number
    ): VoteData {
        const netVotes = positiveVotes - negativeVotes;
        const shouldBeHidden = netVotes < 0;
        
        const voteData: VoteData = {
            positiveVotes,
            negativeVotes,
            netVotes,
            shouldBeHidden
        };
        
        voteCache.set(nodeId, voteData);
        return voteData;
    }

    // Helper to extract vote data from node
    function extractVoteDataFromNode(node: UniversalNodeData): VoteData {
        const positiveVotes = node.metadata.votes?.positive || 0;
        const negativeVotes = node.metadata.votes?.negative || 0;
        const netVotes = node.metadata.net_votes || positiveVotes - negativeVotes;
        
        return {
            positiveVotes,
            negativeVotes,
            netVotes,
            shouldBeHidden: netVotes < 0
        };
    }

    // Helper to process and cache vote data for multiple nodes
    function processAndCacheVoteData(nodes: UniversalNodeData[]) {
        nodes.forEach(node => {
            const voteData = extractVoteDataFromNode(node);
            cacheVoteData(node.id, voteData.positiveVotes, voteData.negativeVotes);
        });
    }

    // FIXED: Build query params with correct backend parameter names
    function buildQueryParams(state: UniversalGraphState): URLSearchParams {
        const params = new URLSearchParams();
        
        // Pagination
        params.append('limit', state.limit.toString());
        params.append('offset', state.offset.toString());
        
        // Sorting - map frontend sortBy to backend expected values
        const sortByMapping: Record<UniversalSortType, string> = {
            'netVotes': 'inclusion_votes',  // Backend expects 'inclusion_votes'
            'chronological': 'chronological',
            'participants': 'participants'
        };
        params.append('sort_by', sortByMapping[state.sortBy] || 'inclusion_votes');
        params.append('sort_direction', state.sortDirection);
        
        // Node type filters - supports all 5 content node types
        state.filters.node_types.forEach(type => {
            params.append('node_types', type);
        });
        
        // Net votes filter
        params.append('min_net_votes', state.filters.net_votes_min.toString());
        params.append('max_net_votes', state.filters.net_votes_max.toString());
        
        // Keywords filter
        if (state.filters.keywords.length > 0) {
            state.filters.keywords.forEach(keyword => {
                params.append('keywords', keyword);
            });
            // Map to backend expected parameter name
            const keywordMode = state.filters.keyword_operator === 'AND' ? 'all' : 'any';
            params.append('keywordMode', keywordMode);
        }
        
        // User filter
        if (state.filters.user_id) {
            params.append('user_id', state.filters.user_id);
            // Note: userFilterMode parameter will need to be added when backend supports it
        }
        
        // Date filters
        if (state.filters.date_from) {
            params.append('date_from', state.filters.date_from);
        }
        
        if (state.filters.date_to) {
            params.append('date_to', state.filters.date_to);
        }
        
        // Always include relationships for universal graph
        params.append('include_relationships', 'true');
        
        return params;
    }

    // ENHANCED: Load nodes from the API with consolidated relationship support
    // BULLETPROOF: Now accepts requestId to prevent stale updates
    async function loadNodes(user: any, requestId?: number) {
        if (!user) {
            console.error('[UniversalGraphStore] No user provided');
            return;
        }

        // Increment and store request ID
        update(state => ({ 
            ...state, 
            loading: true, 
            error: null,
            currentRequestId: requestId ?? state.currentRequestId + 1
        }));
        
        // Get the request ID we'll check against
        const state = get({ subscribe });
        const thisRequestId = state.currentRequestId;

        try {
            const params = buildQueryParams(state);
            const url = `/graph/universal/nodes?${params.toString()}`;
            
            console.log('[UniversalGraphStore] Loading nodes with params:', {
                requestId: thisRequestId,
                sortBy: state.sortBy,
                sortDirection: state.sortDirection,
                nodeTypes: state.filters.node_types,
                url
            });
            
            const response = await fetchWithAuth(url, user);
            
            if (!response) {
                throw new Error('No response from API');
            }
            
            const data: UniversalGraphResponse = response;
            
            // CRITICAL: Check if this request is still current before updating
            const currentState = get({ subscribe });
            if (thisRequestId !== currentState.currentRequestId) {
                console.warn(`[UniversalGraphStore] ⛔ Discarding stale response #${thisRequestId}, current is #${currentState.currentRequestId}`);
                return;
            }
            
            // Process and cache vote data for all nodes
            processAndCacheVoteData(data.nodes);
            
            update(state => ({
                ...state,
                nodes: data.nodes,
                relationships: data.relationships,
                totalCount: data.total_count,
                hasMore: data.has_more,
                loading: false,
                performanceMetrics: data.performance_metrics
            }));
            
            console.log('[UniversalGraphStore] Loaded nodes:', {
                requestId: thisRequestId,
                count: data.nodes.length,
                total: data.total_count,
                hasMore: data.has_more,
                types: data.nodes.reduce((acc: any, node) => {
                    acc[node.type] = (acc[node.type] || 0) + 1;
                    return acc;
                }, {}),
                metrics: data.performance_metrics
            });
            
        } catch (error) {
            console.error('[UniversalGraphStore] Error loading nodes:', error);
            update(state => ({
                ...state,
                loading: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            }));
        }
    }

    // Load more nodes (pagination)
    async function loadMore(user: any) {
        if (!user) {
            console.error('[UniversalGraphStore] No user provided');
            return;
        }

        const state = get({ subscribe });
        
        if (!state.hasMore || state.loading) {
            console.log('[UniversalGraphStore] Cannot load more:', {
                hasMore: state.hasMore,
                loading: state.loading
            });
            return;
        }

        update(state => ({ ...state, loading: true, error: null }));

        try {
            const currentState = get({ subscribe });
            const params = buildQueryParams(currentState);
            const url = `/graph/universal/nodes?${params.toString()}`;
            
            const response = await fetchWithAuth(url, user);
            
            if (!response) {
                throw new Error('No response from API');
            }
            
            const data: UniversalGraphResponse = response;
            
            // Process and cache vote data for new nodes
            processAndCacheVoteData(data.nodes);
            
            update(state => ({
                ...state,
                nodes: [...state.nodes, ...data.nodes],
                relationships: [...state.relationships, ...data.relationships],
                totalCount: data.total_count,
                hasMore: data.has_more,
                loading: false,
                offset: state.offset + state.limit,
                performanceMetrics: data.performance_metrics
            }));
            
            console.log('[UniversalGraphStore] Loaded more nodes:', {
                newCount: data.nodes.length,
                totalCount: data.total_count,
                hasMore: data.has_more
            });
            
        } catch (error) {
            console.error('[UniversalGraphStore] Error loading more nodes:', error);
            update(state => ({
                ...state,
                loading: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            }));
        }
    }

    function reset() {
        set(initialState);
        voteCache.clear();
    }

    function setNodeTypeFilter(types: Array<'openquestion' | 'statement' | 'answer' | 'quantity' | 'evidence' | 'word' | 'category' | 'definition'>) {
        update(s => ({ ...s, filters: { ...s.filters, node_types: types }, offset: 0 }));
    }

    function setKeywordFilter(keywords: string[], operator: FilterOperator) {
        update(s => ({ ...s, filters: { ...s.filters, keywords, keyword_operator: operator }, offset: 0 }));
    }

    function setUserFilter(userId?: string) {
        update(s => ({ ...s, filters: { ...s.filters, user_id: userId } }));
    }

    function setNetVotesFilter(min: number, max: number) {
        update(s => ({ ...s, filters: { ...s.filters, net_votes_min: min, net_votes_max: max } }));
    }

    // DEPRECATED: Kept for backward compatibility
    function setConsensusFilter(min: number, max: number) {
        console.warn('[UniversalGraphStore] setConsensusFilter is deprecated. Consensus filtering is no longer supported.');
        // No-op for backward compatibility
    }

    function setDateFilter(from?: string, to?: string) {
        update(s => ({ ...s, filters: { ...s.filters, date_from: from, date_to: to } }));
    }

    function setSortType(sortBy: UniversalSortType) {
        update(s => ({ ...s, sortBy }));
    }

    function setSortDirection(direction: UniversalSortDirection) {
        update(s => ({ ...s, sortDirection: direction }));
    }

    function setLimit(limit: number) {
        update(s => ({ ...s, limit }));
    }

    // Get vote data for a node - check cache first, with fallback to store
    function getVoteData(nodeId: string): VoteData {
        // Check cache first
        if (voteCache.has(nodeId)) {
            return voteCache.get(nodeId)!;
        }
        
        // Fallback to finding in store
        const state = get({ subscribe });
        const node = state.nodes.find(n => n.id === nodeId);
        
        if (node) {
            const voteData = extractVoteDataFromNode(node);
            cacheVoteData(nodeId, voteData.positiveVotes, voteData.negativeVotes);
            return voteData;
        }
        
        // Return default if not found
        return {
            positiveVotes: 0,
            negativeVotes: 0,
            netVotes: 0,
            shouldBeHidden: false
        };
    }

    // Update vote data in cache and store
    function updateVoteData(nodeId: string, positiveVotes: number, negativeVotes: number) {
        // Update cache
        cacheVoteData(nodeId, positiveVotes, negativeVotes);
        
        // Update store
        update(state => {
            const nodes = [...state.nodes];
            const nodeIndex = nodes.findIndex(n => n.id === nodeId);
            
            if (nodeIndex === -1) return state;
            
            const node = { ...nodes[nodeIndex] };
            
            // Update vote data in metadata
            node.metadata = {
                ...node.metadata,
                votes: {
                    positive: positiveVotes,
                    negative: negativeVotes,
                    net: positiveVotes - negativeVotes
                },
                net_votes: positiveVotes - negativeVotes
            };
            
            // Update vote data in node.data for consistency
            if (node.data) {
                node.data = {
                    ...node.data,
                    positiveVotes,
                    negativeVotes,
                    netVotes: positiveVotes - negativeVotes
                };
            }
            
            nodes[nodeIndex] = node;
            
            return {
                ...state,
                nodes
            };
        });
    }

    // Clear vote cache
    function clearVoteCache(nodeId?: string) {
        if (nodeId) {
            voteCache.delete(nodeId);
        } else {
            voteCache.clear();
        }
    }

    // Get user-specific data for a node
    function getUserData(nodeId: string) {
        const state = get({ subscribe });
        const node = state.nodes.find(n => n.id === nodeId);
        
        if (!node) return null;
        
        return {
            userVoteStatus: node.metadata.userVoteStatus,
            userVisibilityPreference: node.metadata.userVisibilityPreference
        };
    }

    // Update user vote status in store
    function updateUserVoteStatus(nodeId: string, voteStatus: 'agree' | 'disagree' | null) {
        update(state => {
            const nodes = [...state.nodes];
            const nodeIndex = nodes.findIndex(n => n.id === nodeId);
            
            if (nodeIndex === -1) return state;
            
            const node = { ...nodes[nodeIndex] };
            node.metadata = {
                ...node.metadata,
                userVoteStatus: { status: voteStatus }
            };
            
            // Also update in node.data if it exists
            if (node.data) {
                node.data = {
                    ...node.data,
                    userVoteStatus: voteStatus
                };
            }
            
            nodes[nodeIndex] = node;
            
            return {
                ...state,
                nodes
            };
        });
    }

    // Update user visibility preference in store
    function updateUserVisibilityPreference(nodeId: string, isVisible: boolean, source: string = 'user_action') {
        update(state => {
            const nodes = [...state.nodes];
            const nodeIndex = nodes.findIndex(n => n.id === nodeId);
            
            if (nodeIndex === -1) return state;
            
            const node = { ...nodes[nodeIndex] };
            node.metadata = {
                ...node.metadata,
                userVisibilityPreference: {
                    isVisible,
                    source,
                    timestamp: Date.now()
                }
            };
            
            nodes[nodeIndex] = node;
            
            // Return updated state
            return {
                ...state,
                nodes: nodes
            };
        });
    }

    // ENHANCED: Get performance metrics
    function getPerformanceMetrics() {
        const state = get({ subscribe });
        return state.performanceMetrics || null;
    }

    return {
        subscribe,
        user_data,
        loadNodes,
        loadMore,
        reset,
        setNodeTypeFilter,
        setKeywordFilter,
        setUserFilter,
        setNetVotesFilter,
        setConsensusFilter,   // DEPRECATED: But kept for backward compatibility
        setDateFilter,
        setSortType,
        setSortDirection,
        setLimit,
        
        // Vote management methods - matching other store interfaces
        getVoteData,
        updateVoteData,
        clearVoteCache,
        
        // User data management methods
        getUserData,
        updateUserVoteStatus,
        updateUserVisibilityPreference,
        
        // ENHANCED: Performance metrics access
        getPerformanceMetrics
    };
}

export const universalGraphStore = createUniversalGraphStore();