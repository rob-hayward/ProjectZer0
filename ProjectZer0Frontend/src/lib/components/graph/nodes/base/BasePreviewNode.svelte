<!-- src/lib/components/graph/nodes/base/BasePreviewNode.svelte -->
<script lang="ts">
    import type { NodeStyle } from '$lib/types/nodes';
    import BaseNode from './BaseNode.svelte';

    export let style: NodeStyle;
    export let transform: string;
</script>

<BaseNode 
    {style}
    {transform}
>
    <slot name="title" />
    <slot name="content" />
    <slot name="score" />
    <slot name="button" />
</BaseNode>