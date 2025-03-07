<!-- ProjectZer0Frontend/src/lib/components/graph/nodes/NodeRenderer.svelte -->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    import HiddenNode from './common/HiddenNode.svelte';  
    import ShowHideButton from './common/ShowHideButton.svelte';
    import { getNetVotes } from './utils/nodeUtils';
    import { visibilityStore } from '$lib/stores/visibilityPreferenceStore';
    
    // The node to render
    export let node: RenderableNode;
    
    // Event dispatcher for mode changes and visibility changes
    const dispatch = createEventDispatcher<{
        modeChange: { nodeId: string; mode: NodeMode };
        visibilityChange: { nodeId: string; isHidden: boolean };
    }>();
    
    // Handle mode change events from child components
    function handleModeChange(event: CustomEvent<{ mode: NodeMode }>) {
        console.debug(`[NodeRenderer] Mode change event from node ${node.id}:`, event.detail);
        // Include the nodeId in the dispatched event
        dispatch('modeChange', { 
            nodeId: node.id, 
            mode: event.detail.mode 
        });
    }
    
    // Handle visibility change events
    function handleVisibilityChange(event: CustomEvent<{ isHidden: boolean }>) {
        console.debug(`[NodeRenderer] Visibility change for node ${node.id}:`, event.detail);
        
        // Dispatch event to update local state
        dispatch('visibilityChange', { 
            nodeId: node.id, 
            isHidden: event.detail.isHidden 
        });
        
        // Save preference to store (true = visible, false = hidden)
        // The preference store should handle persistence
        visibilityStore.setPreference(node.id, !event.detail.isHidden);
    }
    
    // Component ID for debugging
    const rendererId = node.id.substring(0, 8);
    
    // Position information from node
    $: posX = node.position.x;
    $: posY = node.position.y;
    $: transform = `translate(${posX}, ${posY})`;
    
    // Calculate net votes for the node
    $: netVotes = node.type === 'word' || node.type === 'definition' 
        ? getNetVotes(node.data)
        : 0;
    
    // Log positioning info for debugging
    $: {
        console.debug(`[NodeRenderer:${rendererId}] Position:`, {
            id: node.id,
            type: node.type,
            x: posX,
            y: posY,
            transform,
            isHidden: node.isHidden
        });
    }
    
    // When component mounts, check if we have a stored visibility preference
    // for this node and apply it if needed
    onMount(() => {
        if (node.type === 'word' || node.type === 'definition') {
            const preference = visibilityStore.getPreference(node.id);
            if (preference !== undefined) {
                const shouldBeHidden = !preference;
                
                // Only update if different from current state
                if (node.isHidden !== shouldBeHidden) {
                    console.debug(`[NodeRenderer:${rendererId}] Applying stored visibility preference:`, {
                        nodeId: node.id,
                        isVisible: preference,
                        shouldBeHidden
                    });
                    
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

<!-- Apply node position transform - THIS COMPONENT HANDLES ONLY POSITIONING -->
<g 
    class="node-wrapper" 
    data-node-id={node.id}
    data-node-type={node.type}
    data-node-mode={node.mode || 'preview'}
    data-node-group={node.group}
    data-node-hidden={node.isHidden ? 'true' : 'false'}
    {transform}
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
            {handleModeChange}
        />
        
        <!-- Add show/hide button to qualifying nodes (positioned to the right) -->
        {#if node.type === 'word' || node.type === 'definition'}
            <ShowHideButton 
                isHidden={false}
                y={node.radius} 
                x={20}  
                on:visibilityChange={handleVisibilityChange}
            />
        {/if}
    {/if}
</g>

<style>
    .node-wrapper {
        transform-origin: center;
        transform-box: fill-box;
        will-change: transform;
        transition: transform 0.3s ease;
    }
</style>