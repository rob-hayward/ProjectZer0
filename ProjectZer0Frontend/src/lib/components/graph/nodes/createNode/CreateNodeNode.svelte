<!-- src/lib/components/graph/nodes/createNode/CreateNodeNode.svelte -->
<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import BaseDetailNode from '../base/BaseNode.svelte';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    import { isUserProfileData } from '$lib/types/graph/enhanced';
    import { NODE_CONSTANTS } from '../../../../constants/graph/nodes';
    import { COORDINATE_SPACE } from '../../../../constants/graph';
    import { COLORS } from '$lib/constants/colors';

    // Word related imports
    import NodeTypeSelect from '$lib/components/forms/createNode/shared/NodeTypeSelect.svelte';
    import WordInput from '$lib/components/forms/createNode/word/WordInput.svelte';
    import DefinitionInput from '$lib/components/forms/createNode/word/DefinitionInput.svelte';
    import DiscussionInput from '$lib/components/forms/createNode/shared/DiscussionInput.svelte';
    import WordReview from '$lib/components/forms/createNode/word/WordReview.svelte';
    import MessageDisplay from '$lib/components/forms/createNode/shared/MessageDisplay.svelte';
    
    // Statement related imports
    import StatementInput from '$lib/components/forms/createNode/statement/StatementInput.svelte';
    import StatementReview from '$lib/components/forms/createNode/statement/StatementReview.svelte';
    
    // OpenQuestion related imports
    import OpenQuestionInput from '$lib/components/forms/createNode/openquestion/OpenQuestionInput.svelte';
    import OpenQuestionReview from '$lib/components/forms/createNode/openquestion/OpenQuestionReview.svelte';
    
    // Quantity related imports
    import QuantityInput from '$lib/components/forms/createNode/quantity/QuantityInput.svelte';
    import UnitCategorySelect from '$lib/components/forms/createNode/quantity/UnitCategorySelect.svelte';
    import QuantityReview from '$lib/components/forms/createNode/quantity/QuantityReview.svelte';

    //  Shared imports
    import KeywordInput from '$lib/components/forms/createNode/shared/KeywordInput.svelte';

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
        definitionText: '',      // For word node
        statement: '',           // For statement node
        questionText: '',        // For openquestion node
        question: '',            // For quantity node
        unitCategoryId: '',      // For quantity node
        defaultUnitId: '',       // For quantity node
        userKeywords: [],        // For statement, openquestion and quantity nodes
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
            // Colors array - including the new CYAN
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
                    base: COLORS.PRIMARY.CYAN,
                    full: `${COLORS.PRIMARY.CYAN}FF`,
                    semi: `${COLORS.PRIMARY.CYAN}66`,
                    light: `${COLORS.PRIMARY.CYAN}33`
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

    // Set appropriate style based on node type
    $: if (formData.nodeType === 'word') {
        // For word nodes, use the blue word style from constants
        completeStyle = {
            ...baseStyle,
            colors: NODE_CONSTANTS.COLORS.WORD,
            highlightColor: COLORS.PRIMARY.BLUE
        };
    } else if (formData.nodeType === 'statement') {
        // For statement nodes, use purple (moved from green)
        completeStyle = {
            ...baseStyle,
            colors: {
                background: `${COLORS.PRIMARY.PURPLE}33`,
                border: `${COLORS.PRIMARY.PURPLE}FF`,
                text: `${COLORS.PRIMARY.PURPLE}FF`,
                hover: `${COLORS.PRIMARY.PURPLE}FF`,
                gradient: {
                    start: `${COLORS.PRIMARY.PURPLE}66`,
                    end: `${COLORS.PRIMARY.PURPLE}33`
                }
            } as any,
            highlightColor: COLORS.PRIMARY.PURPLE as any
        };
    } else if (formData.nodeType === 'openquestion') {
        // For openquestion nodes, use cyan
        completeStyle = {
            ...baseStyle,
            colors: {
                background: `${COLORS.PRIMARY.CYAN}33`,
                border: `${COLORS.PRIMARY.CYAN}FF`,
                text: `${COLORS.PRIMARY.CYAN}FF`,
                hover: `${COLORS.PRIMARY.CYAN}FF`,
                gradient: {
                    start: `${COLORS.PRIMARY.CYAN}66`,
                    end: `${COLORS.PRIMARY.CYAN}33`
                }
            } as any,
            highlightColor: COLORS.PRIMARY.CYAN as any
        };
    } else if (formData.nodeType === 'quantity') {
        // For quantity nodes, use turquoise
        completeStyle = {
            ...baseStyle,
            colors: {
                background: `${COLORS.PRIMARY.TURQUOISE}33`,
                border: `${COLORS.PRIMARY.TURQUOISE}FF`,
                text: `${COLORS.PRIMARY.TURQUOISE}FF`,
                hover: `${COLORS.PRIMARY.TURQUOISE}FF`,
                gradient: {
                    start: `${COLORS.PRIMARY.TURQUOISE}66`,
                    end: `${COLORS.PRIMARY.TURQUOISE}33`
                }
            } as any,
            highlightColor: COLORS.PRIMARY.TURQUOISE as any
        };
    } else if (formData.nodeType !== '') {
        // For other node types, use current style from the animation
        completeStyle = { ...currentStyle };
    } else {
        // When no node type selected, use animated current style
        completeStyle = { ...currentStyle };
    }

    // Set the title based on current step and node type
    $: stepTitle = currentStep === 1 ? 'Create New Node' :
                  formData.nodeType === 'word' ? 
                    (currentStep === 2 ? 'Enter Word' :
                     currentStep === 3 ? 'Add Definition' :
                     currentStep === 4 ? 'Start Discussion' :
                     'Review Creation') :
                  formData.nodeType === 'statement' ?
                    (currentStep === 2 ? 'Enter Statement' :
                     currentStep === 3 ? 'Add Keywords' :
                     currentStep === 4 ? 'Start Discussion' :
                     'Review Creation') :
                  formData.nodeType === 'openquestion' ?
                    (currentStep === 2 ? 'Enter Question' :
                     currentStep === 3 ? 'Add Keywords' :
                     currentStep === 4 ? 'Start Discussion' :
                     'Review Creation') :
                  formData.nodeType === 'quantity' ?
                    (currentStep === 2 ? 'Enter Question' :
                     currentStep === 3 ? 'Select Unit' :
                     currentStep === 4 ? 'Add Keywords' :
                     currentStep === 5 ? 'Start Discussion' :
                     'Review Creation') :
                  'Create New Node';

    $: showStepIndicators = currentStep < (formData.nodeType === 'quantity' ? 6 : 5);

    // Max steps based on node type
    $: maxSteps = formData.nodeType === 'word' || formData.nodeType === 'statement' || formData.nodeType === 'openquestion' ? 5 : 
                 formData.nodeType === 'quantity' ? 6 : 1;

    function handleBack() {
        if (currentStep > 1) {
            currentStep--;
            errorMessage = null;
        }
    }

    function handleNext() {
        if (currentStep < maxSteps) {
            currentStep++;
            errorMessage = null;
        }
    }

    function handleNodeTypeChange(event: CustomEvent<{ type: string }>) {
        // Reset form when changing node type
        formData = {
            ...formData,
            nodeType: event.detail.type,
            word: '',
            definitionText: '',
            statement: '',
            questionText: '',
            question: '',
            unitCategoryId: '',
            defaultUnitId: '',
            userKeywords: [],
            discussion: '',
            publicCredit: false
        };
    }

    onDestroy(() => {
        if (intervalId) {
            clearInterval(intervalId);
        }
    });
</script>

<BaseDetailNode {node} style={completeStyle} on:modeChange={handleModeChange}>
    <svelte:fragment slot="default" let:radius>
        <g transform="translate(0, {-radius + (currentStep === (formData.nodeType === 'quantity' ? 6 : 5) ? 100 : 120)})">
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
                    {#each Array(formData.nodeType === 'quantity' ? 6 : 5) as _, i}
                        <circle
                            cx={-50 + (i * 20)}
                            cy="0"
                            r="4"
                            class="step-indicator"
                            class:active={currentStep >= i + 1}
                        />
                    {/each}
                </g>
            {/if}
        
            <!-- Error/Success Messages -->
            {#if errorMessage || successMessage}
                <g transform="translate(0, {showStepIndicators ? 70 : 40})">
                    <MessageDisplay {errorMessage} {successMessage} />
                </g>
            {/if}

            <!-- Dynamic Form Content -->
            <g transform="translate(0, {showStepIndicators ? 100 : 60})">
                {#if currentStep === 1}
                    <NodeTypeSelect
                        bind:nodeType={formData.nodeType}
                        disabled={isLoading}
                        on:proceed={handleNext}
                        on:typeChange={handleNodeTypeChange}
                    />
                {:else if formData.nodeType === 'word'}
                    <!-- Word node creation flow -->
                    {#if currentStep === 2}
                        <WordInput
                            bind:word={formData.word}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                            on:error={e => errorMessage = e.detail.message}
                        />
                    {:else if currentStep === 3}
                        <DefinitionInput
                            bind:definitionText={formData.definitionText}
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
                            word={formData.word}
                            definitionText={formData.definitionText} 
                            discussion={formData.discussion}
                            publicCredit={formData.publicCredit}
                            userId={userData.sub}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:success={e => successMessage = e.detail.message}
                            on:error={e => errorMessage = e.detail.message}
                        />
                    {/if}
                {:else if formData.nodeType === 'statement'}
                    <!-- Statement node creation flow -->
                    {#if currentStep === 2}
                        <StatementInput
                            bind:statement={formData.statement}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 3}
                        <KeywordInput
                            bind:userKeywords={formData.userKeywords}
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
                        <StatementReview
                            statement={formData.statement}
                            userKeywords={formData.userKeywords}
                            discussion={formData.discussion}
                            publicCredit={formData.publicCredit}
                            userId={userData.sub}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:success={e => successMessage = e.detail.message}
                            on:error={e => errorMessage = e.detail.message}
                        />
                    {/if}
                {:else if formData.nodeType === 'openquestion'}
                    <!-- OpenQuestion node creation flow -->
                    {#if currentStep === 2}
                        <OpenQuestionInput
                            bind:questionText={formData.questionText}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 3}
                        <KeywordInput
                            bind:userKeywords={formData.userKeywords}
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
                        <OpenQuestionReview
                            questionText={formData.questionText}
                            userKeywords={formData.userKeywords}
                            discussion={formData.discussion}
                            publicCredit={formData.publicCredit}
                            userId={userData.sub}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:success={e => successMessage = e.detail.message}
                            on:error={e => errorMessage = e.detail.message}
                        />
                    {/if}
                {:else if formData.nodeType === 'quantity'}
                    <!-- Quantity node creation flow -->
                    {#if currentStep === 2}
                        <QuantityInput
                            bind:question={formData.question}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 3}
                        <UnitCategorySelect
                            bind:unitCategoryId={formData.unitCategoryId}
                            bind:defaultUnitId={formData.defaultUnitId}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 4}
                        <KeywordInput
                            bind:userKeywords={formData.userKeywords}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 5}
                        <DiscussionInput
                            bind:discussion={formData.discussion}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 6}
                        <QuantityReview
                            question={formData.question}
                            unitCategoryId={formData.unitCategoryId}
                            defaultUnitId={formData.defaultUnitId}
                            userKeywords={formData.userKeywords}
                            discussion={formData.discussion}
                            publicCredit={formData.publicCredit}
                            userId={userData.sub}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:success={e => successMessage = e.detail.message}
                            on:error={e => errorMessage = e.detail.message}
                        />
                    {/if}
                {/if}
            </g>
        </g>
    </svelte:fragment>
</BaseDetailNode>

<style>
    .title {
        font-size: 30px;
        fill: white;
        font-family: 'Inter', sans-serif;  /* Changed from Orbitron to Inter */
        font-weight: 600;  /* Added weight for consistency */
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