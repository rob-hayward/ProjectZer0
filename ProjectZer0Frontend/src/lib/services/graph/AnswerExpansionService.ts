// src/lib/services/graph/AnswerExpansionService.ts
import { fetchWithAuth } from '../api';

export interface AnswerExpansionResponse {
    nodes: Array<{
        id: string;
        type: 'answer';
        answerText: string;
        questionId?: string;
        parentQuestionId?: string;
        created_by?: string;
        createdBy?: string;
        public_credit?: boolean;
        publicCredit?: boolean;
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

export async function fetchAnswerExpansion(
    answerId: string
): Promise<AnswerExpansionResponse> {
    console.log('[AnswerExpansionService] Fetching expansion for answer:', answerId);
    
    try {
        const response = await fetchWithAuth(`/nodes/answer/${answerId}`);
        
        // DEBUG: Verify field names
        console.log('[AnswerExpansionService] Response fields:', Object.keys(response));
        console.log('[AnswerExpansionService] Answer text field:', response.answerText);
        
        return {
            nodes: [response],
            relationships: []
        };
    } catch (error) {
        console.error('[AnswerExpansionService] Failed to fetch answer expansion:', error);
        throw error;
    }
}