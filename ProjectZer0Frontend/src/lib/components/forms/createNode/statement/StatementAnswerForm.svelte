<!-- src/lib/components/forms/createNode/statement/StatementAnswerForm.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { browser } from '$app/environment';
    import BaseDetailNode from '../../../graph/nodes/base/BaseNode.svelte';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    import { isUserProfileData } from '$lib/types/graph/enhanced';
    import { NODE_CONSTANTS } from '../../../../constants/graph/nodes';
    import { COORDINATE_SPACE } from '../../../../constants/graph';
    import { COLORS } from '$lib/constants/colors';

    // Statement creation imports
    import StatementInput from '$lib/components/forms/createNode/statement/StatementInput.svelte';
    import KeywordInput from '$lib/components/forms/createNode/shared/KeywordInput.svelte';
    import DiscussionInput from '$lib/components/forms/createNode/shared/DiscussionInput.svelte';
    import StatementAnswerReview from '$lib/components/forms/createNode/statement/StatementAnswerReview.svelte';
    import MessageDisplay from '$lib/components/forms/createNode/shared/MessageDisplay.svelte';

    export let node: RenderableNode;
    export let parentQuestionId: string | undefined = undefined;
    
    // Type guard for user profile data
    if (!isUserProfileData(node.data)) {
        throw new Error('Invalid node data type for StatementAnswerForm');
    }
    
    const userData = node.data;

    const dispatch = createEventDispatcher<{
        modeChange: { mode: NodeMode };
        success: { statementId: string; message: string };
        cancel: void;
    }>();
    
    function handleModeChange(event: CustomEvent<{ mode: NodeMode }>) {
        dispatch('modeChange', event.detail);
    }
    
    let currentStep = 1;
    let formData = {
        statement: '',
        userKeywords: [] as string[],
        discussion: '',
        publicCredit: false,
        parentQuestionId: parentQuestionId
    };
    let isLoading = false;
    let errorMessage: string | null = null;
    let successMessage: string | null = null;

    // Style configuration - PURPLE color scheme for statement answers
    const nodeStyle = {
        previewSize: COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL,
        detailSize: COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL,
        colors: { 
            background: `${COLORS.PRIMARY.PURPLE}33`,
            border: `${COLORS.PRIMARY.PURPLE}FF`,
            text: `${COLORS.PRIMARY.PURPLE}FF`,
            hover: `${COLORS.PRIMARY.PURPLE}FF`,
            gradient: {
                start: `${COLORS.PRIMARY.PURPLE}66`,
                end: `${COLORS.PRIMARY.PURPLE}33`
            }
        },
        padding: {
            preview: COORDINATE_SPACE.NODES.PADDING.PREVIEW,
            detail: COORDINATE_SPACE.NODES.PADDING.DETAIL
        },
        lineHeight: NODE_CONSTANTS.LINE_HEIGHT,
        stroke: NODE_CONSTANTS.STROKE,
        highlightColor: COLORS.PRIMARY.PURPLE
    };

    // Step specific data
    $: stepTitle = currentStep === 1 ? 'Answer Question' :
                   currentStep === 2 ? 'Add Keywords' :
                   currentStep === 3 ? 'Start Discussion' :
                   'Review Answer';

    function handleBack() {
        if (currentStep > 1) {
            currentStep--;
            errorMessage = null;
        } else {
            // If on first step, cancel the form
            dispatch('cancel');
        }
    }

    function handleNext() {
        if (currentStep < 4) {
            currentStep++;
            errorMessage = null;
        }
    }

    function handleSuccess(event: CustomEvent<{ statementId: string; message: string }>) {
        successMessage = event.detail.message;
        dispatch('success', {
            statementId: event.detail.statementId,
            message: event.detail.message
        });
    }

    function handleError(event: CustomEvent<{ message: string }>) {
        errorMessage = event.detail.message;
    }
</script>

<BaseDetailNode {node} style={nodeStyle} on:modeChange={handleModeChange}>
    <svelte:fragment slot="default" let:radius>
        <g transform="translate(0, {-radius + 120})">
            <!-- Title -->
            <text 
                class="title"
                text-anchor="middle"
            >
                {stepTitle}
            </text>
        
            <!-- Step Indicators -->
            <g transform="translate(0, 40)">
                {#each Array(4) as _, i}
                    <circle
                        cx={-30 + (i * 20)}
                        cy="0"
                        r="4"
                        class="step-indicator"
                        class:active={currentStep >= i + 1}
                    />
                {/each}
            </g>
        
            <!-- Parent Question ID Display (for debugging) -->
            {#if parentQuestionId}
                <g transform="translate(0, 70)">
                    <text class="parent-info" text-anchor="middle">
                        Answering Question: {parentQuestionId.substring(0, 8)}...
                    </text>
                </g>
            {/if}
        
            <!-- Error/Success Messages -->
            <g transform="translate(0, {parentQuestionId ? 100 : 70})">
                <MessageDisplay {errorMessage} {successMessage} />
            </g>

            <!-- Dynamic Form Content -->
            <g transform="translate(0, {parentQuestionId ? 130 : 100})">
                {#if currentStep === 1}
                    <StatementInput
                        bind:statement={formData.statement}
                        disabled={isLoading}
                        on:back={handleBack}
                        on:proceed={handleNext}
                    />
                {:else if currentStep === 2}
                    <KeywordInput
                        bind:userKeywords={formData.userKeywords}
                        disabled={isLoading}
                        on:back={handleBack}
                        on:proceed={handleNext}
                    />
                {:else if currentStep === 3}
                    <DiscussionInput
                        bind:discussion={formData.discussion}
                        disabled={isLoading}
                        on:back={handleBack}
                        on:proceed={handleNext}
                    />
                {:else if currentStep === 4}
                    <StatementAnswerReview
                        statement={formData.statement}
                        userKeywords={formData.userKeywords}
                        discussion={formData.discussion}
                        publicCredit={formData.publicCredit}
                        userId={userData.sub}
                        {parentQuestionId}
                        disabled={isLoading}
                        on:back={handleBack}
                        on:success={handleSuccess}
                        on:error={handleError}
                    />
                {/if}
            </g>
        </g>
    </svelte:fragment>
</BaseDetailNode>

<style>
    .title {
        font-size: 30px;
        fill: white;
        font-family: 'Inter', sans-serif;
        font-weight: 600;
    }

    .parent-info {
        font-size: 12px;
        fill: rgba(255, 255, 255, 0.6);
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }

    .step-indicator {
        fill: rgba(255, 255, 255, 0.2);
        transition: all 0.3s ease;
    }

    .step-indicator.active {
        fill: rgba(255, 255, 255, 0.8);
    }

    /* Make sure foreignObject elements don't clip their content */
    :global(foreignObject) {
        overflow: visible !important;
    }

    /* Ensure the button containers have enough height */
    :global(.button-wrapper) {
        padding-top: 4px;
        padding-bottom: 4px;
        height: auto !important;
        min-height: 45px;
    }

    /* Give buttons proper spacing */
    :global(.action-button) {
        margin-bottom: 5px;
        position: relative;
        z-index: 5;
    }
</style>