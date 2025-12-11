<!-- src/lib/components/forms/createNode/openquestion/OpenQuestionReview.svelte -->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { fetchWithAuth } from '$lib/services/api';
    import { openQuestionStore } from '$lib/stores/openQuestionStore';
    import { graphStore } from '$lib/stores/graphStore';

    export let questionText = '';
    export let userKeywords: string[] = [];
    export let selectedCategories: string[] = [];
    export let discussion = '';
    export let publicCredit = false;
    export let userId: string | undefined = undefined;
    
    export let width: number = 400;
    export let height: number = 400;
    
    let categoryDetails: Array<{ id: string; name: string }> = [];
    let shareToX = false;
    let isSubmitting = false;
    let errorMessage: string | null = null;

    const dispatch = createEventDispatcher<{
        back: void;
        success: { message: string; questionId: string; };
        error: { message: string; };
        expandOpenQuestion: { questionId: string; };
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
    
    const LAYOUT = {
        startY: 0.0,
        heightRatio: 1.0,
        widthRatio: 1.0
    };
    
    $: reviewContainerY = height * LAYOUT.startY;
    $: reviewContainerHeight = height * LAYOUT.heightRatio;
    $: reviewContainerWidth = width * LAYOUT.widthRatio;

    export async function handleSubmit() {
        if (!questionText.trim()) {
            errorMessage = "Question text is required";
            dispatch('error', { message: errorMessage });
            return;
        }

        isSubmitting = true;
        errorMessage = null;

        try {
            const questionData = {
                questionText: questionText.trim(),
                createdBy: userId,
                userKeywords: userKeywords.length > 0 ? userKeywords : undefined,
                categories: selectedCategories.length > 0 ? selectedCategories : undefined,
                initialComment: discussion || undefined,
                publicCredit
            };
            
            if (browser) console.log('[OpenQuestionReview] Submitting:', questionData);
            
            const createdQuestion = await fetchWithAuth('/nodes/openquestion', {
                method: 'POST',
                body: JSON.stringify(questionData),
            });
            
            if (browser) console.log('[OpenQuestionReview] Response:', createdQuestion);

            if (!createdQuestion?.id) {
                throw new Error('Created question data is incomplete');
            }

            openQuestionStore.set(createdQuestion);
            
            if (browser && graphStore && graphStore.setViewType) {
                graphStore.setViewType('openquestion');
                
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

            setTimeout(() => {
                console.log('[OpenQuestionReview] Dispatching expandOpenQuestion event');
                dispatch('expandOpenQuestion', {
                    questionId: createdQuestion.id
                });
            }, 500);

        } catch (e) {
            if (browser) {
                console.error('[OpenQuestionReview] Error:', e);
                console.error('[OpenQuestionReview] Error details:', e instanceof Error ? e.stack : 'Unknown error');
            }
            errorMessage = e instanceof Error ? e.message : 'Failed to create open question';
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
            <div class="review-item question-item">
                <span class="label">question</span>
                <div class="scrollable-content">
                    <span class="value question-value">{questionText}</span>
                </div>
            </div>
            
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
            
            {#if discussion}
                <div class="review-item">
                    <span class="label">discussion</span>
                    <div class="scrollable-content">
                        <span class="value">{discussion}</span>
                    </div>
                </div>
            {/if}

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

    :global(.question-item) {
        margin-bottom: 4px;
    }

    :global(.question-value) {
        font-size: 14px;
        font-weight: 500;
    }

    .scrollable-content {
        max-height: 100px;
        overflow-y: auto;
        padding-right: 6px;
        margin-bottom: 2px;
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
        font-size: 8px;
        font-family: 'Inter', sans-serif;
        font-weight: 300;
        text-transform: lowercase !important;
        letter-spacing: 0.02em;
    }

    :global(.review-item .value) {
        color: white;
        font-size: 10px;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
        line-height: 1.2;
    }

    :global(.keywords-list) {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 2px;
    }

    :global(.keyword-chip) {
        background: rgba(91, 183, 255, 0.2);
        border: 1px solid rgba(91, 183, 255, 0.3);
        border-radius: 10px;
        padding: 1px 6px;
        font-size: 9px;
        color: white;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    :global(.categories-list) {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 2px;
    }

    :global(.category-chip) {
        background: rgba(255, 138, 61, 0.2);
        border: 1px solid rgba(255, 138, 61, 0.3);
        border-radius: 10px;
        padding: 1px 6px;
        font-size: 9px;
        color: white;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }

    :global(.options-row) {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 16px;
        margin-top: auto;
        padding-top: 6px;
        padding-left: 8px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    :global(.checkbox-label) {
        display: flex;
        align-items: center;
        gap: 4px;
        color: white;
        font-size: 9px;
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
        border-width: 0 1.5px 1.5px 0;
        transform: rotate(45deg);
    }

    :global(.checkbox-label input[type="checkbox"]:checked) {
        background: rgba(91, 183, 255, 0.3);
    }

    :global(.checkbox-label input[type="checkbox"]:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>