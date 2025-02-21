<!-- ProjectZer0Frontend/src/lib/components/graph/nodes/base/BasePreviewNode.svelte -->
<script lang="ts">
    import type { NodeStyle } from '$lib/types/nodes';
    import BaseNode from './BaseNode.svelte';

    export let style: NodeStyle;
    export let transform: string;

    $: radius = style.previewSize / 2;
</script>

<BaseNode 
    {style}
    {transform}
>
    <slot name="title" {radius} />
    <slot name="content" {radius} />
    <slot name="score" {radius} />
    <slot name="button" {radius} />
</BaseNode>