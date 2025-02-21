// src/lib/stores/graphStore.ts
import { derived, writable } from 'svelte/store';
import type { GraphData, ViewType, NodeMode } from '$lib/types/graph/core';
import { GraphManager } from '$lib/services/graph/GraphManager';

export function createGraphStore(viewType: ViewType) {
  const manager = new GraphManager(viewType);
  
  // Create a store for the view type
  const viewTypeStore = writable(viewType);
  
  // When view type changes, update the manager
  viewTypeStore.subscribe(newViewType => {
    if (manager.viewType !== newViewType) {
      // Create a new manager for the new view type
      const newManager = new GraphManager(newViewType);
      manager = newManager;
    }
  });
  
  // Return a store API
  return {
    subscribe: derived(
      [manager.renderableNodes, manager.renderableLinks],
      ([nodes, links]) => ({ nodes, links })
    ).subscribe,
    
    setData: (data: GraphData) => {
      manager.setData(data);
    },
    
    updateNodeMode: (nodeId: string, mode: NodeMode) => {
      manager.updateNodeMode(nodeId, mode);
    },
    
    setViewType: (newViewType: ViewType) => {
      viewTypeStore.set(newViewType);
    }
  };
}

// Create and export the default store
export const graphStore = createGraphStore('dashboard');