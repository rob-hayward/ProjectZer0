<!-- src/lib/components/graph/nodes/NodeRenderer.svelte - CORRECTED -->
<script lang="ts">
    import { createEventDispatcher, onMount, tick } from 'svelte';
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
    
    // The node to render
    export let node: RenderableNode;

    let isProcessingVisibilityChange = false;
    let forceRefresh = 0;
    
    // Add viewType as a prop to know when we're in discussion view
    export let viewType: ViewType;
    
    // Event dispatcher for mode changes, visibility changes, discussions, and linked nodes
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
        answerQuestion: { questionId: string };
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
            nodeId: event.detail.nodeId || node.id, // Use event nodeId or fallback to our node.id
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
    
    // Handle visibility change events
    async function handleVisibilityChange(event: CustomEvent<{ isHidden: boolean }>) {
        console.log('[NodeRenderer] handleVisibilityChange called:', {
            nodeId: node.id,
            isHidden: event.detail.isHidden,
            isProcessing: isProcessingVisibilityChange
        });
        
        if (isProcessingVisibilityChange) {
            console.log('[NodeRenderer] Skipping duplicate visibility change processing');
            return;
        }
        
        isProcessingVisibilityChange = true;
        
        if (graphStore) {
            console.log('[NodeRenderer] Updating graph store visibility');
            graphStore.updateNodeVisibility(node.id, event.detail.isHidden, 'user');
            graphStore.forceTick(5);
        }
        
        dispatch('visibilityChange', { 
            nodeId: node.id, 
            isHidden: event.detail.isHidden 
        });
        
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
    
    // Calculate button positions based on node radius
    $: showHideButtonX = node.radius * 0.7071;
    $: showHideButtonY = node.radius * 0.7071;
    
    onMount(() => {
        if (node.type === 'word' || node.type === 'definition' || node.type === 'statement' || node.type === 'quantity' || node.type === 'comment' || node.type === 'openquestion') {
            const preference = visibilityStore.getPreference(node.id);
            if (preference !== undefined) {
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
        <!-- Render regular node using slot -->
        <slot 
            {node}
            nodeX={posX}
            nodeY={posY}
            handleModeChange={handleModeChange}
        />
    
        <!-- Add show/hide button to qualifying nodes -->
        {#if node.type === 'word' || node.type === 'definition' || node.type === 'statement' || node.type === 'quantity' || node.type === 'comment' || node.type === 'openquestion'}
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
            
            <!-- Add create linked node button only to statement and quantity nodes -->
            {#if node.type === 'statement' || node.type === 'quantity'}
                <CreateLinkedNodeButton 
                    y={-node.radius * 0.7071}  
                    x={-node.radius * 0.7071}
                    nodeId={node.id}
                    nodeType={node.type}
                    on:createLinkedNode={event => {
                        dispatch('createLinkedNode', {
                            nodeId: event.detail.nodeId || node.id,
                            nodeType: event.detail.nodeType || node.type
                        });
                        
                        alert(`Create linked node system not yet implemented for ${event.detail.nodeType || node.type} node ${event.detail.nodeId || node.id}`);
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