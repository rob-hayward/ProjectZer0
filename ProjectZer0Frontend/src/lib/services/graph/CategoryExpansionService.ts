// Service for handling category expansion via API
// Located at: ProjectZer0Frontend/src/lib/services/graph/CategoryExpansionService.ts

import { fetchWithAuth } from '$lib/services/api';

export interface CategoryExpansionResponse {
    nodes: any[];  // UniversalNodeData[]
    relationships: any[];  // UniversalRelationshipData[]
    performance_metrics?: any;
}

/**
 * Fetches a category node and its composed word nodes
 * @param categoryId - The UUID of the category to expand
 * @returns Promise with nodes and relationships
 */
export async function fetchCategoryExpansion(
    categoryId: string
): Promise<CategoryExpansionResponse> {
    try {
        const url = `/categories/${categoryId}/with-contents`;
        const response = await fetchWithAuth(url);
        
        if (!response) {
            throw new Error('No response from category expansion API');
        }
        
        return response as CategoryExpansionResponse;
    } catch (error) {
        console.error('[CategoryExpansion] Error fetching category:', error);
        throw error;
    }
}