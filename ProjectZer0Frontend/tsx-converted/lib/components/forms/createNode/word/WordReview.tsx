/**
 * NOTICE: This is a converted Svelte component file.
 * Original Svelte file: /Users/rob/vsCodeProjects/ProjectZer0/ProjectZer0Frontend/src/lib/components/forms/createNode/word/WordReview.svelte
 * This conversion was created to share with Claude for development purposes.
 */


    import { createEventDispatcher } from 'svelte';
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import { fetchWithAuth } from '$lib/services/api';
    import { FORM_STYLES } from '$lib/styles/forms';
    import { wordStore } from '$lib/stores/wordStore';
    import FormNavigation from '../shared/FormNavigation.svelte';
    import MessageDisplay from '../shared/MessageDisplay.svelte';

    export let word = '';
    export let definition = '';
    export let discussion = '';
    export let publicCredit = false;
    export let disabled = false;
    export let userId: string | undefined = undefined;

    let shareToX = false;
    let isSubmitting = false;
    let errorMessage: string | null = null;
    let successMessage: string | null = null;

    const dispatch = createEventDispatcher<{
        back: void;
        success: { message: string; word: string; };
        error: { message: string; };
    }>();

    async function handleSubmit() {
        isSubmitting = true;
        errorMessage = null;
        successMessage = null;

        try {
            const wordData = {
                word: word.trim(),
                definition,
                discussion,
                publicCredit,
                createdBy: userId,
                shareToX,
            };
            
            if (browser) console.log('Submitting word creation form:', JSON.stringify(wordData, null, 2));
            
            const createdWord = await fetchWithAuth('/nodes/word', {
                method: 'POST',
                body: JSON.stringify(wordData),
            });
            
            if (browser) console.log('Word creation response:', JSON.stringify(createdWord, null, 2));

            if (!createdWord?.word) {
                throw new Error('Created word data is incomplete');
            }

            // Update store and show success message
            wordStore.set(createdWord);
            successMessage = `Word node "${createdWord.word}" created successfully`;
            dispatch('success', {
                message: successMessage,
                word: createdWord.word
            });

            // Navigate to the new word's page
            setTimeout(() => {
                goto(`/graph/word?word=${encodeURIComponent(createdWord.word)}`).catch(error => {
                    console.error('Navigation error:', error);
                    errorMessage = 'Error navigating to new word';
                });
            }, 1000);

        } catch (e) {
            if (browser) {
                console.error('Error creating word:', e);
                console.error('Error details:', e instanceof Error ? e.stack : 'Unknown error');
            }
            errorMessage = e instanceof Error ? e.message : 'Failed to create new word node';
            dispatch('error', { message: errorMessage });
        } finally {
            isSubmitting = false;
        }
    }


// Original Svelte Template:
/*
<!-- src/lib/components/forms/createNode/word/WordReview.svelte -->
*/

// Converted JSX:
export default function Component() {
  return (
    <!-- src/lib/components/forms/createNode/word/WordReview.svelte -->
  );
}