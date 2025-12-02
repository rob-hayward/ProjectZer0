<!-- src/lib/components/graph/nodes/createNode/CreateNodeNode.svelte -->
<!-- UPDATED: CSS-based color cycling + bottom-positioned next button -->
<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import BaseDetailNode from '../base/BaseDetailNode.svelte';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    import { isUserProfileData } from '$lib/types/graph/enhanced';
    import NodeHeader from '../ui/NodeHeader.svelte';
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

    // Answer related imports
    import AnswerInput from '$lib/components/forms/createNode/answer/AnswerInput.svelte';
    import AnswerReview from '$lib/components/forms/createNode/answer/AnswerReview.svelte';
    
    // Evidence related imports
    import EvidenceInput from '$lib/components/forms/evidence/EvidenceInput.svelte';
    import EvidenceReview from '$lib/components/forms/evidence/EvidenceReview.svelte';
    
    // Category related imports
    import CategoryCreationInput from '$lib/components/forms/createNode/category/CategoryCreationInput.svelte';
    import CategoryCreationReview from '$lib/components/forms/createNode/category/CategoryCreationReview.svelte';

    // Shared imports
    import KeywordInput from '$lib/components/forms/createNode/shared/KeywordInput.svelte';
    import CategoryInput from '$lib/components/forms/createNode/shared/CategoryInput.svelte';

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
        definitionText: '',
        statement: '',
        questionText: '',
        question: '',
        unitCategoryId: '',
        defaultUnitId: '',
        answerText: '',
        evidenceTitle: '',
        evidenceUrl: '',
        evidenceType: '',
        parentNodeId: '',
        parentNodeType: '',
        selectedWordIds: [],
        parentCategoryId: null,
        userKeywords: [],
        selectedCategories: [],
        discussion: '',
        publicCredit: false
    };
    let isLoading = false;
    let errorMessage: string | null = null;
    let successMessage: string | null = null;

    // IMPROVED: Detect if we're in universal graph as central node
    // Central nodes have id ending in '-central'
    const isUniversalCentralNode = node.id?.endsWith('-central') || false;
    
    // State for managing CSS animation (not for reactivity - just for class binding)
    let enableColorCycling = false;
    let hasGraphSettled = false;
    
    // State for next button hover
    let isNextButtonHovering = false;
    
    // Listen for graph settlement if we're a central node
    onMount(() => {
        if (isUniversalCentralNode) {
            console.log('[CreateNodeNode] Universal central node detected - waiting for settlement');
            
            // Listen for opacity reveal completion
            const handleSettlement = () => {
                hasGraphSettled = true;
                console.log('[CreateNodeNode] Graph settled - color cycling can begin');
            };
            
            // Try to listen for existing events that indicate settlement
            window.addEventListener('opacity-reveal-complete', handleSettlement);
            window.addEventListener('link-reveal-complete', handleSettlement);
            
            // Fallback timer (5 seconds) in case events don't fire
            const fallbackTimer = setTimeout(() => {
                if (!hasGraphSettled) {
                    console.log('[CreateNodeNode] Fallback: enabling color cycling after 5s');
                    hasGraphSettled = true;
                }
            }, 5000);
            
            return () => {
                window.removeEventListener('opacity-reveal-complete', handleSettlement);
                window.removeEventListener('link-reveal-complete', handleSettlement);
                clearTimeout(fallbackTimer);
            };
        }
    });
    
    // Enable color cycling ONLY when all conditions met:
    // 1. We're a central node in universal graph
    // 2. Graph has settled
    // 3. No node type selected yet
    $: enableColorCycling = isUniversalCentralNode && hasGraphSettled && formData.nodeType === '';
    
    // Apply CSS animation directly to DOM elements
    // Use afterUpdate to ensure DOM is ready, and check more robustly for elements
    $: if (enableColorCycling) {
        console.log('[CreateNodeNode] ✨ Color cycling enabled - applying animation');
        // Use setTimeout to ensure DOM has fully rendered
        setTimeout(() => {
            applyColorCycling(true);
        }, 100);
    } else if (!enableColorCycling && typeof window !== 'undefined') {
        console.log('[CreateNodeNode] Color cycling disabled - removing animation');
        applyColorCycling(false);
    }
    
    function applyColorCycling(enable: boolean) {
        if (typeof window === 'undefined') return;
        
        // Try multiple selectors to find the node
        const selectors = [
            '[data-node-id="create-node-central"]',
            '.detail-node[data-node-id="create-node-central"]',
            'g[data-node-id="create-node-central"]'
        ];
        
        let nodeElement: Element | null = null;
        for (const selector of selectors) {
            nodeElement = document.querySelector(selector);
            if (nodeElement) {
                console.log('[CreateNodeNode] Found node element with selector:', selector);
                break;
            }
        }
        
        if (!nodeElement) {
            console.warn('[CreateNodeNode] Could not find node element for color cycling');
            return;
        }
        
        // Get all the visual elements from BaseNode
        const outerRing = nodeElement.querySelector('.outer-ring');
        const middleRing = nodeElement.querySelector('.middle-ring');
        const backgroundLayer1 = nodeElement.querySelector('.background-layer-1');
        const backgroundLayer2 = nodeElement.querySelector('.background-layer-2');
        const backgroundLayer3 = nodeElement.querySelector('.background-layer-3');
        const contentBackground = nodeElement.querySelector('.content-background');
        const textElements = nodeElement.querySelectorAll('text');
        
        console.log('[CreateNodeNode] Found elements:', {
            outerRing: !!outerRing,
            middleRing: !!middleRing,
            backgroundLayer1: !!backgroundLayer1,
            backgroundLayer2: !!backgroundLayer2,
            backgroundLayer3: !!backgroundLayer3,
            contentBackground: !!contentBackground,
            textCount: textElements.length
        });
        
        if (enable) {
            // Add animation to all visual elements
            const elementsToAnimate = [
                outerRing,
                middleRing,
                backgroundLayer1,
                backgroundLayer2,
                backgroundLayer3,
                contentBackground
            ];
            
            elementsToAnimate.forEach(element => {
                if (element) {
                    (element as SVGElement).style.animation = 'colorCycle 18s linear infinite';
                }
            });
            
            textElements.forEach(text => {
                (text as SVGElement).style.animation = 'colorCycle 18s linear infinite';
            });
            
            console.log('[CreateNodeNode] Applied animation to:', {
                rings: [outerRing, middleRing].filter(Boolean).length,
                backgroundLayers: [backgroundLayer1, backgroundLayer2, backgroundLayer3, contentBackground].filter(Boolean).length,
                textElements: textElements.length
            });
        } else {
            // Remove animation from all elements
            const elementsToReset = [
                outerRing,
                middleRing,
                backgroundLayer1,
                backgroundLayer2,
                backgroundLayer3,
                contentBackground
            ];
            
            elementsToReset.forEach(element => {
                if (element) {
                    (element as SVGElement).style.animation = '';
                }
            });
            
            textElements.forEach(text => {
                (text as SVGElement).style.animation = '';
            });
        }
    }
    
    // Create a base style object
    const baseStyle = {
        previewSize: COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL,
        detailSize: COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL,
        colors: { ...NODE_CONSTANTS.COLORS.WORD },
        padding: {
            preview: COORDINATE_SPACE.NODES.PADDING.PREVIEW,
            detail: COORDINATE_SPACE.NODES.PADDING.DETAIL
        },
        lineHeight: NODE_CONSTANTS.LINE_HEIGHT,
        stroke: NODE_CONSTANTS.STROKE,
        highlightColor: COLORS.PRIMARY.WORD
    };
    
    let completeStyle = { ...baseStyle };

    // STATIC color selection based on node type - NO INTERVALS
    // CSS animations handle the cycling when no type is selected
    $: {
        if (formData.nodeType === 'word') {
            completeStyle = {
                ...baseStyle,
                colors: NODE_CONSTANTS.COLORS.WORD,
                highlightColor: COLORS.PRIMARY.WORD
            };
        } else if (formData.nodeType === 'statement') {
            completeStyle = {
                ...baseStyle,
                colors: {
                    background: `${COLORS.PRIMARY.STATEMENT}33`,
                    border: `${COLORS.PRIMARY.STATEMENT}FF`,
                    text: `${COLORS.PRIMARY.STATEMENT}FF`,
                    hover: `${COLORS.PRIMARY.STATEMENT}FF`,
                    gradient: {
                        start: `${COLORS.PRIMARY.STATEMENT}66`,
                        end: `${COLORS.PRIMARY.STATEMENT}33`
                    }
                } as any,
                highlightColor: COLORS.PRIMARY.STATEMENT as any
            };
        } else if (formData.nodeType === 'openquestion') {
            completeStyle = {
                ...baseStyle,
                colors: {
                    background: `${COLORS.PRIMARY.OPEN_QUESTION}33`,
                    border: `${COLORS.PRIMARY.OPEN_QUESTION}FF`,
                    text: `${COLORS.PRIMARY.OPEN_QUESTION}FF`,
                    hover: `${COLORS.PRIMARY.OPEN_QUESTION}FF`,
                    gradient: {
                        start: `${COLORS.PRIMARY.OPEN_QUESTION}66`,
                        end: `${COLORS.PRIMARY.OPEN_QUESTION}33`
                    }
                } as any,
                highlightColor: COLORS.PRIMARY.OPEN_QUESTION as any
            };
        } else if (formData.nodeType === 'quantity') {
            completeStyle = {
                ...baseStyle,
                colors: {
                    background: `${COLORS.PRIMARY.QUANTITY}33`,
                    border: `${COLORS.PRIMARY.QUANTITY}FF`,
                    text: `${COLORS.PRIMARY.QUANTITY}FF`,
                    hover: `${COLORS.PRIMARY.QUANTITY}FF`,
                    gradient: {
                        start: `${COLORS.PRIMARY.QUANTITY}66`,
                        end: `${COLORS.PRIMARY.QUANTITY}33`
                    }
                } as any,
                highlightColor: COLORS.PRIMARY.QUANTITY as any
            };
        } else if (formData.nodeType === 'answer') {
            completeStyle = {
                ...baseStyle,
                colors: {
                    background: `${COLORS.PRIMARY.ANSWER}33`,
                    border: `${COLORS.PRIMARY.ANSWER}FF`,
                    text: `${COLORS.PRIMARY.ANSWER}FF`,
                    hover: `${COLORS.PRIMARY.ANSWER}FF`,
                    gradient: {
                        start: `${COLORS.PRIMARY.ANSWER}66`,
                        end: `${COLORS.PRIMARY.ANSWER}33`
                    }
                } as any,
                highlightColor: COLORS.PRIMARY.ANSWER as any
            };
        } else if (formData.nodeType === 'evidence') {
            completeStyle = {
                ...baseStyle,
                colors: {
                    background: `${COLORS.PRIMARY.EVIDENCE}33`,
                    border: `${COLORS.PRIMARY.EVIDENCE}FF`,
                    text: `${COLORS.PRIMARY.EVIDENCE}FF`,
                    hover: `${COLORS.PRIMARY.EVIDENCE}FF`,
                    gradient: {
                        start: `${COLORS.PRIMARY.EVIDENCE}66`,
                        end: `${COLORS.PRIMARY.EVIDENCE}33`
                    }
                } as any,
                highlightColor: COLORS.PRIMARY.EVIDENCE as any
            };
        } else if (formData.nodeType === 'category') {
            completeStyle = {
                ...baseStyle,
                colors: {
                    background: `${COLORS.PRIMARY.CATEGORY}33`,
                    border: `${COLORS.PRIMARY.CATEGORY}FF`,
                    text: `${COLORS.PRIMARY.CATEGORY}FF`,
                    hover: `${COLORS.PRIMARY.CATEGORY}FF`,
                    gradient: {
                        start: `${COLORS.PRIMARY.CATEGORY}66`,
                        end: `${COLORS.PRIMARY.CATEGORY}33`
                    }
                } as any,
                highlightColor: COLORS.PRIMARY.CATEGORY as any
            };
        } else {
            // Default to word colors when no type selected
            completeStyle = {
                ...baseStyle,
                colors: NODE_CONSTANTS.COLORS.WORD,
                highlightColor: COLORS.PRIMARY.WORD
            };
        }
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
                     currentStep === 3 ? 'Add Categories' :
                     currentStep === 4 ? 'Add Keywords' :
                     currentStep === 5 ? 'Start Discussion' :
                     'Review Creation') :
                  formData.nodeType === 'openquestion' ?
                    (currentStep === 2 ? 'Enter Question' :
                     currentStep === 3 ? 'Add Categories' :
                     currentStep === 4 ? 'Add Keywords' :
                     currentStep === 5 ? 'Start Discussion' :
                     'Review Creation') :
                  formData.nodeType === 'quantity' ?
                    (currentStep === 2 ? 'Choose Unit Category' :
                     currentStep === 3 ? 'Enter Value' :
                     currentStep === 4 ? 'Add Categories' :
                     currentStep === 5 ? 'Add Keywords' :
                     currentStep === 6 ? 'Start Discussion' :
                     'Review Creation') :
                  formData.nodeType === 'answer' ?
                    (currentStep === 2 ? 'Enter Answer' :
                     currentStep === 3 ? 'Add Categories' :
                     currentStep === 4 ? 'Add Keywords' :
                     currentStep === 5 ? 'Start Discussion' :
                     'Review Creation') :
                  formData.nodeType === 'evidence' ?
                    (currentStep === 2 ? 'Evidence Details' :
                     currentStep === 3 ? 'Add Categories' :
                     currentStep === 4 ? 'Add Keywords' :
                     currentStep === 5 ? 'Start Discussion' :
                     'Review Creation') :
                  formData.nodeType === 'category' ?
                    (currentStep === 2 ? 'Select Words' :
                     currentStep === 3 ? 'Start Discussion' :
                     'Review Creation') :
                  'Create New Node';

    // Show step indicators for multi-step flows
    $: showStepIndicators = formData.nodeType !== '' && maxSteps > 1;

    // Current step can vary by node type
    $: currentStep = Math.min(currentStep, 
                              formData.nodeType === 'quantity' ? 7 : 
                              formData.nodeType === 'word' || formData.nodeType === 'statement' || 
                              formData.nodeType === 'openquestion' || formData.nodeType === 'answer' || 
                              formData.nodeType === 'evidence' ? 6 : 
                              formData.nodeType === 'category' ? 4 :
                              1);

    // Max steps based on node type
    $: maxSteps = formData.nodeType === 'word' ? 5 :
                 formData.nodeType === 'statement' || formData.nodeType === 'openquestion' || formData.nodeType === 'answer' || formData.nodeType === 'evidence' ? 6 : 
                 formData.nodeType === 'quantity' ? 7 :
                 formData.nodeType === 'category' ? 4 : 1;

    // Get node radius for button positioning
    $: nodeRadius = node.radius || (COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL / 2);

    // Next button state - ALWAYS show on step 1, just disabled when no type selected
    $: showNextButton = currentStep === 1;
    $: isNextButtonDisabled = formData.nodeType === '';
    $: nextButtonColor = formData.nodeType ? completeStyle.highlightColor : 'rgba(255, 255, 255, 0.3)';
    $: nextTooltipText = formData.nodeType ? 'Next Step' : 'Select Type First';
    
    // Unique filter ID for glow
    const nextGlowFilterId = `next-glow-${Math.random().toString(36).slice(2)}`;

    function handleBack() {
        if (currentStep > 1) {
            currentStep--;
            errorMessage = null;
        }
    }

    function handleNext() {
        if (isNextButtonDisabled) {
            console.log('[CreateNodeNode] Button click ignored - no type selected');
            return;
        }
        if (currentStep < maxSteps) {
            currentStep++;
            errorMessage = null;
        }
    }

    function handleNextKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleNext();
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
            answerText: '',
            selectedWordIds: [],
            parentCategoryId: null,
            userKeywords: [],
            selectedCategories: [],
            discussion: '',
            publicCredit: false
        };
    }
</script>

<BaseDetailNode 
    {node} 
    style={completeStyle}
    on:modeChange={handleModeChange}
>
    <svelte:fragment slot="title" let:radius>
        <NodeHeader title={stepTitle} {radius} mode="detail" />
    </svelte:fragment>

    <!-- FIXED: Proper ContentBox positioning - content centered in node -->
    <svelte:fragment slot="contentText" let:x let:y let:width let:height let:positioning>
        <!-- Error/Success Messages -->
        {#if errorMessage || successMessage}
            <foreignObject
                {x}
                {y}
                {width}
                height="50"
            >
                <div style="width: 100%; height: 100%;">
                    <MessageDisplay {errorMessage} {successMessage} />
                </div>
            </foreignObject>
        {/if}

        <!-- Dynamic Form Content -->
        <!-- ================================================================ -->
        <!-- COORDINATE SYSTEM ARCHITECTURE (SINGLE SOURCE OF TRUTH):        -->
        <!--                                                                  -->
        <!-- 1. ContentBox provides: x, y, width, height, positioning        -->
        <!--    - For contentText: x=left edge (after padding), y=center     -->
        <!--    - For voting sections: x=left edge, y=top of section         -->
        <!--                                                                  -->
        <!-- 2. This SVG positioned at (x, formY) - absolute coordinates     -->
        <!--                                                                  -->
        <!-- 3. <g translate({width/2}, 0)> for horizontal centering         -->
        <!--    (This centers text horizontally via text-anchor="middle")    -->
        <!--                                                                  -->
        <!-- 4. ContentText section Y positioning is CENTER-ORIGIN:          -->
        <!--    - Y: 0 = CENTER, negative = UP, positive = DOWN              -->
        <!--    - X: Standard left-to-right (unchanged)                      -->
        <!--                                                                  -->
        <!-- 5. Child components calculate Y positions as:                   -->
        <!--    y = height * positioning.element (where 0 = center)          -->
        <!--                                                                  -->
        <!-- 6. To adjust positioning: ONLY edit ContentBox                  -->
        <!--    POSITIONING_CONFIGS['create-node'] - nowhere else!           -->
        <!-- ================================================================ -->
        {@const formY = y + (errorMessage || successMessage ? 60 : 0)}
        {@const formHeight = height - (errorMessage || successMessage ? 60 : 0)}
        
        <svg {x} y={formY} {width} height={formHeight}>
            <!-- Horizontal centering for text-anchor="middle" to work -->
            <g transform="translate({width/2}, 0)">
                {#if currentStep === 1}
                    <NodeTypeSelect
                        nodeType={formData.nodeType}
                        {positioning}
                        width={width}
                        height={formHeight}
                        on:typeChange={handleNodeTypeChange}
                        on:proceed={handleNext}
                    />
                {:else if formData.nodeType === 'word'}
                    {#if currentStep === 2}
                        <WordInput
                            bind:word={formData.word}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
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
                    {#if currentStep === 2}
                        <StatementInput
                            bind:statement={formData.statement}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 3}
                        <CategoryInput
                            bind:selectedCategories={formData.selectedCategories}
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
                        <StatementReview
                            statement={formData.statement}
                            userKeywords={formData.userKeywords}
                            selectedCategories={formData.selectedCategories}
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
                    {#if currentStep === 2}
                        <OpenQuestionInput
                            bind:questionText={formData.questionText}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 3}
                        <CategoryInput
                            bind:selectedCategories={formData.selectedCategories}
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
                        <OpenQuestionReview
                            questionText={formData.questionText}
                            userKeywords={formData.userKeywords}
                            selectedCategories={formData.selectedCategories}
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
                    {#if currentStep === 2}
                        <UnitCategorySelect
                            bind:unitCategoryId={formData.unitCategoryId}
                            bind:defaultUnitId={formData.defaultUnitId}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 3}
                        <QuantityInput
                            bind:question={formData.question}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 4}
                        <CategoryInput
                            bind:selectedCategories={formData.selectedCategories}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 5}
                        <KeywordInput
                            bind:userKeywords={formData.userKeywords}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 6}
                        <DiscussionInput
                            bind:discussion={formData.discussion}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 7}
                        <QuantityReview
                            question={formData.question}
                            unitCategoryId={formData.unitCategoryId}
                            defaultUnitId={formData.defaultUnitId}
                            userKeywords={formData.userKeywords}
                            selectedCategories={formData.selectedCategories}
                            discussion={formData.discussion}
                            publicCredit={formData.publicCredit}
                            userId={userData.sub}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:success={e => successMessage = e.detail.message}
                            on:error={e => errorMessage = e.detail.message}
                        />
                    {/if}
                {:else if formData.nodeType === 'answer'}
                    {#if currentStep === 2}
                        <AnswerInput
                            bind:answerText={formData.answerText}
                            questionText="[Question text will be provided when answer creation is triggered from a question]"
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 3}
                        <CategoryInput
                            bind:selectedCategories={formData.selectedCategories}
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
                        <AnswerReview
                            answerText={formData.answerText}
                            questionId="[Will be provided when answer creation is triggered from a question]"
                            questionText="[Question text will be provided when answer creation is triggered from a question]"
                            userKeywords={formData.userKeywords}
                            selectedCategories={formData.selectedCategories}
                            discussion={formData.discussion}
                            publicCredit={formData.publicCredit}
                            userId={userData.sub}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:success={e => successMessage = e.detail.message}
                            on:error={e => errorMessage = e.detail.message}
                        />
                    {/if}
                {:else if formData.nodeType === 'evidence'}
                    {#if currentStep === 2}
                        <EvidenceInput
                            bind:title={formData.evidenceTitle}
                            bind:url={formData.evidenceUrl}
                            bind:evidenceType={formData.evidenceType}
                            parentNodeText={formData.parentNodeType ? "[Parent node text will be provided when evidence creation is triggered from a node]" : ""}
                            parentNodeType={formData.parentNodeType || ""}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 3}
                        <CategoryInput
                            bind:selectedCategories={formData.selectedCategories}
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
                        <EvidenceReview
                            title={formData.evidenceTitle}
                            url={formData.evidenceUrl}
                            evidenceType={formData.evidenceType}
                            parentNodeId={formData.parentNodeId}
                            parentNodeType={formData.parentNodeType}
                            parentNodeText="[Parent node text will be provided when evidence creation is triggered from a node]"
                            userKeywords={formData.userKeywords}
                            selectedCategories={formData.selectedCategories}
                            discussion={formData.discussion}
                            publicCredit={formData.publicCredit}
                            userId={userData.sub}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:success={e => successMessage = e.detail.message}
                            on:error={e => errorMessage = e.detail.message}
                        />
                    {/if}
                {:else if formData.nodeType === 'category'}
                    {#if currentStep === 2}
                        <CategoryCreationInput
                            bind:selectedWordIds={formData.selectedWordIds}
                            bind:parentCategoryId={formData.parentCategoryId}
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
                        <CategoryCreationReview
                            selectedWordIds={formData.selectedWordIds}
                            parentCategoryId={formData.parentCategoryId}
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
        </svg>

        <!-- Step Indicators - positioned just above the next button -->
        {#if showStepIndicators}
            <g transform="translate(0, {nodeRadius - 75})">
                {#each Array(maxSteps) as _, i}
                    <circle
                        cx={-(maxSteps - 1) * 10 + (i * 20)}
                        cy="0"
                        r="4"
                        class="step-indicator"
                        class:active={currentStep >= i + 1}
                    />
                {/each}
            </g>
        {/if}

        <!-- Next Step Button (positioned at bottom like Control Node's Apply button) -->
        <!-- Button is OUTSIDE the translated SVG wrapper to use node-centered coordinates -->
        {#if showNextButton}
            <!-- Filter definitions -->
            <defs>
                <filter id={nextGlowFilterId} x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="blur1"/>
                    <feFlood flood-color={nextButtonColor} flood-opacity="0.6" result="color1"/>
                    <feComposite in="color1" in2="blur1" operator="in" result="shadow1"/>
                    
                    <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="blur2"/>
                    <feFlood flood-color={nextButtonColor} flood-opacity="0.8" result="color2"/>
                    <feComposite in="color2" in2="blur2" operator="in" result="shadow2"/>
                    
                    <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur3"/>
                    <feFlood flood-color={nextButtonColor} flood-opacity="1" result="color3"/>
                    <feComposite in="color3" in2="blur3" operator="in" result="shadow3"/>
                    
                    <feMerge>
                        <feMergeNode in="shadow1"/>
                        <feMergeNode in="shadow2"/>
                        <feMergeNode in="shadow3"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>

            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <!-- svelte-ignore a11y-mouse-events-have-key-events -->
            <circle
                cx={0}
                cy={nodeRadius - 40}
                r={30}
                fill="transparent"
                class="next-button-detection"
                class:disabled={isNextButtonDisabled}
                on:mouseenter={() => !isNextButtonDisabled && (isNextButtonHovering = true)}
                on:mouseleave={() => isNextButtonHovering = false}
                on:click={handleNext}
                on:keydown={handleNextKeydown}
                tabindex="0"
                role="button"
                aria-label={nextTooltipText}
                aria-pressed="false"
                style="cursor: {isNextButtonDisabled ? 'not-allowed' : 'pointer'};"
            />

            <g style:filter={isNextButtonHovering && !isNextButtonDisabled ? `url(#${nextGlowFilterId})` : 'none'}>
                <foreignObject 
                    x={-20}
                    y={nodeRadius - 60}
                    width={40}
                    height={40}
                    class="next-icon-container"
                >
                    <div class="next-icon-wrapper" {...{"xmlns": "http://www.w3.org/1999/xhtml"}}>
                        <span 
                            class="material-symbols-outlined next-icon"
                            class:hovered={isNextButtonHovering && !isNextButtonDisabled}
                            class:disabled={isNextButtonDisabled}
                            style:color={nextButtonColor}
                        >
                            arrow_circle_right
                        </span>
                    </div>
                </foreignObject>
            </g>

            <!-- Tooltip -->
            {#if isNextButtonHovering}
                <g transform="translate(0, {nodeRadius + 10})">
                    <rect
                        x={-50}
                        y={-10}
                        width="100"
                        height="20"
                        rx="4"
                        fill="rgba(0, 0, 0, 0.9)"
                        class="next-tooltip-background"
                    />
                    <text
                        x={0}
                        y={3}
                        text-anchor="middle"
                        dominant-baseline="middle"
                        fill="white"
                        font-size="11"
                        font-weight="500"
                        font-family="Inter, system-ui, sans-serif"
                        class="next-tooltip-text"
                    >
                        {nextTooltipText}
                    </text>
                </g>
            {/if}
        {/if}
    </svelte:fragment>
</BaseDetailNode>

<style>
    .step-indicator {
        fill: rgba(255, 255, 255, 0.2);
        transition: all 0.3s ease;
    }

    .step-indicator.active {
        fill: rgba(255, 255, 255, 0.8);
    }

    /* Next button styles (positioned at bottom) */
    .next-button-detection {
        transition: all 0.2s ease;
        outline: none;
    }

    .next-button-detection:focus {
        outline: 2px solid rgba(255, 255, 255, 0.3);
        outline-offset: 4px;
    }
    
    .next-button-detection.disabled {
        cursor: not-allowed !important;
    }

    .next-icon-container {
        overflow: visible;
        pointer-events: none;
    }

    .next-icon-wrapper {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
    }

    :global(.material-symbols-outlined.next-icon) {
        font-size: 32px;
        transition: all 0.3s ease;
        font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 48;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    :global(.material-symbols-outlined.next-icon.hovered) {
        font-size: 36px;
        font-variation-settings: 'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 48;
    }
    
    :global(.material-symbols-outlined.next-icon.disabled) {
        opacity: 0.3;
    }

    .next-tooltip-background {
        filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4));
        pointer-events: none;
    }

    .next-tooltip-text {
        pointer-events: none;
        user-select: none;
        letter-spacing: 0.02em;
    }
</style>