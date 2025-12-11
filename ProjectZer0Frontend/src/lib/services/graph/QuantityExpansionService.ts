// src/lib/services/graph/QuantityExpansionService.ts
import { fetchWithAuth } from '../api';

export interface QuantityExpansionResponse {
    nodes: Array<{
        id: string;
        type: 'quantity';
        question: string;
        unitCategoryId?: string;
        defaultUnitId?: string;
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
            responses?: Record<string, any>;
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
 * Fetch quantity expansion data from backend
 * Returns the quantity node ready for graph display
 */
export async function fetchQuantityExpansion(
    quantityId: string
): Promise<QuantityExpansionResponse> {
    console.log('[QuantityExpansionService] Fetching expansion for quantity:', quantityId);
    
    try {
        const response = await fetchWithAuth(`/nodes/quantity/${quantityId}`);
        
        console.log('[QuantityExpansionService] Response fields:', Object.keys(response));
        console.log('[QuantityExpansionService] Question field:', response.question);
        
        return {
            nodes: [response],
            relationships: []
        };
    } catch (error) {
        console.error('[QuantityExpansionService] Failed to fetch quantity expansion:', error);
        throw error;
    }
}