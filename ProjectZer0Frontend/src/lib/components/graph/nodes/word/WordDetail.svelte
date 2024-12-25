<!-- src/lib/components/graph/nodes/word/WordDetail.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';
    import type { WordNode, NodeStyle } from '$lib/types/nodes';
    import type { UserProfile } from '$lib/types/user';
    import { NODE_CONSTANTS, CIRCLE_RADIUS } from '../base/BaseNodeConstants';
    import { getUserDetails } from '$lib/services/userLookup';
    import { getDisplayName, getVoteValue } from '../utils/nodeUtils';
    import BaseDetailNode from '../base/BaseDetailNode.svelte';
 
    export let data: WordNode;
    export let style: NodeStyle;
 
    const CONTENT_WIDTH = 350;
    const CONTENT_START_Y = -180;
    const METRICS_SPACING = {
        labelX: -200,
        equalsX: 0,
        valueX: 30
    };
 
    let wordCreatorDetails: UserProfile | null = null;
    let definitionCreatorDetails: UserProfile | null = null;
 
    // Get the live definition (highest voted)
    $: liveDefinition = data.definitions.length > 0
        ? [...data.definitions].sort((a, b) => getVoteValue(b.votes) - getVoteValue(a.votes))[0]
        : null;
 
    onMount(async () => {
        if (data.createdBy && data.createdBy !== 'FreeDictionaryAPI') {
            wordCreatorDetails = await getUserDetails(data.createdBy);
        }
        
        if (liveDefinition?.createdBy && liveDefinition.createdBy !== 'FreeDictionaryAPI') {
            definitionCreatorDetails = await getUserDetails(liveDefinition.createdBy);
        }
    });
 
    // Calculate text wrapping for definition
    function wrapText(text: string): string[] {
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';
 
        words.forEach(word => {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            if (testLine.length * 10 > CONTENT_WIDTH && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });
 
        if (currentLine) {
            lines.push(currentLine);
        }
 
        return lines;
    }
 
    $: definitionLines = liveDefinition ? wrapText(liveDefinition.text) : [];
 </script>
 
 <!-- src/lib/components/graph/nodes/word/WordDetail.svelte -->
<!-- ... script section remains the same ... -->

<BaseDetailNode {style}>
    <svelte:fragment let:radius let:isHovered>
        <!-- Title -->
        <text 
            dy={-radius + 120} 
            class="title"
        >
            Word Node
        </text>

        <!-- Word -->
        <g transform="translate(0, {-radius + 170})">
            <text 
                x={METRICS_SPACING.labelX}
                class="label left-align"
            >
                word:
            </text>
            <text 
                x={METRICS_SPACING.labelX}
                dy="25"
                class="value left-align word-value"
            >
                {data.word}
            </text>
        </g>

        <!-- Definition -->
        {#if liveDefinition}
            <g transform="translate(0, {-radius + 230})">
                <text 
                    x={METRICS_SPACING.labelX}
                    class="label left-align"
                >
                    live definition:
                </text>
                
                <!-- Widened content area for definition -->
                {#each definitionLines as line, i}
                    <text 
                        x={METRICS_SPACING.labelX}
                        dy={25 + i * 20}
                        class="value left-align definition-text"
                    >
                        {line}
                    </text>
                {/each}

                {#if liveDefinition.createdBy !== 'FreeDictionaryAPI'}
                    <g transform="translate(0, {30 + definitionLines.length * 20})">
                        <text 
                            x={METRICS_SPACING.labelX}
                            class="label left-align"
                        >
                            definition approval votes:
                        </text>
                        <text 
                            x={METRICS_SPACING.labelX + 250}
                            class="value left-align"
                        >
                            {getVoteValue(liveDefinition.votes)}
                        </text>
                    </g>
                {/if}
            </g>
        {/if}

        <!-- Credits section remains the same -->
    </svelte:fragment>
</BaseDetailNode>

<style>
    text {
        font-family: 'Orbitron', sans-serif;
        fill: white;
    }

    .title {
        font-size: 30px;
        text-anchor: middle;
    }

    .label {
        font-size: 14px;
        fill: rgba(255, 255, 255, 0.7);
    }

    .value {
        font-size: 14px;
    }

    .word-value {
        font-size: 16px; /* Slightly larger for emphasis */
    }

    .definition-text {
        /* Assuming max width of about 450-500px for definition text */
        inline-size: 450px;
        text-overflow: ellipsis;
        overflow: hidden;
    }

    .credits-label {
        font-size: 10px;
        fill: rgba(255, 255, 255, 0.7);
    }

    .credits-value {
        font-size: 10px;
    }

    .left-align {
        text-anchor: start;
    }
</style>