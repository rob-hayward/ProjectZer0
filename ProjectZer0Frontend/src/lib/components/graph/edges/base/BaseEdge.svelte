<!-- ProjectZer0Frontend/src/lib/components/graph/edges/base/BaseEdge.svelte -->
<script lang="ts">
    import type { GraphNode } from '$lib/types/graph';
    import type { WordNode, Definition } from '$lib/types/nodes';
    import { NODE_CONSTANTS } from '../../nodes/base/BaseNodeConstants';
    
    export let sourceNode: GraphNode;
    export let targetNode: GraphNode;
    export let sourceX: number;
    export let sourceY: number;
    export let targetX: number;
    export let targetY: number;

    const edgeId = `edge-${Math.random().toString(36).slice(2)}`;
    const gradientId = `gradient-${edgeId}`;

    // Determine if this is a live definition connection
    $: isLiveDefinition = 
        targetNode.type === 'definition' && 
        targetNode.group === 'live-definition';

    // Get node colors
    $: sourceColor = NODE_CONSTANTS.COLORS.WORD.border;
    $: targetColor = isLiveDefinition ? 
        NODE_CONSTANTS.COLORS.DEFINITION.live.border : 
        NODE_CONSTANTS.COLORS.DEFINITION.alternative.border;

    // Calculate path with proper node radii
    $: path = (() => {
        const sourceRadius = sourceNode.type === 'word' ? 
            NODE_CONSTANTS.SIZES.WORD.preview / 2 : 
            NODE_CONSTANTS.SIZES.DEFINITION.live.preview / 2;

        const targetRadius = targetNode.type === 'word' ? 
            NODE_CONSTANTS.SIZES.WORD.preview / 2 : 
            (isLiveDefinition ? 
                NODE_CONSTANTS.SIZES.DEFINITION.live.preview / 2 : 
                NODE_CONSTANTS.SIZES.DEFINITION.alternative.preview / 2);

        const dx = targetX - sourceX;
        const dy = targetY - sourceY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance === 0) return '';

        const angle = Math.atan2(dy, dx);
        const startX = sourceX + (sourceRadius * Math.cos(angle));
        const startY = sourceY + (sourceRadius * Math.sin(angle));
        const endX = targetX - (targetRadius * Math.cos(angle));
        const endY = targetY - (targetRadius * Math.sin(angle));

        return `M ${startX} ${startY} L ${endX} ${endY}`;
    })();
</script>

<g class="edge">
    <defs>
        <linearGradient
            id={gradientId}
            gradientUnits="userSpaceOnUse"
            x1={sourceX}
            y1={sourceY}
            x2={targetX}
            y2={targetY}
        >
            <stop offset="0%" stop-color={sourceColor} stop-opacity="0.8" />
            <stop offset="100%" stop-color={targetColor} stop-opacity="0.8" />
        </linearGradient>
    </defs>

    <path
        d={path}
        stroke={`url(#${gradientId})`}
        stroke-width="2"
        class="edge-path"
    />
</g>

<style>
    .edge-path {
        fill: none;
        vector-effect: non-scaling-stroke;
    }

    .edge {
        pointer-events: none;
        mix-blend-mode: screen;
    }
</style>