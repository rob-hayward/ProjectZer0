<!-- ProjectZer0Frontend/src/lib/components/forms/createNode/quantity/QuantityReview.svelte -->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { fetchWithAuth } from '$lib/services/api';
    import MessageDisplay from '$lib/components/forms/createNode/shared/MessageDisplay.svelte';

    export let question = '';
    export let unitCategoryId = '';
    export let defaultUnitId = '';
    export let userKeywords: string[] = [];
    export let selectedCategories: string[] = [];
    export let discussion = '';
    export let publicCredit = false;
    export let userId: string | undefined = undefined;
    
    export let width: number = 400;
    export let height: number = 400;

    let shareToX = false;
    let isSubmitting = false;
    let errorMessage: string | null = null;
    let successMessage: string | null = null;
    
    let categoryName = '';
    let unitName = '';
    let unitSymbol = '';
    let categoryDetails: Array<{ id: string; name: string }> = [];
    
    const dispatch = createEventDispatcher<{
        back: void;
        success: { message: string; question: string; };
        error: { message: string; };
        expandQuantity: { quantityId: string; };
    }>();
    
    onMount(async () => {
        if (unitCategoryId && defaultUnitId) {
            try {
                const category = await fetchWithAuth(`/units/categories/${unitCategoryId}`);
                if (category) {
                    categoryName = category.name;
                }
                
                const units = await fetchWithAuth(`/units/categories/${unitCategoryId}/units`);
                if (units && Array.isArray(units)) {
                    const selectedUnit = units.find(u => u.id === defaultUnitId);
                    if (selectedUnit) {
                        unitName = selectedUnit.name;
                        unitSymbol = selectedUnit.symbol;
                    }
                }
            } catch (error) {
                console.error('Error loading unit details:', error);
            }
        }
        
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
    
    // ============================================================================
    // QUANTITY REVIEW LAYOUT CONFIGURATION
    // ============================================================================
    // These values match StatementReview/OpenQuestionReview to maximize space for
    // the review screen. They intentionally differ from ContentBox 'create-node' 
    // defaults which are shared across all creation flows.
    //
    // ContentBox 'create-node' defaults (shared by all node creation reviews):
    //   - reviewContainer: 0.05 (5% from top)
    //   - reviewContainerHeight: 0.85 (85% of available height)
    //
    // QuantityReview overrides (this component only):
    const LAYOUT = {
        startY: 0.0,        // Start at very top (no gap)
        heightRatio: 1.0,   // Use full available height
        widthRatio: 1.0     // Use full available width
    };
    // ============================================================================
    
    $: reviewContainerY = height * LAYOUT.startY;
    $: reviewContainerHeight = height * LAYOUT.heightRatio;
    $: reviewContainerWidth = width * LAYOUT.widthRatio;

    export async function handleSubmit() {
        if (!question.trim()) {
            errorMessage = "Question text is required";
            dispatch('error', { message: errorMessage });
            return;
        }
        
        if (!unitCategoryId || !defaultUnitId) {
            errorMessage = "Unit category and default unit are required";
            dispatch('error', { message: errorMessage });
            return;
        }

        isSubmitting = true;
        errorMessage = null;

        try {
            const quantityData = {
                question: question,
                createdBy: userId,
                unitCategoryId: unitCategoryId,
                defaultUnitId: defaultUnitId,
                userKeywords: userKeywords.length > 0 ? userKeywords : undefined,
                categories: selectedCategories.length > 0 ? selectedCategories : undefined,
                initialComment: discussion || '',
                publicCredit
            };
            
            console.log('[QuantityReview] Submitting:', quantityData);
            
            const createdQuantity = await fetchWithAuth('/nodes/quantity', {
                method: 'POST',
                body: JSON.stringify(quantityData),
            });
            
            console.log('[QuantityReview] Response:', createdQuantity);

            if (!createdQuantity?.id) {
                throw new Error('Created quantity data is incomplete');
            }

            const successMsg = `Quantity node created successfully`;
            dispatch('success', {
                message: successMsg,
                question: question
            });
            
            successMessage = successMsg;
            
            // Dispatch expand event for universal graph
            setTimeout(() => {
                console.log('[QuantityReview] Dispatching expandQuantity event');
                dispatch('expandQuantity', {
                    quantityId: createdQuantity.id
                });
            }, 500);

        } catch (e) {
            console.error('[QuantityReview] Error:', e);
            console.error('[QuantityReview] Error details:', e instanceof Error ? e.stack : 'Unknown error');
            errorMessage = e instanceof Error ? e.message : 'Failed to create quantity node';
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
            <!-- Question text -->
            <div class="review-item question-item">
                <span class="label">question</span>
                <div class="scrollable-content">
                    <span class="value question-value">{question}</span>
                </div>
            </div>
            
            <!-- Unit information (category and default unit on same line) -->
            <div class="review-item">
                <span class="label">units</span>
                <div class="unit-info">
                    <span class="value">{categoryName || unitCategoryId}</span>
                    <span class="separator">•</span>
                    <span class="value">{unitName || defaultUnitId} {unitSymbol ? `(${unitSymbol})` : ''}</span>
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

            <!-- Options row - single line -->
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
        font-size: 12px;
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

    :global(.unit-info) {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    
    :global(.unit-info .separator) {
        color: rgba(255, 255, 255, 0.4);
        font-size: 9px;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }

    :global(.review-item .label) {
        color: rgba(255, 255, 255, 0.7);
        font-size: 7px;
        font-family: 'Inter', sans-serif;
        font-weight: 300;
        text-transform: lowercase !important;
        letter-spacing: 0.02em;
    }

    :global(.review-item .value) {
        color: white;
        font-size: 9px;
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
        background: rgba(72, 224, 194, 0.2);
        border: 1px solid rgba(72, 224, 194, 0.3);
        border-radius: 10px;
        padding: 1px 6px;
        font-size: 8px;
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
        font-size: 8px;
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
        font-size: 8px;
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
        background: rgba(72, 224, 194, 0.3);
    }

    :global(.checkbox-label input[type="checkbox"]:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>