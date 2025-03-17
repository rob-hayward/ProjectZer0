// src/lib/stores/wordListStore.ts
import { writable, get } from 'svelte/store';
import { fetchWithAuth } from '$lib/services/api';

interface WordListState {
    words: string[];
    isLoading: boolean;
    error: string | null;
    lastLoaded: number | null;
}

function createWordListStore() {
    const { subscribe, set, update } = writable<WordListState>({
        words: [],
        isLoading: false,
        error: null,
        lastLoaded: null
    });

    return {
        subscribe,
        
        /**
         * Load all words from the backend
         * Uses caching to prevent excessive API calls
         */
        async loadAllWords(forceRefresh = false) {
            const state = get({ subscribe });
            
            // Check if we've already loaded words and they're still fresh (24 hours)
            const isCacheValid = 
                state.words.length > 0 && 
                state.lastLoaded !== null &&
                Date.now() - state.lastLoaded < 24 * 60 * 60 * 1000;
                
            // Skip if we already have words and cache is valid
            if (!forceRefresh && isCacheValid) {
                console.log('[WordListStore] Using cached word list:', {
                    wordCount: state.words.length,
                    lastLoaded: state.lastLoaded ? new Date(state.lastLoaded).toLocaleString() : 'Never'
                });
                return state.words;
            }
            
            update(state => ({ ...state, isLoading: true, error: null }));
            
            try {
                console.log('[WordListStore] Fetching all words from API...');
                
                // Fetch words from the backend
                const response = await fetchWithAuth('/nodes/word/all');
                
                // Validate response
                if (!response || !Array.isArray(response)) {
                    throw new Error('Invalid response from word API');
                }
                
                // Extract word strings from the response
                // The response might be an array of objects with a word property
                const words = response.map(item => {
                    if (typeof item === 'string') return item;
                    if (item && typeof item === 'object' && 'word' in item) return item.word;
                    return '';
                }).filter(Boolean);
                
                // Sort alphabetically
                words.sort();
                
                console.log(`[WordListStore] Loaded ${words.length} words from API`);
                
                // Update the store
                update(state => ({
                    ...state,
                    words,
                    isLoading: false,
                    lastLoaded: Date.now()
                }));
                
                // Save to localStorage for faster access next time
                if (words.length > 0 && typeof window !== 'undefined') {
                    try {
                        localStorage.setItem('pz_word_list', JSON.stringify({
                            words,
                            timestamp: Date.now()
                        }));
                        console.log('[WordListStore] Saved word list to localStorage');
                    } catch (e) {
                        console.warn('[WordListStore] Failed to save word list to localStorage', e);
                    }
                }
                
                return words;
            } catch (error) {
                console.error('[WordListStore] Error fetching words:', error);
                
                // Try to load from localStorage as fallback
                if (typeof window !== 'undefined') {
                    try {
                        const cachedData = localStorage.getItem('pz_word_list');
                        if (cachedData) {
                            const { words, timestamp } = JSON.parse(cachedData);
                            if (Array.isArray(words) && words.length > 0) {
                                console.log('[WordListStore] Using fallback from localStorage:', {
                                    wordCount: words.length,
                                    timestamp: timestamp ? new Date(timestamp).toLocaleString() : 'Unknown'
                                });
                                
                                update(state => ({
                                    ...state,
                                    words,
                                    isLoading: false,
                                    error: `Error fetching words: ${error}. Using cached data.`,
                                    lastLoaded: timestamp
                                }));
                                
                                return words;
                            }
                        }
                    } catch (e) {
                        console.warn('[WordListStore] Failed to load word list from localStorage', e);
                    }
                }
                
                // Update store with error
                update(state => ({
                    ...state,
                    isLoading: false,
                    error: `Error fetching words: ${error}`
                }));
                
                return [];
            }
        },
        
        /**
         * Search for words matching a query
         */
        searchWords(query: string, limit = 20): string[] {
            if (!query) return [];
            
            const state = get({ subscribe });
            const lowerQuery = query.toLowerCase();
            
            // Search for words that start with the query first
            const startsWith = state.words
                .filter(word => word.toLowerCase().startsWith(lowerQuery))
                .slice(0, limit);
                
            // If we don't have enough matches, look for words containing the query
            if (startsWith.length < limit) {
                const remaining = limit - startsWith.length;
                const contains = state.words
                    .filter(word => !word.toLowerCase().startsWith(lowerQuery) && 
                                    word.toLowerCase().includes(lowerQuery))
                    .slice(0, remaining);
                    
                return [...startsWith, ...contains];
            }
            
            return startsWith;
        },
        
        /**
         * Reset the store to initial state
         */
        reset() {
            set({
                words: [],
                isLoading: false,
                error: null,
                lastLoaded: null
            });
        }
    };
}

export const wordListStore = createWordListStore();