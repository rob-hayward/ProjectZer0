<!-- src/lib/components/graph/nodes/NodeRenderer.svelte - WITH VISIBILITY BEHAVIOUR & ALL EXPANSION HANDLERS -->
<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy, tick } from 'svelte';
    import { get } from 'svelte/store';
    import type { RenderableNode, NodeMode, ViewType } from '$lib/types/graph/enhanced';
    import HiddenNode from './hidden/HiddenNode.svelte';  
    import ShowHideButton from './ui/ShowHideButton.svelte';
    import DiscussButton from './ui/DiscussButton.svelte';
    import ReplyButton from './ui/ReplyButton.svelte';
    import CreateLinkedNodeButton from './ui/CreateLinkedNodeButton.svelte';
    import AnswerQuestionButton from './ui/AnswerQuestionButton.svelte';
    import { visibilityStore } from '$lib/stores/visibilityPreferenceStore';
    import { statementNetworkStore } from '$lib/stores/statementNetworkStore';
    import { wordViewStore } from '$lib/stores/wordViewStore';
    import { openQuestionViewStore } from '$lib/stores/openQuestionViewStore';
    import { graphStore } from '$lib/stores/graphStore';
    import { navigateToNodeDiscussion } from '$lib/services/navigation';
    import { COORDINATE_SPACE } from '$lib/constants/graph/coordinate-space';
    import { universalGraphStore } from '$lib/stores/universalGraphStore';
    import { createVisibilityBehaviour, type VisibilityBehaviour } from './behaviours/visibilityBehaviour';
    
    // The node to render
    export let node: RenderableNode;

    let isProcessingVisibilityChange = false;
    let forceRefresh = 0;
    
    // Add viewType as a prop to know when we're in discussion view
    export let viewType: ViewType;
    
    // ENHANCED: Visibility behaviour instance
    let visibilityBehaviour: VisibilityBehaviour | null = null;
    let visibilityUnsubscribe: (() => void) | null = null;
    
    // FIXED: Event dispatcher with ALL expansion event types
    const dispatch = createEventDispatcher<{
        modeChange: { 
            nodeId: string; 
            mode: NodeMode; 
            position?: { x: number; y: number };
        };
        visibilityChange: { nodeId: string; isHidden: boolean };
        discuss: { 
            nodeId: string;
            nodeType: string;
        };
        reply: { commentId: string };
        createLinkedNode: {
            nodeId: string;
            nodeType: string;
        };
        createDefinition: {
            wordId: string;
        };
        answerQuestion: { questionId: string };
        expandCategory: {
            categoryId: string;
            categoryName: string;
            sourceNodeId: string;
            sourcePosition: { x: number; y: number };
        };
        expandWord: { 
            word: string;
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
        expandEvidence: {
            evidenceId: string;
            sourceNodeId: string;
            sourcePosition: { x: number; y: number };
        };
    }>();

    // Store the expected radius for comment nodes
    const COMMENT_VISIBLE_RADIUS = COORDINATE_SPACE.NODES.SIZES.COMMENT.PREVIEW / 2;
    const HIDDEN_NODE_RADIUS = COORDINATE_SPACE.NODES.SIZES.HIDDEN / 2;
    
    // ENHANCED: D3-Native opacity control
    $: nodeOpacity = (() => {
        if (node.opacity !== undefined && node.opacity !== null) {
            return node.opacity;
        }
        
        if (node.isHidden) {
            return 1;
        }
        
        return 1;
    })();
    
    // CORRECTED: Handle mode change events from child components
    function handleModeChange(event: CustomEvent<{ 
        mode: NodeMode; 
        position?: { x: number; y: number };
        nodeId?: string;
    }>) {
        console.log('[NodeRenderer] MODE EVENT - Received from node component:', {
            eventNodeId: event.detail.nodeId?.substring(0, 8),
            actualNodeId: node.id.substring(0, 8),
            mode: event.detail.mode,
            position: event.detail.position,
            eventType: event.type,
            hasEventNodeId: !!event.detail.nodeId,
            currentNodeMode: node.mode
        });
        
        // CRITICAL: Ensure we have consistent event data
        const eventData = {
            nodeId: event.detail.nodeId || node.id,
            mode: event.detail.mode,
            position: event.detail.position || { x: node.position.x, y: node.position.y }
        };
        
        console.log('[NodeRenderer] MODE EVENT - Forwarding to Graph component with data:', {
            nodeId: eventData.nodeId.substring(0, 8),
            mode: eventData.mode,
            position: eventData.position
        });
        
        // Forward the event to Graph component
        dispatch('modeChange', eventData);
        
        console.log('[NodeRenderer] MODE EVENT - Successfully dispatched to Graph component');
    }
    
    // ENHANCED: Handle visibility change events with visibilityBehaviour integration
    async function handleVisibilityChange(event: CustomEvent<{ isHidden: boolean }>) {
        console.log('[NodeRenderer] handleVisibilityChange called:', {
            nodeId: node.id,
            isHidden: event.detail.isHidden,
            isProcessing: isProcessingVisibilityChange,
            hasVisibilityBehaviour: !!visibilityBehaviour
        });
        
        if (isProcessingVisibilityChange) {
            console.log('[NodeRenderer] Skipping duplicate visibility change processing');
            return;
        }
        
        isProcessingVisibilityChange = true;
        
        try {
            // PRIORITY: Use visibilityBehaviour if available
            if (visibilityBehaviour) {
                console.log('[NodeRenderer] Using visibilityBehaviour to handle visibility change');
                await visibilityBehaviour.handleVisibilityChange(
                    event.detail.isHidden,
                    'user'
                );
                // visibilityBehaviour will update node.isHidden via subscription
            } else {
                console.log('[NodeRenderer] No visibilityBehaviour - falling back to direct update');
                // Fallback: Update node directly
                node.isHidden = event.detail.isHidden;
                node.hiddenReason = 'user';
            }
            
            // Still update graphStore for simulation coordination
            if (graphStore) {
                console.log('[NodeRenderer] Updating graph store visibility');
                graphStore.updateNodeVisibility(node.id, event.detail.isHidden, 'user');
                graphStore.forceTick(5);
            }
            
            // Forward to Graph
            dispatch('visibilityChange', { 
                nodeId: node.id, 
                isHidden: event.detail.isHidden 
            });
            
            // Special handling for comment nodes (existing code)
            if (node.type === 'comment') {
                await tick();
                
                if (node.isHidden && !event.detail.isHidden) {
                    setTimeout(() => {
                        forceRefresh++;
                        
                        const customEvent = new CustomEvent('node-size-changed', {
                            bubbles: true,
                            detail: { 
                                nodeId: node.id,
                                nodeType: node.type,
                                radius: node.radius
                            }
                        });
                        
                        const element = document.querySelector(`[data-node-id="${node.id}"]`);
                        if (element) {
                            element.dispatchEvent(customEvent);
                        }
                        
                        window.dispatchEvent(new CustomEvent('node-size-changed', {
                            detail: { 
                                nodeId: node.id, 
                                nodeType: node.type,
                                radius: node.radius
                            }
                        }));
                        
                        isProcessingVisibilityChange = false;
                    }, 100);
                } else {
                    isProcessingVisibilityChange = false;
                }
            } else {
                isProcessingVisibilityChange = false;
            }
            
        } catch (error) {
            console.error('[NodeRenderer] Error handling visibility change:', error);
            isProcessingVisibilityChange = false;
        }
        
        console.log('[NodeRenderer] handleVisibilityChange complete');
    }
        
    // Handle discuss button click
    function handleDiscussClick(event: CustomEvent<{ nodeId: string | undefined }>) {
        const nodeId = event.detail.nodeId || node.id;
        
        navigateToNodeDiscussion(node.type, node.id);
        
        dispatch('discuss', {
            nodeId: nodeId,
            nodeType: node.type
        });
    }
    
    // Handle reply button click
    function handleReply(event: CustomEvent<{ nodeId: string | undefined }>) {
        const nodeId = event.detail.nodeId || node.id;
        dispatch('reply', { commentId: nodeId });
    }
    
    // Handle answer question button click
    function handleAnswerQuestion(event: CustomEvent<{ questionId: string }>) {
        const questionId = event.detail.questionId || node.id;
        dispatch('answerQuestion', { questionId: questionId });
    }
    
    // NEW: Handle create definition button click
    function handleCreateDefinition(event: CustomEvent<{
        wordId: string;
    }>) {
        console.log('[NodeRenderer] Create definition event received:', {
            wordId: event.detail.wordId
        });
        
        dispatch('createDefinition', event.detail);
        console.log('[NodeRenderer] Create definition event forwarded to Graph');
    }
    
    // Handle category expansion
    function handleExpandCategory(event: CustomEvent<{
        categoryId: string;
        categoryName: string;
        sourceNodeId: string;
        sourcePosition: { x: number; y: number };
    }>) {
        console.log('[NodeRenderer] Category expansion event received:', {
            categoryId: event.detail.categoryId,
            categoryName: event.detail.categoryName,
            sourceNodeId: event.detail.sourceNodeId,
            sourcePosition: event.detail.sourcePosition
        });
        
        dispatch('expandCategory', event.detail);
        console.log('[NodeRenderer] Category expansion event forwarded to Graph');
    }

    // Handle word expansion
    function handleExpandWord(event: CustomEvent<{
        word: string;
        sourceNodeId: string;
        sourcePosition: { x: number; y: number };
    }>) {
        console.log('[NodeRenderer] Word expansion event received:', {
            word: event.detail.word,
            sourceNodeId: event.detail.sourceNodeId,
            sourcePosition: event.detail.sourcePosition
        });
        
        dispatch('expandWord', event.detail);
        console.log('[NodeRenderer] Word expansion event forwarded to Graph');
    }

    // NEW: Handle statement expansion
    function handleExpandStatement(event: CustomEvent<{
        statementId: string;
        sourceNodeId: string;
        sourcePosition: { x: number; y: number };
    }>) {
        console.log('[NodeRenderer] Statement expansion event received:', {
            statementId: event.detail.statementId,
            sourceNodeId: event.detail.sourceNodeId,
            sourcePosition: event.detail.sourcePosition
        });
        
        dispatch('expandStatement', event.detail);
        console.log('[NodeRenderer] Statement expansion event forwarded to Graph');
    }

    // NEW: Handle openquestion expansion
    function handleExpandOpenQuestion(event: CustomEvent<{
        questionId: string;
        sourceNodeId: string;
        sourcePosition: { x: number; y: number };
    }>) {
        console.log('[NodeRenderer] OpenQuestion expansion event received:', {
            questionId: event.detail.questionId,
            sourceNodeId: event.detail.sourceNodeId,
            sourcePosition: event.detail.sourcePosition
        });
        
        dispatch('expandOpenQuestion', event.detail);
        console.log('[NodeRenderer] OpenQuestion expansion event forwarded to Graph');
    }

    // NEW: Handle quantity expansion
    function handleExpandQuantity(event: CustomEvent<{
        quantityId: string;
        sourceNodeId: string;
        sourcePosition: { x: number; y: number };
    }>) {
        console.log('[NodeRenderer] Quantity expansion event received:', {
            quantityId: event.detail.quantityId,
            sourceNodeId: event.detail.sourceNodeId,
            sourcePosition: event.detail.sourcePosition
        });
        
        dispatch('expandQuantity', event.detail);
        console.log('[NodeRenderer] Quantity expansion event forwarded to Graph');
    }

    // NEW: Handle answer expansion
    function handleExpandAnswer(event: CustomEvent<{
        answerId: string;
        sourceNodeId: string;
        sourcePosition: { x: number; y: number };
    }>) {
        console.log('[NodeRenderer] Answer expansion event received:', {
            answerId: event.detail.answerId,
            sourceNodeId: event.detail.sourceNodeId,
            sourcePosition: event.detail.sourcePosition
        });
        
        dispatch('expandAnswer', event.detail);
        console.log('[NodeRenderer] Answer expansion event forwarded to Graph');
    }

    // NEW: Handle definition expansion
    function handleExpandDefinition(event: CustomEvent<{
        definitionId: string;
        sourceNodeId: string;
        sourcePosition: { x: number; y: number };
    }>) {
        console.log('[NodeRenderer] Definition expansion event received:', {
            definitionId: event.detail.definitionId,
            sourceNodeId: event.detail.sourceNodeId,
            sourcePosition: event.detail.sourcePosition
        });
        
        dispatch('expandDefinition', event.detail);
        console.log('[NodeRenderer] Definition expansion event forwarded to Graph');
    }

    function handleExpandEvidence(event: CustomEvent<{
        evidenceId: string;
        sourceNodeId: string;
        sourcePosition: { x: number; y: number };
    }>) {
        console.log('[NodeRenderer] Evidence expansion event received:', {
            evidenceId: event.detail.evidenceId,
            sourceNodeId: event.detail.sourceNodeId,
            sourcePosition: event.detail.sourcePosition
        });
        
        dispatch('expandEvidence', event.detail);
        console.log('[NodeRenderer] Evidence expansion event forwarded to Graph');
    }
    
    // Position information from node
    $: posX = node.position.x;
    $: posY = node.position.y;
    $: transform = node.position.svgTransform;
    
    // Special case for comment nodes to correct radius value
    $: if (node.type === 'comment' && !node.isHidden && node.radius !== COMMENT_VISIBLE_RADIUS) {
        node.radius = COMMENT_VISIBLE_RADIUS;
        forceRefresh++;
        
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('node-size-changed', {
                detail: { 
                    nodeId: node.id, 
                    nodeType: node.type,
                    radius: node.radius
                }
            }));
        }, 50);
    }
    
    // Special case for hidden nodes to ensure consistent radius
    $: if (node.isHidden && node.radius !== HIDDEN_NODE_RADIUS) {
        node.radius = HIDDEN_NODE_RADIUS;
        forceRefresh++;
    }
    
    // Special handling for central node
    $: if (node.group === 'central' || (node.data && 'sub' in node.data && node.data.sub === 'controls')) {
        posX = 0;
        posY = 0;
        transform = 'translate(0,0)';
    }

    // Get vote data from the appropriate store based on node type AND view type
    $: netVotes = (() => {
        if (viewType === 'universal') {
            return universalGraphStore.getVoteData(node.id).netVotes;
        }
        
        return node.type === 'statement' 
            ? statementNetworkStore.getVoteData(node.id).netVotes 
            : (node.type === 'word' || node.type === 'definition')
                ? wordViewStore.getVoteData(node.id).netVotes
                : node.type === 'openquestion'
                    ? openQuestionViewStore.getVoteData(node.id).netVotes
                    : 0;
    })();
    
    // ENHANCED: Update community visibility when votes change
    $: if (visibilityBehaviour && netVotes !== undefined) {
        visibilityBehaviour.updateCommunityVisibility(netVotes);
    }
    
    // Calculate button positions based on node radius
    $: showHideButtonX = node.radius * 0.7071;
    $: showHideButtonY = node.radius * 0.7071;
    
    // ENHANCED: Initialize visibility behaviour on mount
    onMount(async () => {
        console.log('[NodeRenderer] Mounting node:', node.id, 'type:', node.type);
        
        // Determine which store to use based on viewType
        const store = viewType === 'universal' ? universalGraphStore : 
                      node.type === 'statement' ? statementNetworkStore :
                      node.type === 'word' || node.type === 'definition' ? wordViewStore :
                      node.type === 'openquestion' ? openQuestionViewStore :
                      graphStore;
        
        // Create visibility behaviour for votable nodes
        if (node.type === 'word' || node.type === 'definition' || 
            node.type === 'statement' || node.type === 'quantity' || 
            node.type === 'comment' || node.type === 'openquestion') {
            
            console.log('[NodeRenderer] Creating visibilityBehaviour for', node.id);
            
            try {
                visibilityBehaviour = createVisibilityBehaviour(node.id, {
                    communityThreshold: 0,
                    graphStore: store
                });
                
                // Initialize with current net votes
                await visibilityBehaviour.initialize(netVotes);
                
                console.log('[NodeRenderer] visibilityBehaviour initialized:', {
                    nodeId: node.id,
                    netVotes,
                    currentState: visibilityBehaviour.getCurrentState()
                });
                
                // Subscribe to visibility changes from the behaviour
                visibilityUnsubscribe = visibilityBehaviour.isHidden.subscribe(isHidden => {
                    const hiddenReason = get(visibilityBehaviour!.hiddenReason);
                    
                    console.log('[NodeRenderer] Visibility subscription update:', {
                        nodeId: node.id,
                        isHidden,
                        hiddenReason,
                        currentNodeHidden: node.isHidden
                    });
                    
                    // Only update if state actually changed
                    if (node.isHidden !== isHidden || node.hiddenReason !== hiddenReason) {
                        console.log('[NodeRenderer] Updating node visibility state');
                        
                        // Update node properties for rendering
                        node.isHidden = isHidden;
                        node.hiddenReason = hiddenReason;
                        
                        // Trigger reactivity
                        forceRefresh++;
                        
                        // Notify Graph component
                        dispatch('visibilityChange', {
                            nodeId: node.id,
                            isHidden
                        });
                    }
                });
                
            } catch (error) {
                console.error('[NodeRenderer] Error creating visibilityBehaviour:', error);
            }
        }
        
        // Apply cached preference (existing code - now redundant but harmless)
        const preference = visibilityStore.getPreference(node.id);
        if (preference !== undefined) {
            console.log('[NodeRenderer] Found cached preference for', node.id, ':', preference);
            
            if (visibilityBehaviour) {
                // Let visibilityBehaviour handle it
                await visibilityBehaviour.setUserPreference(preference);
            } else {
                // Fallback for nodes without visibilityBehaviour
                const shouldBeHidden = !preference;
                
                if (node.isHidden !== shouldBeHidden) {
                    dispatch('visibilityChange', {
                        nodeId: node.id,
                        isHidden: shouldBeHidden
                    });
                }
            }
        }
    });
    
    // ENHANCED: Cleanup on destroy
    onDestroy(() => {
        console.log('[NodeRenderer] Destroying node:', node.id);
        
        // Unsubscribe from visibility changes
        if (visibilityUnsubscribe) {
            visibilityUnsubscribe();
            visibilityUnsubscribe = null;
        }
        
        // Reset visibility behaviour
        if (visibilityBehaviour) {
            visibilityBehaviour.reset();
            visibilityBehaviour = null;
        }
    });
</script>

<!-- Apply node position via SVG transform attribute -->
<!-- ENHANCED: Apply D3-controlled opacity to the entire node wrapper -->
<g 
    class="node-wrapper" 
    data-node-id={node.id}
    data-node-type={node.type}
    data-node-mode={node.mode || 'preview'}
    data-node-group={node.group}
    data-node-hidden={node.isHidden ? 'true' : 'false'}
    data-node-radius={node.radius}
    data-force-refresh={forceRefresh}
    transform={transform}
    opacity={nodeOpacity}
>
    {#if node.isHidden}
        <!-- Render hidden node -->
        <HiddenNode 
            {node}
            hiddenBy={node.hiddenReason || 'community'}
            {netVotes}
            on:visibilityChange={handleVisibilityChange}
            on:modeChange={handleModeChange}
        />
    {:else}
        <!-- Render regular node using slot - FIXED: Pass all expansion handlers -->
        <slot 
            {node}
            nodeX={posX}
            nodeY={posY}
            handleModeChange={handleModeChange}
            handleExpandCategory={handleExpandCategory}
            handleExpandWord={handleExpandWord}
            handleExpandStatement={handleExpandStatement}
            handleExpandOpenQuestion={handleExpandOpenQuestion}
            handleExpandQuantity={handleExpandQuantity}
            handleExpandAnswer={handleExpandAnswer}
            handleExpandDefinition={handleExpandDefinition}
        />
    
        <!-- Add show/hide button to qualifying nodes -->
        {#if node.type === 'word' || node.type === 'definition' || node.type === 'statement' || node.type === 'quantity' || node.type === 'comment' || node.type === 'openquestion' || node.type === 'answer'}
            {#key `${node.radius}-${forceRefresh}`}
                <ShowHideButton 
                    isHidden={false}
                    y={showHideButtonY}  
                    x={showHideButtonX}  
                    nodeId={node.id}
                    on:visibilityChange={handleVisibilityChange}
                />
            {/key}
            
            <!-- Central node special handling in discussion view -->
            {#if viewType === 'discussion' && node.group === 'central'}
                <ReplyButton 
                    y={-node.radius * 0.7071}  
                    x={node.radius * 0.7071}
                    nodeId={node.id}
                    on:reply={handleReply}
                />
            {:else if node.type !== 'comment'}
                <DiscussButton 
                    y={-node.radius * 0.7071}  
                    x={node.radius * 0.7071}
                    nodeId={node.id}
                    on:discuss={handleDiscussClick}
                />
            {/if}
            
            <!-- Add create linked node button to statement, quantity, AND WORD nodes -->
            {#if node.type === 'statement' || node.type === 'quantity' || node.type === 'word' || node.type === 'answer'}
                <CreateLinkedNodeButton 
                    y={-node.radius * 0.7071}  
                    x={-node.radius * 0.7071}
                    nodeId={node.id}
                    nodeType={node.type}
                    on:createLinkedNode={event => {
                        // For word nodes, dispatch createDefinition instead
                        if (node.type === 'word') {
                            dispatch('createDefinition', {
                                wordId: node.id
                            });
                        } else {
                            dispatch('createLinkedNode', {
                                nodeId: event.detail.nodeId || node.id,
                                nodeType: event.detail.nodeType || node.type
                            });
                        }
                    }}
                />
            {/if}
            
            <!-- Add answer question button only to openquestion nodes -->
            {#if node.type === 'openquestion'}
                <AnswerQuestionButton 
                    y={-node.radius * 0.7071}  
                    x={-node.radius * 0.7071}
                    questionId={node.id}
                    on:answerQuestion={handleAnswerQuestion}
                />
            {/if}
        {/if}
    {/if}
</g>