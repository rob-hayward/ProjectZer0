<!-- src/lib/components/forms/createNode/statement/StatementReview.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { browser } from '$app/environment';
    import { fetchWithAuth } from '$lib/services/api';
    import { FORM_STYLES } from '$lib/styles/forms';
    import { graphStore } from '$lib/stores/graphStore';
    import FormNavigation from '$lib/components/forms/createNode/shared/FormNavigation.svelte';
    import MessageDisplay from '$lib/components/forms/createNode/shared/MessageDisplay.svelte';

    export let statement = '';
    export let userKeywords: string[] = [];
    export let discussion = '';
    export let publicCredit = false;
    export let disabled = false;
    export let userId: string | undefined = undefined; // Used during submission

    let shareToX = false;
    let isSubmitting = false;
    let errorMessage: string | null = null;
    let successMessage: string | null = null;
    let debugMessage: string | null = null;

    const dispatch = createEventDispatcher<{
        back: void;
        success: { message: string; statement: string; };
        error: { message: string; };
    }>();

    async function handleSubmit() {
        if (!statement.trim()) {
            errorMessage = "Statement text is required";
            dispatch('error', { message: errorMessage });
            return;
        }

        isSubmitting = true;
        errorMessage = null;
        debugMessage = null;

        try {
            // Prepare data for the backend
            const statementData = {
                statement: statement,
                createdBy: userId, // Include userId in the submission
                userKeywords: userKeywords.length > 0 ? userKeywords : undefined,
                initialComment: discussion || '',
                publicCredit
            };
            
            console.log('Submitting statement:', JSON.stringify(statementData, null, 2));
            
            // The endpoint should match the backend controller for statement creation
            const endpoint = `/nodes/statement`;
            console.log(`Using endpoint: ${endpoint}`);
            
            const createdStatement = await fetchWithAuth(endpoint, {
                method: 'POST',
                body: JSON.stringify(statementData),
            });
            
            console.log('Statement creation response:', JSON.stringify(createdStatement, null, 2));

            // Update graph store to statement view type
            if (browser && graphStore && graphStore.setViewType) {
                console.log('[StatementReview] Updating graph store to statement view');
                graphStore.setViewType('statement');
                
                // Force immediate visual update if available
                if (graphStore.forceTick) {
                    try {
                        graphStore.forceTick();
                    } catch (e) {
                        console.warn('[StatementReview] Error forcing tick:', e);
                    }
                }
            }

            // Dispatch success event
            const successMsg = `Statement created successfully`;
            dispatch('success', {
                message: successMsg,
                statement: statement
            });
            
            // Set success message for display
            successMessage = successMsg;

            // Use direct navigation instead of goto to ensure reliability
            setTimeout(() => {
                if (browser) {
                    // Navigate to the statement view with the new statement ID
                    const targetUrl = `/graph/statement?id=${encodeURIComponent(createdStatement.id)}`;
                    console.log('[StatementReview] Navigating to:', targetUrl);
                    
                    window.location.href = targetUrl;
                }
            }, 800);

        } catch (e) {
            if (browser) {
                console.error('Error creating statement:', e);
                console.error('Error details:', e instanceof Error ? e.stack : 'Unknown error');
            }
            errorMessage = e instanceof Error ? e.message : 'Failed to create statement';
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
            <!-- Statement text -->
            <div class="review-item">
                <span class="label">Statement:</span>
                <div class="scrollable-content">
                    <span class="value">{statement}</span>
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
    <g transform="translate(0, 200)">
        <FormNavigation
            onBack={() => dispatch('back')}
            onNext={handleSubmit}
            nextLabel={isSubmitting ? "Submitting..." : "Create Statement"}
            loading={isSubmitting}
            nextDisabled={disabled || isSubmitting || !statement.trim()}
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

    :global(.keywords-list) {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 4px;
    }

    :global(.keyword-chip) {
        background: rgba(74, 144, 226, 0.2);
        border: 1px solid rgba(74, 144, 226, 0.3);
        border-radius: 12px;
        padding: 2px 8px;
        font-size: 11px;
        color: white;
        font-family: 'Orbitron', sans-serif;
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