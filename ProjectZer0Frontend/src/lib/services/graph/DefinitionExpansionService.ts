// src/lib/services/graph/DefinitionExpansionService.ts
import { fetchWithAuth } from '../api';

export interface DefinitionExpansionResponse {
    nodes: any[];
    relationships: any[];
}

export async function fetchDefinitionExpansion(definitionId: string): Promise<DefinitionExpansionResponse> {
    console.log('[DefinitionExpansionService] Fetching expansion for definition:', definitionId);
    
    try {
        // ✅ FIXED: Changed from /nodes/definition/ to /definitions/
        const response = await fetchWithAuth(`/definitions/${definitionId}`, {
            method: 'GET'
        });
        
        console.log('[DefinitionExpansionService] Raw API response:', response);
        
        // Wrap single node response in expansion format
        const expansionData: DefinitionExpansionResponse = {
            nodes: [response],
            relationships: []
        };
        
        console.log('[DefinitionExpansionService] Expansion data formatted:', {
            nodeCount: expansionData.nodes.length,
            relationshipCount: expansionData.relationships.length
        });
        
        return expansionData;
        
    } catch (error) {
        console.error('[DefinitionExpansionService] Error fetching definition expansion:', error);
        throw error;
    }
}