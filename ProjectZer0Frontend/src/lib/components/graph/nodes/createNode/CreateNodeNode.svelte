<!-- src/lib/components/graph/nodes/createNode/CreateNodeNode.svelte -->
<script lang="ts">
    import BaseSvgDetailNode from '../base/BaseDetailNode.svelte';
    import { NODE_CONSTANTS } from '../base/BaseNodeConstants';
    import { FORM_STYLES } from '$lib/styles/forms';
    import type { UserProfile } from '$lib/types/user';

    // Import form components
    import NodeTypeSelect from '$lib/components/forms/createNode/shared/NodeTypeSelect.svelte';
    import WordInput from '$lib/components/forms/createNode/word/WordInput.svelte';
    import DefinitionInput from '$lib/components/forms/createNode/word/DefinitionInput.svelte';
    import DiscussionInput from '$lib/components/forms/createNode/shared/DiscussionInput.svelte';
    import WordReview from '$lib/components/forms/createNode/word/WordReview.svelte';
    import MessageDisplay from '$lib/components/forms/createNode/shared/MessageDisplay.svelte';
    
    export let node: UserProfile;
    
    // State management
    let currentStep = 1;
    let formData = {
        nodeType: '',
        word: '',
        definition: '',
        discussion: '',
        publicCredit: false
    };
    let isLoading = false;
    let errorMessage: string | null = null;
    let successMessage: string | null = null;

    // Node styling
    const style = {
        previewSize: NODE_CONSTANTS.SIZES.WORD.detail,
        detailSize: NODE_CONSTANTS.SIZES.WORD.detail,
        colors: NODE_CONSTANTS.COLORS.WORD,
        padding: NODE_CONSTANTS.PADDING,
        lineHeight: NODE_CONSTANTS.LINE_HEIGHT,
        stroke: NODE_CONSTANTS.STROKE
    };

    $: stepTitle = currentStep === 1 ? 'Create New Node' :
                   currentStep === 2 ? 'Enter Word' :
                   currentStep === 3 ? 'Add Definition' :
                   currentStep === 4 ? 'Start Discussion' :
                   'Review';

    function handleBack() {
        if (currentStep > 1) {
            currentStep--;
            errorMessage = null;
        }
    }

    function handleNext() {
        if (currentStep < 5) {
            currentStep++;
            errorMessage = null;
        }
    }
</script>

<BaseSvgDetailNode {style}>
    <svelte:fragment let:radius let:isHovered>
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
                {#each Array(5) as _, i}
                    <circle
                        cx={-40 + (i * 20)}
                        cy="0"
                        r="4"
                        class="step-indicator"
                        class:active={currentStep >= i + 1}
                    />
                {/each}
            </g>

            <!-- Error/Success Messages -->
            <g transform="translate(0, 70)">
                <MessageDisplay {errorMessage} {successMessage} />
            </g>

            <!-- Dynamic Form Content -->
            <g transform="translate(0, 100)">
                {#if currentStep === 1}
                    <NodeTypeSelect
                        bind:nodeType={formData.nodeType}
                        disabled={isLoading}
                        on:proceed={handleNext}
                    />
                {:else if currentStep === 2}
                    <WordInput
                        bind:word={formData.word}
                        disabled={isLoading}
                        on:back={handleBack}
                        on:proceed={handleNext}
                        on:error={e => errorMessage = e.detail.message}
                        on:wordExists={() => errorMessage = "Word already exists"}
                    />
                {:else if currentStep === 3}
                    <DefinitionInput
                        bind:definition={formData.definition}
                        disabled={isLoading}
                        on:back={handleBack}
                        on:proceed={handleNext}
                    />
                {:else if currentStep === 4}
                    <DiscussionInput
                        bind:discussion={formData.discussion}
                        disabled={isLoading}
                        on:back={handleBack}
                        on:proceed={handleNext}
                    />
                {:else if currentStep === 5}
                    <WordReview
                        {...formData}
                        userId={node.sub}
                        disabled={isLoading}
                        on:back={handleBack}
                        on:success={e => successMessage = e.detail.message}
                        on:error={e => errorMessage = e.detail.message}
                    />
                {/if}
            </g>
        </g>
    </svelte:fragment>
</BaseSvgDetailNode>

<style>
    .title {
        font-size: 30px;
        fill: white;
        font-family: 'Orbitron', sans-serif;
    }

    .step-indicator {
        fill: rgba(255, 255, 255, 0.2);
        transition: all 0.3s ease;
    }

    .step-indicator.active {
        fill: rgba(255, 255, 255, 0.8);
    }
</style>