// src/lib/services/word.ts
import { fetchWithAuth } from './api';
import type { WordNode } from '$lib/types/nodes';

export async function getWordData(word: string): Promise<WordNode | null> {
    try {
        if (!word) {
            console.warn('getWordData called with empty word');
            return null;
        }

        console.log(`Fetching word data for: ${word}`);
        const encodedWord = encodeURIComponent(word.toLowerCase());
        const wordData = await fetchWithAuth(`/nodes/word/${encodedWord}`);
        console.log('Word data received:', wordData);
        return wordData;
    } catch (error) {
        console.error('Error fetching word data:', error);
        throw error; // Re-throw to allow handling by caller
    }
}

export async function checkWordExists(word: string): Promise<boolean> {
    try {
        if (!word) return false;
        
        console.log(`Checking if word exists: ${word}`);
        const response = await fetchWithAuth(`/nodes/word/check/${encodeURIComponent(word.toLowerCase())}`);
        return response.exists;
    } catch (error) {
        console.error('Error checking word existence:', error);
        return false;
    }
}