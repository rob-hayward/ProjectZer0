<!-- src/lib/components/graph/nodes/base/BasePreviewNode.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    import BaseNode from './BaseNode.svelte';
    import ExpandCollapseButton from '../common/ExpandCollapseButton.svelte';
    import { NODE_CONSTANTS } from '../../../../constants/graph/node-styling';

    export let node: RenderableNode;

    const dispatch = createEventDispatcher<{
        modeChange: { mode: NodeMode };
        click: void;
    }>();

    interface $$Slots {
        title: {
            radius: number;
            style: typeof NODE_CONSTANTS;
        };
        content: {
            radius: number;
            style: typeof NODE_CONSTANTS;
        };
        score: {
            radius: number;
            style: typeof NODE_CONSTANTS;
        };
        button: {
            radius: number;
            style: typeof NODE_CONSTANTS;
        };
    }

    function handleButtonClick() {
        console.log(`[BasePreviewNode] Button clicked for node:`, {
            id: node.id,
            type: node.type,
            mode: node.mode,
            radius: node.radius
        });
        dispatch('click');
    }

    function handleModeChange(event: CustomEvent<{ mode: NodeMode }>) {
        console.log(`[BasePreviewNode] Mode change event:`, {
            nodeId: node.id,
            newMode: event.detail.mode
        });
        dispatch('modeChange', event.detail);
    }
    
    // Track radius changes
    $: console.log(`[BasePreviewNode] Node radius is:`, node.radius, "mode:", node.mode);
    
    onMount(() => {
        console.log(`[BasePreviewNode] Mounted for node:`, {
            id: node.id,
            type: node.type,
            mode: node.mode,
            radius: node.radius
        });
    });
</script>

<g 
    class="preview-node"
    data-node-id={node.id}
    data-node-type={node.type}
    data-node-mode={node.mode}
    data-node-radius={node.radius}
>
    <BaseNode {node}>
        <svelte:fragment slot="default" let:radius let:filterId let:gradientId>
            <!-- Title slot -->
            {#if $$slots.title}
                <slot 
                    name="title" 
                    {radius}
                    style={NODE_CONSTANTS}
                />
            {/if}

            <!-- Content slot -->
            {#if $$slots.content}
                <slot 
                    name="content" 
                    {radius}
                    style={NODE_CONSTANTS}
                />
            {/if}

            <!-- Score slot -->
            {#if $$slots.score}
                <slot 
                    name="score" 
                    {radius}
                    style={NODE_CONSTANTS}
                />
            {/if}

            <!-- Expand/Collapse Button (positioned to the left) -->
            {#if $$slots.button}
                <slot 
                    name="button" 
                    {radius}
                    style={NODE_CONSTANTS}
                >
                    <ExpandCollapseButton 
                        mode="expand"
                        y={radius}
                        x={-20} 
                        on:click={handleButtonClick}
                        on:modeChange={handleModeChange}
                    />
                </slot>
            {/if}
        </svelte:fragment>
    </BaseNode>
</g>

<style>
    .preview-node {
        will-change: transform;
        transition: transform 0.3s ease-out;
    }
</style>