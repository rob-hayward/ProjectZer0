<!-- ProjectZer0Frontend/src/lib/components/graph/nodes/createNode/CreateNodeNode.svelte -->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { fetchWithAuth } from '$lib/services/api';
    import { FORM_STYLES } from '$lib/styles/forms';
    import { graphStore } from '$lib/stores/graphStore';
    import FormNavigation from '$lib/components/forms/createNode/shared/FormNavigation.svelte';
    import MessageDisplay from '$lib/components/forms/createNode/shared/MessageDisplay.svelte';

    export let selectedWordIds: string[] = [];
    export let parentCategoryId: string | null = null;
    export let discussion = '';
    export let publicCredit = false;
    export let disabled = false;
    export let userId: string | undefined = undefined;
    
    let words: Array<{ id: string; word: string }> = [];
    let parentCategory: { id: string; name: string } | null = null;
    let isSubmitting = false;
    let errorMessage: string | null = null;
    let successMessage: string | null = null;

    const dispatch = createEventDispatcher<{
        back: void;
        success: { message: string; categoryId: string; };
        error: { message: string; };
    }>();
    
    $: categoryName = words.map(w => w.word).join(' ');
    
    onMount(async () => {
        try {
            const allWords = await fetchWithAuth('/words');
            words = allWords.filter((w: any) => selectedWordIds.includes(w.id));
            
            if (parentCategoryId) {
                const categories = await fetchWithAuth('/categories');
                parentCategory = categories.find((c: any) => c.id === parentCategoryId);
            }
        } catch (error) {
            console.error('Error fetching details:', error);
        }
    });

    async function handleSubmit() {
        if (selectedWordIds.length === 0) {
            errorMessage = "At least one word is required";
            dispatch('error', { message: errorMessage });
            return;
        }

        isSubmitting = true;
        errorMessage = null;

        try {
            const categoryData = {
                wordIds: selectedWordIds,
                parentCategoryId: parentCategoryId || undefined,
                createdBy: userId,
                initialComment: discussion || '',
                publicCredit
            };
            
            console.log('Submitting category:', JSON.stringify(categoryData, null, 2));
            
            const createdCategory = await fetchWithAuth('/categories', {
                method: 'POST',
                body: JSON.stringify(categoryData),
            });
            
            console.log('Category creation response:', JSON.stringify(createdCategory, null, 2));

            if (browser && graphStore) {
                if (graphStore.forceTick) {
                    try {
                        graphStore.forceTick();
                    } catch (e) {
                        console.warn('[CategoryReview] Error forcing tick:', e);
                    }
                }
            }

            const successMsg = `Category "${categoryName}" created successfully`;
            dispatch('success', {
                message: successMsg,
                categoryId: createdCategory.id
            });
            
            successMessage = successMsg;

            setTimeout(() => {
                if (browser) {
                    const targetUrl = `/graph/category?id=${encodeURIComponent(createdCategory.id)}`;
                    console.log('[CategoryReview] Navigating to:', targetUrl);
                    
                    window.location.href = targetUrl;
                }
            }, 800);

        } catch (e) {
            if (browser) {
                console.error('Error creating category:', e);
                console.error('Error details:', e instanceof Error ? e.stack : 'Unknown error');
            }
            errorMessage = e instanceof Error ? e.message : 'Failed to create category';
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
        height="320"
    >
        <div class="review-container">
            <!-- Category Name -->
            <div class="review-item name-item">
                <span class="label">Category Name:</span>
                <div class="category-name">
                    "{categoryName}"
                </div>
            </div>
            
            <!-- Selected Words -->
            <div class="review-item">
                <span class="label">Composed of Words:</span>
                <div class="words-list">
                    {#each words as word}
                        <span class="word-chip">{word.word}</span>
                    {/each}
                </div>
            </div>
            
            <!-- Parent Category -->
            {#if parentCategory}
                <div class="review-item">
                    <span class="label">Parent Category:</span>
                    <div class="parent-display">
                        {parentCategory.name}
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

            <!-- Options -->
            <div class="options-grid">
                <label class="checkbox-label">
                    <input
                        type="checkbox"
                        bind:checked={publicCredit}
                        disabled={isSubmitting}
                    />
                    <span>Publicly credit creation</span>
                </label>
            </div>
        </div>
    </foreignObject>

    <!-- Navigation -->
    <g transform="translate(0, 200)">
        <FormNavigation
            onBack={() => dispatch('back')}
            onNext={handleSubmit}
            nextLabel={isSubmitting ? "Creating..." : "Create Category"}
            loading={isSubmitting}
            nextDisabled={disabled || isSubmitting || selectedWordIds.length === 0}
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

    :global(.name-item) {
        margin-bottom: 8px;
    }
    
    :global(.category-name) {
        background: rgba(255, 138, 61, 0.15);
        border: 1px solid rgba(255, 138, 61, 0.4);
        border-radius: 4px;
        padding: 12px;
        color: rgba(255, 138, 61, 1);
        font-family: 'Inter', sans-serif;
        font-size: 16px;
        font-weight: 600;
        text-align: center;
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

    :global(.words-list) {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 4px;
    }

    :global(.word-chip) {
        background: rgba(255, 138, 61, 0.2);
        border: 1px solid rgba(255, 138, 61, 0.3);
        border-radius: 12px;
        padding: 2px 8px;
        font-size: 11px;
        color: white;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    :global(.parent-display) {
        color: rgba(255, 138, 61, 0.9);
        font-family: 'Inter', sans-serif;
        font-size: 13px;
        font-weight: 500;
        padding: 4px 8px;
        background: rgba(255, 138, 61, 0.1);
        border-radius: 4px;
        display: inline-block;
    }

    :global(.options-grid) {
        display: flex;
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
        background: rgba(255, 138, 61, 0.3);
    }

    :global(.checkbox-label input[type="checkbox"]:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>