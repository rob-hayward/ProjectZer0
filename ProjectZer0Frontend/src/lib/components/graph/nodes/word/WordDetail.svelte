<!-- src/lib/components/graph/nodes/word/WordDetail.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';
    import type { WordNode, NodeStyle } from '$lib/types/nodes';
    import type { UserProfile } from '$lib/types/user';
    import { NODE_CONSTANTS, CIRCLE_RADIUS } from '../base/BaseNodeConstants';
    import { getUserDetails } from '$lib/services/userLookup';
    import { getDisplayName, getVoteValue } from '../utils/nodeUtils';
    import { fetchWithAuth } from '$lib/services/api';
    import { userStore } from '$lib/stores/userStore';
    import BaseDetailNode from '../base/BaseDetailNode.svelte';
 
    export let data: WordNode;
    export let style: NodeStyle;
 
    const CONTENT_WIDTH = 450;
    const CONTENT_START_Y = -180;
    const METRICS_SPACING = {
        labelX: -220,
        equalsX: 0,
        valueX: 30
    };
 
    let wordCreatorDetails: UserProfile | null = null;
    let definitionCreatorDetails: UserProfile | null = null;
    let voteStatus: 'agree' | 'disagree' | 'none' = 'none';
    let isVoting = false;
    let showDisagreeMessage = false;
 
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

            // Fetch current vote status
            if (liveDefinition) {
                try {
                    const response = await fetchWithAuth(
                        `/nodes/word/${data.word}/definitions/${liveDefinition.id}/vote`
                    );
                    voteStatus = response.voteStatus;
                } catch (error) {
                    console.error('Error fetching vote status:', error);
                }
            }
        }
    });

    async function handleAgreeVote() {
        if (!$userStore || isVoting || !liveDefinition) return;
        isVoting = true;
        showDisagreeMessage = false;

        try {
            const previousStatus = voteStatus;
            await fetchWithAuth(
                `/nodes/word/${data.word}/definitions/${liveDefinition.id}/vote`,
                {
                    method: 'POST',
                    body: JSON.stringify({ vote: 'agree' })
                }
            );

            voteStatus = 'agree';
            
            // Update vote count
            if (previousStatus === 'none') {
                liveDefinition.votes = getVoteValue(liveDefinition.votes) + 1;
            } else if (previousStatus === 'disagree') {
                liveDefinition.votes = getVoteValue(liveDefinition.votes) + 1;
            }
        } catch (error) {
            console.error('Error voting:', error);
        } finally {
            isVoting = false;
        }
    }

    async function handleDisagreeVote() {
        if (!$userStore || isVoting || !liveDefinition) return;
        isVoting = true;

        try {
            const previousStatus = voteStatus;
            await fetchWithAuth(
                `/nodes/word/${data.word}/definitions/${liveDefinition.id}/vote`,
                {
                    method: 'POST',
                    body: JSON.stringify({ vote: 'disagree' })
                }
            );

            voteStatus = 'disagree';
            showDisagreeMessage = true;
            
            // Only decrease vote count if removing a previous agree vote
            if (previousStatus === 'agree') {
                liveDefinition.votes = getVoteValue(liveDefinition.votes) - 1;
            }
        } catch (error) {
            console.error('Error voting:', error);
        } finally {
            isVoting = false;
        }
    }
 
    // Calculate text wrapping for definition
    function wrapText(text: string): string[] {
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';

        words.forEach(word => {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            // Adjusted character width calculation
            if (testLine.length * 8 > CONTENT_WIDTH && currentLine) {  // Reduced from 10 to 8 for better text flow
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
        <g transform="translate(0, {-radius + 150})">
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
            <g transform="translate(0, {-radius + 210})">
                <text 
                    x={METRICS_SPACING.labelX}
                    class="label left-align"
                >
                    live definition:
                </text>
                
                <!-- Definition text -->
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


   <!-- Vote Buttons and Information -->
<g transform="translate(0, {20 + definitionLines.length * 20})">
   <!-- Vote Buttons -->
<foreignObject
x={-160}
width="100"
height="50">
<div class="button-wrapper">
    <button 
        class="vote-button agree"
        class:active={voteStatus === 'agree'}
        on:click={handleAgreeVote}
        disabled={isVoting}
    >
        Agree
    </button>
</div>
</foreignObject>

<foreignObject
x={40}
width="100"
height="50">
<div class="button-wrapper">
    <button 
        class="vote-button disagree"
        class:active={voteStatus === 'disagree'}
        on:click={handleDisagreeVote}
        disabled={isVoting}
    >
        Disagree
    </button>
</div>
</foreignObject>

 <!-- Vote Information below buttons -->
<text 
x={-160}
dy="80"
class="vote-info left-align"
>
total agree votes:
</text>
<text 
x={40}
dy="80"
class="vote-info-value left-align">
{getVoteValue(liveDefinition.votes)}
</text>

<text 
x={-160}
dy="100"
class="vote-info left-align"
>
your vote:
</text>
<text 
x={40}
dy="100"
class="vote-info-value left-align">
{voteStatus}
</text>
                    <!-- Disagree Message -->
                    {#if showDisagreeMessage}
                        <g transform="translate(0, 60)">
                            <text 
                                x={METRICS_SPACING.labelX}
                                class="message left-align"
                            >
                                If you disagree with this definition, you can view and vote for
                            </text>
                            <text 
                                x={METRICS_SPACING.labelX}
                                dy="20"
                                class="message left-align"
                            >
                                alternative definitions, or suggest your own alternative definition.
                            </text>
                            <text 
                                x={METRICS_SPACING.labelX}
                                dy="40"
                                class="message left-align"
                            >
                                The definition with the most votes will be displayed as the live definition.
                            </text>
                        </g>
                    {/if}
                </g>
             {/if}
             </g>
             {/if}
             
             <!-- Creator credits -->
    <g transform="translate(0, {CIRCLE_RADIUS - 90})">  <!-- Moved down by changing from -110 to -70 -->
        <g transform="translate(0, 0)">
            <!-- Word Creator -->
            <text x={-160} class="small-text secondary left-align">  <!-- Centered by using -125 instead of METRICS_SPACING.labelX -->
                Word created by:
                <tspan x={-160} dy="20" class="small-text primary left-align">
                    {getDisplayName(data.createdBy, wordCreatorDetails, !data.publicCredit)}
                </tspan>
            </text>

            <!-- Definition Creator -->
            {#if liveDefinition}
                <text x={40} class="small-text secondary left-align">  <!-- Adjusted from METRICS_SPACING.labelX + CONTENT_WIDTH/2 + 20 to just 40 -->
                    Definition created by:
                    <tspan x={40} dy="20" class="small-text primary left-align">
                        {getDisplayName(liveDefinition.createdBy, definitionCreatorDetails, false)}
                    </tspan>
                </text>
            {/if}
        </g>
    </g>
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
        font-size: 16px;
    }

    .definition-text {
        inline-size: 550px;
        text-overflow: ellipsis;
        overflow: hidden;
    }

    .small-text {
        font-size: 10px;
    }

    .primary {
        fill: white;
    }

    .secondary {
        fill: rgba(255, 255, 255, 0.7);
    }

    .message {
        font-size: 12px;
        fill: rgba(255, 255, 255, 0.7);
    }

    .left-align {
        text-anchor: start;
    }

    .button-wrapper {
    padding-top: 8px;
    height: 100%;
}

:global(.vote-button) {
    width: 100%;
    padding: 8px 16px;
    border-radius: 4px;
    font-family: 'Orbitron', sans-serif;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 100px;
    box-sizing: border-box;
    margin: 0;
    color: white;
}

:global(.vote-button.agree) {
    background: rgba(46, 204, 113, 0.3);
    border: 1px solid rgba(46, 204, 113, 0.4);
}

:global(.vote-button.disagree) {
    background: rgba(231, 76, 60, 0.3);
    border: 1px solid rgba(231, 76, 60, 0.4);
}

:global(.vote-button:hover:not(:disabled)) {
    transform: translateY(-1px);
}

:global(.vote-button.agree:hover:not(:disabled)) {
    background: rgba(46, 204, 113, 0.4);
    border: 1px solid rgba(46, 204, 113, 0.4);
}

:global(.vote-button.disagree:hover:not(:disabled)) {
    background: rgba(231, 76, 60, 0.4);
    border: 1px solid rgba(231, 76, 60, 0.4);
}

:global(.vote-button:active:not(:disabled)) {
    transform: translateY(0);
}

:global(.vote-button.active.agree) {
    background: rgba(46, 204, 113, 0.4);
    border-color: rgba(46, 204, 113, 0.6);
}

:global(.vote-button.active.disagree) {
    background: rgba(231, 76, 60, 0.4);
    border-color: rgba(231, 76, 60, 0.6);
}

:global(.vote-button:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
}

.vote-info {
    font-size: 13px;
    fill: rgba(255, 255, 255, 0.7);
}

.vote-info-value {
    font-size: 13px;
    fill: white;
}
</style>