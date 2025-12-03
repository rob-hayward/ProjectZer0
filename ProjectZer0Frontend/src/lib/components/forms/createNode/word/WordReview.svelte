<!-- src/lib/components/forms/createNode/word/WordReview.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { browser } from '$app/environment';
    import { fetchWithAuth } from '$lib/services/api';
    import MessageDisplay from '../shared/MessageDisplay.svelte';

    export let word = '';
    export let definitionText = '';
    export let discussion = '';
    export let publicCredit = false;
    export let disabled = false;
    
    export let positioning: Record<string, number> = {};
    export let width: number = 400;
    export let height: number = 400;

    let shareToX = false;
    let isSubmitting = false;
    let errorMessage: string | null = null;

    const dispatch = createEventDispatcher<{
        back: void;
        success: { message: string; word: string; };
        error: { message: string; };
        expandWord: { word: string; };
    }>();

    export async function handleSubmit() {
        if (disabled || isSubmitting) return;
        
        isSubmitting = true;
        errorMessage = null;

        try {
            const wordData = {
                word: word.trim(),
                initialDefinition: definitionText,  // Backend expects initialDefinition
                initialComment: discussion,         // Backend expects initialComment
                publicCredit,
                // createdBy is extracted from JWT - don't send it
                // shareToX is not supported by backend yet
            };
            
            if (browser) console.log('Submitting word creation form:', JSON.stringify(wordData, null, 2));
            
            const createdWord = await fetchWithAuth('/words', {  // Correct endpoint: /words
                method: 'POST',
                body: JSON.stringify(wordData),
            });
            
            if (browser) console.log('Word creation response:', JSON.stringify(createdWord, null, 2));

            if (!createdWord?.word) {
                throw new Error('Created word data is incomplete');
            }

            const successMsg = `Word node "${createdWord.word}" created successfully`;
            dispatch('success', {
                message: successMsg,
                word: createdWord.word
            });

            // Dispatch expandWord event to add new word to universal graph
            setTimeout(() => {
                console.log('[WordReview] Dispatching expandWord event for newly created word:', createdWord.word);
                dispatch('expandWord', {
                    word: createdWord.word
                });
            }, 500);

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
    
    $: reviewContainerY = height * (positioning.reviewContainer || 0.05);
    $: reviewContainerHeight = Math.max(200, height * (positioning.reviewContainerHeight || 0.85));
    $: reviewContainerWidth = Math.min(560, width * 1.0);
</script>

<g>
    <foreignObject
        x={-reviewContainerWidth/2}
        y={reviewContainerY}
        width={reviewContainerWidth}
        height={reviewContainerHeight}
    >
        <div class="review-container">
            <div class="review-item word-item">
                <span class="label">Word:</span>
                <span class="value word-value">{word}</span>
            </div>
            
            {#if definitionText}
                <div class="review-item">
                    <span class="label">Definition:</span>
                    <div class="scrollable-content">
                        <span class="value">{definitionText}</span>
                    </div>
                </div>
            {/if}
            
            {#if discussion}
                <div class="review-item">
                    <span class="label">Discussion:</span>
                    <div class="scrollable-content">
                        <span class="value">{discussion}</span>
                    </div>
                </div>
            {/if}

            <div class="options-grid">
                <label class="checkbox-label">
                    <input
                        type="checkbox"
                        bind:checked={publicCredit}
                        disabled={isSubmitting}
                    />
                    <span>Publicly credit creation</span>
                </label>

                <label class="checkbox-label">
                    <input
                        type="checkbox"
                        bind:checked={shareToX}
                        disabled={isSubmitting}
                    />
                    <span>Share on X (Twitter)</span>
                </label>
            </div>
        </div>
    </foreignObject>

    {#if errorMessage}
        <g transform="translate(0, {reviewContainerY + reviewContainerHeight + 10})">
            <MessageDisplay {errorMessage} successMessage={null} />
        </g>
    {/if}
</g>

<style>
    :global(.review-container) {
        background: rgba(0, 0, 0, 0.3);
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        max-height: 100%;
        overflow-y: auto;
    }

    :global(.review-item) {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    :global(.word-item) {
        margin-bottom: 8px;
    }

    :global(.word-value) {
        font-size: 16px;
        font-weight: 600;
    }

    .scrollable-content {
        max-height: 120px;
        overflow-y: auto;
        padding-right: 8px;
        margin-bottom: 4px;
    }

    .scrollable-content::-webkit-scrollbar {
        width: 8px;
    }

    .scrollable-content::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
    }

    .scrollable-content::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        border: 2px solid rgba(255, 255, 255, 0.1);
    }

    .scrollable-content::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.4);
    }

    :global(.review-item .label) {
        color: rgba(255, 255, 255, 0.7);
        font-size: 12px;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    :global(.review-item .value) {
        color: white;
        font-size: 14px;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
        line-height: 1.4;
    }

    :global(.options-grid) {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-top: 12px;
        padding-top: 12px;
        padding-left: 12px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    :global(.checkbox-label) {
        display: flex;
        align-items: center;
        gap: 8px;
        color: white;
        font-size: 12px;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }

    :global(.checkbox-label:first-child) {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    :global(.checkbox-label:last-child) {
        display: flex;
        align-items: center;
        gap: 8px;
        padding-left: 35px;
    }

    :global(.checkbox-label input[type="checkbox"]) {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 2px;
        background: rgba(0, 0, 0, 0.9);
        cursor: pointer;
        appearance: none;
        -webkit-appearance: none;
        position: relative;
        flex-shrink: 0;
    }

    :global(.checkbox-label input[type="checkbox"]:checked::after) {
        content: '';
        position: absolute;
        top: 2px;
        left: 5px;
        width: 4px;
        height: 8px;
        border: solid white;
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
    }

    :global(.checkbox-label input[type="checkbox"]:checked) {
        background: rgba(74, 144, 226, 0.3);
    }

    :global(.checkbox-label input[type="checkbox"]:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>