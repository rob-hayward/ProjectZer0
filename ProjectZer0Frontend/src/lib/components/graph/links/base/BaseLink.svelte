<!-- ProjectZer0Frontend/src/lib/components/graph/links/base/BaseLink.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';
    import type { GraphNode } from '$lib/types/graph/core';
    import { LINK_CONSTANTS } from '$lib/constants/graph/links';
    import { COORDINATE_SPACE } from '$lib/constants/graph';
 
    export let sourceNode: GraphNode;
    export let targetNode: GraphNode;
    export let sourceX: number;
    export let sourceY: number;
    export let targetX: number;
    export let targetY: number;
    export let version: any = undefined;

    const linkId = `link-${Math.random().toString(36).slice(2)}`;
    const gradientId = `gradient-${linkId}`;
    const filterGlowId = `glow-${linkId}`;
    
    // Path data
    let path = "";
    
    // Hard-coded radius values based on COORDINATE_SPACE constants
    const RADII = {
        WORD: {
            DETAIL: COORDINATE_SPACE.NODES.SIZES.WORD.DETAIL / 2, // 300
            PREVIEW: COORDINATE_SPACE.NODES.SIZES.WORD.PREVIEW / 2 // 67.5
        },
        DEFINITION: {
            DETAIL: COORDINATE_SPACE.NODES.SIZES.DEFINITION.DETAIL / 2, // 300
            PREVIEW: COORDINATE_SPACE.NODES.SIZES.DEFINITION.PREVIEW / 2 // 160
        },
        NAVIGATION: COORDINATE_SPACE.NODES.SIZES.NAVIGATION / 2 // 40
    };
    
    function calculatePath() {
        if (!sourceNode || !targetNode) return "";
        
        // Get exact radius based on node type and mode
        let sourceRadius, targetRadius;
        
        // Source node radius (usually word node)
        if (sourceNode.type === 'word') {
            // Explicit mode check for word nodes
            sourceRadius = (sourceNode.mode === 'detail') ? 
                RADII.WORD.DETAIL : 
                RADII.WORD.PREVIEW;
        } else if (sourceNode.type === 'definition') {
            sourceRadius = (sourceNode.mode === 'detail') ?
                RADII.DEFINITION.DETAIL :
                RADII.DEFINITION.PREVIEW;
        } else {
            sourceRadius = RADII.NAVIGATION;
        }
        
        // Target node radius (usually definition node)
        if (targetNode.type === 'definition') {
            targetRadius = (targetNode.mode === 'detail') ?
                RADII.DEFINITION.DETAIL :
                RADII.DEFINITION.PREVIEW;
        } else if (targetNode.type === 'word') {
            targetRadius = (targetNode.mode === 'detail') ?
                RADII.WORD.DETAIL :
                RADII.WORD.PREVIEW;
        } else {
            targetRadius = RADII.NAVIGATION;
        }
        
        // Calculate vector between nodes
        const dx = targetX - sourceX;
        const dy = targetY - sourceY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Skip if distance is zero to avoid division by zero
        if (distance === 0) return "";
        
        // Calculate unit vector
        const unitX = dx / distance;
        const unitY = dy / distance;
        
        // Calculate points on the perimeter of each node
        const startX = sourceX + (unitX * sourceRadius);
        const startY = sourceY + (unitY * sourceRadius);
        const endX = targetX - (unitX * targetRadius);
        const endY = targetY - (unitY * targetRadius);
        
        // Return SVG path string
        return `M${startX},${startY}L${endX},${endY}`;
    }
    
    // Update path when required properties change
    $: {
        // Only recalculate when we have all necessary data
        if (sourceNode && targetNode && sourceX !== undefined && sourceY !== undefined && 
            targetX !== undefined && targetY !== undefined) {
            path = calculatePath();
        }
    }
    
    // Force recalculation when version changes
    $: if (version !== undefined) {
        path = calculatePath();
    }
    
    onMount(() => {
        path = calculatePath();
    });
</script>

{#if path}
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
                x1={sourceX}
                y1={sourceY}
                x2={targetX}
                y2={targetY}
            >
                <slot name="gradient">
                    <stop
                        offset="0%"
                        stop-color={LINK_CONSTANTS.COLORS.WORD}
                        stop-opacity={LINK_CONSTANTS.STYLES.WORD_TO_DEFINITION.GRADIENT.START_OPACITY}
                    />
                    <stop
                        offset="100%"
                        stop-color={LINK_CONSTANTS.COLORS.WORD}
                        stop-opacity={LINK_CONSTANTS.STYLES.WORD_TO_DEFINITION.GRADIENT.END_OPACITY}
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
            stroke-linecap="round"
            vector-effect="non-scaling-stroke"
        />
    
        <!-- Main link path -->
        <path
            d={path}
            stroke={`url(#${gradientId})`}
            class="link-path"
            stroke-width={LINK_CONSTANTS.STYLES.WORD_TO_DEFINITION.STROKE_WIDTH}
            stroke-linecap="round"
            opacity="1"
            vector-effect="non-scaling-stroke"
        />
    </g>
{/if}
 
<style>
    .link {
        pointer-events: none;
    }
 
    .link-path {
        fill: none;
        vector-effect: non-scaling-stroke;
        stroke-opacity: 1;
        stroke-linecap: round;
        stroke-linejoin: round;
    }
 
    .link-glow {
        fill: none;
        stroke: rgba(255, 255, 255, 0.1);
        stroke-width: 4px;
        stroke-opacity: 0.5;
        stroke-linecap: round;
        stroke-linejoin: round;
        vector-effect: non-scaling-stroke;
    }
</style>