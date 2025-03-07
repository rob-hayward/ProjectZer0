// src/lib/stores/visibilityPreferenceStore.ts
import { writable, derived, get } from 'svelte/store';
import { fetchWithAuth } from '$lib/services/api';

// Store state
interface VisibilityState {
  isLoaded: boolean;
  preferences: Record<string, boolean>;
  isLoading: boolean;
}

function createVisibilityStore() {
  // Initialize empty store
  const { subscribe, set, update } = writable<VisibilityState>({
    isLoaded: false,
    preferences: {},
    isLoading: false
  });

  return {
    subscribe,
    
    // Load all user preferences
    async loadPreferences() {
      update(state => ({ ...state, isLoading: true }));
      try {
        const response = await fetchWithAuth('/users/visibility-preferences');
        update(state => ({ 
          isLoaded: true, 
          preferences: response || {}, 
          isLoading: false 
        }));
        console.log('[VisibilityStore] Loaded preferences:', response);
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
    
    // Set preference and save to backend
    async setPreference(nodeId: string, isVisible: boolean) {
      // Optimistically update local state
      update(state => ({
        ...state,
        preferences: {
          ...state.preferences,
          [nodeId]: isVisible
        }
      }));
      
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
    }
  };
}

export const visibilityStore = createVisibilityStore();