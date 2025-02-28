<!-- src/lib/components/graph/nodes/createNode/CreateNodeNode.svelte -->
<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import BaseDetailNode from '../base/BaseNode.svelte';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    import { isUserProfileData } from '$lib/types/graph/enhanced';
    import { NODE_CONSTANTS } from '../../../../constants/graph/node-styling';
    import { COORDINATE_SPACE } from '../../../../constants/graph';
    import { COLORS } from '$lib/constants/colors';

    import NodeTypeSelect from '$lib/components/forms/createNode/shared/NodeTypeSelect.svelte';
    import WordInput from '$lib/components/forms/createNode/word/WordInput.svelte';
    import DefinitionInput from '$lib/components/forms/createNode/word/DefinitionInput.svelte';
    import DiscussionInput from '$lib/components/forms/createNode/shared/DiscussionInput.svelte';
    import WordReview from '$lib/components/forms/createNode/word/WordReview.svelte';
    import MessageDisplay from '$lib/components/forms/createNode/shared/MessageDisplay.svelte';

    export let node: RenderableNode;
    
    // Type guard for user profile data
    if (!isUserProfileData(node.data)) {
        throw new Error('Invalid node data type for CreateNodeNode');
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
        nodeType: '',
        word: '',
        definition: '',
        discussion: '',
        publicCredit: false
    };
    let isLoading = false;
    let errorMessage: string | null = null;
    let successMessage: string | null = null;

    let colorIndex = 0;
    let intervalId: NodeJS.Timeout | undefined;
    
    // Create a base style object that we'll modify
    const baseStyle = {
        previewSize: COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL,
        detailSize: COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL,
        colors: { ...NODE_CONSTANTS.COLORS.WORD }, // Clone to avoid modifying the original
        padding: {
            preview: COORDINATE_SPACE.NODES.PADDING.PREVIEW,
            detail: COORDINATE_SPACE.NODES.PADDING.DETAIL
        },
        lineHeight: NODE_CONSTANTS.LINE_HEIGHT,
        stroke: NODE_CONSTANTS.STROKE,
        highlightColor: COLORS.PRIMARY.BLUE
    };
    
    // Current style - will be updated reactively
    let currentStyle = { ...baseStyle };
    let completeStyle = { ...baseStyle };

    $: if (formData.nodeType === '') {
        if (!intervalId) {
            // Colors array
            const colors = [
                {
                    base: COLORS.PRIMARY.BLUE,
                    full: `${COLORS.PRIMARY.BLUE}FF`,
                    semi: `${COLORS.PRIMARY.BLUE}66`,
                    light: `${COLORS.PRIMARY.BLUE}33`
                },
                {
                    base: COLORS.PRIMARY.PURPLE,
                    full: `${COLORS.PRIMARY.PURPLE}FF`,
                    semi: `${COLORS.PRIMARY.PURPLE}66`,
                    light: `${COLORS.PRIMARY.PURPLE}33`
                },
                {
                    base: COLORS.PRIMARY.TURQUOISE,
                    full: `${COLORS.PRIMARY.TURQUOISE}FF`,
                    semi: `${COLORS.PRIMARY.TURQUOISE}66`,
                    light: `${COLORS.PRIMARY.TURQUOISE}33`
                },
                {
                    base: COLORS.PRIMARY.GREEN,
                    full: `${COLORS.PRIMARY.GREEN}FF`,
                    semi: `${COLORS.PRIMARY.GREEN}66`,
                    light: `${COLORS.PRIMARY.GREEN}33`
                },
                {
                    base: COLORS.PRIMARY.YELLOW,
                    full: `${COLORS.PRIMARY.YELLOW}FF`,
                    semi: `${COLORS.PRIMARY.YELLOW}66`,
                    light: `${COLORS.PRIMARY.YELLOW}33`
                },
                {
                    base: COLORS.PRIMARY.ORANGE,
                    full: `${COLORS.PRIMARY.ORANGE}FF`,
                    semi: `${COLORS.PRIMARY.ORANGE}66`,
                    light: `${COLORS.PRIMARY.ORANGE}33`
                },
                {
                    base: COLORS.PRIMARY.RED,
                    full: `${COLORS.PRIMARY.RED}FF`,
                    semi: `${COLORS.PRIMARY.RED}66`,
                    light: `${COLORS.PRIMARY.RED}33`
                }
            ];
            
            intervalId = setInterval(() => {
                colorIndex = (colorIndex + 1) % colors.length;
                
                // Use type assertion to bypass TypeScript's literal type checking
                const newStyle = { ...baseStyle };
                // Update style with new colors
                newStyle.colors = {
                    background: colors[colorIndex].light,
                    border: colors[colorIndex].full,
                    text: colors[colorIndex].full,
                    hover: colors[colorIndex].full,
                    gradient: {
                        start: colors[colorIndex].semi,
                        end: colors[colorIndex].light
                    }
                } as typeof NODE_CONSTANTS.COLORS.WORD;
                
                newStyle.highlightColor = colors[colorIndex].base as typeof COLORS.PRIMARY.BLUE;
                
                // Update current style
                currentStyle = newStyle;
                
                // Also update complete style if no node type is selected
                if (formData.nodeType === '') {
                    completeStyle = newStyle;
                }
            }, 2000); // 2 seconds
        }
    } else {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = undefined;
        }
    }

    // FIX: Better handling of style when node type is selected
    $: if (formData.nodeType === 'word') {
        // For word nodes, use the blue word style from constants
        completeStyle = {
            ...baseStyle,
            colors: NODE_CONSTANTS.COLORS.WORD,
            highlightColor: COLORS.PRIMARY.BLUE
        };
    } else if (formData.nodeType !== '') {
        // For other node types, use current style from the animation
        completeStyle = { ...currentStyle };
    } else {
        // When no node type selected, use animated current style
        completeStyle = { ...currentStyle };
    }

    $: stepTitle = currentStep === 1 ? 'Create New Node' :
                   currentStep === 2 ? 'Enter Word' :
                   currentStep === 3 ? 'Add Definition' :
                   currentStep === 4 ? 'Start Discussion' :
                   'Review Creation';

    $: showStepIndicators = currentStep < 5;

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

    onDestroy(() => {
        if (intervalId) {
            clearInterval(intervalId);
        }
    });
</script>

<BaseDetailNode {node} style={completeStyle} on:modeChange={handleModeChange}>
    <svelte:fragment slot="default" let:radius>
        <g transform="translate(0, {-radius + (currentStep === 5 ? 100 : 120)})">
            <!-- Title -->
            <text 
                class="title"
                text-anchor="middle"
            >
                {stepTitle}
            </text>
        
            <!-- Step Indicators -->
            {#if showStepIndicators}
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
            {/if}
        
            <!-- Error/Success Messages -->
            <g transform="translate(0, {showStepIndicators ? 70 : 40})">
                <MessageDisplay {errorMessage} {successMessage} />
            </g>

            <!-- Dynamic Form Content -->
            <g transform="translate(0, {showStepIndicators ? 100 : 60})">
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

    .step-indicator {
        fill: rgba(255, 255, 255, 0.2);
        transition: all 0.3s ease;
    }

    .step-indicator.active {
        fill: rgba(255, 255, 255, 0.8);
    }

    :global(.node) {
        transition: all 2s ease-in-out;
    }
    
    :global(.outer-ring) {
        transition: stroke 2s ease-in-out;
    }
    
    :global(text) {
        transition: fill 2s ease-in-out;
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