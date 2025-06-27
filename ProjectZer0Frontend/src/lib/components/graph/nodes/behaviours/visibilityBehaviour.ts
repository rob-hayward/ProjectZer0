// src/lib/components/graph/nodes/behaviours/visibilityBehaviour.ts

import { writable, derived, get, type Writable, type Readable } from 'svelte/store';
import { visibilityStore } from '$lib/stores/visibilityPreferenceStore';

export interface VisibilityBehaviourState {
  isHidden: boolean;
  hiddenReason: 'user' | 'community';
  userPreference?: boolean;
  communityHidden: boolean;
}

export interface VisibilityBehaviourOptions {
  communityThreshold?: number; // Net votes threshold for community hiding
  graphStore?: any; // For updating graph visibility
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
    graphStore = null
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

  // FIXED: Safe way to check for user_data property
  function hasUserDataStore(store: any): boolean {
    return store && 
           typeof store === 'object' && 
           'user_data' in store && 
           store.user_data && 
           typeof store.user_data.subscribe === 'function';
  }

  // Public methods
  async function initialize(netVotes: number = 0): Promise<void> {
    try {
      // Initialize visibility store if needed
      await visibilityStore.initialize();
      
      // Get user preference from visibilityStore (global preferences)
      const userPref = visibilityStore.getPreference(nodeId);
      userPreference.set(userPref);
      
      // ENHANCED: Try to get user preference from graph store if available
      if (graphStore) {
        try {
          // Check if the store has user_data (like universalGraphStore)
          if (hasUserDataStore(graphStore)) {
            // Subscribe to user_data to get user-specific preferences
            graphStore.user_data.subscribe((userData: any) => {
              if (userData && userData[nodeId] && userData[nodeId].userVisibilityPreference) {
                const storePreference = userData[nodeId].userVisibilityPreference.isVisible;
                userPreference.set(storePreference);
              }
            });
          }
          // Check if the store has getUserData method
          else if (typeof graphStore.getUserData === 'function') {
            const userData = graphStore.getUserData(nodeId);
            if (userData && userData.userVisibilityPreference) {
              userPreference.set(userData.userVisibilityPreference.isVisible);
            }
          }
        } catch (err) {
          console.debug('[VisibilityBehaviour] Store does not have user data methods:', err);
          // This is not an error, just means this store doesn't have user-specific data
        }
      }
      
      // Calculate community visibility
      updateCommunityVisibility(netVotes);
      
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
      
      // Save to global visibility store
      visibilityStore.setPreference(nodeId, isVisible);
      
      // ENHANCED: Update graph store if it supports user preferences
      if (graphStore && typeof graphStore.updateUserVisibilityPreference === 'function') {
        graphStore.updateUserVisibilityPreference(nodeId, isVisible, 'user');
      }
      
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