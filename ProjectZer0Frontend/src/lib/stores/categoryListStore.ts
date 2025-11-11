// src/lib/stores/categoryListStore.ts
// NEW: Store for managing category list from universal graph filters
import { writable, get } from 'svelte/store';
import { fetchWithAuth } from '$lib/services/api';

export interface Category {
    id: string;
    name: string;
}

interface CategoryListState {
    categories: Category[];
    isLoading: boolean;
    error: string | null;
    lastLoaded: number | null;
}

function createCategoryListStore() {
    const { subscribe, set, update } = writable<CategoryListState>({
        categories: [],
        isLoading: false,
        error: null,
        lastLoaded: null
    });

    return {
        subscribe,
        
        /**
         * Load all categories from the backend
         * Uses caching to prevent excessive API calls
         */
        async loadAllCategories(forceRefresh = false) {
            const state = get({ subscribe });
            
            // Check if we've already loaded categories and they're still fresh (24 hours)
            const isCacheValid = 
                state.categories.length > 0 && 
                state.lastLoaded !== null &&
                Date.now() - state.lastLoaded < 24 * 60 * 60 * 1000;
                
            // Skip if we already have categories and cache is valid
            if (!forceRefresh && isCacheValid) {
                return state.categories;
            }
            
            update(state => ({ ...state, isLoading: true, error: null }));
            
            try {
                // Use universal graph endpoint for categories
                const response = await fetchWithAuth('/graph/universal/filters/categories');
                
                let categories: Category[] = [];
                
                // Handle different response types
                if (response === '' || response === null || response === undefined || 
                    (Array.isArray(response) && response.length === 0)) {
                    // Use empty array as fallback (categories are optional)
                    categories = [];
                }
                else if (Array.isArray(response)) {
                    // Response is array of category objects with id and name
                    categories = response.map((item: any) => {
                        if (item && typeof item === 'object' && 'id' in item && 'name' in item) {
                            return {
                                id: item.id,
                                name: item.name
                            };
                        }
                        return null;
                    }).filter(Boolean) as Category[];
                }
                else if (typeof response === 'object' && response !== null) {
                    // Handle alternative response formats
                    if ('categories' in response && Array.isArray(response.categories)) {
                        categories = response.categories.map((item: any) => {
                            if (item && typeof item === 'object' && 'id' in item && 'name' in item) {
                                return {
                                    id: item.id,
                                    name: item.name
                                };
                            }
                            return null;
                        }).filter(Boolean) as Category[];
                    }
                }
                else {
                    console.error('[CategoryListStore] Unexpected response type:', typeof response);
                    throw new Error('Unexpected response type from API');
                }
                
                // Sort alphabetically by name and ensure uniqueness by ID
                const uniqueCategories = new Map<string, Category>();
                categories.forEach(cat => uniqueCategories.set(cat.id, cat));
                categories = Array.from(uniqueCategories.values())
                    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
                
                // Update the store
                update(state => ({
                    ...state,
                    categories,
                    isLoading: false,
                    error: null,
                    lastLoaded: Date.now()
                }));
                
                // Save to localStorage for faster access next time
                saveToLocalStorage(categories);
                
                console.log('[CategoryListStore] Successfully loaded categories:', categories.length);
                
                return categories;
            } catch (error) {
                console.error('[CategoryListStore] Error fetching categories:', error);
                
                // Try to load from localStorage as fallback
                const cachedCategories = loadFromLocalStorage();
                if (cachedCategories.length > 0) {
                    update(state => ({
                        ...state,
                        categories: cachedCategories,
                        isLoading: false,
                        error: `Error fetching categories: ${error}. Using cached data.`,
                        lastLoaded: Date.now() - 86400000 // Set to 24h ago to encourage refresh on next load
                    }));
                    
                    console.log('[CategoryListStore] Using cached categories:', cachedCategories.length);
                    
                    return cachedCategories;
                }
                
                // If no cache, return empty array (categories are optional)
                update(state => ({
                    ...state,
                    categories: [],
                    isLoading: false,
                    error: `Error fetching categories: ${error}. No categories available.`,
                    lastLoaded: Date.now()
                }));
                
                console.log('[CategoryListStore] No categories available');
                
                return [];
            }
        },
        
        /**
         * Search for categories matching a query
         */
        searchCategories(query: string, limit = 20): Category[] {
            const state = get({ subscribe });
            
            if (!state.categories.length) return [];
            
            // Handle empty query
            if (!query.trim()) {
                return state.categories.slice(0, Math.min(limit, 30));
            }
            
            const lowerQuery = query.toLowerCase().trim();
            
            // For better performance, use separate arrays
            const exactMatches: Category[] = [];
            const startsWith: Category[] = [];
            const contains: Category[] = [];
            
            for (const category of state.categories) {
                const lowerName = category.name.toLowerCase();
                
                // Check for exact match
                if (lowerName === lowerQuery) {
                    exactMatches.push(category);
                    continue;
                }
                
                // Check for starts with
                if (lowerName.startsWith(lowerQuery)) {
                    startsWith.push(category);
                    if (exactMatches.length + startsWith.length >= limit) break;
                    continue;
                }
                
                // Check for contains
                if (exactMatches.length + startsWith.length + contains.length < limit &&
                    lowerName.includes(lowerQuery)) {
                    contains.push(category);
                }
                
                if (exactMatches.length + startsWith.length + contains.length >= limit) break;
            }
            
            return [
                ...exactMatches,
                ...startsWith.slice(0, limit - exactMatches.length),
                ...contains.slice(0, limit - exactMatches.length - startsWith.length)
            ];
        },
        
        /**
         * Check if a category exists by ID
         */
        categoryExists(categoryId: string): boolean {
            const state = get({ subscribe });
            return state.categories.some(c => c.id === categoryId);
        },
        
        /**
         * Get category by ID
         */
        getCategoryById(categoryId: string): Category | undefined {
            const state = get({ subscribe });
            return state.categories.find(c => c.id === categoryId);
        },
        
        /**
         * Get all available categories
         */
        getAllCategories(): Category[] {
            const state = get({ subscribe });
            return [...state.categories];
        },
        
        /**
         * Reset the store to initial state
         */
        reset() {
            set({
                categories: [],
                isLoading: false,
                error: null,
                lastLoaded: null
            });
        }
    };
    
    /**
     * Helper function to save categories to localStorage
     */
    function saveToLocalStorage(categories: Category[]) {
        if (categories.length > 0 && typeof window !== 'undefined') {
            try {
                localStorage.setItem('pz_category_list', JSON.stringify({
                    categories,
                    timestamp: Date.now()
                }));
            } catch (e) {
                console.warn('[CategoryListStore] Failed to save category list to localStorage', e);
            }
        }
    }
    
    /**
     * Helper function to load categories from localStorage
     */
    function loadFromLocalStorage(): Category[] {
        if (typeof window !== 'undefined') {
            try {
                const cachedData = localStorage.getItem('pz_category_list');
                if (cachedData) {
                    const { categories, timestamp } = JSON.parse(cachedData);
                    if (Array.isArray(categories) && categories.length > 0) {
                        return categories;
                    }
                }
            } catch (e) {
                console.warn('[CategoryListStore] Failed to load category list from localStorage', e);
            }
        }
        return [];
    }
}

export const categoryListStore = createCategoryListStore();