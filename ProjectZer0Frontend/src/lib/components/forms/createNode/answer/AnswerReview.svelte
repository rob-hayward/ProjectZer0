<!-- ProjectZer0Frontend/src/lib/components/forms/createNode/answer/AnswerReview.svelte -->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { fetchWithAuth } from '$lib/services/api';
    import { graphStore } from '$lib/stores/graphStore';

    export let answerText = '';
    export let questionId = '';
    export let questionText = '';
    export let userKeywords: string[] = [];
    export let selectedCategories: string[] = [];
    export let discussion = '';
    export let publicCredit = false;
    export let disabled = false;
    export let userId: string | undefined = undefined;
    export let width: number = 400;
    export let height: number = 400;
    
    $: isActuallyDisabled = disabled || isSubmitting;
    let categoryDetails: Array<{ id: string; name: string }> = [];
    let shareToX = false;
    let isSubmitting = false;
    let errorMessage: string | null = null;
    let successMessage: string | null = null;

    const dispatch = createEventDispatcher<{
        back: void;
        success: { message: string; answerId: string };
        error: { message: string };
        expandAnswer: { answerId: string };
    }>();
    
    onMount(async () => {
        if (selectedCategories.length > 0) {
            try {
                const allCategories = await fetchWithAuth('/categories');
                categoryDetails = allCategories.filter((cat: any) => 
                    selectedCategories.includes(cat.id)
                );
            } catch (error) {
                console.error('[AnswerReview] Error fetching category details:', error);
            }
        }
    });
    
    const LAYOUT = {
        startY: 0.0,
        heightRatio: 1.0,
        widthRatio: 1.0
    };
    
    $: reviewContainerY = height * LAYOUT.startY;
    $: reviewContainerHeight = height * LAYOUT.heightRatio;
    $: reviewContainerWidth = width * LAYOUT.widthRatio;

    export async function handleSubmit() {
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
                parentQuestionId: questionId,  // ← CRITICAL: Backend expects parentQuestionId
                createdBy: userId,
                categoryIds: selectedCategories.length > 0 ? selectedCategories : undefined,
                userKeywords: userKeywords.length > 0 ? userKeywords : undefined,
                initialComment: discussion || '',
                publicCredit
            };
            
            console.log('[AnswerReview] Submitting answer:', JSON.stringify(answerData, null, 2));
            
            const createdAnswer = await fetchWithAuth('/nodes/answer', {
                method: 'POST',
                body: JSON.stringify(answerData),
            });
            
            console.log('[AnswerReview] Answer creation response:', JSON.stringify(createdAnswer, null, 2));

            if (!createdAnswer?.id) {
                throw new Error('Created answer data is incomplete');
            }

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

            // ⚠️ CRITICAL CHANGE: Instead of navigating, dispatch expandAnswer event
            setTimeout(() => {
                console.log('[AnswerReview] Dispatching expandAnswer event');
                dispatch('expandAnswer', {
                    answerId: createdAnswer.id
                });
            }, 500);

        } catch (e) {
            if (browser) {
                console.error('[AnswerReview] Error creating answer:', e);
                console.error('[AnswerReview] Error details:', e instanceof Error ? e.stack : 'Unknown error');
            }
            errorMessage = e instanceof Error ? e.message : 'Failed to create answer';
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
            <!-- Parent Question -->
            <div class="review-item question-context-item">
                <span class="label">answering question</span>
                <div class="question-context">
                    {questionText}
                </div>
            </div>
            
            <!-- Answer text -->
            <div class="review-item answer-item">
                <span class="label">your answer</span>
                <div class="scrollable-content">
                    <span class="value answer-value">{answerText}</span>
                </div>
            </div>
            
            <!-- Keywords list -->
            {#if userKeywords.length > 0}
                <div class="review-item">
                    <span class="label">your keywords</span>
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
                    <span class="label">categories</span>
                    <div class="categories-list">
                        {#each categoryDetails as category}
                            <span class="category-chip">{category.name}</span>
                        {/each}
                    </div>
                </div>
            {/if}
            
            <!-- Discussion -->
            {#if discussion}
                <div class="review-item">
                    <span class="label">discussion</span>
                    <div class="scrollable-content">
                        <span class="value">{discussion}</span>
                    </div>
                </div>
            {/if}

            <!-- Options row -->
            <div class="options-row">
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
</g>

<style>
    :global(.review-container) {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        background: rgba(0, 0, 0, 0.3);
        padding: 0px 6px 4px 6px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        overflow-y: auto;
    }

    :global(.review-container::-webkit-scrollbar) {
        width: 8px;
    }

    :global(.review-container::-webkit-scrollbar-track) {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
    }

    :global(.review-container::-webkit-scrollbar-thumb) {
        background: rgba(255, 255, 255, 0.3);
        border-radius: 4px;
    }

    :global(.review-container::-webkit-scrollbar-thumb:hover) {
        background: rgba(255, 255, 255, 0.4);
    }

    :global(.review-item) {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    :global(.question-context-item) {
        margin-bottom: 4px;
    }

    :global(.answer-item) {
        margin-bottom: 4px;
    }

    :global(.answer-value) {
        font-size: 13px;
        font-weight: 500;
    }
    
    :global(.question-context) {
        background: rgba(182, 140, 255, 0.1);
        border: 1px solid rgba(182, 140, 255, 0.3);
        border-radius: 4px;
        padding: 6px 8px;
        color: rgba(255, 255, 255, 0.8);
        font-family: 'Inter', sans-serif;
        font-size: 11px;
        font-weight: 400;
        line-height: 1.3;
        font-style: italic;
        max-height: 60px;
        overflow-y: auto;
    }

    :global(.question-context::-webkit-scrollbar) {
        width: 4px;
    }

    :global(.question-context::-webkit-scrollbar-track) {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 2px;
    }

    :global(.question-context::-webkit-scrollbar-thumb) {
        background: rgba(182, 140, 255, 0.3);
        border-radius: 2px;
    }

    :global(.question-context::-webkit-scrollbar-thumb:hover) {
        background: rgba(182, 140, 255, 0.5);
    }

    .scrollable-content {
        max-height: 65px;
        overflow-y: auto;
        padding-right: 8px;
    }

    .scrollable-content::-webkit-scrollbar {
        width: 6px;
    }

    .scrollable-content::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 3px;
    }

    .scrollable-content::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.3);
        border-radius: 3px;
    }

    .scrollable-content::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.4);
    }

    :global(.review-item .label) {
        color: rgba(255, 255, 255, 0.5);
        font-size: 10px;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
        text-transform: lowercase;
    }

    :global(.review-item .value) {
        color: white;
        font-size: 12px;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
        line-height: 1.3;
    }

    :global(.keywords-list),
    :global(.categories-list) {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }

    :global(.keyword-chip),
    :global(.category-chip) {
        background: rgba(182, 140, 255, 0.2);
        border: 1px solid rgba(182, 140, 255, 0.3);
        border-radius: 10px;
        padding: 2px 6px;
        font-size: 10px;
        color: white;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }

    :global(.options-row) {
        display: flex;
        flex-direction: row;
        gap: 12px;
        margin-top: 4px;
        padding-top: 4px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    :global(.checkbox-label) {
        display: flex;
        align-items: center;
        gap: 4px;
        color: white;
        font-size: 10px;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }

    :global(.checkbox-label input[type="checkbox"]) {
        width: 12px;
        height: 12px;
        border: 1px solid rgba(255, 255, 255, 0.3);
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
        top: 1px;
        left: 3px;
        width: 3px;
        height: 6px;
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