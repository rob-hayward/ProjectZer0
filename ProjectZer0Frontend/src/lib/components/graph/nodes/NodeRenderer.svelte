<!-- src/lib/components/graph/nodes/NodeRenderer.svelte -->
<script lang="ts">
    import { createEventDispatcher, onMount, tick } from 'svelte';
    import type { RenderableNode, NodeMode, ViewType } from '$lib/types/graph/enhanced';
    import HiddenNode from './hidden/HiddenNode.svelte';  
    import ShowHideButton from './ui/ShowHideButton.svelte';
    import DiscussButton from './ui/DiscussButton.svelte';
    import ReplyButton from './ui/ReplyButton.svelte';
    import CreateLinkedNodeButton from './ui/CreateLinkedNodeButton.svelte';
    import { visibilityStore } from '$lib/stores/visibilityPreferenceStore';
    import { statementNetworkStore } from '$lib/stores/statementNetworkStore';
    import { wordViewStore } from '$lib/stores/wordViewStore';
    import { graphStore } from '$lib/stores/graphStore';
    import { navigateToNodeDiscussion } from '$lib/services/navigation';
    import { COORDINATE_SPACE } from '$lib/constants/graph/coordinate-space';
    
    // The node to render
    export let node: RenderableNode;

    let isProcessingVisibilityChange = false;
    let forceRefresh = 0; // Counter to force re-renders
    
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
        reply: { commentId: string };  // For reply events
        createLinkedNode: {
            nodeId: string;
            nodeType: string;
        };
    }>();

    // Store the expected radius for comment nodes
    const COMMENT_VISIBLE_RADIUS = COORDINATE_SPACE.NODES.SIZES.COMMENT.PREVIEW / 2;
    const HIDDEN_NODE_RADIUS = COORDINATE_SPACE.NODES.SIZES.HIDDEN / 2;
    
    // Handle mode change events from child components
    function handleModeChange(event: CustomEvent<{ 
        mode: NodeMode; 
        position?: { x: number; y: number };
        nodeId?: string;
    }>) {
        console.log('[NodeRenderer] Mode change requested:', {
            nodeId: node.id,
            nodeType: node.type,
            currentMode: node.mode,
            newMode: event.detail.mode
        });
        
        // Include the nodeId in the dispatched event
        const eventData: {
            nodeId: string;
            mode: NodeMode;
            position?: { x: number; y: number };
        } = {
            nodeId: node.id,
            mode: event.detail.mode
        };
        
        // ALWAYS use current node position data to ensure accuracy
        if (node.position) {
            eventData.position = {
                x: node.position.x,
                y: node.position.y
            };
        }
        // Fall back to position from event if available
        else if (event.detail.position) {
            eventData.position = event.detail.position;
        }
        
        // Dispatch the enhanced event
        dispatch('modeChange', eventData);
    }
    
    // Handle visibility change events
    async function handleVisibilityChange(event: CustomEvent<{ isHidden: boolean }>) {
        // Prevent duplicate processing of the same event
        if (isProcessingVisibilityChange) {
            return;
        }
        
        // Set flag to prevent multiple simultaneous updates
        isProcessingVisibilityChange = true;
        
        // Log visibility change request
        console.log('[NodeRenderer] Visibility change requested:', {
            nodeId: node.id,
            nodeType: node.type,
            currentRadius: node.radius,
            beforeIsHidden: node.isHidden,
            afterIsHidden: event.detail.isHidden
        });

        // The visibility store uses isVisible (true = visible, false = hidden)
        // So we need to invert isHidden to get isVisible
        const isVisible = !event.detail.isHidden;
        
        // First update the visibility store directly
        visibilityStore.setPreference(node.id, isVisible);
        
        // Then update the graph store
        if (graphStore) {
            // Call the correct method on graphStore to update visibility
            graphStore.updateNodeVisibility(node.id, event.detail.isHidden, 'user');
            
            // Force ticks to refresh layout
            graphStore.forceTick(5);
        }
        
        // Dispatch event to update local state and parent components
        dispatch('visibilityChange', { 
            nodeId: node.id, 
            isHidden: event.detail.isHidden 
        });
        
        // CRITICAL FIX: For comment nodes specifically, ensure radius is updated after visibility change
        if (node.type === 'comment') {
            // Wait for next tick to ensure reactivity
            await tick();
            
            // For transition from hidden to visible, verify radius is updated
            if (node.isHidden && !event.detail.isHidden) {
                console.log('[NodeRenderer] Comment node transitioning from hidden to visible, verifying radius');
                
                // Force a refresh after a short delay to ensure all updates have happened
                setTimeout(() => {
                    // Force component refresh by incrementing counter
                    forceRefresh++;
                    console.log('[NodeRenderer] Forcing refresh of comment node, current radius:', node.radius);
                    
                    // Dispatch a custom event to notify parent components that node size has changed
                    const customEvent = new CustomEvent('node-size-changed', {
                        bubbles: true,
                        detail: { 
                            nodeId: node.id,
                            nodeType: node.type,
                            radius: node.radius
                        }
                    });
                    
                    // Dispatch on the DOM element
                    const element = document.querySelector(`[data-node-id="${node.id}"]`);
                    if (element) {
                        element.dispatchEvent(customEvent);
                    }
                    
                    // Also dispatch via window for components that might not be in DOM hierarchy
                    window.dispatchEvent(new CustomEvent('node-size-changed', {
                        detail: { 
                            nodeId: node.id, 
                            nodeType: node.type,
                            radius: node.radius
                        }
                    }));
                    
                    console.log('[NodeRenderer] Dispatched node-size-changed event:', {
                        nodeId: node.id,
                        nodeType: node.type,
                        radius: node.radius
                    });
                    
                    isProcessingVisibilityChange = false;
                }, 100);
            } else {
                // For other transitions, release the flag normally
                isProcessingVisibilityChange = false;
            }
        } else {
            // For non-comment nodes, release the flag normally
            isProcessingVisibilityChange = false;
        }
    }
        
    // Handle discuss button click
    function handleDiscussClick(event: CustomEvent<{ nodeId: string | undefined }>) {
        const nodeId = event.detail.nodeId || node.id;
        console.log(`[NodeRenderer] Discuss event received for node ${nodeId}`);
        
        // Navigate to the discussion view for this node
        navigateToNodeDiscussion(node.type, node.id);
        
        // Forward the event to parent components
        dispatch('discuss', {
            nodeId: nodeId,
            nodeType: node.type
        });
    }
    
    // Handle reply button click
    function handleReply(event: CustomEvent<{ nodeId: string | undefined }>) {
        const nodeId = event.detail.nodeId || node.id;
        console.log(`[NodeRenderer] Reply event received for node ${nodeId}`);
        
        // Dispatch reply event to parent
        dispatch('reply', { commentId: nodeId });
    }
    
    // Position information from node
    $: posX = node.position.x;
    $: posY = node.position.y;
    $: transform = node.position.svgTransform;
    
    // Special case for comment nodes to correct radius value
    $: if (node.type === 'comment' && !node.isHidden && node.radius !== COMMENT_VISIBLE_RADIUS) {
        console.log(`[NodeRenderer] Correcting comment node radius from ${node.radius} to ${COMMENT_VISIBLE_RADIUS}`);
        node.radius = COMMENT_VISIBLE_RADIUS;
        forceRefresh++; // Force re-render
        
        // Notify about the radius change
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
        console.log(`[NodeRenderer] Correcting hidden node radius from ${node.radius} to ${HIDDEN_NODE_RADIUS}`);
        node.radius = HIDDEN_NODE_RADIUS;
        forceRefresh++; // Force re-render
    }
    
    // Special handling for central node - override position to ensure it's exactly at (0,0)
    $: if (node.group === 'central' || (node.data && 'sub' in node.data && node.data.sub === 'controls')) {
        posX = 0;
        posY = 0;
        transform = 'translate(0,0)';
    }
    
    // Get vote data from the appropriate store based on node type
    $: netVotes = node.type === 'statement' 
        ? statementNetworkStore.getVoteData(node.id).netVotes 
        : (node.type === 'word' || node.type === 'definition')
            ? wordViewStore.getVoteData(node.id).netVotes
            : 0;
    
    // Calculate button positions based on node radius
    $: showHideButtonX = node.radius * 0.7071;
    $: showHideButtonY = node.radius * 0.7071;
    
    onMount(() => {
        // Check for initial visibility preferences
        if (node.type === 'word' || node.type === 'definition' || node.type === 'statement' || node.type === 'quantity' || node.type === 'comment') {
            const preference = visibilityStore.getPreference(node.id);
            if (preference !== undefined) {
                const shouldBeHidden = !preference;
                
                // Only update if different from current state
                if (node.isHidden !== shouldBeHidden) {
                    // Dispatch event to update the node state
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
        <!-- Render regular node using slot, passing node position data -->
        <slot 
            {node}
            nodeX={posX}
            nodeY={posY}
            handleModeChange={handleModeChange}
        />
    
        <!-- ONLY add buttons to visible nodes (not hidden ones) -->
        <!-- Add show/hide button to qualifying nodes (including comment nodes) - positioned at 4:30 -->
        {#if node.type === 'word' || node.type === 'definition' || node.type === 'statement' || node.type === 'quantity' || node.type === 'comment'}
            <!-- Use key to force re-render when radius changes -->
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
                <!-- Replace Discuss button with Reply button for central node in discussion view -->
                <ReplyButton 
                    y={-node.radius * 0.7071}  
                    x={node.radius * 0.7071}
                    nodeId={node.id}
                    on:reply={handleReply}
                />
            {:else if node.type !== 'comment'}
                <!-- Add discuss button to qualifying non-comment nodes - positioned at 2:30 -->
                <DiscussButton 
                    y={-node.radius * 0.7071}  
                    x={node.radius * 0.7071}
                    nodeId={node.id}
                    on:discuss={handleDiscussClick}
                />
            {/if}
            
            <!-- Add create linked node button only to statement and quantity nodes - positioned at 10:30 -->
            {#if node.type === 'statement' || node.type === 'quantity'}
                <CreateLinkedNodeButton 
                    y={-node.radius * 0.7071}  
                    x={-node.radius * 0.7071}
                    nodeId={node.id}
                    nodeType={node.type}
                    on:createLinkedNode={event => {
                        console.log(`[NodeRenderer] Create linked node event received for node ${event.detail.nodeId} of type ${event.detail.nodeType}`);
                        // Forward the createLinkedNode event to parent components
                        dispatch('createLinkedNode', {
                            nodeId: event.detail.nodeId || node.id,
                            nodeType: event.detail.nodeType || node.type
                        });
                        
                        // Temporary alert until implementation is complete
                        alert(`Create linked node system not yet implemented for ${event.detail.nodeType || node.type} node ${event.detail.nodeId || node.id}`);
                    }}
                />
            {/if}
        {/if}
    {/if}
</g>