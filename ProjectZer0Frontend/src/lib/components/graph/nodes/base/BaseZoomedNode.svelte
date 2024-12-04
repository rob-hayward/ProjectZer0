<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { spring } from 'svelte/motion';
    import type { NodeStyle } from '$lib/types/nodes';
    import { BaseNodeDisplay } from './BaseNodeDisplay';
    import { CIRCLE_RADIUS } from './BaseNodeConstants';

    export let style: NodeStyle;
    export let drawContent: (
        ctx: CanvasRenderingContext2D, 
        centerX: number, 
        centerY: number, 
        style: NodeStyle,
        isHovered: boolean
    ) => void;

    let canvas: HTMLCanvasElement;
    let isAnimating = true;
    const scale = spring(1, { stiffness: 0.3, damping: 0.8 });

    onMount(() => {
        const ctx = canvas.getContext('2d')!;
        let frame: number;

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;

            // Draw background circle and glow
            BaseNodeDisplay.drawNodeBackground(
                ctx, 
                centerX, 
                centerY, 
                CIRCLE_RADIUS, 
                false
            );

            // Draw content
            drawContent(ctx, centerX, centerY, style, false);

            frame = requestAnimationFrame(animate);
        }

        animate();

        return () => {
            cancelAnimationFrame(frame);
        };
    });
</script>

<div 
    class="zoomed-node"
    style="transform: scale({$scale});"
>
    <canvas 
        bind:this={canvas}
        width={window.innerWidth}
        height={window.innerHeight}
    />
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
    }

    canvas {
        width: 100%;
        height: 100%;
    }
</style>