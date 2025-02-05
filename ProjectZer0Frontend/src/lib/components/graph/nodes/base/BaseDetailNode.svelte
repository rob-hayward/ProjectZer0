<!-- ProjectZer0Frontend/src/lib/components/graph/nodes/base/BaseDetailNode.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';
    import { spring } from 'svelte/motion';
    import type { NodeStyle } from '$lib/types/nodes';
    import BaseSvgNode from './BaseNode.svelte';
    import { CIRCLE_RADIUS } from '../../../../constants/graph/nodes';
 
    export let style: NodeStyle;
 
    const baseOpacity = spring(0, { stiffness: 0.3, damping: 0.8 });
 
    onMount(() => {
        baseOpacity.set(1);
    });
 
    $: detailStyle = {
        ...style,
        previewSize: CIRCLE_RADIUS * 2
    };
 
    $: radius = CIRCLE_RADIUS;
</script>
 
<g 
    class="detail-node"
    style:opacity={$baseOpacity}
    style:transform-origin="center"
>
    <BaseSvgNode 
        transform="" 
        style={detailStyle}
    >
        <slot {radius} />
    </BaseSvgNode>
</g>
 
<style>
    .detail-node {
        will-change: transform;
    }
 
    :global(.detail-node text) {
        fill: white;
        font-family: 'Orbitron', sans-serif;
        text-anchor: middle;
    }
</style>