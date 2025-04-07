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
    
    // Determine link types
    $: isLiveDefinition = link.type === 'live';
    $: isStatementRelation = link.type === 'related';
    
    // Get source and target colors based on link type
    $: sourceColor = isStatementRelation ? 
        LINK_CONSTANTS.COLORS.STATEMENT : 
        LINK_CONSTANTS.COLORS.WORD;
    $: targetColor = isStatementRelation ? 
        LINK_CONSTANTS.COLORS.STATEMENT : 
        (isLiveDefinition ? 
            LINK_CONSTANTS.COLORS.DEFINITION.LIVE : 
            LINK_CONSTANTS.COLORS.DEFINITION.ALTERNATIVE);
    
    // Get gradient opacity based on link type
    $: startOpacity = isStatementRelation ?
        LINK_CONSTANTS.STYLES.STATEMENT_RELATION.GRADIENT.START_OPACITY :
        LINK_CONSTANTS.STYLES.WORD_TO_DEFINITION.GRADIENT.START_OPACITY;
    $: endOpacity = isStatementRelation ?
        LINK_CONSTANTS.STYLES.STATEMENT_RELATION.GRADIENT.END_OPACITY :
        LINK_CONSTANTS.STYLES.WORD_TO_DEFINITION.GRADIENT.END_OPACITY;

    // Get relationship count from metadata if it exists (for statement relations)
    $: relationCount = isStatementRelation ? (link.metadata?.relationCount || 1) : 1;
    
    // Calculate stroke width
    $: strokeWidth = isStatementRelation ?
        // For statement relations, adjust based on relation count
        Math.min(
            LINK_CONSTANTS.STYLES.STATEMENT_RELATION.MAX_STROKE_WIDTH,
            LINK_CONSTANTS.STYLES.STATEMENT_RELATION.BASE_STROKE_WIDTH + 
            (relationCount - 1) * LINK_CONSTANTS.STYLES.STATEMENT_RELATION.STROKE_WIDTH_INCREMENT
        ) :
        // For other links, use standard values
        (isLiveDefinition ?
            LINK_CONSTANTS.STYLES.WORD_TO_DEFINITION.STROKE_WIDTH :
            LINK_CONSTANTS.STYLES.WORD_TO_ALT_DEFINITION.STROKE_WIDTH);
    
    // Calculate glow intensity based on relationship count for statement relations
    $: glowIntensity = isStatementRelation ? 
        Math.min(
            LINK_CONSTANTS.STYLES.STATEMENT_RELATION.GLOW.MAX_INTENSITY,
            LINK_CONSTANTS.STYLES.STATEMENT_RELATION.GLOW.BASE_INTENSITY + 
            (relationCount - 1) * LINK_CONSTANTS.STYLES.STATEMENT_RELATION.GLOW.INTENSITY_INCREMENT
        ) : 2;
    
    // Calculate glow opacity
    $: glowOpacity = isStatementRelation ? 
        Math.min(
            LINK_CONSTANTS.STYLES.STATEMENT_RELATION.GLOW.MAX_OPACITY,
            LINK_CONSTANTS.STYLES.STATEMENT_RELATION.GLOW.BASE_OPACITY + 
            (relationCount - 1) * LINK_CONSTANTS.STYLES.STATEMENT_RELATION.GLOW.OPACITY_INCREMENT
        ) : 0.5;
    
    onMount(() => {
        console.debug(`[LinkRenderer:${linkId}] Mounted:`, { 
            source: link.sourceId, 
            target: link.targetId,
            path: link.path.substring(0, 30) + '...',
            type: link.type,
            relationCount: relationCount
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
        data-relation-count={relationCount}
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
            
            <!-- Glow filter with dynamic intensity for statement relations -->
            <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation={glowIntensity} />
                <feColorMatrix
                    type="matrix"
                    values="0 0 0 0 1   0 0 0 0 1   0 0 0 0 1  0 0 0 {glowOpacity} 0"
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
        
        <!-- Add tooltip for statement relations showing shared words -->
        {#if isStatementRelation && link.metadata?.sharedWords && link.metadata.sharedWords.length > 0}
            <title>Shared keywords: {link.metadata.sharedWords.join(', ')}</title>
        {/if}
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