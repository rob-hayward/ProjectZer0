<!-- ProjectZer0Frontend/src/lib/components/graph/nodes/base/BaseSvgNode.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { NodeStyle } from '$lib/types/nodes';
    
    export let transform: string;
    export let style: NodeStyle;
    export let isHovered = false;
    
    const dispatch = createEventDispatcher<{
        click: void;
        hover: { isHovered: boolean };
    }>();

    function handleClick() {
        dispatch('click');
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<g 
    class="base-node"
    class:hovered={isHovered}
    {transform}
    on:mouseenter={() => dispatch('hover', { isHovered: true })}
    on:mouseleave={() => dispatch('hover', { isHovered: false })}
    on:click={handleClick}
>
    <!-- Background -->
    <circle
        r={style.previewSize / 2}
        class="background"
        fill={style.colors.background}
    />
    
    <!-- Border -->
    <circle
        r={style.previewSize / 2}
        class="border"
        stroke={isHovered ? style.colors.hover : style.colors.border}
        stroke-width="2"
        fill="none"
    />
    
    <!-- Content slot -->
    <slot {isHovered} />
</g>

<style>
    .base-node {
        transform-origin: center;
        transition: transform 0.3s ease-out;
    }
    
    .hovered {
        transform: scale(1.05);
    }
    
    .background {
        fill: rgba(0, 0, 0, 0.7);
    }
    
    .border {
        transition: stroke 0.3s ease-out;
    }

    :global(.base-node *) {
        vector-effect: non-scaling-stroke;
    }
</style>