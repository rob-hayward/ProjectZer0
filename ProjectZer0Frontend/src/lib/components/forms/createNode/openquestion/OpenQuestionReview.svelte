<!-- src/lib/components/forms/createNode/openquestion/OpenQuestionReview.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { browser } from '$app/environment';
    import { fetchWithAuth } from '$lib/services/api';
    import { FORM_STYLES } from '$lib/styles/forms';
    import { graphStore } from '$lib/stores/graphStore';
    import FormNavigation from '$lib/components/forms/createNode/shared/FormNavigation.svelte';
    import MessageDisplay from '$lib/components/forms/createNode/shared/MessageDisplay.svelte';

    export let questionText = '';
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
        success: { message: string; questionText: string; };
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
                questionText: questionText,
                createdBy: userId, // Include userId in the submission
                userKeywords: userKeywords.length > 0 ? userKeywords : undefined,
                initialComment: discussion || '',
                publicCredit
            };
            
            console.log('Submitting open question:', JSON.stringify(questionData, null, 2));
            
            // The endpoint should match the backend controller for open question creation
            const endpoint = `/nodes/openquestion`;
            console.log(`Using endpoint: ${endpoint}`);
            
            const createdQuestion = await fetchWithAuth(endpoint, {
                method: 'POST',
                body: JSON.stringify(questionData),
            });
            
            console.log('Open question creation response:', JSON.stringify(createdQuestion, null, 2));

            // Update graph store to openquestion view type
            if (browser && graphStore && graphStore.setViewType) {
                console.log('[OpenQuestionReview] Updating graph store to openquestion view');
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

            // Dispatch success event
            const successMsg = `Open question created successfully`;
            dispatch('success', {
                message: successMsg,
                questionText: questionText
            });
            
            // Set success message for display
            successMessage = successMsg;

            // Use direct navigation instead of goto to ensure reliability
            setTimeout(() => {
                if (browser) {
                    // Navigate to the question view with the new question ID
                    const targetUrl = `/graph/openquestion?id=${encodeURIComponent(createdQuestion.id)}`;
                    console.log('[OpenQuestionReview] Navigating to:', targetUrl);
                    
                    window.location.href = targetUrl;
                }
            }, 800);

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
            <div class="review-item">
                <span class="label">Question:</span>
                <div class="scrollable-content">
                    <span class="value">{questionText}</span>
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
            nextLabel={isSubmitting ? "Submitting..." : "Create Question"}
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

    :global(.keywords-list) {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 4px;
    }

    :global(.keyword-chip) {
        background: rgba(0, 188, 212, 0.2);  /* Using CYAN colors */
        border: 1px solid rgba(0, 188, 212, 0.3);
        border-radius: 12px;
        padding: 2px 8px;
        font-size: 11px;
        color: white;
        font-family: 'Inter', sans-serif;  /* Changed from Orbitron */
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
        background: rgba(0, 188, 212, 0.3);  /* Using CYAN colors */
    }

    :global(.checkbox-label input[type="checkbox"]:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>