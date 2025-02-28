<!-- src/lib/components/graph/links/LinkRenderer.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';
    import type { RenderableLink } from '$lib/types/graph/enhanced';
    import { LINK_CONSTANTS } from '$lib/constants/graph/links';
    
    export let link: RenderableLink;
    
    // Create unique IDs for this link
    const linkId = `link-${Math.random().toString(36).slice(2, 9)}`;
    const gradientId = `gradient-${linkId}`;
    const filterId = `filter-${linkId}`;
    
    // Determine if this is a live definition link
    $: isLiveDefinition = link.type === 'live';
    
    // Get the appropriate colors based on link type
    $: sourceColor = LINK_CONSTANTS.COLORS.WORD;
    $: targetColor = isLiveDefinition ? 
        LINK_CONSTANTS.COLORS.DEFINITION.LIVE : 
        LINK_CONSTANTS.COLORS.DEFINITION.ALTERNATIVE;
    
    // Get the appropriate opacity based on link type
    $: startOpacity = LINK_CONSTANTS.STYLES.WORD_TO_DEFINITION.GRADIENT.START_OPACITY;
    $: endOpacity = LINK_CONSTANTS.STYLES.WORD_TO_DEFINITION.GRADIENT.END_OPACITY;

    // Get appropriate stroke width
    $: strokeWidth = isLiveDefinition ?
        LINK_CONSTANTS.STYLES.WORD_TO_DEFINITION.STROKE_WIDTH :
        LINK_CONSTANTS.STYLES.WORD_TO_ALT_DEFINITION.STROKE_WIDTH;
    
    onMount(() => {
        console.debug(`[LinkRenderer:${linkId}] Mounted:`, { 
            source: link.sourceId, 
            target: link.targetId,
            path: link.path.substring(0, 30) + '...'
        });
    });
</script>

{#if link.path}
    <g 
        class="link"
        data-link-id={linkId}
        data-source-id={link.sourceId}
        data-target-id={link.targetId}
        data-link-type={link.type}
    >
        <defs>
            <!-- Gradient definition -->
            <linearGradient
                id={gradientId}
                gradientUnits="userSpaceOnUse"
                x1={link.sourcePosition?.x || 0}
                y1={link.sourcePosition?.y || 0}
                x2={link.targetPosition?.x || 0}
                y2={link.targetPosition?.y || 0}
            >
                <stop
                    offset="0%"
                    stop-color={sourceColor}
                    stop-opacity={startOpacity}
                />
                <stop
                    offset="100%"
                    stop-color={targetColor}
                    stop-opacity={endOpacity}
                />
            </linearGradient>
            
            <!-- Glow filter -->
            <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
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
            d={link.path}
            class="link-glow"
            filter={`url(#${filterId})`}
            stroke-linecap="round"
            vector-effect="non-scaling-stroke"
        />
        
        <!-- Main link path -->
        <path
            d={link.path}
            stroke={`url(#${gradientId})`}
            class="link-path"
            stroke-width={strokeWidth}
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