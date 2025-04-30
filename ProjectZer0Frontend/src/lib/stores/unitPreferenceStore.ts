// src/lib/stores/unitPreferenceStore.ts
import { writable, derived, get } from 'svelte/store';
import { fetchWithAuth } from '$lib/services/api';
import { browser } from '$app/environment';

// Local storage key
const STORAGE_KEY = 'pz_unit_preferences';

// Preference types
export interface UnitPreference {
  unitId: string;
  lastUpdated: number;
}

// Store state
interface UnitPreferenceState {
  isLoaded: boolean;
  preferences: Record<string, UnitPreference>;
  isLoading: boolean;
  lastUpdated: number;
  error: string | null;
}

function createUnitPreferenceStore() {
  // Initialize with empty state
  const { subscribe, set, update } = writable<UnitPreferenceState>({
    isLoaded: false,
    preferences: {},
    isLoading: false,
    lastUpdated: 0,
    error: null
  });

  // Helper to save to localStorage
  function saveToLocalStorage(preferences: Record<string, UnitPreference>) {
    if (!browser) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        preferences,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error saving unit preferences to localStorage:', error);
    }
  }

  // Helper to load from localStorage
  function loadFromLocalStorage(): Record<string, UnitPreference> {
    if (!browser) return {};
    try {
      const storedData = localStorage.getItem(STORAGE_KEY);
      if (storedData) {
        const parsed = JSON.parse(storedData);
        console.log('Loaded unit preferences from localStorage:', 
          { count: Object.keys(parsed.preferences || {}).length });
        return parsed.preferences || {};
      }
    } catch (error) {
      console.error('Error loading unit preferences from localStorage:', error);
    }
    return {};
  }

  return {
    subscribe,
    
    // Initialization - called as early as possible
    initialize() {
      if (browser) {
        const preferences = loadFromLocalStorage();
        if (Object.keys(preferences).length > 0) {
          update(state => ({
            ...state,
            preferences,
            isLoaded: true,
            lastUpdated: Date.now()
          }));
          
          console.log('Initialized with cached unit preferences');
        }
      }
    },
    
    // Load preferences from backend and merge with cached
    async loadPreferences() {
      update(state => ({ ...state, isLoading: true, error: null }));
      
      try {
        const response = await fetchWithAuth('/users/unit-preferences');
        
        // Transform the response to our internal format
        const preferences: Record<string, UnitPreference> = {};
        
        // Process the response based on its structure
        if (response && typeof response === 'object' && response !== null) {
          // Using type-safe approach for iterating over unknown object
          Object.entries(response).forEach(([nodeId, value]) => {
            if (value && typeof value === 'object') {
              // Use type assertion to safely handle the object properties
              const valueObj = value as { unitId?: string; lastUpdated?: number };
              if (typeof valueObj.unitId === 'string') {
                preferences[nodeId] = {
                  unitId: valueObj.unitId,
                  lastUpdated: typeof valueObj.lastUpdated === 'number' 
                    ? valueObj.lastUpdated 
                    : Date.now()
                };
              }
            }
          });
        }
        
        // Update state with merged preferences
        update(state => {
          const mergedPreferences = {
            ...state.preferences,
            ...preferences
          };
          
          // Save to localStorage
          saveToLocalStorage(mergedPreferences);
          
          return { 
            isLoaded: true, 
            preferences: mergedPreferences,
            isLoading: false,
            lastUpdated: Date.now(),
            error: null
          };
        });
        
        console.log('Loaded unit preferences from backend:', {
          count: Object.keys(preferences).length
        });
      } catch (error) {
        console.error('Error loading unit preferences:', error);
        update(state => ({ 
          ...state, 
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load unit preferences'
        }));
      }
    },
    
    // Get preference for a specific node
    getPreference(nodeId: string): UnitPreference | undefined {
      const state = get({ subscribe });
      return state.preferences[nodeId];
    },
    
    // Set preference and save to backend and cache
    async setPreference(nodeId: string, unitId: string) {
      // Optimistically update local state
      update(state => {
        const updatedPreferences = {
          ...state.preferences,
          [nodeId]: {
            unitId,
            lastUpdated: Date.now()
          }
        };
        
        // Save to localStorage immediately
        saveToLocalStorage(updatedPreferences);
        
        return {
          ...state,
          preferences: updatedPreferences,
          lastUpdated: Date.now(),
          error: null
        };
      });
      
      try {
        console.log(`Saving unit preference for ${nodeId}: ${unitId}`);
        
        const response = await fetchWithAuth('/users/unit-preferences', {
          method: 'POST',
          body: JSON.stringify({
            nodeId,
            unitId
          })
        });
        
        console.log(`Successfully saved unit preference for ${nodeId}`);
        return unitId;
      } catch (error) {
        console.error(`Error saving unit preference for ${nodeId}:`, error);
        
        // Update error state but don't revert the optimistic update
        update(state => ({
          ...state,
          error: error instanceof Error ? error.message : 'Failed to save unit preference'
        }));
        
        return unitId;
      }
    },
    
    // Get all preferences
    getAllPreferences(): Record<string, UnitPreference> {
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
        lastUpdated: Date.now(),
        error: null
      });
    },
    
    // Get last error
    getError(): string | null {
      return get({ subscribe }).error;
    },
    
    // Reset error state
    clearError() {
      update(state => ({ ...state, error: null }));
    }
  };
}

export const unitPreferenceStore = createUnitPreferenceStore();