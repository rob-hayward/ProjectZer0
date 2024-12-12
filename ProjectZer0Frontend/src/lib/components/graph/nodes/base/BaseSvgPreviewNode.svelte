<!-- src/lib/components/graph/nodes/base/BaseSvgPreviewNode.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { spring } from 'svelte/motion';
    import type { NodeStyle } from '$lib/types/nodes';

    export let style: NodeStyle;
    export let transform: string;

    let isHovered = false;
    
    const dispatch = createEventDispatcher<{
        detail: void;
        hover: { isHovered: boolean };
    }>();

    function handleMouseEnter() {
        isHovered = true;
        dispatch('hover', { isHovered });
    }

    function handleMouseLeave() {
        isHovered = false;
        dispatch('hover', { isHovered });
    }

    function handleClick() {
        dispatch('detail');
    }

    // Spring animation for hover effect
    const hoverScale = spring(1, {
        stiffness: 0.1,
        damping: 0.6
    });

    $: hoverScale.set(isHovered ? 1.05 : 1);
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<g 
    class="preview-node"
    {transform}
    on:mouseenter={handleMouseEnter}
    on:mouseleave={handleMouseLeave}
    on:click={handleClick}
>
    <g transform={`scale(${$hoverScale})`}>
        <slot 
            {isHovered} 
            {style}
        />
    </g>
</g>

<style>
    .preview-node {
        transform-origin: center;
        transition: transform 0.3s ease-out;
        cursor: pointer;
    }

    :global(.preview-node *) {
        vector-effect: non-scaling-stroke;
    }
</style>