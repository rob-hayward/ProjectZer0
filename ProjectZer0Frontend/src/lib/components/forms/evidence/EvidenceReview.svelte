<!-- src/lib/components/forms/evidence/EvidenceReview.svelte -->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { fetchWithAuth } from '$lib/services/api';
    import { FORM_STYLES } from '$lib/styles/forms';
    import { graphStore } from '$lib/stores/graphStore';
    import FormNavigation from '../createNode/shared/FormNavigation.svelte';
    import MessageDisplay from '../createNode/shared/MessageDisplay.svelte';
    import CategoryTags from '$lib/components/graph/nodes/ui/CategoryTags.svelte';

    export let title = '';
    export let url = '';
    export let evidenceType = '';
    export let parentNodeId = '';
    export let parentNodeType = '';
    export let parentNodeText = '';
    export let userKeywords: string[] = [];
    export let selectedCategories: string[] = [];
    export let discussion = '';
    export let publicCredit = false;
    export let disabled = false;
    export let userId: string | undefined = undefined;
    
    let categoryDetails: Array<{ id: string; name: string }> = [];
    let isSubmitting = false;
    let errorMessage: string | null = null;
    let successMessage: string | null = null;

    const dispatch = createEventDispatcher<{
        back: void;
        success: { message: string; evidenceId: string; };
        error: { message: string; };
    }>();
    
    // Evidence type display labels
    const EVIDENCE_TYPE_LABELS: Record<string, string> = {
        'peer_reviewed_study': 'Peer-Reviewed Study',
        'government_report': 'Government Report',
        'news_article': 'News Article',
        'expert_opinion': 'Expert Opinion',
        'dataset': 'Dataset',
        'video': 'Video',
        'image': 'Image',
        'other': 'Other'
    };
    
    $: evidenceTypeLabel = EVIDENCE_TYPE_LABELS[evidenceType] || evidenceType;
    $: parentNodeTypeDisplay = parentNodeType === 'StatementNode' ? 'Statement' :
                               parentNodeType === 'AnswerNode' ? 'Answer' :
                               parentNodeType === 'QuantityNode' ? 'Quantity' :
                               'Node';
    
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
        if (!title.trim()) {
            errorMessage = "Title is required";
            dispatch('error', { message: errorMessage });
            return;
        }

        if (!url.trim()) {
            errorMessage = "URL is required";
            dispatch('error', { message: errorMessage });
            return;
        }

        if (!evidenceType) {
            errorMessage = "Evidence type is required";
            dispatch('error', { message: errorMessage });
            return;
        }

        if (!parentNodeId) {
            errorMessage = "Parent node ID is missing";
            dispatch('error', { message: errorMessage });
            return;
        }

        isSubmitting = true;
        errorMessage = null;

        try {
            const evidenceData = {
                title: title.trim(),
                url: url.trim(),
                evidenceType: evidenceType,
                parentNodeId: parentNodeId,
                parentNodeType: parentNodeType,
                createdBy: userId,
                userKeywords: userKeywords.length > 0 ? userKeywords : undefined,
                categories: selectedCategories.length > 0 ? selectedCategories : undefined,
                initialComment: discussion || '',
                publicCredit
            };
            
            console.log('Submitting evidence:', JSON.stringify(evidenceData, null, 2));
            
            const createdEvidence = await fetchWithAuth('/nodes/evidence', {
                method: 'POST',
                body: JSON.stringify(evidenceData),
            });
            
            console.log('Evidence creation response:', JSON.stringify(createdEvidence, null, 2));

            if (browser && graphStore) {
                if (graphStore.forceTick) {
                    try {
                        graphStore.forceTick();
                    } catch (e) {
                        console.warn('[EvidenceReview] Error forcing tick:', e);
                    }
                }
            }

            const successMsg = `Evidence added successfully`;
            dispatch('success', {
                message: successMsg,
                evidenceId: createdEvidence.id
            });
            
            successMessage = successMsg;

            // Navigate back to parent node
            setTimeout(() => {
                if (browser) {
                    const viewType = parentNodeType === 'StatementNode' ? 'statement' :
                                   parentNodeType === 'AnswerNode' ? 'answer' :
                                   parentNodeType === 'QuantityNode' ? 'quantity' : 'statement';
                    const targetUrl = `/graph/${viewType}?id=${encodeURIComponent(parentNodeId)}`;
                    console.log('[EvidenceReview] Navigating to:', targetUrl);
                    
                    window.location.href = targetUrl;
                }
            }, 800);

        } catch (e) {
            if (browser) {
                console.error('Error creating evidence:', e);
                console.error('Error details:', e instanceof Error ? e.stack : 'Unknown error');
            }
            errorMessage = e instanceof Error ? e.message : 'Failed to create evidence';
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
        height="420"
    >
        <div class="review-container">
            <!-- Parent Node -->
            <div class="review-item">
                <span class="label">Adding Evidence to {parentNodeTypeDisplay}:</span>
                <div class="parent-context">
                    {parentNodeText}
                </div>
            </div>
            
            <!-- Evidence Title -->
            <div class="review-item title-item">
                <span class="label">Evidence Title:</span>
                <div class="scrollable-content">
                    <span class="value title-value">{title}</span>
                </div>
            </div>
            
            <!-- Evidence URL -->
            <div class="review-item">
                <span class="label">URL:</span>
                <div class="url-display">
                    <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
                </div>
            </div>
            
            <!-- Evidence Type -->
            <div class="review-item">
                <span class="label">Evidence Type:</span>
                <div class="type-display">
                    {evidenceTypeLabel}
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
    <g transform="translate(0, 270)">
        <FormNavigation
            onBack={() => dispatch('back')}
            onNext={handleSubmit}
            nextLabel={isSubmitting ? "Submitting..." : "Add Evidence"}
            loading={isSubmitting}
            nextDisabled={disabled || isSubmitting || !title.trim() || !url.trim() || !evidenceType}
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

    :global(.title-item) {
        margin-bottom: 4px;
    }

    :global(.title-value) {
        font-size: 14px;
        font-weight: 500;
    }
    
    :global(.parent-context) {
        background: rgba(103, 242, 142, 0.1);
        border: 1px solid rgba(103, 242, 142, 0.3);
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
    
    :global(.url-display) {
        background: rgba(103, 242, 142, 0.05);
        border: 1px solid rgba(103, 242, 142, 0.2);
        border-radius: 4px;
        padding: 6px 8px;
        word-break: break-all;
    }
    
    :global(.url-display a) {
        color: rgba(103, 242, 142, 1);
        text-decoration: none;
        font-family: 'Inter', sans-serif;
        font-size: 12px;
        font-weight: 400;
    }
    
    :global(.url-display a:hover) {
        text-decoration: underline;
    }
    
    :global(.type-display) {
        color: rgba(103, 242, 142, 0.9);
        font-family: 'Inter', sans-serif;
        font-size: 13px;
        font-weight: 500;
        padding: 4px 8px;
        background: rgba(103, 242, 142, 0.1);
        border-radius: 4px;
        display: inline-block;
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
        background: rgba(103, 242, 142, 0.2);
        border: 1px solid rgba(103, 242, 142, 0.3);
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
        background: rgba(103, 242, 142, 0.3);
    }

    :global(.checkbox-label input[type="checkbox"]:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>