<!-- ProjectZer0Frontend/src/lib/components/forms/answer/AnswerReview.svelte -->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { fetchWithAuth } from '$lib/services/api';
    import { FORM_STYLES } from '$lib/styles/forms';
    import { graphStore } from '$lib/stores/graphStore';
    import FormNavigation from '$lib/components/forms/createNode/shared/FormNavigation.svelte';
    import MessageDisplay from '$lib/components/forms/createNode/shared/MessageDisplay.svelte';
    import CategoryTags from '$lib/components/graph/nodes/ui/CategoryTags.svelte';

    export let answerText = '';
    export let questionId = '';
    export let questionText = '';
    export let userKeywords: string[] = [];
    export let selectedCategories: string[] = [];
    export let discussion = '';
    export let publicCredit = false;
    export let disabled = false;
    export let userId: string | undefined = undefined;
    
    let categoryDetails: Array<{ id: string; name: string }> = [];
    let shareToX = false;
    let isSubmitting = false;
    let errorMessage: string | null = null;
    let successMessage: string | null = null;

    const dispatch = createEventDispatcher<{
        back: void;
        success: { message: string; answerId: string; };
        error: { message: string; };
    }>();
    
    onMount(async () => {
        if (selectedCategories.length > 0) {
            try {
                const allCategories = await fetchWithAuth('/categories');
                categoryDetails = allCategories.filter((cat: any) => 
                    selectedCategories.includes(cat.id)
                );
            } catch (error) {
                console.error('Error fetching category details:', error);
            }
        }
    });

    async function handleSubmit() {
        if (!answerText.trim()) {
            errorMessage = "Answer text is required";
            dispatch('error', { message: errorMessage });
            return;
        }

        if (!questionId) {
            errorMessage = "Question ID is missing";
            dispatch('error', { message: errorMessage });
            return;
        }

        isSubmitting = true;
        errorMessage = null;

        try {
            const answerData = {
                answerText: answerText.trim(),
                questionId: questionId,
                createdBy: userId,
                userKeywords: userKeywords.length > 0 ? userKeywords : undefined,
                categories: selectedCategories.length > 0 ? selectedCategories : undefined,
                initialComment: discussion || '',
                publicCredit
            };
            
            console.log('Submitting answer:', JSON.stringify(answerData, null, 2));
            
            const createdAnswer = await fetchWithAuth('/nodes/answer', {
                method: 'POST',
                body: JSON.stringify(answerData),
            });
            
            console.log('Answer creation response:', JSON.stringify(createdAnswer, null, 2));

            if (browser && graphStore) {
                if (graphStore.forceTick) {
                    try {
                        graphStore.forceTick();
                    } catch (e) {
                        console.warn('[AnswerReview] Error forcing tick:', e);
                    }
                }
            }

            const successMsg = `Answer submitted successfully`;
            dispatch('success', {
                message: successMsg,
                answerId: createdAnswer.id
            });
            
            successMessage = successMsg;

            setTimeout(() => {
                if (browser) {
                    const targetUrl = `/graph/openquestion?id=${encodeURIComponent(questionId)}`;
                    console.log('[AnswerReview] Navigating to:', targetUrl);
                    
                    window.location.href = targetUrl;
                }
            }, 800);

        } catch (e) {
            if (browser) {
                console.error('Error creating answer:', e);
                console.error('Error details:', e instanceof Error ? e.stack : 'Unknown error');
            }
            errorMessage = e instanceof Error ? e.message : 'Failed to create answer';
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
        height="380"
    >
        <div class="review-container">
            <!-- Parent Question -->
            <div class="review-item">
                <span class="label">Answering Question:</span>
                <div class="question-context">
                    {questionText}
                </div>
            </div>
            
            <!-- Answer text -->
            <div class="review-item answer-item">
                <span class="label">Your Answer:</span>
                <div class="scrollable-content">
                    <span class="value answer-value">{answerText}</span>
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
            
            <!-- Categories display -->
            {#if categoryDetails.length > 0}
                <div class="review-item">
                    <span class="label">Categories:</span>
                    <div class="categories-display">
                        <svg width="100%" height="30" viewBox="0 0 400 30">
                            <CategoryTags 
                                categories={categoryDetails}
                                radius={100}
                            />
                        </svg>
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

    <!-- Navigation -->
    <g transform="translate(0, 270)">
        <FormNavigation
            onBack={() => dispatch('back')}
            onNext={handleSubmit}
            nextLabel={isSubmitting ? "Submitting..." : "Submit Answer"}
            loading={isSubmitting}
            nextDisabled={disabled || isSubmitting || !answerText.trim()}
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

    :global(.answer-item) {
        margin-bottom: 4px;
    }

    :global(.answer-value) {
        font-size: 14px;
        font-weight: 500;
    }
    
    :global(.question-context) {
        background: rgba(182, 140, 255, 0.1);
        border: 1px solid rgba(182, 140, 255, 0.3);
        border-radius: 4px;
        padding: 8px;
        color: rgba(255, 255, 255, 0.8);
        font-family: 'Inter', sans-serif;
        font-size: 12px;
        font-weight: 400;
        line-height: 1.4;
        font-style: italic;
        max-height: 60px;
        overflow-y: auto;
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
        background: rgba(182, 140, 255, 0.2);
        border: 1px solid rgba(182, 140, 255, 0.3);
        border-radius: 12px;
        padding: 2px 8px;
        font-size: 11px;
        color: white;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    :global(.categories-display) {
        margin-top: 4px;
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
        background: rgba(182, 140, 255, 0.3);
    }

    :global(.checkbox-label input[type="checkbox"]:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>