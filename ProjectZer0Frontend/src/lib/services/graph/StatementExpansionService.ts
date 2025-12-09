// src/lib/services/graph/StatementExpansionService.ts
import { fetchWithAuth } from '../api';

export interface StatementExpansionResponse {
    nodes: Array<{
        id: string;
        type: 'statement';
        content: string;
        created_by: string;
        createdBy?: string;
        public_credit?: boolean;
        publicCredit?: boolean;
        participant_count?: number;
        created_at: string;
        createdAt?: string;
        updated_at?: string;
        updatedAt?: string;
        keywords?: Array<{ word: string; source: string; frequency?: number }>;
        categories?: Array<{ id: string; name: string }>;
        metadata?: {
            votes?: {
                positive: number;
                negative: number;
                net: number;
            };
            relatedStatements?: any[];
            parentQuestion?: any;
            discussionId?: string;
            initialComment?: string;
        };
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
 * Fetch statement expansion data from backend
 * Returns the statement node ready for graph display
 */
export async function fetchStatementExpansion(statementId: string): Promise<StatementExpansionResponse> {
    console.log('[StatementExpansionService] Fetching expansion for statement:', statementId);
    
    try {
        // Fetch the statement by ID
        const response = await fetchWithAuth(`/nodes/statement/${statementId}`);
        
        console.log('[StatementExpansionService] Statement data received:', {
            statementId: response.id,
            content: response.content?.substring(0, 50) + '...',
            hasKeywords: !!response.keywords?.length,
            hasCategories: !!response.categories?.length
        });
        
        // Transform to expansion response format
        return {
            nodes: [response],
            relationships: [] // Statement has no child nodes, so no relationships
        };
    } catch (error) {
        console.error('[StatementExpansionService] Failed to fetch statement expansion:', error);
        throw error;
    }
}
