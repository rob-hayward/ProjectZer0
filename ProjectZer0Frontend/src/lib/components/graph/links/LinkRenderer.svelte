<!-- src/lib/components/graph/links/LinkRenderer.svelte - Enhanced for Smooth Reveals -->
<script lang="ts">
    import { onMount } from 'svelte';
    import type { RenderableLink } from '$lib/types/graph/enhanced';
    import { ConsolidatedRelationshipUtils } from '$lib/types/graph/enhanced';
    import { LINK_CONSTANTS } from '$lib/constants/graph/links';
    import { NODE_CONSTANTS } from '$lib/constants/graph/nodes';
    
    export let link: RenderableLink;
    export let viewType: string = 'standard';
    
    // Create unique IDs for this link
    const linkId = `link-${Math.random().toString(36).slice(2, 9)}`;
    const gradientId = `gradient-${linkId}`;
    const filterId = `filter-${linkId}`;
    
    // Use consolidated relationship utilities for all calculations
    $: isConsolidated = ConsolidatedRelationshipUtils.isConsolidated(link);
    $: relationshipCount = ConsolidatedRelationshipUtils.getRelationshipCount(link);
    $: primaryKeyword = ConsolidatedRelationshipUtils.getPrimaryKeyword(link);
    $: allKeywords = ConsolidatedRelationshipUtils.getAllKeywords(link);
    $: effectiveStrength = ConsolidatedRelationshipUtils.getEffectiveStrength(link);
    $: tooltipText = ConsolidatedRelationshipUtils.getTooltipText(link);
    $: visualProps = ConsolidatedRelationshipUtils.getVisualProperties(link);
    
    // Determine link types
    $: isLiveDefinition = link.type === 'live';
    $: isStatementRelation = link.type === 'related';
    $: isComment = link.type === 'comment';
    $: isReply = link.type === 'reply';
    $: isCommentForm = link.type === 'comment-form';
    $: isReplyForm = link.type === 'reply-form';
    $: isAnswerLink = link.type === 'answers' || (link.type === 'alternative' && link.sourceType === 'openquestion');
    $: isSharedKeywordLink = link.type === 'shared_keyword';
    $: isUniversalAnswerLink = link.type === 'answers';
    $: isRespondsToLink = link.type === 'responds_to';
    $: isRelatedToLink = link.type === 'related_to';
    
    // Get source and target colors based on node types
    $: sourceColor = getSourceColor(link);
    $: targetColor = getTargetColor(link);
    
    // Calculate sophisticated visual opacity
    $: calculatedVisualOpacity = (() => {
        // Check if link has existing opacity properties
        if ((link as any).opacity !== undefined && (link as any).opacity !== null) {
            return (link as any).opacity;
        } else if (link.metadata?.opacity !== undefined && link.metadata.opacity !== null) {
            return link.metadata.opacity;
        } else {
            // Use the sophisticated gradient opacity calculation
            const startOpacity = getGradientOpacity('start');
            const endOpacity = getGradientOpacity('end');
            return (startOpacity + endOpacity) / 2;
        }
    })();
    
    // CSS approach for universal view vs traditional approach for other views
    $: linkOpacity = viewType === 'universal' 
        ? 1 // CSS will handle opacity via custom properties and classes
        : calculatedVisualOpacity; // Traditional immediate opacity for other views
    
    // Use calculated properties for visual styling
    $: strokeWidth = visualProps.strokeWidth;
    $: strokeOpacity = linkOpacity;
    $: glowOpacity = linkOpacity * 0.7;
    $: dashArray = visualProps.dashArray;
    $: glowIntensity = visualProps.glowIntensity;
    
    // Gradient opacity calculation for consolidated relationships
    $: gradientStartOpacity = getGradientOpacity('start');
    $: gradientEndOpacity = getGradientOpacity('end');
    
    /**
     * Helper to extract base color from NODE_CONSTANTS
     */
    function extractBaseColorFromStyle(style: any): string {
        if (style.border) {
            return style.border.substring(0, 7); // Extract the hex color without alpha
        }
        return "#FFFFFF"; // Default to white
    }
    
    /**
     * Get the source color based on the source node type
     */
    function getSourceColor(link: RenderableLink): string {
        // Universal graph shared keyword relationships
        if (isSharedKeywordLink) {
            switch (link.sourceType) {
                case 'statement':
                    return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.STATEMENT);
                case 'openquestion':
                    return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.OPENQUESTION);
                case 'quantity':
                    return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.QUANTITY);
                default:
                    return LINK_CONSTANTS.COLORS.STATEMENT;
            }
        }
        
        if (isStatementRelation) {
            return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.STATEMENT);
        }
        
        if (isComment) {
            // Comment from central node to comment node - use the source node type color
            switch (link.sourceType) {
                case 'word':
                    return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.WORD);
                case 'statement':
                    return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.STATEMENT);
                case 'definition':
                    return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.DEFINITION.live);
                case 'quantity':
                    return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.QUANTITY);
                case 'openquestion':
                    return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.OPENQUESTION);
                default:
                    return LINK_CONSTANTS.COLORS.WORD;
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
                switch (link.sourceType) {
                    case 'word':
                        return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.WORD);
                    case 'statement':
                        return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.STATEMENT);
                    case 'definition':
                        return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.DEFINITION.live);
                    case 'quantity':
                        return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.QUANTITY);
                    case 'openquestion':
                        return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.OPENQUESTION);
                    default:
                        return LINK_CONSTANTS.COLORS.WORD;
                }
            }
        }
        
        // Handle answer links from openquestion
        if (isAnswerLink) {
            return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.OPENQUESTION);
        }
        
        // Universal graph relationship types
        if (isUniversalAnswerLink || isRespondsToLink || isRelatedToLink) {
            switch (link.sourceType) {
                case 'statement':
                    return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.STATEMENT);
                case 'openquestion':
                    return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.OPENQUESTION);
                case 'quantity':
                    return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.QUANTITY);
                default:
                    return LINK_CONSTANTS.COLORS.STATEMENT;
            }
        }
        
        // Default for word-definition links
        return LINK_CONSTANTS.COLORS.WORD;
    }

    /**
     * Get the target color based on the target node type
     */
    function getTargetColor(link: RenderableLink): string {
        // Universal graph shared keyword relationships
        if (isSharedKeywordLink) {
            switch (link.targetType) {
                case 'statement':
                    return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.STATEMENT);
                case 'openquestion':
                    return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.OPENQUESTION);
                case 'quantity':
                    return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.QUANTITY);
                default:
                    return LINK_CONSTANTS.COLORS.STATEMENT;
            }
        }
        
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
        
        // Handle answer links to statements
        if (isAnswerLink) {
            // If target is statement-answer-form, use statement color
            if (link.targetType === 'statement-answer-form' || link.targetType === 'statement') {
                return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.STATEMENT);
            }
        }
        
        // Universal graph relationship types
        if (isUniversalAnswerLink || isRespondsToLink || isRelatedToLink) {
            switch (link.targetType) {
                case 'statement':
                    return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.STATEMENT);
                case 'openquestion':
                    return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.OPENQUESTION);
                case 'quantity':
                    return extractBaseColorFromStyle(NODE_CONSTANTS.COLORS.QUANTITY);
                default:
                    return LINK_CONSTANTS.COLORS.STATEMENT;
            }
        }
        
        // Default handling for word-definition links
        return isLiveDefinition ? 
            LINK_CONSTANTS.COLORS.DEFINITION.LIVE : 
            LINK_CONSTANTS.COLORS.DEFINITION.ALTERNATIVE;
    }
    
    /**
     * Get gradient opacity based on link type and consolidation
     */
    function getGradientOpacity(position: 'start' | 'end'): number {
        const baseOpacity = 1.0; // Use 1.0 as base for calculations
        
        // For consolidated relationships, boost opacity
        if (isConsolidated) {
            const consolidationBonus = Math.min(0.2, (relationshipCount - 1) * 0.02);
            return Math.min(0.95, baseOpacity + consolidationBonus);
        }
        
        if (isStatementRelation) {
            return Math.min(
                LINK_CONSTANTS.STYLES.STATEMENT_RELATION.GRADIENT.MAX_OPACITY * baseOpacity,
                (LINK_CONSTANTS.STYLES.STATEMENT_RELATION.GRADIENT.MIN_OPACITY + 
                (relationshipCount - 1) * LINK_CONSTANTS.STYLES.STATEMENT_RELATION.GRADIENT.OPACITY_INCREMENT) * baseOpacity
            );
        }
        
        // Comment links - higher opacity
        if (isComment || isReply) {
            return position === 'start' ? baseOpacity * 0.9 : baseOpacity * 0.9;
        }
        
        // Comment form links - dashed effect with lower opacity
        if (isCommentForm || isReplyForm) {
            return position === 'start' ? baseOpacity * 0.7 : baseOpacity * 0.7;
        }
        
        // Handle answer links
        if (isAnswerLink) {
            return position === 'start' ? baseOpacity * 0.8 : baseOpacity * 0.8;
        }
        
        // Universal graph link opacities
        if (isSharedKeywordLink) {
            // Shared keyword links - opacity based on strength and consolidation
            const strengthBonus = effectiveStrength * 0.3;
            const consolidationBonus = isConsolidated ? 0.1 : 0;
            return Math.min(0.9, (0.6 + strengthBonus + consolidationBonus) * baseOpacity);
        }
        
        if (isUniversalAnswerLink) {
            return position === 'start' ? baseOpacity * 0.9 : baseOpacity * 0.9;
        }
        
        if (isRespondsToLink || isRelatedToLink) {
            return position === 'start' ? baseOpacity * 0.8 : baseOpacity * 0.8;
        }
        
        // Default for word-definition links
        const defaultOpacity = position === 'start' ?
            (isLiveDefinition ? 
                LINK_CONSTANTS.STYLES.WORD_TO_DEFINITION.GRADIENT.START_OPACITY :
                LINK_CONSTANTS.STYLES.WORD_TO_ALT_DEFINITION.GRADIENT.START_OPACITY) :
            (isLiveDefinition ? 
                LINK_CONSTANTS.STYLES.WORD_TO_DEFINITION.GRADIENT.END_OPACITY :
                LINK_CONSTANTS.STYLES.WORD_TO_ALT_DEFINITION.GRADIENT.END_OPACITY);
        
        return defaultOpacity * baseOpacity;
    }
    
    /**
     * Get visual indicator for consolidated relationships
     */
    $: consolidationIndicator = (() => {
        if (!isConsolidated) return '';
        
        if (relationshipCount >= 5) return '●●●'; // Strong consolidation
        if (relationshipCount >= 3) return '●●'; // Medium consolidation
        return '●'; // Light consolidation
    })();
    
    /**
     * Get link label for consolidated relationships
     */
    $: linkLabel = (() => {
        if (isConsolidated) {
            return `${primaryKeyword} +${relationshipCount - 1}`;
        }
        if (primaryKeyword) {
            return primaryKeyword;
        }
        return '';
    })();
</script>

{#if link.path}
    <g 
        class="link"
        class:consolidated={isConsolidated}
        class:strong-consolidation={relationshipCount >= 5}
        class:medium-consolidation={relationshipCount >= 3 && relationshipCount < 5}
        class:light-consolidation={relationshipCount >= 2 && relationshipCount < 3}
        class:phantom-link={viewType === 'universal'}
        data-link-id={linkId}
        data-source-id={link.sourceId}
        data-target-id={link.targetId}
        data-link-type={link.type}
        data-relation-count={relationshipCount}
        data-is-consolidated={isConsolidated}
        data-effective-strength={effectiveStrength.toFixed(2)}
        data-view-type={viewType}
        style="--link-opacity: {calculatedVisualOpacity}; --glow-opacity: {calculatedVisualOpacity * 0.7}; --link-{linkId}-opacity: {calculatedVisualOpacity}"
    >
        <defs>
            <!-- Gradient definition with consolidated relationship support -->
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
            
            <!-- Glow filter with dynamic intensity for consolidated relationships -->
            <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation={glowIntensity} />
                <feColorMatrix
                    type="matrix"
                    values="0 0 0 0 1   0 0 0 0 1   0 0 0 0 1  0 0 0 {glowOpacity} 0"
                />
                <feComposite in="SourceGraphic" operator="over" />
            </filter>
            
            <!-- Pattern for consolidated relationships -->
            {#if isConsolidated}
                <pattern id="consolidation-pattern-{linkId}" x="0" y="0" width="10" height="4" patternUnits="userSpaceOnUse">
                    <rect width="10" height="4" fill="none"/>
                    <circle cx="2" cy="2" r="0.5" fill={sourceColor} opacity="0.6"/>
                    <circle cx="8" cy="2" r="0.5" fill={targetColor} opacity="0.6"/>
                </pattern>
            {/if}
        </defs>
        
        <!-- Background glow with enhanced intensity for consolidated relationships -->
        <path
            d={link.path}
            class="link-glow"
            class:consolidated-glow={isConsolidated}
            filter={`url(#${filterId})`}
            stroke-linecap="round"
            stroke-width={strokeWidth * 2}
            stroke-opacity={glowOpacity}
            vector-effect="non-scaling-stroke"
        />
        
        <!-- Main link path with CSS custom properties and smooth reveal -->
        <path
            d={link.path}
            stroke={`url(#${gradientId})`}
            class="link-path"
            class:consolidated-link={isConsolidated}
            class:dashed-link={dashArray !== 'none'}
            stroke-width={strokeWidth}
            stroke-linecap="round"
            stroke-dasharray={dashArray}
            opacity={strokeOpacity}
            vector-effect="non-scaling-stroke"
        />
        
        <!-- Consolidation indicator overlay for multi-keyword relationships -->
        {#if isConsolidated && relationshipCount >= 3}
            <path
                d={link.path}
                class="consolidation-indicator"
                stroke={`url(#${gradientId})`}
                stroke-width={strokeWidth * 0.3}
                stroke-linecap="round"
                stroke-dasharray="2,3"
                opacity={strokeOpacity * 0.8}
                vector-effect="non-scaling-stroke"
                stroke-dashoffset="5"
            />
        {/if}
        
        <!-- Tooltip with rich consolidated relationship information -->
        <title>{tooltipText}</title>
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
    
    /* ENHANCED: Smoother CSS-driven phantom links with longer transitions */
    .phantom-link {
        /* Initial state - hidden */
        opacity: 0;
        
        /* ENHANCED: Much longer, smoother transition - 4 seconds base */
        transition: opacity 4s cubic-bezier(0.25, 0.1, 0.25, 1);
        
        /* GPU acceleration for smooth performance */
        will-change: opacity;
    }
    
    /* ENHANCED: Use CSS custom property for individual link opacity */
    .phantom-link .link-path,
    .phantom-link .link-glow,
    .phantom-link .consolidation-indicator {
        opacity: var(--link-opacity, 0);
        transition: opacity 4s cubic-bezier(0.25, 0.1, 0.25, 1);
    }
    
    /* When parent has 'revealed' class, show links with calculated opacity */
    :global(.universal-graph.revealed) .phantom-link {
        opacity: 1; /* Container opacity */
    }
    
    /* ENHANCED: Individual link opacity controlled by custom property */
    :global(.universal-graph.revealed) .phantom-link .link-path {
        opacity: var(--link-opacity, 1);
    }
    
    :global(.universal-graph.revealed) .phantom-link .link-glow {
        opacity: var(--glow-opacity, 0.7);
    }
    
    /* Consolidated relationship styling */
    .consolidated-link {
        /* Subtle animation for consolidated relationships */
        animation: consolidation-pulse 3s ease-in-out infinite;
    }
    
    .consolidated-glow {
        /* Enhanced glow for consolidated relationships */
        stroke: rgba(255, 255, 255, 0.15);
    }
    
    .consolidation-indicator {
        /* Indicator overlay for highly consolidated relationships */
        animation: consolidation-flow 4s linear infinite;
    }
    
    /* Consolidation strength classes */
    .strong-consolidation .link-path {
        filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.3));
    }
    
    .medium-consolidation .link-path {
        filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.2));
    }
    
    .light-consolidation .link-path {
        filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.1));
    }
    
    /* Dashed link animation for form connections */
    .dashed-link {
        animation: dash-flow 20s linear infinite;
    }
    
    /* Animations */
    @keyframes consolidation-pulse {
        0%, 100% { 
            opacity: 1; 
        }
        50% { 
            opacity: 0.85; 
        }
    }
    
    @keyframes consolidation-flow {
        to {
            stroke-dashoffset: -20;
        }
    }
    
    @keyframes dash-flow {
        to {
            stroke-dashoffset: -100;
        }
    }
    
    /* Hover effects for consolidated relationships */
    .link:hover .consolidated-link {
        animation-duration: 1s; /* Faster pulse on hover */
    }
    
    .link:hover .link-glow {
        stroke-opacity: 0.3; /* Brighter glow on hover */
    }
    
    /* Performance: Reduce animations for large numbers of relationships */
    @media (prefers-reduced-motion: reduce) {
        .link-path,
        .link-glow,
        .consolidation-indicator,
        .phantom-link {
            animation: none;
            transition: none;
        }
    }
    
    /* ENHANCED: Support for individual link timing via CSS custom properties */
    /* Removed invalid @supports block with dynamic property name */
</style>