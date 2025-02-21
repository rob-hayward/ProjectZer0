<!-- ProjectZer0Frontend/src/lib/components/graph/nodes/base/BaseDetailNode.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';
    import { spring } from 'svelte/motion';
    import type { NodeStyle } from '$lib/types/nodes';
    import BaseSvgNode from './BaseNode.svelte';
    import { COORDINATE_SPACE } from '../../../../constants/graph';

    export let style: NodeStyle;

    const baseOpacity = spring(0, { stiffness: 0.3, damping: 0.8 });

    onMount(() => {
        baseOpacity.set(1);
    });

    // Use standard detail size from COORDINATE_SPACE
    $: radius = COORDINATE_SPACE.NODES.SIZES.STANDARD.DETAIL / 2;

    $: detailStyle = {
        ...style,
        previewSize: radius * 2  // Double the radius for diameter
    };
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