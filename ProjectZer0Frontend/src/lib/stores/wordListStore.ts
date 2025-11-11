// src/lib/stores/wordListStore.ts
// UPDATED: Fixed to use correct /graph/universal/filters/keywords endpoint
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
         * FIXED: Now uses correct universal graph endpoint
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
                return state.words;
            }
            
            update(state => ({ ...state, isLoading: true, error: null }));
            
            try {
                // FIXED: Use correct universal graph endpoint
                const response = await fetchWithAuth('/graph/universal/filters/keywords');
                
                let words: string[] = [];
                
                // Handle different response types
                if (response === '' || response === null || response === undefined || 
                    (Array.isArray(response) && response.length === 0)) {
                    // Use sample words as fallback
                    words = [
                        'democracy', 'freedom', 'justice', 'equality', 'society', 
                        'government', 'truth', 'privacy', 'rights', 'liberty',
                        'security', 'capitalism', 'socialism', 'economy', 'education',
                        'health', 'environment', 'climate', 'technology', 'science'
                    ];
                }
                else if (Array.isArray(response)) {
                    // UPDATED: Handle universal graph response format
                    // Response is array of objects with 'word' property
                    words = response.map((item: any) => {
                        if (typeof item === 'string') return item;
                        if (item && typeof item === 'object' && 'word' in item) {
                            return item.word;
                        }
                        return null;
                    }).filter(Boolean) as string[];
                }
                else if (typeof response === 'object' && response !== null) {
                    // Handle alternative response formats
                    if ('words' in response && Array.isArray(response.words)) {
                        words = response.words.map((item: any) => {
                            if (typeof item === 'string') return item;
                            if (item && typeof item === 'object' && 'word' in item) return item.word;
                            return null;
                        }).filter(Boolean) as string[];
                    } else if ('keywords' in response && Array.isArray(response.keywords)) {
                        words = response.keywords.map((item: any) => {
                            if (typeof item === 'string') return item;
                            if (item && typeof item === 'object' && 'word' in item) return item.word;
                            return null;
                        }).filter(Boolean) as string[];
                    }
                }
                else if (typeof response === 'string' && response.trim() !== '') {
                    try {
                        // Try to parse JSON string
                        const parsed = JSON.parse(response);
                        if (Array.isArray(parsed)) {
                            words = parsed.filter(Boolean);
                        }
                    } catch (e) {
                        console.error('[WordListStore] Failed to parse response as JSON:', e);
                        throw new Error('Invalid response format from API');
                    }
                }
                else {
                    console.error('[WordListStore] Unexpected response type:', typeof response);
                    throw new Error('Unexpected response type from API');
                }
                
                // Sort alphabetically and ensure uniqueness
                words = [...new Set(words)].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
                
                // Update the store
                update(state => ({
                    ...state,
                    words,
                    isLoading: false,
                    error: null,
                    lastLoaded: Date.now()
                }));
                
                // Save to localStorage for faster access next time
                saveToLocalStorage(words);
                
                console.log('[WordListStore] Successfully loaded words:', words.length);
                
                return words;
            } catch (error) {
                console.error('[WordListStore] Error fetching words:', error);
                
                // Try to load from localStorage as fallback
                const cachedWords = loadFromLocalStorage();
                if (cachedWords.length > 0) {
                    update(state => ({
                        ...state,
                        words: cachedWords,
                        isLoading: false,
                        error: `Error fetching words: ${error}. Using cached data.`,
                        lastLoaded: Date.now() - 86400000 // Set to 24h ago to encourage refresh on next load
                    }));
                    
                    console.log('[WordListStore] Using cached words:', cachedWords.length);
                    
                    return cachedWords;
                }
                
                // If no cache, provide sample words
                const sampleWords = [
                    'democracy', 'freedom', 'justice', 'equality', 'society', 
                    'government', 'truth', 'privacy', 'rights', 'liberty',
                    'security', 'capitalism', 'socialism', 'economy', 'education',
                    'health', 'environment', 'climate', 'technology', 'science'
                ];
                
                update(state => ({
                    ...state,
                    words: sampleWords,
                    isLoading: false,
                    error: `Error fetching words: ${error}. Using sample data.`,
                    lastLoaded: Date.now()
                }));
                
                console.log('[WordListStore] Using sample words');
                
                return sampleWords;
            }
        },
        
        /**
         * Search for words matching a query
         */
        searchWords(query: string, limit = 20): string[] {
            const state = get({ subscribe });
            
            // If no query and caller wants all words, return all words (up to limit)
            if (!query && limit > 50) {
                return state.words.slice(0, limit);
            }
            
            if (!state.words.length) return [];
            
            // Handle empty query more efficiently
            if (!query.trim()) {
                return state.words.slice(0, Math.min(limit, 30)); // Just return a sample of words
            }
            
            const lowerQuery = query.toLowerCase().trim();
            
            // For better performance, use separate arrays and combine at the end
            const exactMatches: string[] = [];
            const startsWith: string[] = [];
            const contains: string[] = [];
            
            // Only process enough words to meet our limit
            // This is more efficient than creating filtered arrays of all words
            for (const word of state.words) {
                const lowerWord = word.toLowerCase();
                
                // Check for exact match
                if (lowerWord === lowerQuery) {
                    exactMatches.push(word);
                    continue;
                }
                
                // Check for starts with
                if (lowerWord.startsWith(lowerQuery)) {
                    startsWith.push(word);
                    // Break early if we have enough matches
                    if (exactMatches.length + startsWith.length >= limit) break;
                    continue;
                }
                
                // Check for contains if we don't have enough matches yet
                if (exactMatches.length + startsWith.length + contains.length < limit &&
                    lowerWord.includes(lowerQuery)) {
                    contains.push(word);
                }
                
                // Break if we have enough matches
                if (exactMatches.length + startsWith.length + contains.length >= limit) break;
            }
            
            // Combine results in priority order
            return [
                ...exactMatches, 
                ...startsWith.slice(0, limit - exactMatches.length),
                ...contains.slice(0, limit - exactMatches.length - startsWith.length)
            ];
        },
        
        /**
         * Check if a word exists in the list
         */
        wordExists(word: string): boolean {
            const state = get({ subscribe });
            return state.words.some(w => w.toLowerCase() === word.toLowerCase());
        },
        
        /**
         * Get all available words
         */
        getAllWords(): string[] {
            const state = get({ subscribe });
            return [...state.words];
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
    
    /**
     * Helper function to save words to localStorage
     */
    function saveToLocalStorage(words: string[]) {
        if (words.length > 0 && typeof window !== 'undefined') {
            try {
                localStorage.setItem('pz_word_list', JSON.stringify({
                    words,
                    timestamp: Date.now()
                }));
            } catch (e) {
                console.warn('[WordListStore] Failed to save word list to localStorage', e);
            }
        }
    }
    
    /**
     * Helper function to load words from localStorage
     */
    function loadFromLocalStorage(): string[] {
        if (typeof window !== 'undefined') {
            try {
                const cachedData = localStorage.getItem('pz_word_list');
                if (cachedData) {
                    const { words, timestamp } = JSON.parse(cachedData);
                    if (Array.isArray(words) && words.length > 0) {
                        return words;
                    }
                }
            } catch (e) {
                console.warn('[WordListStore] Failed to load word list from localStorage', e);
            }
        }
        return [];
    }
}

export const wordListStore = createWordListStore();