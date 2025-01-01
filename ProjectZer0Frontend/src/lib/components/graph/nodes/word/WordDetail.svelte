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
    let voteStatus: 'agree' | 'none' = 'none';
    let isVoting = false;
    let showDisagreeMessage = false;
    let isMessageClosing = false;  // For animation
 
    // Get the live definition (highest voted)
    $: liveDefinition = data.definitions.length > 0
        ? [...data.definitions].sort((a, b) => getVoteValue(b.votes) - getVoteValue(a.votes))
            .find(d => getVoteValue(d.votes) > 0) || data.definitions[0]
        : null;
 
        onMount(async () => {
    if (data.createdBy && data.createdBy !== 'FreeDictionaryAPI') {
        wordCreatorDetails = await getUserDetails(data.createdBy);
    }
    
    if (liveDefinition?.createdBy && liveDefinition.createdBy !== 'FreeDictionaryAPI') {
        definitionCreatorDetails = await getUserDetails(liveDefinition.createdBy);

        // Fetch current vote status
        if (liveDefinition && $userStore) {
            try {
                const response = await fetchWithAuth(
                    `/definitions/${liveDefinition.id}/vote`
                );
                // If this is a newly created definition by this user, it should already have a vote
                voteStatus = response.hasVoted ? 'agree' : 'none';
                console.log('Initial vote status:', voteStatus); // Debug log
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
            const result = await fetchWithAuth(
                `/definitions/${liveDefinition.id}/vote`,
                {
                    method: 'POST',
                    body: JSON.stringify({ vote: 'agree' })
                }
            );

            voteStatus = result.hasVoted ? 'agree' : 'none';
            liveDefinition.votes = getVoteValue(result.definition.votes);
            
            // Refresh the definition list as other definitions' votes might have changed
            data = { ...data };
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
            const result = await fetchWithAuth(
                `/definitions/${liveDefinition.id}/vote`,
                {
                    method: 'POST',
                    body: JSON.stringify({ vote: 'disagree' })
                }
            );

            voteStatus = 'none';
            showDisagreeMessage = true;  // Show the message
            liveDefinition.votes = getVoteValue(result.definition.votes);
            
            // Refresh the definition list as other definitions' votes might have changed
            data = { ...data };
        } catch (error) {
            console.error('Error voting:', error);
        } finally {
            isVoting = false;
        }
    }
 
    function wrapText(text: string): string[] {
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';

        words.forEach(word => {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            if (testLine.length * 8 > CONTENT_WIDTH && currentLine) {
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
        <text dy={-radius + 120} class="title">
            Word Node
        </text>

        <!-- Word -->
        <g transform="translate(0, {-radius + 150})">
            <text x={METRICS_SPACING.labelX} class="label left-align">
                word:
            </text>
            <text x={METRICS_SPACING.labelX} dy="25" class="value left-align word-value">
                {data.word}
            </text>
        </g>

        <!-- Definition -->
        {#if liveDefinition}
            <g transform="translate(0, {-radius + 210})">
                <text x={METRICS_SPACING.labelX} class="label left-align">
                    live definition:
                </text>
                
                <!-- Definition text -->
                {#each definitionLines as line, i}
                    <text x={METRICS_SPACING.labelX} dy={25 + i * 20} class="value left-align definition-text">
                        {line}
                    </text>
                {/each}
                {#if liveDefinition.createdBy !== 'FreeDictionaryAPI'}
                    <!-- Vote Buttons and Information -->
                    <g transform="translate(0, {20 + definitionLines.length * 20})">
                        <!-- Vote Buttons -->
                        <foreignObject x={-160} width="100" height="50">
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

                        <foreignObject x={40} width="100" height="50">
                            <div class="button-wrapper">
                                <button 
                                    class="vote-button disagree"
                                    class:active={voteStatus === 'none'}
                                    on:click={handleDisagreeVote}
                                    disabled={isVoting}
                                >
                                    Disagree
                                </button>
                            </div>
                        </foreignObject>

                        <!-- Vote Information -->
                        <text x={-160} dy="80" class="vote-info left-align">
                            total agree votes:
                        </text>
                        <text x={40} dy="80" class="vote-info-value left-align">
                            {getVoteValue(liveDefinition.votes)}
                        </text>

                        <text x={-160} dy="100" class="vote-info left-align">
                            your vote:
                        </text>
                        <text x={40} dy="100" class="vote-info-value left-align">
                            {voteStatus}
                        </text>

                <!-- Disagree Message -->
{#if showDisagreeMessage}
<g transform="translate(0, 0)">
    <foreignObject 
        x="-125" 
        y="-125"
        width="250" 
        height="250"  
    >
        <div class="message-container">
            <button 
                class="close-button"
                on:click={() => showDisagreeMessage = false}
                aria-label="Close message"
            >×</button>
            <div class="message-content">
                <p>If you disagree with this definition, you can:</p>
                <ul>
                    <li>View alternative definitions</li>
                    <li>Suggest your own definition</li>
                </ul>
                <p class="small-note">The definition with the most votes becomes the live definition.</p>
            </div>
        </div>
    </foreignObject>
</g>
{/if}
                    </g>
                {/if}
            </g>
        {/if}
        
        <!-- Creator credits -->
        <g transform="translate(0, {CIRCLE_RADIUS - 90})">
            <g transform="translate(0, 0)">
                <text x={-160} class="small-text secondary left-align">
                    Word created by:
                    <tspan x={-160} dy="20" class="small-text primary left-align">
                        {getDisplayName(data.createdBy, wordCreatorDetails, !data.publicCredit)}
                    </tspan>
                </text>

                {#if liveDefinition}
                    <text x={40} class="small-text secondary left-align">
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

    :global(.message-container) {
            position: relative;
            width: 200px;
            height: 200px;
            background: rgb(0, 0, 0);  /* Fully opaque black */
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            padding: 20px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.8);
            pointer-events: auto;  /* Ensure clickable */
        }

    :global(.close-button) {
        position: absolute;
        top: 15px;
        right: 15px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 1px solid rgba(255, 255, 255, 0.3);
        background: rgba(255, 255, 255, 0.1);
        color: white;
        font-size: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        padding: 0;
        line-height: 1;
    }

    :global(.close-button:hover) {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.4);
    }

    :global(.message-content) {
        color: white;
        font-family: 'Orbitron', sans-serif;
        font-size: 11px;
        text-align: center;
    }

    :global(.message-content p) {
        margin: 0 0 10px 0;
    }

    :global(.message-content ul) {
        list-style: none;
        padding: 0;
        margin: 0 0 10px 0;
    }

    :global(.message-content li) {
        margin: 5px 0;
        color: rgba(255, 255, 255, 0.8);
    }

    :global(.message-content .small-note) {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.6);
        margin-top: 10px;
    }
</style>