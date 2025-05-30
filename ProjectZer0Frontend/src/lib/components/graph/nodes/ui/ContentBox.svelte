<!-- src/lib/components/graph/nodes/ui/ContentBox.svelte -->
<script lang="ts">
    import { COORDINATE_SPACE } from '$lib/constants/graph/coordinate-space';
    import type { NodeType } from '$lib/types/graph/enhanced';
    
    export let nodeType: NodeType;
    export let mode: 'preview' | 'detail' = 'detail';
    export let showBorder: boolean = true; // Changed from false to true for design work
    
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
            horizontalPadding: 0,
            verticalPadding: 0,  // Reduced from 20 to move content up
            sectionSpacing: 0,    // Reduced from 10 for tighter layout
            contentYOffset: 0,
            votingYOffset: 0,   // Move voting section up slightly
            statsYOffset: 0,     // Move stats up slightly
            titleYOffset: 0,     // Reduced from 45 - move word display up
            mainTextYOffset: 0   // Reduced from 75 - move instruction text up
        },
        definition: {
            horizontalPadding: 0,
            verticalPadding: 0,
            sectionSpacing: 0,
            contentYOffset: 0,
            votingYOffset: 0,
            statsYOffset: 0,
            titleYOffset: 0,
            mainTextYOffset: 0
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
            detail: { content: 0.60, voting: 0.15, stats: 0.25 },
            preview: { content: 0.50, voting: 0.50, stats: 0 }  // Split evenly for centered voting
        },
        definition: {
            detail: { content: 0.60, voting: 0.15, stats: 0.25 },
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
    
    // SINGLE SOURCE OF TRUTH for Y positioning - removed vertical padding for content and stats
    $: contentBaseY = -halfBox; // Removed finalVerticalPadding
    $: votingBaseY = contentBaseY + contentHeight + finalSectionSpacing;
    $: statsBaseY = votingBaseY + votingHeight + finalSectionSpacing;
    
    // Final positions with offsets - removed offsets for content and stats
    $: contentY = contentBaseY; // Removed finalContentYOffset
    $: votingY = votingBaseY + finalVotingYOffset;
    $: statsY = statsBaseY; // Removed finalStatsYOffset
    
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
        <!-- Main content box border - white dashed -->
        <rect
            x={-halfBox}
            y={-halfBox}
            width={boxSize}
            height={boxSize}
            fill="none"
            stroke="rgba(255,255,255,0.4)"
            stroke-width="2"
            stroke-dasharray="8,4"
        />
        
        <!-- Content section border - green, aligned with content box -->
        <rect
            x={-halfBox}
            y={contentY}
            width={boxSize}
            height={contentHeight}
            fill="none"
            stroke="rgba(46, 204, 113, 0.6)"
            stroke-width="1"
        />
        
        <!-- Voting section border - yellow, aligned with content box -->
        <rect
            x={-halfBox}
            y={votingY}
            width={boxSize}
            height={votingHeight}
            fill="none"
            stroke="rgba(241, 196, 15, 0.6)"
            stroke-width="1"
        />
        
        <!-- Stats section border - red (only if stats section has height), aligned with content box -->
        {#if statsHeight > 0}
            <rect
                x={-halfBox}
                y={statsY}
                width={boxSize}
                height={statsHeight}
                fill="none"
                stroke="rgba(231, 76, 60, 0.6)"
                stroke-width="1"
            />
        {/if}
        
        <!-- Add labels for each section to make it clear what's what -->
        <text
            x={-halfBox + 5}
            y={contentY + 12}
            style:font-family="Inter"
            style:font-size="10px"
            style:fill="rgba(46, 204, 113, 0.8)"
            style:font-weight="500"
        >
            CONTENT
        </text>
        
        <text
            x={-halfBox + 5}
            y={votingY + 12}
            style:font-family="Inter"
            style:font-size="10px"
            style:fill="rgba(241, 196, 15, 0.8)"
            style:font-weight="500"
        >
            VOTING
        </text>
        
        {#if statsHeight > 0}
            <text
                x={-halfBox + 5}
                y={statsY + 12}
                style:font-family="Inter"
                style:font-size="10px"
                style:fill="rgba(231, 76, 60, 0.8)"
                style:font-weight="500"
            >
                STATS
            </text>
        {/if}
        
        <!-- Add dimensions text for reference -->
        <text
            x="0"
            y={-halfBox - 5}
            style:font-family="Inter"
            style:font-size="8px"
            style:fill="rgba(255, 255, 255, 0.6)"
            style:text-anchor="middle"
            style:font-weight="400"
        >
            {boxSize}×{boxSize} ({nodeType} {mode})
        </text>
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