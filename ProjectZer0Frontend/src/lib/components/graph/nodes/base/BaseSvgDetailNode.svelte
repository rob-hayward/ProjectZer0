<!-- ProjectZer0Frontend/src/lib/components/graph/nodes/base/BaseSvgDetailNode.svelte -->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { spring } from 'svelte/motion';
    import type { NodeStyle } from '$lib/types/nodes';
    import { CIRCLE_RADIUS } from './BaseNodeConstants';
    import BaseSvgNode from './BaseSvgNode.svelte';

    export let style: NodeStyle;
    export let width = window.innerWidth;
    export let height = window.innerHeight;

    const scale = spring(1, { stiffness: 0.3, damping: 0.8 });
    let isHovered = false;

    // Calculate viewBox to maintain aspect ratio
    $: viewBox = `0 0 ${width} ${height}`;
    $: centerX = width / 2;
    $: centerY = height / 2;

    // Animation setup
    let animationFrame: number;
    let baseOpacity = spring(0, { stiffness: 0.3, damping: 0.8 });

    onMount(() => {
        // Fade in animation
        baseOpacity.set(1);
        return () => {
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
            }
        };
    });
</script>

<div 
    class="zoomed-node"
    style="opacity: {$baseOpacity};"
>
    <svg
        {width}
        {height}
        {viewBox}
        class="zoomed-svg"
    >
        <defs>
            <!-- Background gradient -->
            <radialGradient id="zoomedBackground" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="rgba(0,0,0,0.9)" />
                <stop offset="100%" stop-color="rgba(0,0,0,0.7)" />
            </radialGradient>

            <!-- Glow filter -->
            <filter id="zoomedGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="10" />
                <feComposite in="SourceGraphic" operator="over" />
            </filter>
        </defs>

        <!-- Background overlay -->
        <rect
            x="0"
            y="0"
            {width}
            {height}
            fill="rgba(0,0,0,0.8)"
        />

        <!-- Main node container -->
        <g 
            class="node-container"
            style="transform: scale({$scale}); transform-origin: center;"
        >
            <!-- Base node circle -->
            <circle
                cx={centerX}
                cy={centerY}
                r={CIRCLE_RADIUS}
                class="base-circle"
                fill="url(#zoomedBackground)"
            />

            <!-- Decorative rings -->
            <circle
                cx={centerX}
                cy={centerY}
                r={CIRCLE_RADIUS + 10}
                class="outer-ring"
                fill="none"
            />

            <circle
                cx={centerX}
                cy={centerY}
                r={CIRCLE_RADIUS - 10}
                class="inner-ring"
                fill="none"
            />

            <!-- Content slot -->
            <g class="content-container">
                <slot
                    {centerX}
                    {centerY}
                    radius={CIRCLE_RADIUS}
                    {style}
                    {isHovered}
                />
            </g>
        </g>
    </svg>
</div>

<style>
    .zoomed-node {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
    }

    .zoomed-svg {
        width: 100%;
        height: 100%;
        overflow: visible;
    }

    .node-container {
        will-change: transform;
    }

    .base-circle {
        stroke: rgba(255, 255, 255, 0.2);
        stroke-width: 2;
        vector-effect: non-scaling-stroke;
    }

    .outer-ring {
        stroke: rgba(255, 255, 255, 0.15);
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
    }

    .inner-ring {
        stroke: rgba(255, 255, 255, 0.1);
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
    }

    .content-container {
        pointer-events: all;
    }

    :global(.zoomed-node text) {
        fill: white;
        font-family: 'Orbitron', sans-serif;
        text-anchor: middle;
    }

    :global(.zoomed-node path) {
        vector-effect: non-scaling-stroke;
    }

    :global(.zoomed-node .animated-element) {
        transition: all 0.3s ease-out;
    }
</style>