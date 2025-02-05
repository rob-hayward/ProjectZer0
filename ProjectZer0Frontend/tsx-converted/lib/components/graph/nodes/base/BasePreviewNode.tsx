/**
 * NOTICE: This is a converted Svelte component file.
 * Original Svelte file: /Users/rob/vsCodeProjects/ProjectZer0/ProjectZer0Frontend/src/lib/components/graph/nodes/base/BasePreviewNode.svelte
 * This conversion was created to share with Claude for development purposes.
 */


    import type { NodeStyle } from '$lib/types/nodes';
    import BaseNode from './BaseNode.svelte';

    export let style: NodeStyle;
    export let transform: string;

    useEffect(() => { radius = style.previewSize / 2; });


// Original Svelte Template:
/*
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
*/

// Converted JSX:
export default function Component() {
  return (
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
  );
}