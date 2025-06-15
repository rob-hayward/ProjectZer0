<!-- src/lib/components/graph/links/LinkRenderer.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';
    import type { RenderableLink } from '$lib/types/graph/enhanced';
    import { LINK_CONSTANTS } from '$lib/constants/graph/links';
    import { NODE_CONSTANTS } from '$lib/constants/graph/nodes';
    
    export let link: RenderableLink;
    
    // Create unique IDs for this link
    const linkId = `link-${Math.random().toString(36).slice(2, 9)}`;
    const gradientId = `gradient-${linkId}`;
    const filterId = `filter-${linkId}`;
    
    // Determine link types
    $: isLiveDefinition = link.type === 'live';
    $: isStatementRelation = link.type === 'related';
    $: isComment = link.type === 'comment';
    $: isReply = link.type === 'reply';
    $: isCommentForm = link.type === 'comment-form';
    $: isReplyForm = link.type === 'reply-form';
    // ADD: Check for answer links
    $: isAnswerLink = link.type === 'answers' || (link.type === 'alternative' && link.sourceType === 'openquestion');
    
    // ENHANCED: Get source and target colors based on node types
    $: sourceColor = getSourceColor(link);
    $: targetColor = getTargetColor(link);
    
    // Get relationship count from metadata if it exists (for statement relations)
    $: relationCount = isStatementRelation ? 
        (link.metadata?.relationCount || 1) : 
        1;
    
    // Enhanced visual properties based on relationship count
    $: strokeWidth = getStrokeWidth(link, relationCount);
    
    // Calculate gradient opacity based on relationship count for statement relations
    $: gradientStartOpacity = getGradientOpacity(link, relationCount, 'start');
    $: gradientEndOpacity = getGradientOpacity(link, relationCount, 'end');
    
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
    
    /**
     * Helper to extract base color from NODE_CONSTANTS
     */
    function extractBaseColorFromStyle(style: any): string {
        // If the style has a border property, use it (removing any alpha channel)
        if (style.border) {
            return style.border.substring(0, 7); // Extract the hex color without alpha
        }
        return "#FFFFFF"; // Default to white
    }
    
    /**
     * Get the source color based on the source node type
     * UPDATED to use NODE_CONSTANTS instead of direct color references
     */
    function getSourceColor(link: RenderableLink): string {
        if (isStatementRelation) {
            return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.STATEMENT);
        }
        
        if (isComment) {
            // Comment from central node to comment node - use the source node type color
            if (link.sourceType === 'word') {
                return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.WORD);
            } else if (link.sourceType === 'statement') {
                return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.STATEMENT);
            } else if (link.sourceType === 'definition') {
                return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.DEFINITION.live);
            } else if (link.sourceType === 'quantity') {
                return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.QUANTITY);
            } else if (link.sourceType === 'openquestion') {
                // ADD: OpenQuestion support
                return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.OPENQUESTION);
            }
        }
        
        if (isReply || isReplyForm) {
            // Reply from comment to comment - use comment color
            return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.COMMENT);
        }
        
        if (isCommentForm) {
            // Form from central or comment node
            if (link.sourceType === 'comment') {
                return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.COMMENT);
            } else {
                // From central node - use central node color
                if (link.sourceType === 'word') {
                    return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.WORD);
                } else if (link.sourceType === 'statement') {
                    return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.STATEMENT);
                } else if (link.sourceType === 'definition') {
                    return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.DEFINITION.live);
                } else if (link.sourceType === 'quantity') {
                    return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.QUANTITY);
                } else if (link.sourceType === 'openquestion') {
                    // ADD: OpenQuestion support
                    return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.OPENQUESTION);
                }
            }
        }
        
        // ADD: Handle answer links from openquestion
        if (isAnswerLink) {
            return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.OPENQUESTION);
        }
        
        // Default for word-definition links
        return LINK_CONSTANTS.COLORS.WORD;
    }

    /**
     * Get the target color based on the target node type
     * UPDATED to use NODE_CONSTANTS instead of direct color references
     */
    function getTargetColor(link: RenderableLink): string {
        if (isStatementRelation) {
            return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.STATEMENT);
        }
        
        if (isComment || isCommentForm) {
            // Link to a comment or comment form - always use comment color from NODE_CONSTANTS
            return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.COMMENT);
        }
        
        if (isReply || isReplyForm) {
            // Reply to another comment - always use comment color from NODE_CONSTANTS
            return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.COMMENT);
        }
        
        // ADD: Handle answer links to statements
        if (isAnswerLink) {
            // If target is statement-answer-form, use statement color
            if (link.targetType === 'statement-answer-form' || link.targetType === 'statement') {
                return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.STATEMENT);
            }
        }
        
        // Default handling for word-definition links
        return isLiveDefinition ? 
            LINK_CONSTANTS.COLORS.DEFINITION.LIVE : 
            LINK_CONSTANTS.COLORS.DEFINITION.ALTERNATIVE;
    }
    
    /**
     * Get stroke width based on link type
     */
    function getStrokeWidth(link: RenderableLink, relationCount: number): number {
        if (isStatementRelation) {
            // For statement relations, adjust based on relation count
            return Math.min(
                LINK_CONSTANTS.STYLES.STATEMENT_RELATION.MAX_STROKE_WIDTH,
                LINK_CONSTANTS.STYLES.STATEMENT_RELATION.BASE_STROKE_WIDTH + 
                (relationCount - 1) * LINK_CONSTANTS.STYLES.STATEMENT_RELATION.STROKE_WIDTH_INCREMENT
            );
        }
        
        if (isComment) {
            // Root comments - medium thickness
            return 2.0;
        }
        
        if (isReply) {
            // Replies - slightly thinner
            return 1.5;
        }
        
        if (isCommentForm || isReplyForm) {
            // Forms - dashed line effect
            return 1.5;
        }
        
        // ADD: Handle answer links
        if (isAnswerLink) {
            // Answer links - medium thickness
            return 2.0;
        }
        
        // Default for word-definition links
        return isLiveDefinition ?
            LINK_CONSTANTS.STYLES.WORD_TO_DEFINITION.STROKE_WIDTH :
            LINK_CONSTANTS.STYLES.WORD_TO_ALT_DEFINITION.STROKE_WIDTH;
    }
    
    /**
     * Get gradient opacity based on link type
     */
    function getGradientOpacity(link: RenderableLink, relationCount: number, position: 'start' | 'end'): number {
        if (isStatementRelation) {
            return Math.min(
                LINK_CONSTANTS.STYLES.STATEMENT_RELATION.GRADIENT.MAX_OPACITY,
                LINK_CONSTANTS.STYLES.STATEMENT_RELATION.GRADIENT.MIN_OPACITY + 
                (relationCount - 1) * LINK_CONSTANTS.STYLES.STATEMENT_RELATION.GRADIENT.OPACITY_INCREMENT
            );
        }
        
        // Comment links - higher opacity
        if (isComment || isReply) {
            return position === 'start' ? 0.9 : 0.9;
        }
        
        // Comment form links - dashed effect with lower opacity
        if (isCommentForm || isReplyForm) {
            return position === 'start' ? 0.7 : 0.7;
        }
        
        // ADD: Handle answer links
        if (isAnswerLink) {
            // Answer links - solid with good visibility
            return position === 'start' ? 0.8 : 0.8;
        }
        
        // Default for word-definition links
        return position === 'start' ?
            (isLiveDefinition ? 
                LINK_CONSTANTS.STYLES.WORD_TO_DEFINITION.GRADIENT.START_OPACITY :
                LINK_CONSTANTS.STYLES.WORD_TO_ALT_DEFINITION.GRADIENT.START_OPACITY) :
            (isLiveDefinition ? 
                LINK_CONSTANTS.STYLES.WORD_TO_DEFINITION.GRADIENT.END_OPACITY :
                LINK_CONSTANTS.STYLES.WORD_TO_ALT_DEFINITION.GRADIENT.END_OPACITY);
    }
    
    /**
     * ENHANCED: Get the stroke-dasharray for the link
     * Used to create dashed lines for form links
     * Now also checks metadata for custom dash patterns
     */
    $: dashArray = (isCommentForm || isReplyForm) ? '5,5' : 
                   (isAnswerLink && link.targetType === 'statement-answer-form') ? '5,5' : // Dashed for form links
                   (link.metadata?.isDashed || link.metadata?.linkStyle === 'form') ? '5,5' : // ENHANCED: Check metadata
                   'none';
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
                    stop-opacity={gradientStartOpacity}
                />
                <stop
                    offset="100%"
                    stop-color={targetColor}
                    stop-opacity={gradientEndOpacity}
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
            stroke-width={strokeWidth * 2}
            stroke-opacity={glowOpacity}
            vector-effect="non-scaling-stroke"
        />
        
        <!-- Main link path -->
        <path
            d={link.path}
            stroke={`url(#${gradientId})`}
            class="link-path"
            class:dashed-link={dashArray !== 'none'}
            stroke-width={strokeWidth}
            stroke-linecap="round"
            stroke-dasharray={dashArray}
            opacity="1"
            vector-effect="non-scaling-stroke"
        />
        
        <!-- Add tooltip for statement relations showing shared words -->
        {#if isStatementRelation && link.metadata?.sharedWords && link.metadata.sharedWords.length > 0}
            <title>{link.metadata.sharedWords.length} shared keywords: {link.metadata.sharedWords.join(', ')}</title>
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
        stroke-linecap: round;
        stroke-linejoin: round;
        vector-effect: non-scaling-stroke;
    }
    
    /* ENHANCED: Add animation for dashed links */
    .dashed-link {
        animation: dash-flow 20s linear infinite;
    }
    
    @keyframes dash-flow {
        to {
            stroke-dashoffset: -100;
        }
    }
</style>