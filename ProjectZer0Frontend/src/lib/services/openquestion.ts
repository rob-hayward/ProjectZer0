// src/lib/services/openquestion.ts
import { fetchWithAuth } from './api';
import type { OpenQuestionNode } from '$lib/types/domain/nodes';

export async function getOpenQuestionData(id: string): Promise<OpenQuestionNode | null> {
    try {
        if (!id) {
            console.warn('getOpenQuestionData called with empty id');
            return null;
        }

        console.log(`Fetching open question data for: ${id}`);
        const questionData = await fetchWithAuth(`/nodes/openquestion/${id}`);
        console.log('Open question data received:', questionData);
        return questionData;
    } catch (error) {
        console.error('Error fetching open question data:', error);
        throw error; // Re-throw to allow handling by caller
    }
}

export async function createOpenQuestion(questionData: {
    questionText: string;
    userKeywords?: string[];
    initialComment?: string;
    publicCredit?: boolean;
}): Promise<OpenQuestionNode> {
    try {
        console.log('Creating open question:', questionData);
        const response = await fetchWithAuth('/nodes/openquestion', {
            method: 'POST',
            body: JSON.stringify(questionData)
        });
        console.log('Open question created:', response);
        return response;
    } catch (error) {
        console.error('Error creating open question:', error);
        throw error;
    }
}

/**
 * Fetch multiple open questions for the network view
 */
export async function getOpenQuestionNetwork(options?: {
    limit?: number;
    offset?: number;
    keywords?: string[];
    userId?: string;
    sortBy?: string;
    sortDirection?: string;
}): Promise<OpenQuestionNode[]> {
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
    return fetchWithAuth(`/nodes/openquestion/network${queryString}`);
}

/**
 * Create a statement that answers this open question
 */
export async function createAnswerStatement(questionId: string, answerData: {
    statement: string;
    userKeywords?: string[];
    initialComment?: string;
    publicCredit?: boolean;
}): Promise<any> {
    try {
        console.log(`Creating answer for question ${questionId}:`, answerData);
        const response = await fetchWithAuth(`/nodes/openquestion/${questionId}/answers`, {
            method: 'POST',
            body: JSON.stringify(answerData)
        });
        console.log('Answer statement created:', response);
        return response;
    } catch (error) {
        console.error('Error creating answer statement:', error);
        throw error;
    }
}

/**
 * Get all statements that answer this open question
 */
export async function getQuestionAnswers(questionId: string): Promise<any[]> {
    try {
        console.log(`Fetching answers for question: ${questionId}`);
        const answers = await fetchWithAuth(`/nodes/openquestion/${questionId}/answers`);
        console.log('Question answers received:', answers);
        return answers;
    } catch (error) {
        console.error('Error fetching question answers:', error);
        throw error;
    }
}

/**
 * Link an existing statement as an answer to this question
 */
export async function linkAnswerToQuestion(questionId: string, statementId: string): Promise<{ success: boolean }> {
    try {
        console.log(`Linking statement ${statementId} to question ${questionId}`);
        const response = await fetchWithAuth(`/nodes/openquestion/${questionId}/answers/${statementId}/link`, {
            method: 'POST'
        });
        console.log('Answer linked successfully:', response);
        return response;
    } catch (error) {
        console.error('Error linking answer to question:', error);
        throw error;
    }
}

/**
 * Unlink a statement from this question
 */
export async function unlinkAnswerFromQuestion(questionId: string, statementId: string): Promise<{ success: boolean }> {
    try {
        console.log(`Unlinking statement ${statementId} from question ${questionId}`);
        const response = await fetchWithAuth(`/nodes/openquestion/${questionId}/answers/${statementId}/unlink`, {
            method: 'DELETE'
        });
        console.log('Answer unlinked successfully:', response);
        return response;
    } catch (error) {
        console.error('Error unlinking answer from question:', error);
        throw error;
    }
}