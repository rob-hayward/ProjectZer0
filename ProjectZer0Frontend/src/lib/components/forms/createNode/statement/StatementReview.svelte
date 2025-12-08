<!-- src/lib/components/forms/createNode/statement/StatementReview.svelte -->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { fetchWithAuth } from '$lib/services/api';
    import { graphStore } from '$lib/stores/graphStore';
    import MessageDisplay from '$lib/components/forms/createNode/shared/MessageDisplay.svelte';

    export let statement = '';
    export let userKeywords: string[] = [];
    export let selectedCategories: string[] = [];
    export let discussion = '';
    export let publicCredit = false;
    
    export let positioning: Record<string, number> = {};
    export let width: number = 400;
    export let height: number = 400;
    
    let categoryDetails: Array<{ id: string; name: string }> = [];
    let shareToX = false;
    let isSubmitting = false;
    let errorMessage: string | null = null;

    const dispatch = createEventDispatcher<{
        back: void;
        success: { message: string; statement: string; };
        error: { message: string; };
        expandStatement: { statementId: string; };
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
    
    // MAXIMIZED: Start at 0% from top, use 98% of height, stay within ContentBox bounds
    $: reviewContainerY = height * (positioning.reviewContainer || 0.00);
    $: reviewContainerHeight = Math.max(200, height * (positioning.reviewContainerHeight || 0.98));
    $: reviewContainerWidth = Math.min(600, width * 1.05);

    export async function handleSubmit() {
        if (!statement.trim()) {
            errorMessage = "Statement text is required";
            dispatch('error', { message: errorMessage });
            return;
        }

        isSubmitting = true;
        errorMessage = null;

        try {
            const statementData = {
                statement: statement.trim(),
                userKeywords: userKeywords.length > 0 ? userKeywords : undefined,
                categories: selectedCategories.length > 0 ? selectedCategories : undefined,
                initialComment: discussion || undefined,
                publicCredit
            };
            
            if (browser) console.log('[StatementReview] Submitting:', statementData);
            
            const createdStatement = await fetchWithAuth('/nodes/statement', {
                method: 'POST',
                body: JSON.stringify(statementData),
            });
            
            if (browser) console.log('[StatementReview] Response:', createdStatement);

            if (!createdStatement?.id) {
                throw new Error('Created statement data is incomplete');
            }

            const successMsg = `Statement created successfully`;
            dispatch('success', {
                message: successMsg,
                statement: statement
            });

            setTimeout(() => {
                console.log('[StatementReview] Dispatching expandStatement event');
                dispatch('expandStatement', {
                    statementId: createdStatement.id
                });
            }, 500);

        } catch (e) {
            if (browser) {
                console.error('[StatementReview] Error:', e);
                console.error('[StatementReview] Error details:', e instanceof Error ? e.stack : 'Unknown error');
            }
            errorMessage = e instanceof Error ? e.message : 'Failed to create statement';
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
            <!-- Statement text -->
            <div class="review-item">
                <span class="label">statement</span>
                <div class="scrollable-content">
                    <span class="value">{statement}</span>
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

    {#if errorMessage}
        <g transform="translate(0, {reviewContainerY + reviewContainerHeight + 10})">
            <MessageDisplay {errorMessage} successMessage={null} />
        </g>
    {/if}
</g>

<style>
    :global(.review-container) {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        background: rgba(0, 0, 0, 0.3);
        padding: 0px 10px 8px 10px;
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

    .scrollable-content {
        max-height: 55px;
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
        background: rgba(74, 144, 226, 0.2);
        border: 1px solid rgba(74, 144, 226, 0.3);
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

    :global(.options-grid) {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
        margin-top: 2px;
        padding-top: 6px;
        padding-left: 8px;
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

    :global(.checkbox-label:first-child) {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    :global(.checkbox-label:last-child) {
        display: flex;
        align-items: center;
        gap: 4px;
        padding-left: 0px;
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
        background: rgba(74, 144, 226, 0.3);
    }

    :global(.checkbox-label input[type="checkbox"]:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>