<!-- ProjectZer0Frontend/src/lib/components/graph/nodes/NodeRenderer.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    
    // The node to render
    export let node: RenderableNode;
    
    // Event dispatcher for mode changes
    const dispatch = createEventDispatcher<{
        modeChange: { nodeId: string; mode: NodeMode };
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

    // Component ID for debugging
    const rendererId = node.id.substring(0, 8);
    
    // Position information from node
    $: posX = node.position.x;
    $: posY = node.position.y;
    $: transform = `translate(${posX}, ${posY})`;
    
    // Log positioning info for debugging
    $: {
        console.debug(`[NodeRenderer:${rendererId}] Position:`, {
            id: node.id,
            type: node.type,
            x: posX,
            y: posY,
            transform
        });
    }
</script>

<!-- Apply node position transform - THIS COMPONENT HANDLES ONLY POSITIONING -->
<g 
    class="node-wrapper" 
    data-node-id={node.id}
    data-node-type={node.type}
    data-node-mode={node.mode || 'preview'}
    data-node-group={node.group}
    {transform}
>
    <!-- Render appropriate node component using slot -->
    <slot 
        {node}
        {handleModeChange}
    />
</g>

<style>
    .node-wrapper {
        transform-origin: center;
        transform-box: fill-box;
        will-change: transform;
        transition: transform 0.3s ease;
    }
</style>