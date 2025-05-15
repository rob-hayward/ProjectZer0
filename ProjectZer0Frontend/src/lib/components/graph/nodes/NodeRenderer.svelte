<!-- src/lib/components/graph/nodes/NodeRenderer.svelte -->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import type { RenderableNode, NodeMode, ViewType } from '$lib/types/graph/enhanced';
    import HiddenNode from './common/HiddenNode.svelte';  
    import ShowHideButton from './common/ShowHideButton.svelte';
    import ExpandCollapseButton from './common/ExpandCollapseButton.svelte';
    import DiscussButton from './common/DiscussButton.svelte';
    import ReplyButton from './common/ReplyButton.svelte';
    import CreateLinkedNodeButton from './common/CreateLinkedNodeButton.svelte';
    import { visibilityStore } from '$lib/stores/visibilityPreferenceStore';
    import { statementNetworkStore } from '$lib/stores/statementNetworkStore';
    import { wordViewStore } from '$lib/stores/wordViewStore';
    import { graphStore } from '$lib/stores/graphStore';
    import { navigateToNodeDiscussion } from '$lib/services/navigation'; // Import the new navigation function
    
    // The node to render
    export let node: RenderableNode;
    
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
    
    // Handle mode change events from child components
    function handleModeChange(event: CustomEvent<{ 
        mode: NodeMode; 
        position?: { x: number; y: number };
        nodeId?: string;
    }>) {
        console.log('[NODE_CENTRE_DEBUG] NodeRenderer handleModeChange called with:', {
            nodeId: node.id,
            mode: event.detail.mode,
            position: event.detail.position
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
            console.log('[NODE_CENTRE_DEBUG] NodeRenderer using current node position:', {
                x: node.position.x,
                y: node.position.y
            });
            eventData.position = {
                x: node.position.x,
                y: node.position.y
            };
        }
        // Fall back to position from event if available
        else if (event.detail.position) {
            console.log('[NODE_CENTRE_DEBUG] NodeRenderer using position from event:', {
                x: event.detail.position.x,
                y: event.detail.position.y
            });
            eventData.position = event.detail.position;
        }
        
        // Dispatch the enhanced event
        console.log('[NODE_CENTRE_DEBUG] NodeRenderer dispatching modeChange:', eventData);
        dispatch('modeChange', eventData);
    }
    
    // Handle visibility change events
    function handleVisibilityChange(event: CustomEvent<{ isHidden: boolean }>) {
        // Log complete information
        console.log('[NodeRenderer] Visibility change requested:', {
            nodeId: node.id,
            currentVisibility: node.isHidden ? 'hidden' : 'visible',
            newVisibility: event.detail.isHidden ? 'hidden' : 'visible',
            nodeType: node.type
        });

        // The visibility store uses isVisible (true = visible, false = hidden)
        // So we need to invert isHidden to get isVisible
        const isVisible = !event.detail.isHidden;
        
        // First update the visibility store directly
        visibilityStore.setPreference(node.id, isVisible);
        console.log('[NodeRenderer] Updated visibility store for:', {
            nodeId: node.id,
            isVisible: isVisible
        });
        
        // Then update the graph store directly - this is the key to immediate UI updates
        if (graphStore) {
            // Call the correct method on graphStore to update visibility
            graphStore.updateNodeVisibility(node.id, event.detail.isHidden, 'user');
            console.log('[NodeRenderer] Updated graphStore visibility for:', {
                nodeId: node.id,
                isHidden: event.detail.isHidden
            });
            
            // Force ticks to refresh layout
            graphStore.forceTick(5);
        }
        
        // Directly update the node's visibility state (redundant with above, but just to be sure)
        node.isHidden = event.detail.isHidden;
        
        // Dispatch event to update local state and parent components
        dispatch('visibilityChange', { 
            nodeId: node.id, 
            isHidden: event.detail.isHidden 
        });
    }
    
    // Handle discuss button click - use the navigation service to navigate to discussion view
    function handleDiscussClick(event: CustomEvent<{ nodeId: string | undefined }>) {
        const nodeId = event.detail.nodeId || node.id;
        console.log(`[NodeRenderer] Discuss event received for node ${nodeId}`);
        
        // Navigate to the discussion view for this node using the new navigation function
        navigateToNodeDiscussion(node.type, node.id);
        
        // Forward the event to parent components (optional, may not be needed with direct navigation)
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
    
    onMount(() => {
        console.log('[NODE_CENTRE_DEBUG] NodeRenderer mounted:', {
            id: node.id,
            type: node.type,
            position: {
                x: posX,
                y: posY,
                transform
            }
        });
        
        if (node.type === 'word' || node.type === 'definition' || node.type === 'statement' || node.type === 'quantity') {
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
    
        <!-- Add show/hide button to qualifying nodes - positioned at 4:30 -->
        {#if node.type === 'word' || node.type === 'definition' || node.type === 'statement' || node.type === 'quantity'}
            <ShowHideButton 
                isHidden={false}
                y={node.radius * 0.7071}  
                x={node.radius * 0.7071}  
                nodeId={node.id}
                on:visibilityChange={handleVisibilityChange}
            />
            
            <!-- Central node special handling in discussion view -->
            {#if viewType === 'discussion' && node.group === 'central'}
                <!-- Replace Discuss button with Reply button for central node in discussion view -->
                <ReplyButton 
                    y={-node.radius * 0.7071}  
                    x={node.radius * 0.7071}
                    nodeId={node.id}
                    on:reply={handleReply}
                />
            {:else}
                <!-- Add discuss button to qualifying nodes - positioned at 2:30 -->
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