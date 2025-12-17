// src/lib/services/graph/EvidenceExpansionService.ts
import { fetchWithAuth } from '../api';

export interface EvidenceExpansionResponse {
    nodes: Array<{
        id: string;
        type: 'evidence';
        title: string;
        url: string;
        evidenceType: string;
        parentNodeId?: string;
        parentNodeType?: string;
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
            peerReview?: {
                qualityScore: number;
                independenceScore: number;
                relevanceScore: number;
                overallScore: number;
                reviewCount: number;
            };
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
 * Fetch evidence expansion data from backend
 * Returns the evidence node ready for graph display
 */
export async function fetchEvidenceExpansion(
    evidenceId: string
): Promise<EvidenceExpansionResponse> {
    console.log('[EvidenceExpansionService] Fetching expansion for evidence:', evidenceId);
    
    try {
        const response = await fetchWithAuth(`/nodes/evidence/${evidenceId}`);
        
        console.log('[EvidenceExpansionService] Response fields:', Object.keys(response));
        console.log('[EvidenceExpansionService] Evidence title:', response.title);
        
        return {
            nodes: [response],
            relationships: []
        };
    } catch (error) {
        console.error('[EvidenceExpansionService] Failed to fetch evidence expansion:', error);
        throw error;
    }
}