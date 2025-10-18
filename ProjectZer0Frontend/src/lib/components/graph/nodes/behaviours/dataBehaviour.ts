// // src/lib/components/graph/nodes/behaviours/dataBehaviour.ts

// import { writable, derived, get, type Writable, type Readable } from 'svelte/store';
// import { userStore } from '$lib/stores/userStore';

// export interface DataBehaviourState<T = any> {
//   data: T;
//   isLoading: boolean;
//   error: string | null;
//   lastRefresh: number;
//   hasInitialized: boolean;
// }

// export interface DataBehaviourOptions<T = any> {
//   transformData?: (data: any) => T;
//   validateData?: (data: any) => boolean;
//   onDataChange?: (data: T) => void;
//   refreshInterval?: number; // Auto-refresh interval in ms
// }

// export interface DataBehaviour<T = any> {
//   // State (readable stores)
//   data: Readable<T>;
//   displayData: Readable<T>;
//   isLoading: Readable<boolean>;
//   error: Readable<string | null>;
//   hasInitialized: Readable<boolean>;
//   userName: Readable<string>;
  
//   // Methods
//   initialize: (initialData?: T) => Promise<void>;
//   updateData: (newData: T) => void;
//   refresh: () => Promise<void>;
//   setLoading: (loading: boolean) => void;
//   setError: (error: string | null) => void;
//   reset: () => void;
//   destroy: () => void; // Added destroy method to interface
//   getCurrentState: () => DataBehaviourState<T>;
// }

// /**
//  * Creates standardised data behaviour for node components
//  * 
//  * @param nodeType - Type of node for logging/debugging
//  * @param initialData - Initial data for the node
//  * @param options - Configuration options
//  * @returns Data behaviour object with state and methods
//  */
// export function createDataBehaviour<T = any>(
//   nodeType: string,
//   initialData?: T,
//   options: DataBehaviourOptions<T> = {}
// ): DataBehaviour<T> {
//   const {
//     transformData = (data: any) => data as T,
//     validateData = () => true,
//     onDataChange = null,
//     refreshInterval = 0
//   } = options;

//   // Internal state
//   const data: Writable<T> = writable(initialData as T);
//   const isLoading: Writable<boolean> = writable(false);
//   const error: Writable<string | null> = writable(null);
//   const lastRefresh: Writable<number> = writable(0);
//   const hasInitialized: Writable<boolean> = writable(false);

//   let refreshTimer: NodeJS.Timeout | null = null;

//   // Derived state
//   const displayData = derived(data, (d) => {
//     try {
//       return transformData(d);
//     } catch (err) {
//       console.error(`[DataBehaviour:${nodeType}] Error transforming data:`, err);
//       return d;
//     }
//   });

//   const userName = derived(userStore, (user) => {
//     return user?.preferred_username || user?.name || 'Anonymous';
//   });

//   // Private helper functions
//   function notifyDataChange(newData: T): void {
//     if (onDataChange && typeof onDataChange === 'function') {
//       try {
//         onDataChange(newData);
//       } catch (err) {
//         console.error(`[DataBehaviour:${nodeType}] Error in onDataChange callback:`, err);
//       }
//     }
//   }

//   function startAutoRefresh(): void {
//     if (refreshInterval > 0 && !refreshTimer) {
//       refreshTimer = setInterval(async () => {
//         try {
//           await refresh();
//         } catch (err) {
//           console.error(`[DataBehaviour:${nodeType}] Auto-refresh failed:`, err);
//         }
//       }, refreshInterval);
//     }
//   }

//   function stopAutoRefresh(): void {
//     if (refreshTimer) {
//       clearInterval(refreshTimer);
//       refreshTimer = null;
//     }
//   }

//   // Public methods
//   async function initialize(newInitialData?: T): Promise<void> {
//     try {
//       isLoading.set(true);
//       error.set(null);

//       const dataToUse = newInitialData || initialData;
      
//       if (dataToUse !== undefined) {
//         // Validate data if validator provided
//         if (!validateData(dataToUse)) {
//           throw new Error('Invalid data provided to initialize');
//         }

//         const transformed = transformData(dataToUse);
//         data.set(transformed);
//         notifyDataChange(transformed);
//       }

//       lastRefresh.set(Date.now());
//       hasInitialized.set(true);
      
//       // Start auto-refresh if configured
//       startAutoRefresh();

//     } catch (err) {
//       console.error(`[DataBehaviour:${nodeType}] Error initializing:`, err);
//       error.set(err instanceof Error ? err.message : 'Failed to initialize data');
//     } finally {
//       isLoading.set(false);
//     }
//   }

//   function updateData(newData: T): void {
//     try {
//       // Validate data if validator provided
//       if (!validateData(newData)) {
//         throw new Error('Invalid data provided to updateData');
//       }

//       const transformed = transformData(newData);
//       data.set(transformed);
//       lastRefresh.set(Date.now());
//       notifyDataChange(transformed);
//       error.set(null);
      
//     } catch (err) {
//       console.error(`[DataBehaviour:${nodeType}] Error updating data:`, err);
//       error.set(err instanceof Error ? err.message : 'Failed to update data');
//     }
//   }

//   async function refresh(): Promise<void> {
//     // This is a placeholder - individual node types will override this
//     // with their specific refresh logic
//     console.log(`[DataBehaviour:${nodeType}] Refresh called - override this method for specific behaviour`);
//     lastRefresh.set(Date.now());
//   }

//   function setLoading(loading: boolean): void {
//     isLoading.set(loading);
//   }

//   function setError(errorMessage: string | null): void {
//     error.set(errorMessage);
//   }

//   function reset(): void {
//     data.set(initialData as T);
//     isLoading.set(false);
//     error.set(null);
//     lastRefresh.set(0);
//     hasInitialized.set(false);
//     stopAutoRefresh();
//   }

//   // Cleanup function (should be called in onDestroy)
//   function destroy(): void {
//     stopAutoRefresh();
//   }

//   // Return public interface
//   return {
//     // State (readable stores)
//     data: { subscribe: data.subscribe },
//     displayData: { subscribe: displayData.subscribe },
//     isLoading: { subscribe: isLoading.subscribe },
//     error: { subscribe: error.subscribe },
//     hasInitialized: { subscribe: hasInitialized.subscribe },
//     userName: { subscribe: userName.subscribe },
    
//     // Methods
//     initialize,
//     updateData,
//     refresh,
//     setLoading,
//     setError,
//     reset,
    
//     // Internal methods (for advanced usage)
//     destroy,
    
//     // Computed getters (for non-reactive access)
//     getCurrentState: () => ({
//       data: get(data),
//       isLoading: get(isLoading),
//       error: get(error),
//       lastRefresh: get(lastRefresh),
//       hasInitialized: get(hasInitialized)
//     })
//   };
// }