<!-- src/lib/components/forms/createNode/openquestion/OpenQuestionReview.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { browser } from '$app/environment';
    import { fetchWithAuth } from '$lib/services/api';
    import { FORM_STYLES } from '$lib/styles/forms';
    import { openQuestionStore } from '$lib/stores/openQuestionStore';
    import { graphStore } from '$lib/stores/graphStore';
    import FormNavigation from '$lib/components/forms/createNode/shared/FormNavigation.svelte';
    import MessageDisplay from '$lib/components/forms/createNode/shared/MessageDisplay.svelte';

    export let questionText = '';
    export let userKeywords: string[] = [];
    export let discussion = '';
    export let publicCredit = false;
    export let disabled = false;
    export let userId: string | undefined = undefined;

    let shareToX = false;
    let isSubmitting = false;
    let errorMessage: string | null = null;
    let successMessage: string | null = null;
    let debugMessage: string | null = null;

    const dispatch = createEventDispatcher<{
        back: void;
        success: { message: string; questionId: string; };
        error: { message: string; };
    }>();

    async function handleSubmit() {
        if (!questionText.trim()) {
            errorMessage = "Question text is required";
            dispatch('error', { message: errorMessage });
            return;
        }

        isSubmitting = true;
        errorMessage = null;
        debugMessage = null;

        try {
            // Prepare data for the backend
            const questionData = {
                questionText: questionText.trim(),
                createdBy: userId,
                userKeywords: userKeywords.length > 0 ? userKeywords : undefined,
                initialComment: discussion || '',
                publicCredit,
                shareToX
            };
            
            if (browser) console.log('Submitting open question:', JSON.stringify(questionData, null, 2));
            
            const createdQuestion = await fetchWithAuth('/nodes/openquestion', {
                method: 'POST',
                body: JSON.stringify(questionData),
            });
            
            if (browser) console.log('Open question creation response:', JSON.stringify(createdQuestion, null, 2));

            if (!createdQuestion?.id) {
                throw new Error('Created question data is incomplete');
            }

            // Update openQuestionStore with the created question
            openQuestionStore.set(createdQuestion);
            
            // Update graph store to openquestion view type
            if (browser && graphStore && graphStore.setViewType) {
                graphStore.setViewType('openquestion');
                
                // Force immediate visual update if available
                if (graphStore.forceTick) {
                    try {
                        graphStore.forceTick();
                    } catch (e) {
                        console.warn('[OpenQuestionReview] Error forcing tick:', e);
                    }
                }
            }

            const successMsg = `Question created successfully`;
            dispatch('success', {
                message: successMsg,
                questionId: createdQuestion.id
            });
            
            // Set success message for display
            successMessage = successMsg;

            // Use direct navigation to ensure reliability
            setTimeout(() => {
                if (browser) {
                    const targetUrl = `/graph/openquestion?id=${encodeURIComponent(createdQuestion.id)}`;
                    console.log('[OpenQuestionReview] Navigating to:', targetUrl);
                    
                    // Use direct window location for reliable navigation
                    window.location.href = targetUrl;
                }
            }, 800); // Match the timing from WordReview

        } catch (e) {
            if (browser) {
                console.error('Error creating open question:', e);
                console.error('Error details:', e instanceof Error ? e.stack : 'Unknown error');
            }
            errorMessage = e instanceof Error ? e.message : 'Failed to create open question';
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
            <!-- Question text -->
            <div class="review-item question-item">
                <span class="label">Question:</span>
                <div class="scrollable-content">
                    <span class="value question-value">{questionText}</span>
                </div>
            </div>
            
            <!-- Keywords list -->
            {#if userKeywords.length > 0}
                <div class="review-item">
                    <span class="label">Your Keywords:</span>
                    <div class="keywords-list">
                        {#each userKeywords as keyword}
                            <span class="keyword-chip">{keyword}</span>
                        {/each}
                    </div>
                </div>
            {/if}
            
            <!-- Discussion -->
            {#if discussion}
                <div class="review-item">
                    <span class="label">Discussion:</span>
                    <div class="scrollable-content">
                        <span class="value">{discussion}</span>
                    </div>
                </div>
            {/if}

            <!-- Options grid -->
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

    <!-- Messages -->
    {#if errorMessage}
        <g transform="translate(0, 240)">
            <MessageDisplay errorMessage={errorMessage} successMessage={null} />
        </g>
    {/if}

    <!-- Navigation -->
    <g transform="translate(0, 270)">
        <FormNavigation
            onBack={() => dispatch('back')}
            onNext={handleSubmit}
            nextLabel={isSubmitting ? "Creating..." : "Create Question"}
            loading={isSubmitting}
            nextDisabled={disabled || isSubmitting || !questionText.trim()}
        />
    </g>
</g>

<style>
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

    :global(.question-item) {
        margin-bottom: 4px;
    }

    :global(.question-value) {
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

    :global(.review-item .label) {
        color: rgba(255, 255, 255, 0.7);
        font-size: 11px;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }

    :global(.review-item .value) {
        color: white;
        font-size: 13px;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
        line-height: 1.3;
    }

    :global(.keywords-list) {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 4px;
    }

    :global(.keyword-chip) {
        background: rgba(0, 188, 212, 0.2);
        border: 1px solid rgba(0, 188, 212, 0.3);
        border-radius: 12px;
        padding: 2px 8px;
        font-size: 11px;
        color: white;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
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
        font-family: 'Inter', sans-serif;
        font-weight: 400;
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
        background: rgba(0, 188, 212, 0.3);
    }

    :global(.checkbox-label input[type="checkbox"]:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>