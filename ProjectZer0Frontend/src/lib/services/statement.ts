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