<!-- src/lib/components/forms/createNode/createNode/CreateNodeNode.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import BaseSvgDetailNode from '../base/BaseDetailNode.svelte';
    import { NODE_CONSTANTS } from '../base/BaseNodeConstants';
    import { COLORS } from '$lib/constants/colors';
    import { FORM_STYLES } from '$lib/styles/forms';
    import type { UserProfile } from '$lib/types/user';

    import NodeTypeSelect from '$lib/components/forms/createNode/shared/NodeTypeSelect.svelte';
    import WordInput from '$lib/components/forms/createNode/word/WordInput.svelte';
    import DefinitionInput from '$lib/components/forms/createNode/word/DefinitionInput.svelte';
    import DiscussionInput from '$lib/components/forms/createNode/shared/DiscussionInput.svelte';
    import WordReview from '$lib/components/forms/createNode/word/WordReview.svelte';
    import MessageDisplay from '$lib/components/forms/createNode/shared/MessageDisplay.svelte';

    export let node: UserProfile;
    
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

    $: if (formData.nodeType === '') {
        if (!intervalId) {
            // Arranged colors in a more harmonious order
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
                // Update style with transition
                style = {
                    ...style,
                    colors: {
                        ...style.colors,
                        border: colors[colorIndex].full as "#3498dbFF",
                        text: colors[colorIndex].full as "#3498dbFF",
                        hover: colors[colorIndex].full as "#3498dbFF",
                        gradient: {
                            start: colors[colorIndex].semi as "#3498db66",
                            end: colors[colorIndex].light as "#3498db33"
                        }
                    }
                };
            }, 2000); // 2 seconds
        }
    } else {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = undefined;
        }
    }

    $: style = {
        previewSize: NODE_CONSTANTS.SIZES.WORD.detail,
        detailSize: NODE_CONSTANTS.SIZES.WORD.detail,
        colors: formData.nodeType === 'word' ? NODE_CONSTANTS.COLORS.WORD : {
            background: NODE_CONSTANTS.COLORS.WORD.background,
            border: NODE_CONSTANTS.COLORS.WORD.border,
            text: NODE_CONSTANTS.COLORS.WORD.text,
            hover: NODE_CONSTANTS.COLORS.WORD.hover,
            gradient: NODE_CONSTANTS.COLORS.WORD.gradient
        },
        padding: NODE_CONSTANTS.PADDING,
        lineHeight: NODE_CONSTANTS.LINE_HEIGHT,
        stroke: NODE_CONSTANTS.STROKE,
        highlightColor: formData.nodeType === 'word' 
            ? COLORS.PRIMARY.BLUE 
            : formData.nodeType === ''
                ? [
                    COLORS.PRIMARY.BLUE,
                    COLORS.PRIMARY.PURPLE,
                    COLORS.PRIMARY.GREEN,
                    COLORS.PRIMARY.TURQUOISE,
                    COLORS.PRIMARY.YELLOW,
                    COLORS.PRIMARY.ORANGE
                  ][colorIndex]
                : undefined
    };

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

<BaseSvgDetailNode {style}>
    <svelte:fragment let:radius>
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

    :global(.node) {
        transition: all 2s ease-in-out;
    }
    
    :global(.outer-ring) {
        transition: stroke 2s ease-in-out;
    }
    
    :global(text) {
        transition: fill 2s ease-in-out;
    }
</style>