<!-- src/lib/components/graph/nodes/base/BaseDetailNode.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import { spring } from 'svelte/motion';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    import BaseNode from './BaseNode.svelte';
    import ExpandCollapseButton from '../common/ExpandCollapseButton.svelte';
    import { NODE_CONSTANTS } from '../../../../constants/graph/node-styling';

    // Allow passing the node and custom style for more flexibility
    export let node: RenderableNode;
    export let style = node.style;

    const baseOpacity = spring(0, { 
        stiffness: 0.3, 
        damping: 0.8 
    });

    const dispatch = createEventDispatcher<{
        modeChange: { mode: NodeMode };
        click: void;
    }>();

    interface $$Slots {
        default: {
            radius: number;
            filterId: string;
            gradientId: string;
        };
    }

    onMount(() => {
        baseOpacity.set(1);
    });

    function handleButtonClick() {
        dispatch('click');
    }

    function handleModeChange(event: CustomEvent<{ mode: NodeMode }>) {
        dispatch('modeChange', event.detail);
    }
</script>

<g 
    class="detail-node"
    style:opacity={$baseOpacity}
    style:transform-origin="center"
>
    <BaseNode {node} {style}>
        <svelte:fragment slot="default" let:radius let:filterId let:gradientId>
            <slot 
                {radius} 
                {filterId} 
                {gradientId}
            />
            
            <!-- Collapse Button (positioned to the left) -->
            <ExpandCollapseButton 
                mode="collapse"
                y={radius}
                x={-20} 
                on:click={handleButtonClick}
                on:modeChange={handleModeChange}
            />
        </svelte:fragment>
    </BaseNode>
</g>

<style>
    .detail-node {
        will-change: transform, opacity;
        transition: all 0.3s ease-out;
    }

    :global(.detail-node text) {
        fill: white;
        font-family: 'Orbitron', sans-serif;
        text-anchor: middle;
    }
</style>