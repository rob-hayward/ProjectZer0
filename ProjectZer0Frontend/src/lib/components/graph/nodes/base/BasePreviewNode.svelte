<!-- src/lib/components/graph/nodes/base/BasePreviewNode.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
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
        dispatch('click');
    }

    function handleModeChange(event: CustomEvent<{ mode: NodeMode }>) {
        dispatch('modeChange', event.detail);
    }
</script>

<g class="preview-node">
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
        will-change: transform, opacity;
        transition: all 0.3s ease-out;
    }
</style>