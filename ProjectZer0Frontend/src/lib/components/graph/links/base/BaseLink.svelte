<!-- src/lib/components/graph/links/base/BaseLink.svelte -->
<script lang="ts">
    import type { GraphNode } from '$lib/types/graph/core';
    import { LINK_CONSTANTS } from '../../../../constants/graph/links';
 
    export let sourceNode: GraphNode;
    export let targetNode: GraphNode;
    export let sourceX: number;
    export let sourceY: number;
    export let targetX: number;
    export let targetY: number;
 
    const linkId = `link-${Math.random().toString(36).slice(2)}`;
    const gradientId = `gradient-${linkId}`;
    const filterGlowId = `glow-${linkId}`;

    $: {
        // Log link position calculations for debugging
        const distance = Math.sqrt(
            Math.pow(targetX - sourceX, 2) + 
            Math.pow(targetY - sourceY, 2)
        );
        console.log(`Link ${linkId} metrics:`, {
            source: { x: sourceX, y: sourceY },
            target: { x: targetX, y: targetY },
            distance,
            sourceType: sourceNode.type,
            targetType: targetNode.type
        });
    }

    $: path = `M${sourceX},${sourceY}L${targetX},${targetY}`;
    $: gradientStart = { x: sourceX, y: sourceY };
    $: gradientEnd = { x: targetX, y: targetY };
</script>
 
<g 
    class="link" 
    data-link-id={linkId}
    data-source-id={sourceNode.id}
    data-target-id={targetNode.id}
>
    <defs>
        <linearGradient
            id={gradientId}
            gradientUnits="userSpaceOnUse"
            x1={gradientStart.x}
            y1={gradientStart.y}
            x2={gradientEnd.x}
            y2={gradientEnd.y}
        >
            <slot name="gradient">
                <stop
                    offset="0%"
                    stop-color={LINK_CONSTANTS.COLORS.WORD}
                    stop-opacity="0.8"
                />
                <stop
                    offset="100%"
                    stop-color={LINK_CONSTANTS.COLORS.WORD}
                    stop-opacity="0.4"
                />
            </slot>
        </linearGradient>

        <filter id={filterGlowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
            <feColorMatrix
                type="matrix"
                values="0 0 0 0 1   0 0 0 0 1   0 0 0 0 1  0 0 0 0.5 0"
            />
            <feComposite in="SourceGraphic" operator="over" />
        </filter>
    </defs>
 
    <!-- Background glow -->
    <path
        d={path}
        class="link-glow"
        filter={`url(#${filterGlowId})`}
    />
 
    <!-- Main link path -->
    <path
        d={path}
        stroke={`url(#${gradientId})`}
        class="link-path"
        data-source-type={sourceNode.type}
        data-target-type={targetNode.type}
    />
</g>
 
<style>
    .link {
        pointer-events: none;
    }
 
    .link-path {
        fill: none;
        stroke-width: 2px;
        vector-effect: non-scaling-stroke;
    }
 
    .link-glow {
        fill: none;
        stroke: rgba(255, 255, 255, 0.1);
        stroke-width: 4px;
        vector-effect: non-scaling-stroke;
    }
</style>