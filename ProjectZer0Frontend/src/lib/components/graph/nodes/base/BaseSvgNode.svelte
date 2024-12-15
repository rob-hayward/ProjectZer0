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

    const filterId = `glow-${Math.random().toString(36).slice(2)}`;
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<g 
    class="base-node"
    {transform}
    on:mouseenter={() => dispatch('hover', { isHovered: true })}
    on:mouseleave={() => dispatch('hover', { isHovered: false })}
    on:click={handleClick}
>
<defs>
    <filter 
        id={filterId} 
        x="-50%" 
        y="-50%" 
        width="200%" 
        height="200%" 
        filterUnits="userSpaceOnUse"
    >
        <!-- Multiple blur layers for stronger glow -->
        <feGaussianBlur 
            in="SourceAlpha" 
            stdDeviation="2"
            result="blur1"
        />
        <feFlood 
            flood-color={style.colors.border}
            flood-opacity="1"
            result="color1"
        />
        <feComposite 
            in="color1"
            in2="blur1"
            operator="in"
            result="shadow1"
        />
        
        <!-- Second glow layer for intensity -->
        <feGaussianBlur 
            in="SourceAlpha" 
            stdDeviation="4"
            result="blur2"
        />
        <feFlood 
            flood-color={style.colors.border}
            flood-opacity="0.8"
            result="color2"
        />
        <feComposite 
            in="color2"
            in2="blur2"
            operator="in"
            result="shadow2"
        />

        <feMerge>
            <feMergeNode in="shadow2"/>
            <feMergeNode in="shadow1"/>
            <feMergeNode in="SourceGraphic"/>
        </feMerge>
    </filter>
</defs>
    
    <!-- Glow group -->
    <g class="glow-group">
        <!-- Background -->
        <circle
            r={style.previewSize / 2}
            class="background"
            fill={style.colors.background}
        />
        
        <!-- Border with glow -->
        <circle
            r={style.previewSize / 2}
            class="border"
            stroke={style.colors.border}
            stroke-width={style.stroke.preview.normal}
            fill="none"
            filter={`url(#${filterId})`}
        />
    </g>
    
    <!-- Content slot -->
    <slot {isHovered} />
</g>

<style>
    .base-node {
        transform-origin: center;
    }
    
    .glow-group {
        transform-box: fill-box;
        transform-origin: center;
    }
    
    .background {
        fill: rgba(0, 0, 0, 0.7);
    }
    
    .border {
        vector-effect: non-scaling-stroke;
    }

    :global(.base-node *) {
        vector-effect: non-scaling-stroke;
    }
</style>