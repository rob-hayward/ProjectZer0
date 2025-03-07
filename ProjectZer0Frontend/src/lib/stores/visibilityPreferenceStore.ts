// src/lib/stores/visibilityPreferenceStore.ts
import { writable, derived, get } from 'svelte/store';
import { fetchWithAuth } from '$lib/services/api';
import { browser } from '$app/environment';

// Local storage key
const STORAGE_KEY = 'pz_visibility_preferences';

// Store state
interface VisibilityState {
  isLoaded: boolean;
  preferences: Record<string, boolean>;
  isLoading: boolean;
  lastUpdated: number;
}

function createVisibilityStore() {
  // Initialize with empty state
  const { subscribe, set, update } = writable<VisibilityState>({
    isLoaded: false,
    preferences: {},
    isLoading: false,
    lastUpdated: 0
  });

  // Helper to save to localStorage
  function saveToLocalStorage(preferences: Record<string, boolean>) {
    if (!browser) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        preferences,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('[VisibilityStore] Error saving to localStorage:', error);
    }
  }

  // Helper to load from localStorage
  function loadFromLocalStorage(): Record<string, boolean> {
    if (!browser) return {};
    try {
      const storedData = localStorage.getItem(STORAGE_KEY);
      if (storedData) {
        const parsed = JSON.parse(storedData);
        console.log('[VisibilityStore] Loaded preferences from localStorage:', parsed);
        return parsed.preferences || {};
      }
    } catch (error) {
      console.error('[VisibilityStore] Error loading from localStorage:', error);
    }
    return {};
  }

  return {
    subscribe,
    
    // Initialization - called as early as possible
    initialize() {
      // Try to load from localStorage first
      if (browser) {
        const cachedPreferences = loadFromLocalStorage();
        if (Object.keys(cachedPreferences).length > 0) {
          update(state => ({
            ...state,
            preferences: cachedPreferences,
            isLoaded: true,
            lastUpdated: Date.now()
          }));
          
          console.log('[VisibilityStore] Initialized with cached preferences');
        }
      }
    },
    
    // Load preferences from backend and merge with cached
    async loadPreferences() {
      update(state => ({ ...state, isLoading: true }));
      
      try {
        const response = await fetchWithAuth('/users/visibility-preferences');
        
        // Merge with existing preferences (backend is source of truth)
        update(state => {
          const updatedPreferences = {
            ...state.preferences,
            ...response
          };
          
          // Save to localStorage
          saveToLocalStorage(updatedPreferences);
          
          return { 
            isLoaded: true, 
            preferences: updatedPreferences, 
            isLoading: false,
            lastUpdated: Date.now()
          };
        });
        
        console.log('[VisibilityStore] Loaded preferences from backend:', response);
      } catch (error) {
        console.error('[VisibilityStore] Error loading preferences:', error);
        update(state => ({ ...state, isLoading: false }));
      }
    },
    
    // Get preference for a specific node
    getPreference(nodeId: string): boolean | undefined {
      const state = get({ subscribe });
      return state.preferences[nodeId];
    },
    
    // Check if a node should be visible (based on preferences)
    shouldBeVisible(nodeId: string, communityVisibility: boolean): boolean {
      const state = get({ subscribe });
      // If user has a preference, use it; otherwise fall back to community visibility
      return state.preferences[nodeId] !== undefined 
        ? state.preferences[nodeId] 
        : communityVisibility;
    },
    
    // Set preference and save to backend and cache
    async setPreference(nodeId: string, isVisible: boolean) {
      // Optimistically update local state
      update(state => {
        const updatedPreferences = {
          ...state.preferences,
          [nodeId]: isVisible
        };
        
        // Save to localStorage immediately
        saveToLocalStorage(updatedPreferences);
        
        return {
          ...state,
          preferences: updatedPreferences,
          lastUpdated: Date.now()
        };
      });
      
      // Save to backend
      try {
        await fetchWithAuth('/users/visibility-preferences', {
          method: 'POST',
          body: JSON.stringify({
            nodeId,
            isVisible
          })
        });
        console.log(`[VisibilityStore] Saved preference for ${nodeId}: ${isVisible}`);
      } catch (error) {
        console.error(`[VisibilityStore] Error saving preference for ${nodeId}:`, error);
        // Note: We don't revert the optimistic update to avoid UI flicker
      }
    },
    
    // Get all preferences
    getAllPreferences(): Record<string, boolean> {
      return get({ subscribe }).preferences;
    },
    
    // Clear all preferences (for testing/debugging)
    clear() {
      if (browser) {
        localStorage.removeItem(STORAGE_KEY);
      }
      set({
        isLoaded: true,
        preferences: {},
        isLoading: false,
        lastUpdated: Date.now()
      });
    }
  };
}

export const visibilityStore = createVisibilityStore();