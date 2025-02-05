/**
 * NOTICE: This is a converted Svelte component file.
 * Original Svelte file: /Users/rob/vsCodeProjects/ProjectZer0/ProjectZer0Frontend/src/lib/components/forms/createNode/word/WordInput.svelte
 * This conversion was created to share with Claude for development purposes.
 */


    import { goto } from '$app/navigation';
    import { createEventDispatcher } from 'svelte';
    import { fetchWithAuth } from '$lib/services/api';
    import { wordStore } from '$lib/stores/wordStore';
    import { FORM_STYLES } from '$lib/styles/forms';
    import FormNavigation from '../shared/FormNavigation.svelte';
    import MessageDisplay from '../shared/MessageDisplay.svelte';

    export let word = '';
    export let disabled = false;

    const dispatch = createEventDispatcher<{
        back: void;
        proceed: void;
    }>();

    let isCheckingWord = false;
    let errorMessage: string | null = null;

    async function checkWordExistence() {
        if (!word.trim()) {
            errorMessage = 'Please enter a word';
            return;
        }

        isCheckingWord = true;
        errorMessage = null;
        
        try {
            const response = await fetchWithAuth(`/nodes/word/check/${encodeURIComponent(word.trim())}`);
            
            if (response.exists) {
                // Word exists - fetch its data
                const wordData = await fetchWithAuth(`/nodes/word/${encodeURIComponent(word.trim())}`);
                errorMessage = `Word "${word.trim()}" already exists. Redirecting to word page...`;
                
                // Update word store and navigate
                wordStore.set(wordData);
                setTimeout(() => {
                    goto('/graph/word');
                }, 2000);
            } else {
                dispatch('proceed');
            }
        } catch (e) {
            errorMessage = e instanceof Error ? e.message : 'Failed to check word existence';
        } finally {
            isCheckingWord = false;
        }
    }


// Original Svelte Template:
/*
<!-- src/lib/components/forms/createNode/word/WordInput.svelte -->
*/

// Converted JSX:
export default function Component() {
  return (
    <!-- src/lib/components/forms/createNode/word/WordInput.svelte -->
  );
}