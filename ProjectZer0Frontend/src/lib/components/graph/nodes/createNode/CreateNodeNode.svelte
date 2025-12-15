<!-- src/lib/components/graph/nodes/createNode/CreateNodeNode.svelte -->
<!-- UPDATED: Added expandCategory event handling for category creation flow -->
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
    import DefinitionInput from '$lib/components/forms/createNode/definition/DefinitionInput.svelte';
    import DefinitionReview from '$lib/components/forms/createNode/definition/DefinitionReview.svelte';
    import DiscussionInput from '$lib/components/forms/createNode/shared/DiscussionInput.svelte';
    import WordReview from '$lib/components/forms/createNode/word/WordReview.svelte';
    import MessageDisplay from '$lib/components/forms/createNode/shared/MessageDisplay.svelte';
    import { fetchWithAuth } from '$lib/services/api';
    
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
    // import EvidenceInput from '$lib/components/forms/evidence/EvidenceInput.svelte';
    // import EvidenceReview from '$lib/components/forms/evidence/EvidenceReview.svelte';
    
    // Category related imports
    import CategoryCreationInput from '$lib/components/forms/createNode/category/CategoryCreationInput.svelte';
    import CategoryCreationReview from '$lib/components/forms/createNode/category/CategoryCreationReview.svelte';

    // Shared imports
    import KeywordInput from '$lib/components/forms/createNode/shared/KeywordInput.svelte';
    import CategoryInput from '$lib/components/forms/createNode/shared/CategoryInput.svelte';
	import EvidenceInput from '$lib/components/forms/createNode/evidence/EvidenceInput.svelte';
	import EvidenceReview from '$lib/components/forms/createNode/evidence/EvidenceReview.svelte';

    export let node: RenderableNode;
    
    if (!isUserProfileData(node.data)) {
        throw new Error('Invalid node data type for CreateNodeNode');
    }
    
    const userData = node.data;

    // Extract contextual config if present in node metadata
    let contextualConfig: {
        nodeType?: string;
        parentNodeId?: string;
        parentNodeType?: string;
        parentDisplayText?: string;
        parentPosition?: { x: number; y: number };
    } | null = null;

    $: if ((node.metadata as any)?.contextualConfig) {
        contextualConfig = (node.metadata as any).contextualConfig;
        console.log('[CreateNodeNode] Contextual config detected:', contextualConfig);
        
        // Pre-set node type if provided
        if (contextualConfig?.nodeType && !formData.nodeType) {
            formData.nodeType = contextualConfig.nodeType;
            console.log('[CreateNodeNode] Node type pre-set to:', formData.nodeType);
        }
    }

    const dispatch = createEventDispatcher<{
        modeChange: { mode: NodeMode };
        expandWord: { 
            word: string;
            sourceNodeId: string;
            sourcePosition: { x: number; y: number };
        };
       expandCategory: {
            categoryId: string;
            categoryName: string;
            sourceNodeId: string;
            sourcePosition: { x: number; y: number };
        };
        expandStatement: {
            statementId: string;
            sourceNodeId: string;
            sourcePosition: { x: number; y: number };
        };
        expandOpenQuestion: {
            questionId: string;
            sourceNodeId: string;
            sourcePosition: { x: number; y: number };
        };
        expandQuantity: {
            quantityId: string;
            sourceNodeId: string;
            sourcePosition: { x: number; y: number };
        };
        expandAnswer: {
            answerId: string;
            sourceNodeId: string;
            sourcePosition: { x: number; y: number };
        };
        expandDefinition: {
            definitionId: string;
            sourceNodeId: string;
            sourcePosition: { x: number; y: number };
        };
    }>();
    
    function handleModeChange(event: CustomEvent<{ mode: NodeMode }>) {
        dispatch('modeChange', event.detail);
    }
    
    function handleWordCreated(event: CustomEvent<{ word: string }>) {
        console.log('[CreateNodeNode] Word created event received:', event.detail);
        
        dispatch('expandWord', {
            word: event.detail.word,
            sourceNodeId: node.id,
            sourcePosition: {
                x: node.position?.x || 0,
                y: node.position?.y || 0
            }
        });
    }
    
   function handleCategoryCreated(event: CustomEvent<{ 
        categoryId: string; 
        categoryName: string;
    }>) {
        console.log('[CreateNodeNode] Forwarding category with source context');
        dispatch('expandCategory', {
            categoryId: event.detail.categoryId,
            categoryName: event.detail.categoryName,
            sourceNodeId: node.id,
            sourcePosition: {
                x: node.position?.x || 0,
                y: node.position?.y || 0
            }
        });
    }
    
    function handleStatementCreated(event: CustomEvent<{ statementId: string }>) {
        console.log('[CreateNodeNode] Statement created, forwarding with source context');
        dispatch('expandStatement', {
            statementId: event.detail.statementId,
            sourceNodeId: node.id,
            sourcePosition: {
                x: node.position?.x || 0,
                y: node.position?.y || 0
            }
        });
    }

    function handleOpenQuestionCreated(event: CustomEvent<{ questionId: string }>) {
        console.log('[CreateNodeNode] OpenQuestion created, forwarding with source context:', {
            questionId: event.detail.questionId,
            nodeId: node.id,
            position: node.position
        });
        
        dispatch('expandOpenQuestion', {
            questionId: event.detail.questionId,
            sourceNodeId: node.id,
            sourcePosition: {
                x: node.position?.x || 0,
                y: node.position?.y || 0
            }
        });
        
        console.log('[CreateNodeNode] expandOpenQuestion event dispatched to parent');
    }

    function handleQuantityCreated(event: CustomEvent<{ quantityId: string }>) {
        console.log('[CreateNodeNode] Quantity created, forwarding with source context:', {
            quantityId: event.detail.quantityId,
            nodeId: node.id,
            position: node.position
        });
        
        dispatch('expandQuantity', {
            quantityId: event.detail.quantityId,
            sourceNodeId: node.id,
            sourcePosition: {
                x: node.position?.x || 0,
                y: node.position?.y || 0
            }
        });
        
        console.log('[CreateNodeNode] expandQuantity event dispatched to parent');
    }

    function handleAnswerCreated(event: CustomEvent<{ answerId: string }>) {
        console.log('[CreateNodeNode] Answer created, forwarding with source context:', {
            answerId: event.detail.answerId,
            nodeId: node.id,
            position: node.position
        });
        
        dispatch('expandAnswer', {
            answerId: event.detail.answerId,
            sourceNodeId: node.id,
            sourcePosition: {
                x: node.position?.x || 0,
                y: node.position?.y || 0
            }
        });
        
        console.log('[CreateNodeNode] expandAnswer event dispatched to parent');
    }

    function handleDefinitionCreated(event: CustomEvent<{ definitionId: string }>) {
        console.log('[CreateNodeNode] Definition created, forwarding with source context');
        dispatch('expandDefinition', {
            definitionId: event.detail.definitionId,
            sourceNodeId: node.id,
            sourcePosition: {
                x: node.position?.x || 0,
                y: node.position?.y || 0
            }
        });
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
    let isCheckingWord = false;
    
    let wordReviewComponent: any;
    let categoryReviewComponent: any;
    let statementReviewComponent: any;
    let openQuestionReviewComponent: any;
    let quantityReviewComponent: any;
    let evidenceReviewComponent: any;
    let answerReviewComponent: any;
    let definitionReviewComponent: any;
    
    const isUniversalCentralNode = node.id?.endsWith('-central') || false;
    
    let enableColorCycling = false;
    let hasGraphSettled = false;
    
    let isNextButtonHovering = false;
    let isPreviousButtonHovering = false;
    
    onMount(() => {
        if (isUniversalCentralNode) {
            console.log('[CreateNodeNode] Universal central node detected - waiting for settlement');
            
            const handleSettlement = () => {
                hasGraphSettled = true;
                console.log('[CreateNodeNode] Graph settled - color cycling can begin');
            };
            
            window.addEventListener('opacity-reveal-complete', handleSettlement);
            window.addEventListener('link-reveal-complete', handleSettlement);
            
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
    
    $: enableColorCycling = isUniversalCentralNode && hasGraphSettled && formData.nodeType === '';
    
    $: if (enableColorCycling) {
        console.log('[CreateNodeNode] âœ¨ Color cycling enabled - applying animation');
        setTimeout(() => {
            applyColorCycling(true);
        }, 100);
    } else if (!enableColorCycling && typeof window !== 'undefined') {
        console.log('[CreateNodeNode] Color cycling disabled - removing animation');
        applyColorCycling(false);
    }
    
    function applyColorCycling(enable: boolean) {
        if (typeof window === 'undefined') return;
        
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
        } else if (formData.nodeType === 'definition') {
            completeStyle = {
                ...baseStyle,
                colors: {
                    background: `${COLORS.PRIMARY.DEFINITION}33`,
                    border: `${COLORS.PRIMARY.DEFINITION}FF`,
                    text: `${COLORS.PRIMARY.DEFINITION}FF`,
                    hover: `${COLORS.PRIMARY.DEFINITION}FF`,
                    gradient: {
                        start: `${COLORS.PRIMARY.DEFINITION}66`,
                        end: `${COLORS.PRIMARY.DEFINITION}33`
                    }
                } as any,
                highlightColor: COLORS.PRIMARY.DEFINITION as any
            };
        } else {
            completeStyle = {
                ...baseStyle,
                colors: NODE_CONSTANTS.COLORS.WORD,
                highlightColor: COLORS.PRIMARY.WORD
            };
        }
    }

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
                  formData.nodeType === 'definition' ?
                    (currentStep === 2 ? 'Enter Definition' :
                     currentStep === 3 ? 'Start Discussion' :
                     'Review Creation') :
                  'Create New Node';
                  

    $: showStepIndicators = formData.nodeType !== '' && maxSteps > 1;

    $: currentStep = Math.min(currentStep, 
                              formData.nodeType === 'quantity' ? 7 : 
                              formData.nodeType === 'word' || formData.nodeType === 'statement' || 
                              formData.nodeType === 'openquestion' || formData.nodeType === 'answer' || 
                              formData.nodeType === 'evidence' ? 6 : 
                              formData.nodeType === 'category' || formData.nodeType === 'definition' ? 4 :
                              1);

    $: maxSteps = formData.nodeType === 'word' ? 5 :
                 formData.nodeType === 'statement' || formData.nodeType === 'openquestion' || formData.nodeType === 'answer' || formData.nodeType === 'evidence' ? 6 : 
                 formData.nodeType === 'quantity' ? 7 :
                 formData.nodeType === 'category' || formData.nodeType === 'definition' ? 4 : 1;

    // Skip type selection if contextual config provides node type
    $: if (contextualConfig?.nodeType && formData.nodeType && currentStep === 1) {
        console.log('[CreateNodeNode] Skipping type selection, going to step 2');
        currentStep = 2;
    }             

    $: nodeRadius = node.radius || (COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL / 2);

    $: isFinalStep = currentStep === maxSteps;
    $: showActionButton = currentStep >= 1 && formData.nodeType !== '';
    $: isNextButtonDisabled = 
        (currentStep === 1 && formData.nodeType === '') ||
        (currentStep === 2 && formData.nodeType === 'word' && (!formData.word.trim() || isCheckingWord)) ||
        (currentStep === 2 && formData.nodeType === 'category' && formData.selectedWordIds.length === 0);
    $: nextButtonColor = !isNextButtonDisabled ? completeStyle.highlightColor : 'rgba(255, 255, 255, 0.3)';
    $: nextButtonIcon = isFinalStep ? 'add_circle' : 'arrow_circle_right';
    $: nextTooltipText = 
        isFinalStep ? 'Create Node' :
        isCheckingWord ? 'Checking word...' :
        (currentStep === 1 && !formData.nodeType) ? 'Select Type First' :
        (currentStep === 2 && formData.nodeType === 'word' && !formData.word.trim()) ? 'Enter Word First' :
        (currentStep === 2 && formData.nodeType === 'category' && formData.selectedWordIds.length === 0) ? 'Select Words First' :
        'Next Step';
    
    $: showPreviousButton = currentStep > 1;
    $: previousButtonColor = completeStyle.highlightColor;
    $: previousTooltipText = 'Previous Step';
    
    const nextGlowFilterId = `next-glow-${Math.random().toString(36).slice(2)}`;
    const previousGlowFilterId = `previous-glow-${Math.random().toString(36).slice(2)}`;

    function handleBack() {
        if (currentStep > 1) {
            currentStep--;
            errorMessage = null;
        }
    }

    async function checkWordAndProceed() {
        if (!formData.word.trim()) {
            errorMessage = 'Please enter a word';
            return;
        }

        isCheckingWord = true;
        errorMessage = null;
        successMessage = null;
        
        try {
            console.log('[CreateNodeNode] Checking word existence:', formData.word.trim());
            
            const response = await fetchWithAuth(`/words/${encodeURIComponent(formData.word.trim())}/with-definitions`);
            
            if (response && response.nodes && response.nodes.length > 0) {
                successMessage = `Word "${formData.word.trim()}" already exists. Loading word node...`;
                
                console.log('[CreateNodeNode] Word exists, dispatching expandWord event');
                
                dispatch('expandWord', {
                    word: formData.word.trim(),
                    sourceNodeId: node.id,
                    sourcePosition: {
                        x: node.position?.x || 0,
                        y: node.position?.y || 0
                    }
                });
                
                return;
            } else {
                console.log('[CreateNodeNode] Word does not exist, proceeding to creation');
                currentStep++;
                errorMessage = null;
            }
        } catch (error) {
            if (error instanceof Error && (error.message.includes('404') || error.message.includes('not found'))) {
                console.log('[CreateNodeNode] Word not found, proceeding to creation');
                currentStep++;
                errorMessage = null;
            } else {
                errorMessage = error instanceof Error ? error.message : 'Failed to check word existence';
                console.error('[CreateNodeNode] Error checking word:', error);
            }
        } finally {
            isCheckingWord = false;
        }
    }

    function handleNext() {
        console.log('[CreateNodeNode] 🔍 DIAGNOSTIC - handleNext called', {
            isNextButtonDisabled,
            isFinalStep,
            currentStep,
            maxSteps,
            nodeType: formData.nodeType,
            hasQuantityComponent: !!quantityReviewComponent,
            questionData: {
                question: formData.question?.substring(0, 50),
                unitCategoryId: formData.unitCategoryId,
                defaultUnitId: formData.defaultUnitId
            }
        });
        
        if (isNextButtonDisabled) {
            console.log('[CreateNodeNode] ❌ Button click ignored - disabled');
            return;
        }
        
        if (isFinalStep) {
            console.log('[CreateNodeNode] ✅ Is final step, checking node type...');
            
            if (formData.nodeType === 'word' && wordReviewComponent) {
                console.log('[CreateNodeNode] 📝 Calling wordReviewComponent.handleSubmit()');
                wordReviewComponent.handleSubmit();
            } else if (formData.nodeType === 'statement' && statementReviewComponent) {
                console.log('[CreateNodeNode] 📝 Calling statementReviewComponent.handleSubmit()');
                statementReviewComponent.handleSubmit();
            } else if (formData.nodeType === 'openquestion' && openQuestionReviewComponent) {
                console.log('[CreateNodeNode] 📝 Calling openQuestionReviewComponent.handleSubmit()');
                openQuestionReviewComponent.handleSubmit();
            } else if (formData.nodeType === 'quantity' && quantityReviewComponent) {
                console.log('[CreateNodeNode] 🎯 Calling quantityReviewComponent.handleSubmit()');
                try {
                    quantityReviewComponent.handleSubmit();
                    console.log('[CreateNodeNode] ✅ handleSubmit call completed (may be async)');
                } catch (error) {
                    console.error('[CreateNodeNode] ❌ Error calling handleSubmit:', error);
                }
            } else if (formData.nodeType === 'answer' && answerReviewComponent) {
                console.log('[CreateNodeNode] 📝 Calling answerReviewComponent.handleSubmit()');
                answerReviewComponent.handleSubmit();
            } else if (formData.nodeType === 'evidence' && evidenceReviewComponent) {
                console.log('[CreateNodeNode] 📝 Calling evidenceReviewComponent.handleSubmit()');
                evidenceReviewComponent.handleSubmit();
            } else if (formData.nodeType === 'definition' && definitionReviewComponent) {
                console.log('[CreateNodeNode] 📝 Calling definitionReviewComponent.handleSubmit()');
                definitionReviewComponent.handleSubmit();
            } else if (formData.nodeType === 'category' && categoryReviewComponent) {
                console.log('[CreateNodeNode] 📝 Calling categoryReviewComponent.handleSubmit()');
                categoryReviewComponent.handleSubmit();
            } else {
                console.error('[CreateNodeNode] ❌ No matching component or component is undefined!', {
                    nodeType: formData.nodeType,
                    availableComponents: {
                        word: !!wordReviewComponent,
                        statement: !!statementReviewComponent,
                        openquestion: !!openQuestionReviewComponent,
                        quantity: !!quantityReviewComponent,
                        answer: !!answerReviewComponent,
                        evidence: !!evidenceReviewComponent,
                        category: !!categoryReviewComponent
                    }
                });
            }
            return;
        }
        
        // Not final step - proceed to next
        console.log('[CreateNodeNode] ⏭️ Not final step, proceeding to next step');
        
        if (currentStep === 2 && formData.nodeType === 'word') {
            checkWordAndProceed();
            return;
        }
        
        if (currentStep < maxSteps) {
            currentStep++;
            errorMessage = null;
            console.log('[CreateNodeNode] ✅ Advanced to step', currentStep);
        }
    }

    function handleNextKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleNext();
        }
    }
    
    function handlePreviousKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleBack();
        }
    }

    function handleNodeTypeChange(event: CustomEvent<{ type: string }>) {
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

    <svelte:fragment slot="contentText" let:x let:y let:width let:height let:positioning>
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

        {@const formY = y + (errorMessage || successMessage ? 60 : 0)}
        {@const formHeight = height - (errorMessage || successMessage ? 60 : 0)}
        
        <svg {x} y={formY} {width} height={formHeight}>
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
                    <AnswerInput
                        bind:answerText={formData.answerText}
                        questionText={contextualConfig?.parentDisplayText || "[Question text will be provided]"}
                        {positioning}
                        {width}
                        height={formHeight}
                        disabled={isLoading}
                        on:back={handleBack}
                        on:proceed={handleNext}
                    />
                   {:else if currentStep === 3}
                        <DefinitionInput
                            bind:definitionText={formData.definitionText}
                            {positioning}
                            {width}
                            height={formHeight}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 4}
                        <DiscussionInput
                            bind:discussion={formData.discussion}
                            {positioning}
                            {width}
                            height={formHeight}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 5}
                    <WordReview
                        bind:this={wordReviewComponent}
                        word={formData.word}
                        definitionText={formData.definitionText}
                        discussion={formData.discussion}
                        publicCredit={formData.publicCredit}
                         
                        {width}              
                        height={formHeight}  
                        disabled={isLoading}
                        on:back={handleBack}
                        on:success={e => successMessage = e.detail.message}
                        on:error={e => errorMessage = e.detail.message}
                        on:expandWord={handleWordCreated}
                    />
                    {/if}
                {:else if formData.nodeType === 'statement'}
                {#if currentStep === 2}
                    <StatementInput
                        bind:statement={formData.statement}
                        {positioning}
                        {width}
                        height={formHeight}
                        disabled={isLoading}
                        on:back={handleBack}
                        on:proceed={handleNext}
                    />
                {:else if currentStep === 3}
                <CategoryInput
                    bind:selectedCategories={formData.selectedCategories}
                    {positioning}        
                    {width}              
                    height={formHeight} 
                    disabled={isLoading}
                    on:back={handleBack}
                    on:proceed={handleNext}
                />
                {:else if currentStep === 4}
                    <KeywordInput
                        bind:userKeywords={formData.userKeywords}
                        {positioning}
                        {width}
                        height={formHeight}
                        disabled={isLoading}
                        on:back={handleBack}
                        on:proceed={handleNext}
                    />
                {:else if currentStep === 5}
                    <DiscussionInput
                        bind:discussion={formData.discussion}
                        {positioning}
                        {width}
                        height={formHeight}
                        disabled={isLoading}
                        on:back={handleBack}
                        on:proceed={handleNext}
                    />
                {:else if currentStep === 6}
                    <StatementReview
                        bind:this={statementReviewComponent}
                        statement={formData.statement}
                        userKeywords={formData.userKeywords}
                        selectedCategories={formData.selectedCategories}
                        discussion={formData.discussion}
                        publicCredit={formData.publicCredit}
                        {width}
                        height={formHeight}
                        on:back={handleBack}
                        on:success={e => successMessage = e.detail.message}
                        on:error={e => errorMessage = e.detail.message}
                        on:expandStatement={handleStatementCreated}
                    />
                {/if}
                {:else if formData.nodeType === 'openquestion'}
                    {#if currentStep === 2}
                        <OpenQuestionInput
                            bind:questionText={formData.questionText}
                            {positioning}
                            {width}
                            height={formHeight}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 3}
                        <CategoryInput
                            bind:selectedCategories={formData.selectedCategories}
                            {positioning}
                            {width}
                            height={formHeight}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 4}
                        <KeywordInput
                            bind:userKeywords={formData.userKeywords}
                            {positioning}
                            {width}
                            height={formHeight}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 5}
                        <DiscussionInput
                            bind:discussion={formData.discussion}
                            {positioning}
                            {width}
                            height={formHeight}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 6}
                        <OpenQuestionReview
                            bind:this={openQuestionReviewComponent}
                            questionText={formData.questionText}
                            userKeywords={formData.userKeywords}
                            selectedCategories={formData.selectedCategories}
                            discussion={formData.discussion}
                            publicCredit={formData.publicCredit}
                            userId={userData.sub}
                            on:back={handleBack}
                            on:success={e => successMessage = e.detail.message}
                            on:error={e => errorMessage = e.detail.message}
                            on:expandOpenQuestion={handleOpenQuestionCreated}
                        />
                    {/if}
                {:else if formData.nodeType === 'quantity'}
                    {#if currentStep === 2}
                        <UnitCategorySelect
                            bind:unitCategoryId={formData.unitCategoryId}
                            bind:defaultUnitId={formData.defaultUnitId}
                            {positioning}
                            {width}
                            height={formHeight}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 3}
                        <QuantityInput
                            bind:question={formData.question}
                            {positioning}
                            {width}
                            height={formHeight}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 4}
                        <CategoryInput
                            bind:selectedCategories={formData.selectedCategories}
                            {positioning}
                            {width}
                            height={formHeight}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 5}
                        <KeywordInput
                            bind:userKeywords={formData.userKeywords}
                            {positioning}
                            {width}
                            height={formHeight}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 6}
                        <DiscussionInput
                            bind:discussion={formData.discussion}
                            {positioning}
                            {width}
                            height={formHeight}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 7}
                        <QuantityReview
                            bind:this={quantityReviewComponent}
                            question={formData.question}
                            unitCategoryId={formData.unitCategoryId}
                            defaultUnitId={formData.defaultUnitId}
                            userKeywords={formData.userKeywords}
                            selectedCategories={formData.selectedCategories}
                            discussion={formData.discussion}
                            publicCredit={formData.publicCredit}
                            userId={userData.sub}
                            {width}             
                            height={formHeight}
                            on:back={handleBack}
                            on:success={e => successMessage = e.detail.message}
                            on:error={e => errorMessage = e.detail.message}
                            on:expandQuantity={handleQuantityCreated}
                        />
                    {/if}
                {:else if formData.nodeType === 'answer'}
                    {#if currentStep === 2}
                        <AnswerInput
                            bind:answerText={formData.answerText}
                            questionText={contextualConfig?.parentDisplayText || "[Question text will be provided]"}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 3}
                        <CategoryInput
                            bind:selectedCategories={formData.selectedCategories}
                            {positioning}
                            {width}
                            height={formHeight}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 4}
                        <KeywordInput
                            bind:userKeywords={formData.userKeywords}
                            {positioning}
                            {width}
                            height={formHeight}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 5}
                        <DiscussionInput
                            bind:discussion={formData.discussion}
                            {positioning}
                            {width}
                            height={formHeight}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 6}
                        <AnswerReview
                            bind:this={answerReviewComponent}
                            answerText={formData.answerText}
                            questionId={contextualConfig?.parentNodeId || "[Question ID]"}
                            questionText={contextualConfig?.parentDisplayText || "[Question text]"}
                            userKeywords={formData.userKeywords}
                            selectedCategories={formData.selectedCategories}
                            discussion={formData.discussion}
                            publicCredit={formData.publicCredit}
                            userId={userData.sub}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:success={e => successMessage = e.detail.message}
                            on:error={e => errorMessage = e.detail.message}
                            on:expandAnswer={handleAnswerCreated}
                        />
                    {/if}
                    {:else if formData.nodeType === 'definition'}
                    {#if currentStep === 2}
                        <DefinitionInput
                            bind:definitionText={formData.definitionText}
                            word={contextualConfig?.parentDisplayText || "[Word]"}
                            {positioning}
                            {width}
                            height={formHeight}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 3}
                        <DiscussionInput
                            bind:discussion={formData.discussion}
                            {positioning}
                            {width}
                            height={formHeight}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 4}
                        <DefinitionReview
                            bind:this={definitionReviewComponent}
                            definitionText={formData.definitionText}
                            word={contextualConfig?.parentDisplayText || "[Word]"}
                            wordId={contextualConfig?.parentNodeId || ""}
                            discussion={formData.discussion}
                            publicCredit={formData.publicCredit}
                            userId={userData.sub}
                            {width}
                            height={formHeight}
                            on:back={handleBack}
                            on:success={e => successMessage = e.detail.message}
                            on:error={e => errorMessage = e.detail.message}
                            on:expandDefinition={handleDefinitionCreated}
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
                            {positioning}
                            {width}
                            height={formHeight}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 4}
                        <KeywordInput
                            bind:userKeywords={formData.userKeywords}
                            {positioning}
                            {width}
                            height={formHeight}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 5}
                        <DiscussionInput
                            bind:discussion={formData.discussion}
                            {positioning}
                            {width}
                            height={formHeight}
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
                            {positioning}
                            {width}
                            height={formHeight}
                            disabled={isLoading}
                            on:back={handleBack}
                            on:proceed={handleNext}
                        />
                    {:else if currentStep === 4}
                        <CategoryCreationReview
                            bind:this={categoryReviewComponent}
                            selectedWordIds={formData.selectedWordIds}
                            parentCategoryId={formData.parentCategoryId}
                            discussion={formData.discussion}
                            publicCredit={formData.publicCredit}
                            on:back={handleBack}
                            on:success={e => successMessage = e.detail.message}
                            on:error={e => errorMessage = e.detail.message}
                            on:expandCategory={handleCategoryCreated}
                        />
                    {/if}
                {/if}
            </g>
        </svg>

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

        {#if showPreviousButton}
            <defs>
                <filter id={previousGlowFilterId} x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="blur1"/>
                    <feFlood flood-color={previousButtonColor} flood-opacity="0.6" result="color1"/>
                    <feComposite in="color1" in2="blur1" operator="in" result="shadow1"/>
                    
                    <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="blur2"/>
                    <feFlood flood-color={previousButtonColor} flood-opacity="0.8" result="color2"/>
                    <feComposite in="color2" in2="blur2" operator="in" result="shadow2"/>
                    
                    <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur3"/>
                    <feFlood flood-color={previousButtonColor} flood-opacity="1" result="color3"/>
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
                cx={-60}
                cy={nodeRadius - 40}
                r={30}
                fill="transparent"
                class="previous-button-detection"
                on:mouseenter={() => isPreviousButtonHovering = true}
                on:mouseleave={() => isPreviousButtonHovering = false}
                on:click={handleBack}
                on:keydown={handlePreviousKeydown}
                tabindex="0"
                role="button"
                aria-label={previousTooltipText}
                aria-pressed="false"
                style="cursor: pointer;"
            />

            <g style:filter={isPreviousButtonHovering ? `url(#${previousGlowFilterId})` : 'none'}>
                <foreignObject 
                    x={-80}
                    y={nodeRadius - 60}
                    width={40}
                    height={40}
                    class="previous-icon-container"
                >
                    <div class="previous-icon-wrapper" {...{"xmlns": "http://www.w3.org/1999/xhtml"}}>
                        <span 
                            class="material-symbols-outlined previous-icon"
                            class:hovered={isPreviousButtonHovering}
                            style:color={previousButtonColor}
                        >
                            arrow_circle_left
                        </span>
                    </div>
                </foreignObject>
            </g>

            {#if isPreviousButtonHovering}
                <g transform="translate(-60, {nodeRadius + 10})">
                    <rect
                        x={-55}
                        y={-10}
                        width="110"
                        height="20"
                        rx="4"
                        fill="rgba(0, 0, 0, 0.9)"
                        stroke={previousButtonColor}
                        stroke-width="1"
                        class="previous-tooltip-background"
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
                        class="previous-tooltip-text"
                    >
                        {previousTooltipText}
                    </text>
                </g>
            {/if}
        {/if}

        {#if showActionButton}
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
                cx={60}
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
                    x={40}
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
                            class:checking={isCheckingWord}
                            style:color={nextButtonColor}
                        >
                            {isCheckingWord ? 'progress_activity' : nextButtonIcon}
                        </span>
                    </div>
                </foreignObject>
            </g>

            {#if isNextButtonHovering}
                <g transform="translate(60, {nodeRadius + 10})">
                    <rect
                        x={-50}
                        y={-10}
                        width="100"
                        height="20"
                        rx="4"
                        fill="rgba(0, 0, 0, 0.9)"
                        stroke={nextButtonColor}
                        stroke-width="1"
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

    .previous-button-detection {
        transition: all 0.2s ease;
        outline: none;
    }

    .previous-button-detection:focus {
        outline: 2px solid rgba(255, 255, 255, 0.3);
        outline-offset: 4px;
    }

    .previous-icon-container {
        overflow: visible;
        pointer-events: none;
    }

    .previous-icon-wrapper {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
    }

    :global(.material-symbols-outlined.previous-icon) {
        font-size: 32px;
        transition: all 0.3s ease;
        font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 48;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    :global(.material-symbols-outlined.previous-icon.hovered) {
        font-size: 36px;
        font-variation-settings: 'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 48;
    }

    .previous-tooltip-background {
        filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4));
        pointer-events: none;
    }

    .previous-tooltip-text {
        pointer-events: none;
        user-select: none;
        letter-spacing: 0.02em;
    }

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
    
    :global(.material-symbols-outlined.next-icon.checking) {
        animation: spin 2s linear infinite;
    }
    
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
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