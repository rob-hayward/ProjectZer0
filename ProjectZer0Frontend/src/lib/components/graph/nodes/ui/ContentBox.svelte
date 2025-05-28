<!-- src/lib/components/graph/nodes/ui/ContentBox.svelte -->
<script lang="ts">
    import { COORDINATE_SPACE } from '$lib/constants/graph/coordinate-space';
    import type { NodeType } from '$lib/types/graph/enhanced';
    
    export let nodeType: NodeType;
    export let mode: 'preview' | 'detail' = 'detail';
    export let showBorder: boolean = false;
    
    // Layout configuration per node type (SINGLE SOURCE OF TRUTH)
    const LAYOUT_CONFIGS: Record<string, {
        horizontalPadding: number;
        verticalPadding: number;
        sectionSpacing: number;
        contentYOffset: number;
        votingYOffset: number;
        statsYOffset: number;
        titleYOffset: number;
        mainTextYOffset: number;
    }> = {
        word: {
            horizontalPadding: 10,
            verticalPadding: 10,  // Reduced from 20 to move content up
            sectionSpacing: 5,    // Reduced from 10 for tighter layout
            contentYOffset: 0,
            votingYOffset: -10,   // Move voting section up slightly
            statsYOffset: -5,     // Move stats up slightly
            titleYOffset: 25,     // Reduced from 45 - move word display up
            mainTextYOffset: 0   // Reduced from 75 - move instruction text up
        },
        definition: {
            horizontalPadding: 10,
            verticalPadding: 10,
            sectionSpacing: 5,
            contentYOffset: 0,
            votingYOffset: -5,
            statsYOffset: -5,
            titleYOffset: 20,
            mainTextYOffset: 45
        },
        statement: {
            horizontalPadding: 10,
            verticalPadding: 15,
            sectionSpacing: 8,
            contentYOffset: 0,
            votingYOffset: -5,
            statsYOffset: -5,
            titleYOffset: 30,
            mainTextYOffset: 60
        },
        quantity: {
            horizontalPadding: 10,
            verticalPadding: 15,
            sectionSpacing: 8,
            contentYOffset: 0,
            votingYOffset: -5,
            statsYOffset: -5,
            titleYOffset: 30,
            mainTextYOffset: 60
        },
        comment: {
            horizontalPadding: 10,
            verticalPadding: 10,
            sectionSpacing: 5,
            contentYOffset: 0,
            votingYOffset: -5,
            statsYOffset: -5,
            titleYOffset: 20,
            mainTextYOffset: 40
        },
        // Add missing node types
        navigation: {
            horizontalPadding: 10,
            verticalPadding: 20,
            sectionSpacing: 10,
            contentYOffset: 0,
            votingYOffset: 0,
            statsYOffset: 0,
            titleYOffset: 45,
            mainTextYOffset: 75
        },
        dashboard: {
            horizontalPadding: 10,
            verticalPadding: 20,
            sectionSpacing: 10,
            contentYOffset: 0,
            votingYOffset: 0,
            statsYOffset: 0,
            titleYOffset: 45,
            mainTextYOffset: 75
        },
        'edit-profile': {
            horizontalPadding: 10,
            verticalPadding: 20,
            sectionSpacing: 10,
            contentYOffset: 0,
            votingYOffset: 0,
            statsYOffset: 0,
            titleYOffset: 45,
            mainTextYOffset: 75
        },
        'create-node': {
            horizontalPadding: 10,
            verticalPadding: 20,
            sectionSpacing: 10,
            contentYOffset: 0,
            votingYOffset: 0,
            statsYOffset: 0,
            titleYOffset: 45,
            mainTextYOffset: 75
        },
        'comment-form': {
            horizontalPadding: 10,
            verticalPadding: 20,
            sectionSpacing: 10,
            contentYOffset: 0,
            votingYOffset: 0,
            statsYOffset: 0,
            titleYOffset: 45,
            mainTextYOffset: 75
        },
        // Default fallback
        default: {
            horizontalPadding: 10,
            verticalPadding: 20,
            sectionSpacing: 10,
            contentYOffset: 0,
            votingYOffset: 0,
            statsYOffset: 0,
            titleYOffset: 45,
            mainTextYOffset: 75
        }
    };
    
    // Layout ratios configuration - different for preview vs detail modes
    const LAYOUT_RATIOS: Record<string, {
        detail: { content: number; voting: number; stats: number };
        preview: { content: number; voting: number; stats: number };
    }> = {
        word: {
            detail: { content: 0.60, voting: 0.25, stats: 0.15 },
            preview: { content: 0.50, voting: 0.50, stats: 0 }  // Split evenly for centered voting
        },
        definition: {
            detail: { content: 0.60, voting: 0.25, stats: 0.15 },
            preview: { content: 0.65, voting: 0.35, stats: 0 }
        },
        statement: {
            detail: { content: 0.60, voting: 0.25, stats: 0.15 },
            preview: { content: 0.65, voting: 0.35, stats: 0 }
        },
        quantity: {
            detail: { content: 0.60, voting: 0.25, stats: 0.15 },
            preview: { content: 0.65, voting: 0.35, stats: 0 }
        },
        comment: {
            detail: { content: 0.60, voting: 0.25, stats: 0.15 },
            preview: { content: 0.60, voting: 0.40, stats: 0 }
        },
        default: {
            detail: { content: 0.60, voting: 0.25, stats: 0.15 },
            preview: { content: 0.70, voting: 0.30, stats: 0 }
        }
    };
    
    // Get layout config for current node type
    $: layoutConfig = LAYOUT_CONFIGS[nodeType] || LAYOUT_CONFIGS.default;
    
    // Get ratios for current node type and mode
    $: currentRatios = (LAYOUT_RATIOS[nodeType] || LAYOUT_RATIOS.default)[mode];
    
    // Allow overrides via props
    export let horizontalPadding: number | undefined = undefined;
    export let verticalPadding: number | undefined = undefined;
    export let sectionSpacing: number | undefined = undefined;
    export let contentYOffset: number | undefined = undefined;
    export let votingYOffset: number | undefined = undefined;
    export let statsYOffset: number | undefined = undefined;
    
    // Use prop overrides if provided, otherwise use config defaults
    $: finalHorizontalPadding = horizontalPadding ?? layoutConfig.horizontalPadding;
    $: finalVerticalPadding = verticalPadding ?? layoutConfig.verticalPadding;
    $: finalSectionSpacing = sectionSpacing ?? layoutConfig.sectionSpacing;
    $: finalContentYOffset = contentYOffset ?? layoutConfig.contentYOffset;
    $: finalVotingYOffset = votingYOffset ?? layoutConfig.votingYOffset;
    $: finalStatsYOffset = statsYOffset ?? layoutConfig.statsYOffset;
    
    // Get appropriate content box size
    $: boxSize = getContentBoxSize(nodeType, mode);
    $: halfBox = boxSize / 2;
    
    function getContentBoxSize(type: NodeType, currentMode: 'preview' | 'detail'): number {
        const sizeMap = COORDINATE_SPACE.CONTENT_BOXES;
        
        switch(type) {
            case 'word': return currentMode === 'detail' ? sizeMap.WORD.DETAIL : sizeMap.WORD.PREVIEW;
            case 'definition': return currentMode === 'detail' ? sizeMap.DEFINITION.DETAIL : sizeMap.DEFINITION.PREVIEW;
            case 'statement': return currentMode === 'detail' ? sizeMap.STATEMENT.DETAIL : sizeMap.STATEMENT.PREVIEW;
            case 'quantity': return currentMode === 'detail' ? sizeMap.QUANTITY.DETAIL : sizeMap.QUANTITY.PREVIEW;
            case 'comment': return currentMode === 'detail' ? sizeMap.COMMENT.DETAIL : sizeMap.COMMENT.PREVIEW;
            default: return currentMode === 'detail' ? sizeMap.STANDARD.DETAIL : sizeMap.STANDARD.PREVIEW;
        }
    }
    
    // Layout sections within the box using mode-specific ratios
    $: contentHeight = Math.floor(boxSize * currentRatios.content);
    $: votingHeight = Math.floor(boxSize * currentRatios.voting);
    $: statsHeight = Math.floor(boxSize * currentRatios.stats);
    
    // SINGLE SOURCE OF TRUTH for Y positioning
    $: contentBaseY = -halfBox + finalVerticalPadding;
    $: votingBaseY = contentBaseY + contentHeight + finalSectionSpacing;
    $: statsBaseY = votingBaseY + votingHeight + finalSectionSpacing;
    
    // Final positions with offsets
    $: contentY = contentBaseY + finalContentYOffset;
    $: votingY = votingBaseY + finalVotingYOffset;
    $: statsY = statsBaseY + finalStatsYOffset;
    
    // X positioning
    $: sectionX = -halfBox + finalHorizontalPadding;
    $: sectionWidth = boxSize - (finalHorizontalPadding * 2);
    
    interface $$Slots {
        content: {
            x: number;
            y: number;
            width: number;
            height: number;
            layoutConfig: typeof layoutConfig;
        };
        voting: {
            x: number;
            y: number;
            width: number;
            height: number;
            layoutConfig: typeof layoutConfig;
        };
        stats: {
            x: number; 
            y: number;
            width: number;
            height: number;
            layoutConfig: typeof layoutConfig;
        };
    }
</script>

<g class="content-box" data-box-size={boxSize}>
    {#if showBorder}
        <rect
            x={-halfBox}
            y={-halfBox}
            width={boxSize}
            height={boxSize}
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            stroke-width="1"
            stroke-dasharray="5,5"
        />
        
        <rect
            x={sectionX}
            y={contentY}
            width={sectionWidth}
            height={contentHeight}
            fill="none"
            stroke="rgba(0,255,0,0.2)"
            stroke-width="1"
        />
        <rect
            x={sectionX}
            y={votingY}
            width={sectionWidth}
            height={votingHeight}
            fill="none"
            stroke="rgba(255,255,0,0.2)"
            stroke-width="1"
        />
        <rect
            x={sectionX}
            y={statsY}
            width={sectionWidth}
            height={statsHeight}
            fill="none"
            stroke="rgba(255,0,0,0.2)"
            stroke-width="1"
        />
    {/if}
    
    <g class="content-section">
        <slot 
            name="content"
            x={sectionX}
            y={contentY}
            width={sectionWidth}
            height={contentHeight}
            {layoutConfig}
        />
    </g>
    
    <g class="voting-section">
        <slot
            name="voting" 
            x={sectionX}
            y={votingY}
            width={sectionWidth}
            height={votingHeight}
            {layoutConfig}
        />
    </g>
    
    <g class="stats-section">
        <slot
            name="stats"
            x={sectionX}
            y={statsY}
            width={sectionWidth}
            height={statsHeight}
            {layoutConfig}
        />
    </g>
</g>

<style>
    .content-box {
        transform-origin: center;
    }
</style>