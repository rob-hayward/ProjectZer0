<!-- src/lib/components/forms/createNode/definition/DefinitionReview.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { browser } from '$app/environment';
    import { fetchWithAuth } from '$lib/services/api';
    import { graphStore } from '$lib/stores/graphStore';
    import { COLORS } from '$lib/constants/colors';

    export let definitionText = '';
    export let word = '';
    export let wordId = '';
    export let discussion = '';
    export let publicCredit = false;
    export let userId: string | undefined = undefined;
    export let width: number = 400;
    export let height: number = 400;
    
    let isSubmitting = false;
    let errorMessage: string | null = null;
    let successMessage: string | null = null;

    const dispatch = createEventDispatcher<{
        back: void;
        success: { message: string; definitionId: string };
        error: { message: string };
        expandDefinition: { definitionId: string };
    }>();
    
    const LAYOUT = {
        startY: 0.0,
        heightRatio: 1.0,
        widthRatio: 1.0
    };
    
    $: reviewContainerY = height * LAYOUT.startY;
    $: reviewContainerHeight = height * LAYOUT.heightRatio;
    $: reviewContainerWidth = width * LAYOUT.widthRatio;

    export async function handleSubmit() {
        if (!definitionText.trim()) {
            errorMessage = "Definition text is required";
            dispatch('error', { message: errorMessage });
            return;
        }

        if (!wordId) {
            errorMessage = "Word ID is missing";
            dispatch('error', { message: errorMessage });
            return;
        }

        isSubmitting = true;
        errorMessage = null;

        try {
            const definitionData = {
                word: word,
                definitionText: definitionText.trim(),
                createdBy: userId,
                discussion: discussion || '',
                publicCredit
            };
            
            console.log('[DefinitionReview] Submitting definition:', JSON.stringify(definitionData, null, 2));
            
            const createdDefinition = await fetchWithAuth('/definitions', {
                method: 'POST',
                body: JSON.stringify(definitionData),
            });
            
            console.log('[DefinitionReview] Definition creation response:', JSON.stringify(createdDefinition, null, 2));

            if (!createdDefinition?.id) {
                throw new Error('Created definition data is incomplete');
            }

            if (browser && graphStore) {
                if (graphStore.forceTick) {
                    try {
                        graphStore.forceTick();
                    } catch (e) {
                        console.warn('[DefinitionReview] Error forcing tick:', e);
                    }
                }
            }

            const successMsg = `Definition submitted successfully`;
            dispatch('success', {
                message: successMsg,
                definitionId: createdDefinition.id
            });
            
            successMessage = successMsg;

            // ⚠️ CRITICAL: Dispatch expandDefinition event instead of navigating
            setTimeout(() => {
                console.log('[DefinitionReview] Dispatching expandDefinition event');
                dispatch('expandDefinition', {
                    definitionId: createdDefinition.id
                });
            }, 500);

        } catch (e) {
            if (browser) {
                console.error('[DefinitionReview] Error creating definition:', e);
                console.error('[DefinitionReview] Error details:', e instanceof Error ? e.stack : 'Unknown error');
            }
            errorMessage = e instanceof Error ?
                e.message :
                'An error occurred while creating the definition';
            dispatch('error', { message: errorMessage });
        } finally {
            isSubmitting = false;
        }
    }
</script>

<g>
    <foreignObject
        x={-reviewContainerWidth/2}
        y={reviewContainerY}
        width={reviewContainerWidth}
        height={reviewContainerHeight}
    >
        <div class="review-container">
            <div class="review-section">
                <div class="review-label">Word:</div>
                <div class="review-value word-value" style:color={COLORS.PRIMARY.WORD}>{word}</div>
            </div>
            
            <div class="review-section">
                <div class="review-label">Definition:</div>
                <div class="review-value scrollable">{definitionText}</div>
            </div>
            
            {#if discussion}
                <div class="review-section">
                    <div class="review-label">Discussion:</div>
                    <div class="review-value scrollable">{discussion}</div>
                </div>
            {/if}
            
            <div class="options-section">
                <label class="checkbox-label">
                    <input
                        type="checkbox"
                        bind:checked={publicCredit}
                        disabled={isSubmitting}
                    />
                    <span>Publicly credit creation</span>
                </label>
            </div>
            
            {#if errorMessage}
                <div class="error-message">{errorMessage}</div>
            {/if}
            
            {#if successMessage}
                <div class="success-message">{successMessage}</div>
            {/if}
        </div>
    </foreignObject>
</g>

<style>
    .review-container {
        width: 100%;
        height: 100%;
        color: white;
        font-family: 'Inter', sans-serif;
        padding: 20px;
        box-sizing: border-box;
        overflow-y: auto;
    }
    
    .review-section {
        margin-bottom: 20px;
    }
    
    .review-label {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    
    .review-value {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.9);
        line-height: 1.5;
    }
    
    .word-value {
        font-size: 18px;
        font-weight: 600;
        /* color applied via inline style using COLORS.PRIMARY.WORD */
    }
    
    .scrollable {
        max-height: 100px;
        overflow-y: auto;
        padding-right: 8px;
    }
    
    .options-section {
        margin-top: 20px;
        padding-top: 20px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .checkbox-label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.8);
        cursor: pointer;
    }
    
    .checkbox-label input[type="checkbox"] {
        cursor: pointer;
    }
    
    .error-message {
        color: #ff4444;
        font-size: 12px;
        margin-top: 12px;
        padding: 8px;
        background: rgba(255, 68, 68, 0.1);
        border-radius: 4px;
    }
    
    .success-message {
        color: #4CAF50;
        font-size: 12px;
        margin-top: 12px;
        padding: 8px;
        background: rgba(76, 175, 80, 0.1);
        border-radius: 4px;
    }
</style>