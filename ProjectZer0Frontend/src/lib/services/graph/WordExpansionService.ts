// src/lib/services/graph/WordExpansionService.ts
import { fetchWithAuth } from '../api';

export interface WordExpansionResponse {
    nodes: Array<{
        id: string;
        type: 'word' | 'definition';
        word?: string;  // For word node
        definitionText?: string;  // For definition node
        created_by?: string;
        createdBy?: string;
        public_credit?: boolean;
        publicCredit?: boolean;
        inclusion_positive_votes: number;
        inclusionPositiveVotes?: number;
        inclusion_negative_votes: number;
        inclusionNegativeVotes?: number;
        inclusion_net_votes: number;
        inclusionNetVotes?: number;
        content_positive_votes?: number;  // Only for definitions
        contentPositiveVotes?: number;
        content_negative_votes?: number;
        contentNegativeVotes?: number;
        content_net_votes?: number;
        contentNetVotes?: number;
        created_at: string;
        createdAt?: string;
        updated_at: string;
        updatedAt?: string;
        is_api_definition?: boolean;
        isApiDefinition?: boolean;
        is_ai_created?: boolean;
        isAICreated?: boolean;
    }>;
    relationships: Array<{
        id: string;
        source: string;
        target: string;
        type: string;
        metadata?: Record<string, any>;
    }>;
}

/**
 * Fetch word expansion data from the backend
 * Returns the word node and all its associated definitions
 */
export async function fetchWordExpansion(word: string): Promise<WordExpansionResponse> {
    console.log('[WordExpansionService] Fetching expansion for word:', word);
    
    try {
        const response = await fetchWithAuth(`/words/${encodeURIComponent(word)}/with-definitions`);
        
        console.log('[WordExpansionService] Expansion data received:', {
            nodeCount: response.nodes.length,
            wordNodes: response.nodes.filter((n: any) => n.type === 'word').length,
            definitionNodes: response.nodes.filter((n: any) => n.type === 'definition').length,
            relationshipCount: response.relationships.length
        });
        
        return response;
    } catch (error) {
        console.error('[WordExpansionService] Failed to fetch word expansion:', error);
        throw error;
    }
}