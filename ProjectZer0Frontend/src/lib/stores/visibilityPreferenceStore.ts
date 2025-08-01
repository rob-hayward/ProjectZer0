// src/lib/stores/visibilityPreferenceStore.ts
import { writable, derived, get } from 'svelte/store';
import { fetchWithAuth } from '$lib/services/api';
import { browser } from '$app/environment';

// Local storage key
const STORAGE_KEY = 'pz_visibility_preferences';

// Preference types
export type PreferenceSource = 'user' | 'community';

export interface VisibilityPreference {
  isVisible: boolean;
  source: PreferenceSource;
  timestamp: number;
}

// Utility type guards
const isBoolean = (value: unknown): value is boolean => 
  typeof value === 'boolean';

const isPreferenceSource = (value: unknown): value is PreferenceSource => 
  value === 'user' || value === 'community';

const isNumber = (value: unknown): value is number => 
  typeof value === 'number';

const hasProperty = <K extends string>(obj: unknown, key: K): obj is Record<K, unknown> => 
  typeof obj === 'object' && obj !== null && key in obj;

// Store state
interface VisibilityState {
  isLoaded: boolean;
  preferences: Record<string, boolean>;
  preferenceDetails: Record<string, VisibilityPreference>;
  isLoading: boolean;
  lastUpdated: number;
  error: string | null;
}

function createVisibilityStore() {
  // Initialize with empty state
  const { subscribe, set, update } = writable<VisibilityState>({
    isLoaded: false,
    preferences: {},
    preferenceDetails: {},
    isLoading: false,
    lastUpdated: 0,
    error: null
  });

  // Helper to save to localStorage
  function saveToLocalStorage(preferences: Record<string, boolean>, details: Record<string, VisibilityPreference>) {
    if (!browser) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        preferences,
        details,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }

  // Helper to load from localStorage
  function loadFromLocalStorage(): { preferences: Record<string, boolean>, details: Record<string, VisibilityPreference> } {
    if (!browser) return { preferences: {}, details: {} };
    try {
      const storedData = localStorage.getItem(STORAGE_KEY);
      if (storedData) {
        const parsed = JSON.parse(storedData);
        console.log('Loaded preferences from localStorage:', 
          { count: Object.keys(parsed.preferences || {}).length });
        return {
          preferences: parsed.preferences || {},
          details: parsed.details || {}
        };
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
    return { preferences: {}, details: {} };
  }

  return {
    subscribe,
    
    // Initialization - called as early as possible
    initialize() {
      if (browser) {
        const { preferences, details } = loadFromLocalStorage();
        if (Object.keys(preferences).length > 0) {
          update(state => ({
            ...state,
            preferences,
            preferenceDetails: details,
            isLoaded: true,
            lastUpdated: Date.now()
          }));
        }
      }
    },
    
    // Load preferences from backend and merge with cached
    async loadPreferences() {
      update(state => ({ ...state, isLoading: true, error: null }));
      
      try {
        const response = await fetchWithAuth('/users/visibility-preferences');
        
        // Transform the response to our internal format
        const preferences: Record<string, boolean> = {};
        const details: Record<string, VisibilityPreference> = {};
        
        // Process the response based on its structure
        if (response && typeof response === 'object' && response !== null) {
          // Using type-safe approach for iterating over unknown object
          Object.entries(response as Record<string, unknown>).forEach(([nodeId, value]) => {
            // Handle both simple boolean and complex object formats
            if (isBoolean(value)) {
              // Direct boolean value
              preferences[nodeId] = value;
              details[nodeId] = {
                isVisible: value,
                source: 'user',
                timestamp: Date.now()
              };
            } 
            else if (value !== null && typeof value === 'object') {
              // It's an object - now safely check for properties
              let isVisible = false;
              let source: PreferenceSource = 'user';
              let timestamp = Date.now();
              
              // Safely extract isVisible property
              if (hasProperty(value, 'isVisible')) {
                isVisible = isBoolean(value.isVisible) ? value.isVisible : false;
              }
              
              // Safely extract source property
              if (hasProperty(value, 'source') && isPreferenceSource(value.source)) {
                source = value.source;
              }
              
              // Safely extract timestamp property
              if (hasProperty(value, 'timestamp') && isNumber(value.timestamp)) {
                timestamp = value.timestamp;
              }
              
              // Store the extracted values
              preferences[nodeId] = isVisible;
              details[nodeId] = {
                isVisible,
                source,
                timestamp
              };
            }
          });
        }
        
        // Update state with merged preferences
        update(state => {
          const mergedPreferences = {
            ...state.preferences,
            ...preferences
          };
          
          const mergedDetails = {
            ...state.preferenceDetails,
            ...details
          };
          
          // Save to localStorage
          saveToLocalStorage(mergedPreferences, mergedDetails);
          
          return { 
            isLoaded: true, 
            preferences: mergedPreferences,
            preferenceDetails: mergedDetails,
            isLoading: false,
            lastUpdated: Date.now(),
            error: null
          };
        });
        
        console.log('Loaded preferences from backend:', {
          count: Object.keys(preferences).length
        });
      } catch (error) {
        console.error('Error loading preferences:', error);
        update(state => ({ 
          ...state, 
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load preferences'
        }));
      }
    },
    
    // Get preference for a specific node
    getPreference(nodeId: string): boolean | undefined {
      const state = get({ subscribe });
      return state.preferences[nodeId];
    },
    
    // Get preference details for a specific node
    getPreferenceDetails(nodeId: string): VisibilityPreference | undefined {
      const state = get({ subscribe });
      return state.preferenceDetails[nodeId];
    },
    
    // Determine if a node should be visible (based on preferences)
    shouldBeVisible(nodeId: string, communityVisibility: boolean): boolean {
      const state = get({ subscribe });
      // If user has a preference, use it; otherwise fall back to community visibility
      return state.preferences[nodeId] !== undefined 
        ? state.preferences[nodeId] 
        : communityVisibility;
    },
    
    // Get preference source (user or community)
    getPreferenceSource(nodeId: string): PreferenceSource | undefined {
      const state = get({ subscribe });
      return state.preferenceDetails[nodeId]?.source;
    },
    
    // Set preference and save to backend and cache
    async setPreference(nodeId: string, isVisible: boolean, source: PreferenceSource = 'user') {
      console.log(`[VisibilityStore] setPreference called - nodeId: ${nodeId}, isVisible: ${isVisible}, source: ${source}`);
      
      // Optimistically update local state
      update(state => {
        const updatedPreferences = {
          ...state.preferences,
          [nodeId]: isVisible
        };
        
        const updatedDetails = {
          ...state.preferenceDetails,
          [nodeId]: {
            isVisible,
            source,
            timestamp: Date.now()
          }
        };
        
        // Save to localStorage immediately
        saveToLocalStorage(updatedPreferences, updatedDetails);
        
        return {
          ...state,
          preferences: updatedPreferences,
          preferenceDetails: updatedDetails,
          lastUpdated: Date.now(),
          error: null
        };
      });
      
      // Only save user preferences to backend
      if (source === 'user') {
        try {
          console.log(`[VisibilityStore] Saving preference to backend for ${nodeId}: ${isVisible}`);
          
          // Create the correct payload format matching VisibilityPreferenceDto
          const payload = {
            nodeId,
            isVisible
          };
          
          console.log('[VisibilityStore] Sending payload:', JSON.stringify(payload));
          console.log('[VisibilityStore] Payload structure check:', {
            hasNodeId: 'nodeId' in payload,
            nodeIdType: typeof payload.nodeId,
            hasIsVisible: 'isVisible' in payload,
            isVisibleType: typeof payload.isVisible,
            extraKeys: Object.keys(payload).filter(k => k !== 'nodeId' && k !== 'isVisible')
          });
          
          const response = await fetchWithAuth('/users/visibility-preferences', {
            method: 'POST',
            body: JSON.stringify(payload)
          });
          
          console.log(`[VisibilityStore] Successfully saved preference for ${nodeId}`, response);
          return isVisible;
        } catch (error) {
          console.error(`[VisibilityStore] Error saving preference for ${nodeId}:`, error);
          
          // Log additional error details
          if (error instanceof Error) {
            console.error('[VisibilityStore] Error details:', {
              message: error.message,
              stack: error.stack,
              name: error.name
            });
          }
          
          // Update error state but don't revert the optimistic update
          update(state => ({
            ...state,
            error: error instanceof Error ? error.message : 'Failed to save preference'
          }));
          
          return isVisible;
        }
      }
      
      return isVisible;
    },
    
    // Get all preferences
    getAllPreferences(): Record<string, boolean> {
      return get({ subscribe }).preferences;
    },
    
    // Get all preference details
    getAllPreferenceDetails(): Record<string, VisibilityPreference> {
      return get({ subscribe }).preferenceDetails;
    },
    
    // Clear all preferences (for testing/debugging)
    clear() {
      if (browser) {
        localStorage.removeItem(STORAGE_KEY);
      }
      set({
        isLoaded: true,
        preferences: {},
        preferenceDetails: {},
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

export const visibilityStore = createVisibilityStore();