<!-- src/lib/components/graph/nodes/ui/ContentBox.svelte -->
<script lang="ts">
    import { COORDINATE_SPACE } from '$lib/constants/graph/coordinate-space';
    import type { NodeType } from '$lib/types/graph/enhanced';
    
    export let nodeType: NodeType;
    export let mode: 'preview' | 'detail' = 'detail';
    export let showBorder: boolean = false; // For debugging/experimentation
    
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
    
    // Layout sections within the box (60% content, 25% voting, 15% stats)
    $: contentHeight = Math.floor(boxSize * 0.60);  // ~254px for detail word
    $: votingHeight = Math.floor(boxSize * 0.25);   // ~106px for detail word  
    $: statsHeight = Math.floor(boxSize * 0.15);    // ~64px for detail word
    
    // Vertical positioning (centered around 0,0)
    $: contentStartY = -halfBox + 20; // Small top margin
    $: votingStartY = contentStartY + contentHeight + 10;
    $: statsStartY = votingStartY + votingHeight + 5;
    
    interface $$Slots {
        content: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
        voting: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
        stats: {
            x: number; 
            y: number;
            width: number;
            height: number;
        };
    }
</script>

<g class="content-box" data-box-size={boxSize}>
    <!-- Debug border (optional) -->
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
        
        <!-- Section dividers -->
        <line
            x1={-halfBox}
            y1={votingStartY - 5}
            x2={halfBox}
            y2={votingStartY - 5}
            stroke="rgba(255,255,255,0.1)"
            stroke-width="1"
            stroke-dasharray="2,2"
        />
        <line
            x1={-halfBox}
            y1={statsStartY - 3}
            x2={halfBox}
            y2={statsStartY - 3}
            stroke="rgba(255,255,255,0.1)"
            stroke-width="1"
            stroke-dasharray="2,2"
        />
    {/if}
    
    <!-- Content Section (60% of box height) -->
    <g class="content-section">
        <slot 
            name="content"
            x={-halfBox + 20}
            y={contentStartY}
            width={boxSize - 40}
            height={contentHeight}
        />
    </g>
    
    <!-- Voting Section (25% of box height) -->
    <g class="voting-section">
        <slot
            name="voting" 
            x={-halfBox + 20}
            y={votingStartY}
            width={boxSize - 40}
            height={votingHeight}
        />
    </g>
    
    <!-- Statistics Section (15% of box height) -->
    <g class="stats-section">
        <slot
            name="stats"
            x={-halfBox + 20}
            y={statsStartY}
            width={boxSize - 40}
            height={statsHeight}
        />
    </g>
</g>

<style>
    .content-box {
        /* Container provides structured layout framework */
        transform-origin: center;
    }
</style>