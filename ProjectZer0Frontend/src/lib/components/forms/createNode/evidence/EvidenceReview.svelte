<!-- src/lib/components/forms/createNode/evidence/EvidenceReview.svelte -->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { fetchWithAuth } from '$lib/services/api';
    import { graphStore } from '$lib/stores/graphStore';

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
    export let userId: string | undefined = undefined;
    export let width: number = 400;    
    export let height: number = 400; 

    $: reviewContainerWidth = Math.min(380, width * 0.95);
    $: reviewContainerHeight = Math.max(400, height * 0.8);
    
    let categoryDetails: Array<{ id: string; name: string }> = [];
    let isSubmitting = false;
    let errorMessage: string | null = null;
    let successMessage: string | null = null;

    const dispatch = createEventDispatcher<{
        back: void;
        expandEvidence: { evidenceId: string };
        success: { message: string; evidenceId: string; };
        error: { message: string; };
    }>();
    
    // Evidence type display labels - MUST match backend exactly
    const EVIDENCE_TYPE_LABELS: Record<string, string> = {
        'academic_paper': 'Academic Paper',
        'news_article': 'News Article',
        'government_report': 'Government Report',
        'expert_testimony': 'Expert Testimony',
        'dataset': 'Dataset',
        'book': 'Book',
        'website': 'Website',
        'legal_document': 'Legal Document',
        'survey_study': 'Survey Study',
        'meta_analysis': 'Meta-Analysis',
        'other': 'Other'
    };
    
    $: evidenceTypeLabel = EVIDENCE_TYPE_LABELS[evidenceType] || evidenceType;
    $: parentNodeTypeDisplay = (() => {
        const typeMap: Record<string, string> = {
            'StatementNode': 'Statement',
            'AnswerNode': 'Answer',
            'QuantityNode': 'Quantity',
            'statement': 'Statement',
            'answer': 'Answer',
            'quantity': 'Quantity'
        };
        return typeMap[parentNodeType] || 'Node';
    })();
    
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

    export async function handleSubmit() {
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
            // Ensure URL has protocol
            let formattedUrl = url.trim();
            if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
                formattedUrl = 'https://' + formattedUrl;
            }

            // Map parent node type to backend format
            const parentTypeMap: Record<string, string> = {
                'statement': 'StatementNode',
                'answer': 'AnswerNode',
                'quantity': 'QuantityNode',
                'StatementNode': 'StatementNode',
                'AnswerNode': 'AnswerNode',
                'QuantityNode': 'QuantityNode'
            };
            const mappedParentType = parentTypeMap[parentNodeType] || 'StatementNode';

            const evidenceData = {
                title,
                url: formattedUrl,
                evidenceType,
                parentNodeId,
                parentNodeType: mappedParentType,
                createdBy: userId || 'unknown',
                userKeywords: userKeywords.length > 0 ? userKeywords : undefined,
                categoryIds: selectedCategories.length > 0 ? selectedCategories : undefined,
                initialComment: discussion || undefined,
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
            successMessage = successMsg;

            console.log('[EvidenceReview] Dispatching expandEvidence event:', {
                evidenceId: createdEvidence.id
            });
            
            dispatch('expandEvidence', {
                evidenceId: createdEvidence.id
            });
            
            dispatch('success', {
                message: successMsg,
                evidenceId: createdEvidence.id
            });

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
        x={-reviewContainerWidth/2}
        y="0"
        width={reviewContainerWidth}
        height={reviewContainerHeight}
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
        gap: 6px;
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
        gap: 1px;
    }

    :global(.title-item) {
        margin-top: 6px;
        margin-bottom: 0px;
    }

    :global(.title-value) {
        font-size: 14px;
        font-weight: 500;
    }
    
    :global(.parent-context) {
        background: rgba(103, 242, 142, 0.1);
        border: 1px solid rgba(103, 242, 142, 0.3);
        border-radius: 4px;
        padding: 6px;
        color: rgba(255, 255, 255, 0.8);
        font-family: 'Inter', sans-serif;
        font-size: 10px;
        font-weight: 400;
        line-height: 1.3;
        font-style: italic;
        max-height: 60px;
        overflow-y: auto;
    }
    
    :global(.url-display) {
        background: rgba(103, 242, 142, 0.05);
        border: 1px solid rgba(103, 242, 142, 0.2);
        border-radius: 4px;
        padding: 4px 6px;
        word-break: break-all;
    }
    
    :global(.url-display a) {
        color: rgba(103, 242, 142, 1);
        text-decoration: none;
        font-family: 'Inter', sans-serif;
        font-size: 9px;
        font-weight: 400;
    }
    
    :global(.url-display a:hover) {
        text-decoration: underline;
    }
    
    :global(.type-display) {
        color: rgba(103, 242, 142, 0.9);
        font-family: 'Inter', sans-serif;
        font-size: 10px;
        font-weight: 500;
        padding: 3px 6px;
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
        background: rgba(255, 216, 110, 0.2);
        border: 1px solid rgba(255, 216, 110, 0.3);
        border-radius: 10px;
        padding: 1px 6px;
        font-size: 9px;
        color: white;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    :global(.categories-list) {
        display: flex;
        flex-wrap: nowrap;
        gap: 4px;
        margin-top: 2px;
        overflow-x: auto;
    }

    :global(.categories-list::-webkit-scrollbar) {
        height: 4px;
    }

    :global(.categories-list::-webkit-scrollbar-track) {
        background: rgba(255, 255, 255, 0.05);
    }

    :global(.categories-list::-webkit-scrollbar-thumb) {
        background: rgba(255, 255, 255, 0.3);
        border-radius: 2px;
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
        white-space: nowrap;
    }
    
    :global(.categories-display) {
        margin-top: 4px;
    }

    :global(.options-grid) {
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
        background: rgba(103, 242, 142, 0.3);
    }

    :global(.checkbox-label input[type="checkbox"]:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>