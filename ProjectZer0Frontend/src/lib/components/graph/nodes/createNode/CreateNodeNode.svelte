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

    let colorIndex = 0;
    let intervalId: NodeJS.Timeout | undefined;
    
    // Create a base style object that we'll modify
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
    
    let currentStyle = { ...baseStyle };
    let completeStyle = { ...baseStyle };

    $: if (formData.nodeType === '') {
        if (!intervalId) {
            const colors = [
                {
                    base: COLORS.PRIMARY.WORD,
                    full: `${COLORS.PRIMARY.WORD}FF`,
                    semi: `${COLORS.PRIMARY.WORD}66`,
                    light: `${COLORS.PRIMARY.WORD}33`
                },
                {
                    base: COLORS.PRIMARY.DEFINITION,
                    full: `${COLORS.PRIMARY.DEFINITION}FF`,
                    semi: `${COLORS.PRIMARY.DEFINITION}66`,
                    light: `${COLORS.PRIMARY.DEFINITION}33`
                },
                {
                    base: COLORS.PRIMARY.STATEMENT,
                    full: `${COLORS.PRIMARY.STATEMENT}FF`,
                    semi: `${COLORS.PRIMARY.STATEMENT}66`,
                    light: `${COLORS.PRIMARY.STATEMENT}33`
                },
                {
                    base: COLORS.PRIMARY.OPEN_QUESTION,
                    full: `${COLORS.PRIMARY.OPEN_QUESTION}FF`,
                    semi: `${COLORS.PRIMARY.OPEN_QUESTION}66`,
                    light: `${COLORS.PRIMARY.OPEN_QUESTION}33`
                },
                {
                    base: COLORS.PRIMARY.ANSWER,
                    full: `${COLORS.PRIMARY.ANSWER}FF`,
                    semi: `${COLORS.PRIMARY.ANSWER}66`,
                    light: `${COLORS.PRIMARY.ANSWER}33`
                },
                {
                    base: COLORS.PRIMARY.QUANTITY,
                    full: `${COLORS.PRIMARY.QUANTITY}FF`,
                    semi: `${COLORS.PRIMARY.QUANTITY}66`,
                    light: `${COLORS.PRIMARY.QUANTITY}33`
                },
                {
                    base: COLORS.PRIMARY.EVIDENCE,
                    full: `${COLORS.PRIMARY.EVIDENCE}FF`,
                    semi: `${COLORS.PRIMARY.EVIDENCE}66`,
                    light: `${COLORS.PRIMARY.EVIDENCE}33`
                },
                {
                    base: COLORS.PRIMARY.CATEGORY,
                    full: `${COLORS.PRIMARY.CATEGORY}FF`,
                    semi: `${COLORS.PRIMARY.CATEGORY}66`,
                    light: `${COLORS.PRIMARY.CATEGORY}33`
                },
                {
                    base: COLORS.PRIMARY.COMMENT,
                    full: `${COLORS.PRIMARY.COMMENT}FF`,
                    semi: `${COLORS.PRIMARY.COMMENT}66`,
                    light: `${COLORS.PRIMARY.COMMENT}33`
                }
            ];
            
            intervalId = setInterval(() => {
                colorIndex = (colorIndex + 1) % colors.length;
                
                const newStyle = { ...baseStyle };
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
                
                newStyle.highlightColor = colors[colorIndex].base as typeof COLORS.PRIMARY.WORD;
                
                currentStyle = newStyle;
                
                if (formData.nodeType === '') {
                    completeStyle = newStyle;
                }
            }, 2000);
        }
    } else {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = undefined;
        }
    }

    // Set appropriate style based on node type
    $: if (formData.nodeType === 'word') {
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
    } else if (formData.nodeType !== '') {
        completeStyle = { ...currentStyle };
    } else {
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
                    (currentStep === 2 ? 'Enter Question' :
                     currentStep === 3 ? 'Select Unit' :
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
                    (currentStep === 2 ? 'Enter Evidence' :
                     currentStep === 3 ? 'Add Categories' :
                     currentStep === 4 ? 'Add Keywords' :
                     currentStep === 5 ? 'Start Discussion' :
                     'Review Creation') :
                  formData.nodeType === 'category' ?
                    (currentStep === 2 ? 'Select Words' :
                     currentStep === 3 ? 'Start Discussion' :
                     'Review Creation') :
                  'Create New Node';

    $: showStepIndicators = currentStep < (formData.nodeType === 'quantity' ? 7 : 
                                          formData.nodeType === 'statement' || formData.nodeType === 'openquestion' || formData.nodeType === 'answer' || formData.nodeType === 'evidence' ? 6 : 
                                          formData.nodeType === 'word' ? 5 :
                                          formData.nodeType === 'category' ? 4 :
                                          1);

    // Max steps based on node type
    $: maxSteps = formData.nodeType === 'word' ? 5 :
                 formData.nodeType === 'statement' || formData.nodeType === 'openquestion' || formData.nodeType === 'answer' || formData.nodeType === 'evidence' ? 6 : 
                 formData.nodeType === 'quantity' ? 7 :
                 formData.nodeType === 'category' ? 4 : 1;

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
            answerText: '',
            selectedWordIds: [],
            parentCategoryId: null,
            userKeywords: [],
            selectedCategories: [],
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
        <g transform="translate(0, {-radius + (currentStep === maxSteps ? 100 : 120)})">
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
                    {#each Array(maxSteps) as _, i}
                        <circle
                            cx={-60 + (i * 20)}
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
                    <!-- Word node creation flow (4 steps after type) -->
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
                    <!-- Statement node creation flow (5 steps after type) -->
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
                    <!-- OpenQuestion node creation flow (5 steps after type) -->
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
                    <!-- Quantity node creation flow (6 steps after type) -->
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
                    <!-- Answer node creation flow (5 steps after type) -->
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
                    <!-- Evidence node creation flow (5 steps after type) -->
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
                    <!-- Category node creation flow (3 steps after type) -->
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

    :global(foreignObject) {
        overflow: visible !important;
    }

    :global(.button-wrapper) {
        padding-top: 4px;
        padding-bottom: 4px;
        height: auto !important;
        min-height: 45px;
    }

    :global(.action-button) {
        margin-bottom: 5px;
        position: relative;
        z-index: 5;
    }
</style>