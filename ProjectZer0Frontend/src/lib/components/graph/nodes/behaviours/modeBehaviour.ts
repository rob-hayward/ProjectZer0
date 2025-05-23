// src/lib/components/graph/nodes/behaviours/modeBehaviour.ts

import { writable, derived, get, type Writable, type Readable } from 'svelte/store';
import type { NodeMode } from '$lib/types/graph/enhanced';

export interface ModeBehaviourState {
  mode: NodeMode;
  isDetail: boolean;
  isPreview: boolean;
  canToggle: boolean;
}

export interface ModeBehaviourOptions {
  allowModeChange?: boolean;
  onModeChange?: (mode: NodeMode) => void;
}

export interface ModeBehaviour {
  // State (readable stores)
  mode: Readable<NodeMode>;
  isDetail: Readable<boolean>;
  isPreview: Readable<boolean>;
  canToggle: Readable<boolean>;
  
  // Methods
  setMode: (mode: NodeMode) => void;
  toggleMode: () => NodeMode;
  handleModeChange: () => NodeMode;
  reset: () => void;
  getCurrentState: () => ModeBehaviourState;
}

/**
 * Creates standardised mode behaviour for node components
 * 
 * @param initialMode - The initial mode for the node
 * @param options - Configuration options
 * @returns Mode behaviour object with state and methods
 */
export function createModeBehaviour(
  initialMode: NodeMode = 'preview',
  options: ModeBehaviourOptions = {}
): ModeBehaviour {
  const {
    allowModeChange = true,
    onModeChange = null
  } = options;

  // Internal state
  const mode: Writable<NodeMode> = writable(initialMode);
  const canToggle: Writable<boolean> = writable(allowModeChange);

  // Derived state
  const isDetail = derived(mode, (m) => m === 'detail');
  const isPreview = derived(mode, (m) => m === 'preview');

  // Private helper functions
  function notifyModeChange(newMode: NodeMode): void {
    if (onModeChange && typeof onModeChange === 'function') {
      try {
        onModeChange(newMode);
      } catch (err) {
        console.error('[ModeBehaviour] Error in onModeChange callback:', err);
      }
    }
  }

  // Public methods
  function setMode(newMode: NodeMode): void {
    const currentMode = get(mode);
    if (currentMode === newMode) {
      return; // No change needed
    }

    mode.set(newMode);
    notifyModeChange(newMode);
  }

  function toggleMode(): NodeMode {
    const currentMode = get(mode);
    const currentCanToggle = get(canToggle);
    
    if (!currentCanToggle) {
      console.warn('[ModeBehaviour] Mode toggling is disabled');
      return currentMode;
    }

    const newMode: NodeMode = currentMode === 'detail' ? 'preview' : 'detail';
    setMode(newMode);
    return newMode;
  }

  function handleModeChange(): NodeMode {
    // This is the standard handler that components can call
    return toggleMode();
  }

  function reset(): void {
    mode.set('preview');
    canToggle.set(true);
  }

  // Return public interface
  return {
    // State (readable stores)
    mode: { subscribe: mode.subscribe },
    isDetail: { subscribe: isDetail.subscribe },
    isPreview: { subscribe: isPreview.subscribe },
    canToggle: { subscribe: canToggle.subscribe },
    
    // Methods
    setMode,
    toggleMode,
    handleModeChange,
    reset,
    
    // Computed getters (for non-reactive access)
    getCurrentState: () => ({
      mode: get(mode),
      isDetail: get(isDetail),
      isPreview: get(isPreview),
      canToggle: get(canToggle)
    })
  };
}