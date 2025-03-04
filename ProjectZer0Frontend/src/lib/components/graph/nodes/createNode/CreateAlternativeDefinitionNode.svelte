<!-- src/lib/components/graph/nodes/createNode/CreateAlternativeDefinitionNode.svelte -->
<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import { browser } from '$app/environment';
    import BaseDetailNode from '../base/BaseNode.svelte';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    import { isUserProfileData } from '$lib/types/graph/enhanced';
    import { NODE_CONSTANTS } from '../../../../constants/graph/node-styling';
    import { COORDINATE_SPACE } from '../../../../constants/graph';
    import { COLORS } from '$lib/constants/colors';
    import { FORM_STYLES } from '$lib/styles/forms';

    // Use our new AlternativeDefinitionInput component
    import AlternativeDefinitionInput from '$lib/components/forms/createNode/alternativeDefinition/AlternativeDefinitionInput.svelte';
    import DiscussionInput from '$lib/components/forms/createNode/shared/DiscussionInput.svelte';
    import AlternativeDefinitionReview from '$lib/components/forms/createNode/alternativeDefinition/AlternativeDefinitionReview.svelte';
    import MessageDisplay from '$lib/components/forms/createNode/shared/MessageDisplay.svelte';

    export let node: RenderableNode;
    
    // Type guard for user profile data
    if (!isUserProfileData(node.data)) {
        throw new Error('Invalid node data type for CreateAlternativeDefinitionNode');
    }
    
    const userData = node.data;

    const dispatch = createEventDispatcher<{
        modeChange: { mode: NodeMode };
    }>();
    
    function handleModeChange(event: CustomEvent<{ mode: NodeMode }>) {
        dispatch('modeChange', event.detail);
    }
    
    let currentStep = 1;
    let formData = {
        word: '',
        definition: '',
        discussion: '',
        publicCredit: false
    };
    let isLoading = false;
    let errorMessage: string | null = null;
    let successMessage: string | null = null;

    // Style configuration - PURPLE color scheme for alt definitions to match alternative definitions
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
    $: stepTitle = currentStep === 1 ? 'Add Alternative Definition' :
                   currentStep === 2 ? 'Add Discussion' :
                   'Review Definition';
                   
    onMount(() => {
        // Get the word from the URL
        if (browser) {
            const url = new URL(window.location.href);
            const wordParam = url.searchParams.get('word');
            
            if (!wordParam) {
                errorMessage = 'No word specified for alternative definition';
                return;
            }
            
            formData.word = wordParam;
            console.log('[CreateAltDefinition] Initialized with word:', wordParam);
        }
    });

    function handleBack() {
        if (currentStep > 1) {
            currentStep--;
            errorMessage = null;
        }
    }

    function handleNext() {
        if (currentStep < 3) {
            currentStep++;
            errorMessage = null;
        }
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
                {#each Array(3) as _, i}
                    <circle
                        cx={-20 + (i * 20)}
                        cy="0"
                        r="4"
                        class="step-indicator"
                        class:active={currentStep >= i + 1}
                    />
                {/each}
            </g>
        
            <!-- Word Display - Left aligned -->
            <g transform="translate({FORM_STYLES.layout.leftAlign}, 70)">
                <text class="word-display left-align">
                    Word: {formData.word}
                </text>
            </g>
        
            <!-- Error/Success Messages -->
            <g transform="translate(0, 100)">
                <MessageDisplay {errorMessage} {successMessage} />
            </g>

            <!-- Dynamic Form Content -->
            <g transform="translate(0, 130)">
                {#if currentStep === 1}
                    <AlternativeDefinitionInput
                        bind:definition={formData.definition}
                        disabled={isLoading}
                        on:back={handleBack}
                        on:proceed={handleNext}
                    />
                {:else if currentStep === 2}
                    <DiscussionInput
                        bind:discussion={formData.discussion}
                        disabled={isLoading}
                        on:back={handleBack}
                        on:proceed={handleNext}
                    />
                {:else if currentStep === 3}
                    <AlternativeDefinitionReview
                        {...formData}
                        userId={userData.sub}
                        disabled={isLoading}
                        on:back={handleBack}
                        on:success={e => successMessage = e.detail.message}
                        on:error={e => errorMessage = e.detail.message}
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
        font-family: 'Orbitron', sans-serif;
    }

    .word-display {
        font-size: 16px;
        fill: white;
        font-family: 'Orbitron', sans-serif;
        font-weight: 500;
    }

    .left-align {
        text-anchor: start;
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