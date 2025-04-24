// src/lib/services/quantity.ts
import { fetchWithAuth } from './api';
import type { QuantityNode } from '$lib/types/domain/nodes';

export async function getQuantityData(id: string): Promise<QuantityNode | null> {
    try {
        if (!id) {
            console.warn('getQuantityData called with empty id');
            return null;
        }

        console.log(`Fetching quantity data for: ${id}`);
        const quantityData = await fetchWithAuth(`/nodes/quantity/${id}`);
        console.log('Quantity data received:', quantityData);
        return quantityData;
    } catch (error) {
        console.error('Error fetching quantity data:', error);
        throw error; // Re-throw to allow handling by caller
    }
}

export async function createQuantity(quantityData: {
    question: string;
    unitCategoryId: string;
    defaultUnitId: string;
    initialComment?: string;
    publicCredit?: boolean;
}): Promise<QuantityNode> {
    try {
        console.log('Creating quantity node:', quantityData);
        const response = await fetchWithAuth('/nodes/quantity', {
            method: 'POST',
            body: JSON.stringify(quantityData)
        });
        console.log('Quantity node created:', response);
        return response;
    } catch (error) {
        console.error('Error creating quantity node:', error);
        throw error;
    }
}

export async function submitResponse(
    quantityNodeId: string,
    value: number,
    unitId: string
): Promise<any> {
    try {
        console.log(`Submitting response to quantity node ${quantityNodeId}:`, { value, unitId });
        const response = await fetchWithAuth(`/nodes/quantity/${quantityNodeId}/response`, {
            method: 'POST',
            body: JSON.stringify({ value, unitId })
        });
        console.log('Response submitted:', response);
        return response;
    } catch (error) {
        console.error('Error submitting response:', error);
        throw error;
    }
}

export async function getUserResponse(quantityNodeId: string): Promise<any> {
    try {
        console.log(`Fetching user response for quantity node: ${quantityNodeId}`);
        const response = await fetchWithAuth(`/nodes/quantity/${quantityNodeId}/response`);
        console.log('User response received:', response);
        return response;
    } catch (error) {
        console.error('Error fetching user response:', error);
        return null; // Return null when no response exists
    }
}

export async function getStatistics(quantityNodeId: string): Promise<any> {
    try {
        console.log(`Fetching statistics for quantity node: ${quantityNodeId}`);
        const statistics = await fetchWithAuth(`/nodes/quantity/${quantityNodeId}/statistics`);
        console.log('Statistics received:', statistics);
        return statistics;
    } catch (error) {
        console.error('Error fetching statistics:', error);
        throw error;
    }
}

export async function deleteUserResponse(quantityNodeId: string): Promise<any> {
    try {
        console.log(`Deleting user response for quantity node: ${quantityNodeId}`);
        const response = await fetchWithAuth(`/nodes/quantity/${quantityNodeId}/response`, {
            method: 'DELETE'
        });
        console.log('Response deleted:', response);
        return response;
    } catch (error) {
        console.error('Error deleting response:', error);
        throw error;
    }
}