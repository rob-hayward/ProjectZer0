// src/lib/stores/universalGraphStore.ts

import { writable, derived, get } from 'svelte/store';
import type { Writable, Readable } from 'svelte/store';
import { fetchWithAuth } from '$lib/services/api';
import { getNeo4jNumber } from '$lib/utils/neo4j-utils';

// Types for universal graph data - UPDATED: Include both OpenQuestion and Statement
export interface UniversalNodeData {
    id: string;
    type: 'openquestion' | 'statement'; // UPDATED: Added statement support
    content: string;
    participant_count: number;
    created_at: string;
    updated_at?: string;
    created_by: string;
    public_credit: boolean;
    
    // Type-specific metadata
    metadata: {
        keywords: Array<{ word: string; frequency: number }>;
        
        // For binary voting nodes (openquestion and statement)
        votes: {
            positive: number;
            negative: number;
            net: number;
        };
        
        // User-specific data from backend
        userVoteStatus?: {
            status: 'agree' | 'disagree' | null;
        };
        
        userVisibilityPreference?: {
            isVisible: boolean;
            source: string;
            timestamp: number;
        };
        
        // For open questions
        answer_count?: number;
        
        // FIXED: For statements - using the correct field names from backend
        relatedStatements?: Array<{
            nodeId: string;
            statement: string;
            sharedWord?: string;
            strength?: number;
            relationshipType: 'shared_keyword' | 'direct';
        }>;
        
        parentQuestion?: {
            nodeId: string;
            questionText: string;
            relationshipType: 'answers';
        };
        
        discussionId?: string;
        initialComment?: string;
    };
}

export interface UniversalRelationshipData {
    id: string;
    source: string;
    target: string;
    type: 'shared_keyword' | 'related_to' | 'answers'; // UPDATED: Added answers relationship
    metadata?: {
        keyword?: string;
        strength?: number;
        created_at?: string;
        sharedWords?: string[]; // ADDED: For statement relationships
        relationCount?: number; // ADDED: For statement relationships
    };
}

export interface UniversalGraphResponse {
    nodes: UniversalNodeData[];
    relationships: UniversalRelationshipData[];
    total_count: number;
    has_more: boolean;
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
    node_types: Array<'openquestion' | 'statement'>; // UPDATED: Added statement support
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
    
    // Pagination
    limit: number;
    offset: number;
    
    // Sorting
    sortBy: UniversalSortType;
    sortDirection: UniversalSortDirection;
    
    // Filters
    filters: UniversalGraphFilters;
}

// Extended interface for the store that includes user_data
interface UniversalGraphStore {
    subscribe: (run: any, invalidate?: any) => any;
    user_data: { subscribe: any };
    loadNodes: (user: any) => Promise<void>;
    loadMore: (user: any) => Promise<void>;
    reset: (user: any) => Promise<void>;
    setNodeTypeFilter: (types: Array<'openquestion' | 'statement'>) => void; // UPDATED
    setKeywordFilter: (keywords: string[], operator?: FilterOperator) => void;
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
            node_types: ['openquestion', 'statement'], // UPDATED: Default to both types
            keywords: [],
            keyword_operator: 'OR',
            net_votes_min: -50,
            net_votes_max: 50,
        }
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
        
        const voteData = {
            positiveVotes,
            negativeVotes,
            netVotes,
            shouldBeHidden
        };
        
        voteCache.set(nodeId, voteData);
        return voteData;
    }

    // UPDATED: Extract and normalize vote data from universal node (supports both types)
    function extractVoteDataFromNode(node: UniversalNodeData): VoteData {
        let positiveVotes = 0;
        let negativeVotes = 0;

        // Extract votes based on node type - supports both openquestion and statement
        if (node.type === 'openquestion' || node.type === 'statement') {
            if (node.metadata.votes) {
                positiveVotes = getNeo4jNumber(node.metadata.votes.positive);
                negativeVotes = getNeo4jNumber(node.metadata.votes.negative);
            }
        }

        return cacheVoteData(node.id, positiveVotes, negativeVotes);
    }

    // Process and cache vote data for all nodes
    function processAndCacheVoteData(nodes: UniversalNodeData[]): void {
        nodes.forEach(node => {
            extractVoteDataFromNode(node);
        });
    }

    // Build query parameters from state
    function buildQueryParams(state: UniversalGraphState): URLSearchParams {
        const params = new URLSearchParams();
        
        // Pagination
        params.append('limit', state.limit.toString());
        params.append('offset', state.offset.toString());
        
        // Sorting
        params.append('sort_by', state.sortBy);
        params.append('sort_direction', state.sortDirection);
        
        // Node type filters - supports both openquestion and statement
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
            
            console.log('[UniversalGraphStore] Loading nodes from:', url);
            
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

            console.log('[UniversalGraphStore] Received data:', {
                nodes: nodes.length,
                relationships: relationships.length,
                totalCount,
                hasMore,
                nodeTypes: nodes.map((n: any) => n.type)
            });

            // Clear vote cache when loading new data
            voteCache.clear();

            // Process and cache vote data for all nodes
            processAndCacheVoteData(nodes);

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
        voteCache.clear();
        update(s => ({ ...s, offset: 0, nodes: [], relationships: [] }));
        await loadNodes(user);
    }

    // UPDATED: Filter setters - now support both openquestion and statement
    function setNodeTypeFilter(types: Array<'openquestion' | 'statement'>) {
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

    // Net votes filter
    function setNetVotesFilter(min: number, max: number) {
        update(s => ({ 
            ...s, 
            filters: { 
                ...s.filters, 
                net_votes_min: Math.max(-100, Math.min(100, min)),
                net_votes_max: Math.max(-100, Math.min(100, max))
            } 
        }));
    }

    // DEPRECATED: Keep for backward compatibility but log warning
    function setConsensusFilter(min: number, max: number) {
        console.warn('[UniversalGraphStore] setConsensusFilter is deprecated. Use setNetVotesFilter instead.');
        // Convert consensus ratio (0-1) to reasonable net votes range
        const minNetVotes = Math.floor((min - 0.5) * 100);
        const maxNetVotes = Math.floor((max - 0.5) * 100);
        setNetVotesFilter(minNetVotes, maxNetVotes);
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

    // Get vote data for a universal graph node - matches other store interfaces
    function getVoteData(nodeId: string): VoteData {
        // Check cache first
        if (voteCache.has(nodeId)) {
            return voteCache.get(nodeId)!;
        }

        // If not in cache, check if it's in current nodes
        const state = get({ subscribe });
        const node = state.nodes.find(n => n.id === nodeId);
        
        if (node) {
            return extractVoteDataFromNode(node);
        }

        // Return default values if not found
        return { positiveVotes: 0, negativeVotes: 0, netVotes: 0, shouldBeHidden: false };
    }

    // UPDATED: Update vote data for a universal graph node - supports both types
    function updateVoteData(nodeId: string, positiveVotes: number, negativeVotes: number): void {
        const state = get({ subscribe });
        const node = state.nodes.find(n => n.id === nodeId);
        
        if (node) {
            // Ensure we're working with numbers
            const posVotes = getNeo4jNumber(positiveVotes);
            const negVotes = getNeo4jNumber(negativeVotes);
            
            // Update the node's vote data - supports both openquestion and statement
            if (node.type === 'openquestion' || node.type === 'statement') {
                if (!node.metadata.votes) {
                    node.metadata.votes = { positive: 0, negative: 0, net: 0 };
                }
                node.metadata.votes.positive = posVotes;
                node.metadata.votes.negative = negVotes;
                node.metadata.votes.net = posVotes - negVotes;
            }
            
            // Cache the updated vote data
            cacheVoteData(nodeId, posVotes, negVotes);
            
            // Trigger store update
            update(state => ({ ...state }));
        } else {
            console.warn(`[UniversalGraphStore] Attempted to update vote data for unknown node: ${nodeId}`);
        }
    }

    // Clear vote cache - matches other store interfaces
    function clearVoteCache(nodeId?: string): void {
        if (nodeId) {
            voteCache.delete(nodeId);
        } else {
            voteCache.clear();
        }
    }

    // Get user data (vote status and visibility preferences) for a node
    function getUserData(nodeId: string): {
        userVoteStatus?: { status: 'agree' | 'disagree' | null };
        userVisibilityPreference?: { isVisible: boolean; source: string; timestamp: number };
    } {
        const state = get({ subscribe });
        const node = state.nodes.find(n => n.id === nodeId);
        
        if (node) {
            return {
                userVoteStatus: node.metadata.userVoteStatus,
                userVisibilityPreference: node.metadata.userVisibilityPreference
            };
        }
        
        return {};
    }

    // Update user vote status for a node
    function updateUserVoteStatus(nodeId: string, voteStatus: 'agree' | 'disagree' | null): void {
        const state = get({ subscribe });
        const nodeIndex = state.nodes.findIndex(n => n.id === nodeId);
        
        if (nodeIndex >= 0) {
            const updatedNodes = [...state.nodes];
            const node = { ...updatedNodes[nodeIndex] };
            
            // Update the user vote status in metadata
            node.metadata = {
                ...node.metadata,
                userVoteStatus: {
                    status: voteStatus
                }
            };
            
            updatedNodes[nodeIndex] = node;
            
            // Update the store
            update(state => ({
                ...state,
                nodes: updatedNodes
            }));
        }
    }

    // Update user visibility preference for a node
    function updateUserVisibilityPreference(
        nodeId: string, 
        isVisible: boolean, 
        source: string = 'user'
    ): void {
        const state = get({ subscribe });
        const nodeIndex = state.nodes.findIndex(n => n.id === nodeId);
        
        if (nodeIndex >= 0) {
            const updatedNodes = [...state.nodes];
            const node = { ...updatedNodes[nodeIndex] };
            
            // Update the user visibility preference in metadata
            node.metadata = {
                ...node.metadata,
                userVisibilityPreference: {
                    isVisible,
                    source,
                    timestamp: Date.now()
                }
            };
            
            updatedNodes[nodeIndex] = node;
            
            // Update the store
            update(state => ({
                ...state,
                nodes: updatedNodes
            }));
        }
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
        updateUserVisibilityPreference
    };
}

export const universalGraphStore = createUniversalGraphStore();