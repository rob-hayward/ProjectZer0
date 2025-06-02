<!-- src/lib/components/forms/createNode/quantity/QuantityReview.svelte -->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { fetchWithAuth } from '$lib/services/api';
    import { FORM_STYLES } from '$lib/styles/forms';
    import { graphStore } from '$lib/stores/graphStore';
    import FormNavigation from '$lib/components/forms/createNode/shared/FormNavigation.svelte';
    import MessageDisplay from '$lib/components/forms/createNode/shared/MessageDisplay.svelte';

    export let question = '';
    export let unitCategoryId = '';
    export let defaultUnitId = '';
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
    
    // Store category/unit details
    let categoryName = '';
    let unitName = '';
    let unitSymbol = '';
    
    const dispatch = createEventDispatcher<{
        back: void;
        success: { message: string; question: string; };
        error: { message: string; };
    }>();
    
    // Load unit and category details when component mounts
    onMount(async () => {
        if (unitCategoryId && defaultUnitId) {
            try {
                // Get category details
                const category = await fetchWithAuth(`/units/categories/${unitCategoryId}`);
                if (category) {
                    categoryName = category.name;
                }
                
                // Get units for this category to find the selected unit
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
                // Non-critical error, don't show to user but log
            }
        }
    });

    async function handleSubmit() {
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
        debugMessage = null;

        try {
            // Prepare data for the backend
            const quantityData = {
                question: question,
                createdBy: userId,
                unitCategoryId: unitCategoryId,
                defaultUnitId: defaultUnitId,
                userKeywords: userKeywords.length > 0 ? userKeywords : undefined,
                initialComment: discussion || '',
                publicCredit
            };
            
            console.log('Submitting quantity node:', JSON.stringify(quantityData, null, 2));
            
            // The endpoint should match the backend controller for quantity creation
            const endpoint = `/nodes/quantity`;
            console.log(`Using endpoint: ${endpoint}`);
            
            const createdQuantity = await fetchWithAuth(endpoint, {
                method: 'POST',
                body: JSON.stringify(quantityData),
            });
            
            console.log('Quantity node creation response:', JSON.stringify(createdQuantity, null, 2));

            // Update graph store to quantity view type
            if (browser && graphStore) {
                console.log('[QuantityReview] Navigating to quantity view');
                
                // Force immediate visual update if available
                if (graphStore.forceTick) {
                    try {
                        graphStore.forceTick();
                    } catch (e) {
                        console.warn('[QuantityReview] Error forcing tick:', e);
                    }
                }
            }

            // Dispatch success event
            const successMsg = `Quantity node created successfully`;
            dispatch('success', {
                message: successMsg,
                question: question
            });
            
            // Set success message for display
            successMessage = successMsg;

            // Use direct navigation instead of goto to ensure reliability
            setTimeout(() => {
                if (browser) {
                    // Navigate to the quantity view with the new quantity ID
                    const targetUrl = `/graph/quantity?id=${encodeURIComponent(createdQuantity.id)}`;
                    console.log('[QuantityReview] Navigating to:', targetUrl);
                    
                    window.location.href = targetUrl;
                }
            }, 800);

        } catch (e) {
            if (browser) {
                console.error('Error creating quantity node:', e);
                console.error('Error details:', e instanceof Error ? e.stack : 'Unknown error');
            }
            errorMessage = e instanceof Error ? e.message : 'Failed to create quantity node';
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
            <!-- Question text -->
            <div class="review-item">
                <span class="label">Question:</span>
                <div class="scrollable-content">
                    <span class="value">{question}</span>
                </div>
            </div>
            
            <!-- Unit category -->
            <div class="review-item">
                <span class="label">Unit Category:</span>
                <div class="unit-info">
                    <span class="value">{categoryName || unitCategoryId}</span>
                </div>
            </div>
            
            <!-- Default unit -->
            <div class="review-item">
                <span class="label">Default Unit:</span>
                <div class="unit-info">
                    <span class="value">{unitName || defaultUnitId} {unitSymbol ? `(${unitSymbol})` : ''}</span>
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
            
            <!-- Debug message -->
            {#if debugMessage}
                <div class="debug-message">
                    Debug: {debugMessage}
                </div>
            {/if}
        </div>
    </foreignObject>

    <!-- Navigation -->
    <g transform="translate(0, 270)">
        <FormNavigation
            onBack={() => dispatch('back')}
            onNext={handleSubmit}
            nextLabel={isSubmitting ? "Submitting..." : "Create Quantity Node"}
            loading={isSubmitting}
            nextDisabled={disabled || isSubmitting || !question.trim() || !unitCategoryId || !defaultUnitId}
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

    .scrollable-content {
        max-height: 65px;
        overflow-y: auto;
        padding-right: 8px;
        margin-bottom: 4px;
    }

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

     .scrollable-content:-webkit-scrollbar {
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
    
    :global(.unit-info) {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    
    :global(.keywords-list) {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 4px;
    }

    :global(.keyword-chip) {
        background: rgba(142, 68, 173, 0.2);
        border: 1px solid rgba(142, 68, 173, 0.3);
        border-radius: 12px;
        padding: 2px 8px;
        font-size: 11px;
        color: white;
        font-family: 'Inter', sans-serif;  /* Changed from Orbitron */
        font-weight: 400;
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
        font-family: 'Inter', sans-serif;  /* Changed from Orbitron */
        font-weight: 400;
    }

    :global(.review-item .value) {
        color: white;
        font-size: 13px;
        font-family: 'Inter', sans-serif;  /* Changed from Orbitron */
        font-weight: 400;
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
        font-family: 'Inter', sans-serif;  /* Changed from Orbitron */
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
        background: rgba(74, 144, 226, 0.3);
    }

    :global(.checkbox-label input[type="checkbox"]:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>
    