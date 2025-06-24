<!-- src/lib/components/forms/createNode/alternativeDefinition/AlternativeDefinitionReview.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { browser } from '$app/environment';
    import { fetchWithAuth } from '$lib/services/api';
    import { FORM_STYLES } from '$lib/styles/forms';
    import { wordStore } from '$lib/stores/wordStore';
    import { graphStore } from '$lib/stores/graphStore';
    import FormNavigation from '$lib/components/forms/createNode/shared/FormNavigation.svelte';
    import MessageDisplay from '$lib/components/forms/createNode/shared/MessageDisplay.svelte';
    import type { WordNode } from '$lib/types/domain/nodes';

    export let word = '';
    export let definitionText = ''; // Updated prop name for consistency
    export let discussion = '';
    export let publicCredit = false;
    export let disabled = false;
    export let userId: string | undefined = undefined;

    let shareToX = false;
    let isSubmitting = false;
    let errorMessage: string | null = null;
    let debugMessage: string | null = null;

    const dispatch = createEventDispatcher<{
        back: void;
        success: { message: string; word: string; };
        error: { message: string; };
    }>();

    async function handleSubmit() {
        if (!definitionText.trim()) {
            errorMessage = "Definition is required";
            dispatch('error', { message: errorMessage });
            return;
        }

        isSubmitting = true;
        errorMessage = null;
        debugMessage = null;

        try {
            // Using the correct endpoint and data format based on the backend code
            // Based on the DefinitionController.createDefinition method
            const definitionData = {
                word: word,
                createdBy: userId,
                definitionText: definitionText, // Already standardized
                // Optional fields
                discussion: discussion || '',
                publicCredit
            };
            
            console.log('Submitting alternative definition:', JSON.stringify(definitionData, null, 2));
            
            // Use the endpoint that matches the DefinitionController
            const endpoint = `/definitions`;
            console.log(`Using endpoint: ${endpoint}`);
            
            const createdDef = await fetchWithAuth(endpoint, {
                method: 'POST',
                body: JSON.stringify(definitionData),
            });
            
            console.log('Alternative definition response:', JSON.stringify(createdDef, null, 2));

            // Get current word to refetch it with the new definition
            const currentWord = wordStore.getCurrentWord() as WordNode | null;
            if (currentWord && currentWord.id) {
                // Fetch the updated word data to include the new definition
                const updatedWord = await fetchWithAuth(`/nodes/word/${word}`, {
                    method: 'GET'
                });

                if (updatedWord) {
                    wordStore.set(updatedWord);
                }
            }
            
            // Update graph store to word view type
            if (browser && graphStore && graphStore.setViewType) {
                graphStore.setViewType('word');
                
                // Force immediate visual update if available
                if (graphStore.forceTick) {
                    try {
                        graphStore.forceTick();
                    } catch (e) {
                        console.warn('[AltDefReview] Error forcing tick:', e);
                    }
                }
            }

            // Dispatch success event
            const successMsg = `Alternative definition for "${word}" added successfully`;
            dispatch('success', {
                message: successMsg,
                word: word
            });

            // Use direct navigation instead of goto to ensure reliability
            setTimeout(() => {
                if (browser) {
                    const targetUrl = `/graph/word?word=${encodeURIComponent(word)}`;
                    console.log('[AltDefReview] Navigating to:', targetUrl);
                    
                    // Use direct window location for reliable navigation
                    window.location.href = targetUrl;
                }
            }, 800);

        } catch (e) {
            if (browser) {
                console.error('Error creating alternative definition:', e);
                console.error('Error details:', e instanceof Error ? e.stack : 'Unknown error');
            }
            errorMessage = e instanceof Error ? e.message : 'Failed to create alternative definition';
            dispatch('error', { message: errorMessage });
        } finally {
            isSubmitting = false;
        }
    }
</script>

<g>
    <!-- Review Content -->
    <foreignObject
        x={FORM_STYLES.layout.leftAlign - 30}
        y="-40"
        width={FORM_STYLES.layout.fieldWidth + 60}
        height="290"
    >
        <div class="review-container">
            <div class="review-item word-item">
                <span class="label">Word:</span>
                <span class="value word-value">{word}</span>
            </div>
            
            {#if definitionText}
                <div class="review-item">
                    <span class="label">Your Definition:</span>
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
            
            {#if debugMessage}
                <div class="debug-message">
                    Debug: {debugMessage}
                </div>
            {/if}
        </div>
    </foreignObject>

    <!-- Messages -->
    {#if errorMessage}
        <g transform="translate(0, 240)">
            <MessageDisplay errorMessage={errorMessage} successMessage={null} />
        </g>
    {/if}

    <!-- Navigation - Moved up -->
    <g transform="translate(0, 200)">
        <FormNavigation
            onBack={() => dispatch('back')}
            onNext={handleSubmit}
            nextLabel={isSubmitting ? "Submitting..." : "Add Definition"}
            loading={isSubmitting}
            nextDisabled={disabled || isSubmitting || !definitionText.trim()}
        />
    </g>
</g>

<style>
    /* Style unchanged */
    :global(.review-container) {
        background: rgba(0, 0, 0, 0.3);
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    :global(.review-item) {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    :global(.word-item) {
        margin-bottom: 4px;
    }

    :global(.word-value) {
        font-size: 14px;
        font-weight: 500;
    }

    .scrollable-content {
        max-height: 65px;
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

    :global(.debug-message) {
        color: #ffa500;
        font-size: 11px;
        font-family: monospace;
        margin-top: 8px;
        padding: 4px;
        background: rgba(0, 0, 0, 0.5);
        border-radius: 4px;
        white-space: pre-wrap;
        overflow-wrap: break-word;
    }

    :global(.review-item .label) {
        color: rgba(255, 255, 255, 0.7);
        font-size: 11px;
        font-family: 'Orbitron', sans-serif;
    }

    :global(.review-item .value) {
        color: white;
        font-size: 13px;
        font-family: 'Orbitron', sans-serif;
        line-height: 1.3;
    }

    :global(.options-grid) {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-top: 4px;
        padding-top: 8px;
        padding-left: 12px;
    }

    :global(.checkbox-label) {
        display: flex;
        align-items: center;
        gap: 6px;
        color: white;
        font-size: 11px;
        font-family: 'Orbitron', sans-serif;
    }

    :global(.checkbox-label:first-child) {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    :global(.checkbox-label:last-child) {
        display: flex;
        align-items: center;
        gap: 6px;
        padding-left: 35px; 
    }

    :global(.checkbox-label input[type="checkbox"]) {
        width: 14px;
        height: 14px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 2px;
        background: rgba(0, 0, 0, 0.9);
        cursor: pointer;
        appearance: none;
        -webkit-appearance: none;
        position: relative;
    }

    :global(.checkbox-label input[type="checkbox"]:checked::after) {
        content: '';
        position: absolute;
        top: 1px;
        left: 4px;
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