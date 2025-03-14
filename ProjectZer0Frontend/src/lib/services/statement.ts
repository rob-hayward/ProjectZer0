// src/lib/services/statement.ts
import { fetchWithAuth } from './api';
import type { StatementNode } from '$lib/types/domain/nodes';

export async function getStatementData(id: string): Promise<StatementNode | null> {
    try {
        if (!id) {
            console.warn('getStatementData called with empty id');
            return null;
        }

        console.log(`Fetching statement data for: ${id}`);
        const statementData = await fetchWithAuth(`/nodes/statement/${id}`);
        console.log('Statement data received:', statementData);
        return statementData;
    } catch (error) {
        console.error('Error fetching statement data:', error);
        throw error; // Re-throw to allow handling by caller
    }
}

export async function createStatement(statementData: {
    statement: string;
    userKeywords?: string[];
    initialComment?: string;
    publicCredit?: boolean;
}): Promise<StatementNode> {
    try {
        console.log('Creating statement:', statementData);
        const response = await fetchWithAuth('/nodes/statement', {
            method: 'POST',
            body: JSON.stringify(statementData)
        });
        console.log('Statement created:', response);
        return response;
    } catch (error) {
        console.error('Error creating statement:', error);
        throw error;
    }
}

/**
 * Fetch multiple statements for the statement network view
 */
export async function getStatementNetwork(options?: {
    limit?: number;
    offset?: number;
    keywords?: string[];
    userId?: string;
    sortBy?: string;
    sortDirection?: string;
}): Promise<StatementNode[]> {
    // Build query parameters
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    if (options?.keywords?.length) {
        options.keywords.forEach(k => params.append('keyword', k));
    }
    if (options?.userId) params.append('userId', options.userId);
    if (options?.sortBy) params.append('sortBy', options.sortBy);
    if (options?.sortDirection) params.append('sortDirection', options.sortDirection);
    
    // Make API request
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return fetchWithAuth(`/nodes/statement/network${queryString}`);
}