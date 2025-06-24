// src/lib/stores/quantityStore.ts
import { writable } from 'svelte/store';
import type { QuantityNode } from '$lib/types/domain/nodes';

function createQuantityStore() {
    const { subscribe, set: baseSet } = writable<QuantityNode | null>(null);

    function updateUrl(id: string | null) {
        console.log('QuantityStore: Updating URL with:', { id });
        
        if (id) {
            const newUrl = `/graph/quantity?id=${encodeURIComponent(id)}`;
            const currentUrl = new URL(window.location.href);
            const currentId = currentUrl.searchParams.get('id');
            
            console.log('QuantityStore: URL check:', {
                newUrl,
                currentId,
                id,
                needsUpdate: currentId !== id
            });

            if (currentId !== id) {
                try {
                    const state = { id };
                    window.history.replaceState(state, '', newUrl);
                } catch (error) {
                    console.error('QuantityStore: Error updating URL:', error);
                }
            } else {
            }
        }
    }

    let currentQuantityId: string | null = null;

    return {
        subscribe,
        set: (quantityData: QuantityNode | null) => {
            console.log('QuantityStore: Setting quantity data:', { 
                quantityData, 
                currentQuantityId,
                newQuantityId: quantityData?.id,
                currentUrl: window.location.href
            });

            baseSet(quantityData);
            
            if (quantityData) {
                // Small delay to ensure other navigation has completed
                setTimeout(() => {
                    updateUrl(quantityData.id);
                }, 0);
                currentQuantityId = quantityData.id;
            } else {
                currentQuantityId = null;
            }
        },
        reset: () => {
            currentQuantityId = null;
            baseSet(null);
        },
        getCurrentQuantity: () => {
            let currentQuantity: QuantityNode | null = null;
            subscribe(value => {
                currentQuantity = value;
            })();
            return currentQuantity;
        }
    };
}

export const quantityStore = createQuantityStore();