<!-- src/lib/components/graph/nodes/base/BasePreviewNode.svelte -->
<script lang="ts">
    import type { NodeStyle } from '$lib/types/nodes';
    import { NODE_CONSTANTS } from './BaseNodeConstants';
    import BaseNode from './BaseNode.svelte';

    export let style: NodeStyle;
    export let transform: string;
</script>

<BaseNode 
    {style}
    {transform}
>
    <!-- Title Area -->
    <text
        y={-style.previewSize/4 - 15}
        class="title"
        style:font-family={NODE_CONSTANTS.FONTS.title.family}
        style:font-size={NODE_CONSTANTS.FONTS.title.size}
        style:font-weight={NODE_CONSTANTS.FONTS.title.weight}
    >
        <slot name="title" />
    </text>

    <!-- Content Area -->
    <text
        y={-style.previewSize/4 + 40}
        class="content"
        style:font-family={NODE_CONSTANTS.FONTS.word.family}
        style:font-size={NODE_CONSTANTS.FONTS.word.size}
        style:font-weight={NODE_CONSTANTS.FONTS.word.weight}
    >
        <slot name="content" />
    </text>

    <!-- Button Area -->
    <g transform="translate(0, {style.previewSize/4 - 60})">
        <slot name="button" />
    </g>
</BaseNode>

<style>
    text {
        text-anchor: middle;
        dominant-baseline: middle;
        user-select: none;
    }

    .title {
        fill: rgba(255, 255, 255, 0.7);
    }

    .content {
        fill: white;
    }
</style>