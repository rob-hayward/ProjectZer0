// src/lib/components/graph/nodes/behaviours/visibilityBehaviour.ts

import { writable, derived, get, type Writable, type Readable } from 'svelte/store';
import { visibilityStore } from '$lib/stores/visibilityPreferenceStore';
import { universalGraphStore } from '$lib/stores/universalGraphStore';

export interface VisibilityBehaviourState {
  isHidden: boolean;
  hiddenReason: 'user' | 'community';
  userPreference?: boolean;
  communityHidden: boolean;
}

export interface VisibilityBehaviourOptions {
  communityThreshold?: number; // Net votes threshold for community hiding
  graphStore?: any; // For updating graph visibility
  // ENHANCED: Add context for batch data usage
  viewType?: string;
}

export interface VisibilityBehaviour {
  // State (readable stores)
  isHidden: Readable<boolean>;
  hiddenReason: Readable<'user' | 'community'>;
  userPreference: Readable<boolean | undefined>;
  communityHidden: Readable<boolean>;
  
  // Methods
  initialize: (netVotes?: number) => Promise<void>;
  updateCommunityVisibility: (netVotes: number) => void;
  handleVisibilityChange: (isHidden: boolean, reason?: 'user' | 'community') => Promise<void>;
  getUserPreference: () => boolean | undefined;
  setUserPreference: (isVisible: boolean) => Promise<void>;
  reset: () => void;
  getCurrentState: () => VisibilityBehaviourState;
}

/**
 * Creates standardised visibility behaviour for node components
 * 
 * @param nodeId - The node's unique identifier
 * @param options - Configuration options
 * @returns Visibility behaviour object with state and methods
 */
export function createVisibilityBehaviour(
  nodeId: string,
  options: VisibilityBehaviourOptions = {}
): VisibilityBehaviour {
  const {
    communityThreshold = 0, // Default: hide if net votes < 0
    graphStore = null,
    viewType = undefined
  } = options;

  // Internal state
  const userPreference: Writable<boolean | undefined> = writable(undefined);
  const communityHidden: Writable<boolean> = writable(false);
  const error: Writable<string | null> = writable(null);

  // Derived state
  const isHidden = derived(
    [userPreference, communityHidden],
    ([userPref, communityHidden]) => {
      // User preference takes precedence if set
      if (userPref !== undefined) {
        return !userPref; // userPref is "isVisible", we need "isHidden"
      }
      // Fall back to community decision
      return communityHidden;
    }
  );

  const hiddenReason = derived(
    [userPreference, communityHidden],
    ([userPref, communityHidden]) => {
      if (userPref !== undefined) {
        return 'user' as const;
      }
      return 'community' as const;
    }
  );

  // Private helper functions
  function updateGraphVisibility(hidden: boolean, reason: 'user' | 'community'): void {
    if (graphStore && typeof graphStore.updateNodeVisibility === 'function') {
      graphStore.updateNodeVisibility(nodeId, hidden, reason);
    }
  }

  // ENHANCED: Check for batch data first
  function tryGetBatchVisibilityData(): boolean | undefined {
    try {
      // Check if we're in universal context and have batch data
      if (viewType === 'universal') {
        const storeData = get(universalGraphStore);
        const batchPreference = storeData?.user_data?.visibility_preferences?.[nodeId];
        
        if (batchPreference !== undefined) {
          console.log(`[VisibilityBehaviour] Using batch visibility data for ${nodeId}:`, batchPreference);
          // Extract the isVisible boolean from the preference object
          return typeof batchPreference === 'object' ? batchPreference.isVisible : batchPreference;
        }
      }
    } catch (err) {
      console.error(`[VisibilityBehaviour] Error accessing batch visibility data:`, err);
    }
    
    return undefined;
  }

  // Public methods
  async function initialize(netVotes: number = 0): Promise<void> {
    try {
      // ENHANCED: Try batch data first
      const batchPreference = tryGetBatchVisibilityData();
      
      if (batchPreference !== undefined) {
        // Use batch data - skip localStorage and API calls
        userPreference.set(batchPreference);
        updateCommunityVisibility(netVotes);
        error.set(null);
        return;
      }
      
      // Fallback to individual loading
      await visibilityStore.initialize();
      
      // Get user preference (this will hit localStorage)
      const userPref = visibilityStore.getPreference(nodeId);
      userPreference.set(userPref);
      
      // Calculate community visibility
      updateCommunityVisibility(netVotes);
      
      // Load preferences from server if not already loaded
      // Note: Using visibilityStore directly since isLoaded is internal
      const storeState = get(visibilityStore);
      if (!storeState || Object.keys(storeState).length === 0) {
        await visibilityStore.loadPreferences();
      }
      
      error.set(null);
    } catch (err) {
      console.error(`[VisibilityBehaviour] Error initializing visibility for ${nodeId}:`, err);
      error.set('Failed to load visibility preferences');
    }
  }

  function updateCommunityVisibility(netVotes: number): void {
    const shouldHide = netVotes < communityThreshold;
    communityHidden.set(shouldHide);
    
    // Update graph store with community decision
    if (get(userPreference) === undefined) {
      updateGraphVisibility(shouldHide, 'community');
    }
  }

  async function handleVisibilityChange(
    isHidden: boolean, 
    reason: 'user' | 'community' = 'user'
  ): Promise<void> {
    try {
      if (reason === 'user') {
        // Convert isHidden to isVisible for storage
        const isVisible = !isHidden;
        await setUserPreference(isVisible);
      } else {
        // Community-driven change
        communityHidden.set(isHidden);
      }
      
      // Update graph store
      updateGraphVisibility(isHidden, reason);
      
      error.set(null);
    } catch (err) {
      console.error(`[VisibilityBehaviour] Error changing visibility for ${nodeId}:`, err);
      error.set('Failed to update visibility');
    }
  }

  function getUserPreference(): boolean | undefined {
    return get(userPreference);
  }

  async function setUserPreference(isVisible: boolean): Promise<void> {
    try {
      // Update local state
      userPreference.set(isVisible);
      
      // Save to store and backend
      visibilityStore.setPreference(nodeId, isVisible);
      
      error.set(null);
    } catch (err) {
      console.error(`[VisibilityBehaviour] Error setting user preference for ${nodeId}:`, err);
      error.set('Failed to save preference');
      throw err;
    }
  }

  function reset(): void {
    userPreference.set(undefined);
    communityHidden.set(false);
    error.set(null);
  }

  // Return public interface
  return {
    // State (readable stores)
    isHidden: { subscribe: isHidden.subscribe },
    hiddenReason: { subscribe: hiddenReason.subscribe },
    userPreference: { subscribe: userPreference.subscribe },
    communityHidden: { subscribe: communityHidden.subscribe },
    
    // Methods
    initialize,
    updateCommunityVisibility,
    handleVisibilityChange,
    getUserPreference,
    setUserPreference,
    reset,
    
    // Computed getters (for non-reactive access)
    getCurrentState: () => ({
      isHidden: get(isHidden),
      hiddenReason: get(hiddenReason),
      userPreference: get(userPreference),
      communityHidden: get(communityHidden)
    })
  };
}