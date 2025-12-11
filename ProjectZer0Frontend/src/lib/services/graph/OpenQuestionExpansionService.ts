// src/lib/services/graph/OpenQuestionExpansionService.ts
import { fetchWithAuth } from '../api';

export interface OpenQuestionExpansionResponse {
    nodes: Array<{
        id: string;
        type: 'openquestion';
        questionText: string;
        content?: string;
        created_by?: string;
        createdBy?: string;
        public_credit?: boolean;
        publicCredit?: boolean;
        participant_count?: number;
        created_at?: string;
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
            answer_count?: number;
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
 * Fetch open question expansion data from backend
 * Returns the question node ready for graph display
 */
export async function fetchOpenQuestionExpansion(
    questionId: string
): Promise<OpenQuestionExpansionResponse> {
    console.log('[OpenQuestionExpansionService] Fetching expansion for question:', questionId);
    
    try {
        const response = await fetchWithAuth(`/nodes/openquestion/${questionId}`);
        
        console.log('[OpenQuestionExpansionService] Response fields:', Object.keys(response));
        console.log('[OpenQuestionExpansionService] Question text field:', response.questionText || response.content);
        
        return {
            nodes: [response],
            relationships: []
        };
    } catch (error) {
        console.error('[OpenQuestionExpansionService] Failed to fetch question expansion:', error);
        throw error;
    }
}