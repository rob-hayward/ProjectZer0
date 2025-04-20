<!-- src/lib/components/graph/nodes/NodeRenderer.svelte -->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    import HiddenNode from './common/HiddenNode.svelte';  
    import ShowHideButton from './common/ShowHideButton.svelte';
    import { visibilityStore } from '$lib/stores/visibilityPreferenceStore';
    import { statementNetworkStore } from '$lib/stores/statementNetworkStore';
    import { wordViewStore } from '$lib/stores/wordViewStore';
    
    // The node to render
    export let node: RenderableNode;
    
    // Event dispatcher for mode changes and visibility changes
    const dispatch = createEventDispatcher<{
        modeChange: { 
            nodeId: string; 
            mode: NodeMode; 
            position?: { x: number; y: number };
        };
        visibilityChange: { nodeId: string; isHidden: boolean };
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
        // Dispatch event to update local state
        dispatch('visibilityChange', { 
            nodeId: node.id, 
            isHidden: event.detail.isHidden 
        });
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
        
        if (node.type === 'word' || node.type === 'definition' || node.type === 'statement') {
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
    
        <!-- Add show/hide button to qualifying nodes -->
        {#if node.type === 'word' || node.type === 'definition' || node.type === 'statement'}
            <ShowHideButton 
                isHidden={false}
                y={node.radius} 
                x={20}  
                nodeId={node.id}
                on:visibilityChange={handleVisibilityChange}
            />
        {/if}
    {/if}
</g>