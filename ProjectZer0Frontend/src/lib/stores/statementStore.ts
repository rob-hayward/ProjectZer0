// src/lib/stores/statementStore.ts
import { writable } from 'svelte/store';
import type { StatementNode } from '$lib/types/domain/nodes';

function createStatementStore() {
    const { subscribe, set: baseSet } = writable<StatementNode | null>(null);

    function updateUrl(id: string | null) {
        console.log('StatementStore: Updating URL with:', { id });
        
        if (id) {
            const newUrl = `/graph/statement?id=${encodeURIComponent(id)}`;
            const currentUrl = new URL(window.location.href);
            const currentId = currentUrl.searchParams.get('id');
            
            console.log('StatementStore: URL check:', {
                newUrl,
                currentId,
                id,
                needsUpdate: currentId !== id
            });

            if (currentId !== id) {
                try {
                    const state = { id };
                    window.history.replaceState(state, '', newUrl);
                    console.log('StatementStore: URL updated successfully via history API');
                } catch (error) {
                    console.error('StatementStore: Error updating URL:', error);
                }
            } else {
                console.log('StatementStore: URL already correct');
            }
        }
    }

    let currentStatementId: string | null = null;

    return {
        subscribe,
        set: (statementData: StatementNode | null) => {
            console.log('StatementStore: Setting statement data:', { 
                statementData, 
                currentStatementId,
                newStatementId: statementData?.id,
                currentUrl: window.location.href
            });

            baseSet(statementData);
            
            if (statementData) {
                // Small delay to ensure other navigation has completed
                setTimeout(() => {
                    updateUrl(statementData.id);
                }, 0);
                currentStatementId = statementData.id;
            } else {
                currentStatementId = null;
            }
        },
        reset: () => {
            console.log('StatementStore: Resetting statement data');
            currentStatementId = null;
            baseSet(null);
        },
        getCurrentStatement: () => {
            let currentStatement: StatementNode | null = null;
            subscribe(value => {
                currentStatement = value;
            })();
            return currentStatement;
        }
    };
}

export const statementStore = createStatementStore();