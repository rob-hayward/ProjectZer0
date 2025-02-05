<!-- ProjectZer0Frontend/src/lib/components/graph/edges/Edge.svelte -->
<!-- <script lang="ts">
    import type { GraphEdge } from '$lib/types/graph/core';
    import { EDGE_CONSTANTS } from '../../../constants/graph/EdgeConstants';
    
    export let source: { x: number; y: number };
    export let target: { x: number; y: number };
    export let link: GraphEdge;

    const gradientId = `edge-gradient-${Math.random().toString(36).slice(2)}`;
    
    $: color = link.type === 'live' ? 
        EDGE_CONSTANTS.COLORS.DEFINITION.LIVE : 
        EDGE_CONSTANTS.COLORS.DEFINITION.ALTERNATIVE;
</script>

<g class="edge">
    <defs>
        <linearGradient 
            id={gradientId} 
            gradientUnits="userSpaceOnUse"
            x1={source.x}
            y1={source.y}
            x2={target.x}
            y2={target.y}
        >
            <stop 
                offset="0%" 
                stop-color={EDGE_CONSTANTS.COLORS.WORD} 
                stop-opacity="0.8"
            />
            <stop 
                offset="100%" 
                stop-color={color} 
                stop-opacity="0.8"
            />
        </linearGradient>
    </defs>

    <line
        x1={source.x}
        y1={source.y}
        x2={target.x}
        y2={target.y}
        stroke={`url(#${gradientId})`}
        stroke-width="2"
        class="edge-line"
    />
</g>

<style>
    .edge-line {
        vector-effect: non-scaling-stroke;
    }

    .edge {
        pointer-events: none;
    }
</style> -->