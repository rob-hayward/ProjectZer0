<!-- src/lib/components/graph/nodes/word/WordNode.svelte -->
<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    import { isWordNodeData } from '$lib/types/graph/enhanced';
    import { NODE_CONSTANTS } from '$lib/constants/graph/nodes';
    import BasePreviewNode from '../base/BasePreviewNode.svelte';
    import BaseDetailNode from '../base/BaseDetailNode.svelte';
    import { userStore } from '$lib/stores/userStore';
    import { graphStore } from '$lib/stores/graphStore';
    import { wordViewStore } from '$lib/stores/wordViewStore';
    import { getUserDetails } from '$lib/services/userLookup';
    
    import { 
        createVoteBehaviour, 
        createVisibilityBehaviour, 
        createModeBehaviour, 
        createDataBehaviour 
    } from '../behaviours';
    
    import VoteControls from '../ui/VoteControls.svelte';
    import NodeHeader from '../ui/NodeHeader.svelte';
    import CreatorCredits from '../ui/CreatorCredits.svelte';
    import ContentBox from '../ui/ContentBox.svelte';
    
    import { wrapTextForWidth } from '../utils/textUtils';

    export let node: RenderableNode;
    export let wordText: string = '';
    
    if (!isWordNodeData(node.data)) {
        throw new Error('Invalid node data type for WordNode');
    }

    const wordData = node.data;
    
    $: displayWord = wordData.word || wordText;
    
    let voteBehaviour: any;
    let visibilityBehaviour: any;
    let modeBehaviour: any;
    let dataBehaviour: any;
    let behavioursInitialized = false;
    
    function triggerDataUpdate() {
        wordDataWrapper = { ...wordData };
        console.log('[WordNode] Data wrapper updated via callback');
    }
    
    $: if (displayWord && !behavioursInitialized) {
        console.log('[WordNode] Initializing behaviours for word:', displayWord);
        
        voteBehaviour = createVoteBehaviour(node.id, 'word', {
            voteStore: wordViewStore,
            graphStore: graphStore,
            apiIdentifier: displayWord,
            dataObject: wordData,
            getVoteEndpoint: (word: string) => `/nodes/word/${word}/vote`,
            getRemoveVoteEndpoint: (word: string) => `/nodes/word/${word}/vote/remove`,
            onDataUpdate: triggerDataUpdate
        });
        
        visibilityBehaviour = createVisibilityBehaviour(node.id, {
            graphStore: graphStore
        });

        modeBehaviour = createModeBehaviour(node.mode);

        dataBehaviour = createDataBehaviour('word', wordData, {
            transformData: (rawData) => ({
                ...rawData,
                displayWord: rawData.word || wordText,
                formattedDate: rawData.createdAt ? new Date(rawData.createdAt).toLocaleDateString() : ''
            })
        });
        
        behavioursInitialized = true;
    }

    $: isDetail = node.mode === 'detail';
    
    $: userName = $userStore?.preferred_username || $userStore?.name || 'Anonymous';
    
    function getNeo4jNumber(value: any): number {
        if (value && typeof value === 'object' && 'low' in value) {
            return Number(value.low);
        }
        return Number(value || 0);
    }
    
    let wordDataWrapper = wordData;
    
    $: dataPositiveVotes = getNeo4jNumber(wordDataWrapper.positiveVotes) || 0;
    $: dataNegativeVotes = getNeo4jNumber(wordDataWrapper.negativeVotes) || 0;
    $: storeVoteData = wordViewStore.getVoteData(node.id);
    
    $: positiveVotes = dataPositiveVotes || storeVoteData.positiveVotes;
    $: negativeVotes = dataNegativeVotes || storeVoteData.negativeVotes;
    $: netVotes = positiveVotes - negativeVotes;
    $: scoreDisplay = netVotes > 0 ? `+${netVotes}` : netVotes.toString();
    $: wordStatus = netVotes > 0 ? 'agreed' : netVotes < 0 ? 'disagreed' : 'undecided';
    
    $: behaviorState = voteBehaviour ? voteBehaviour.getCurrentState() : null;
    $: userVoteStatus = behaviorState?.userVoteStatus || 'none';
    $: isVoting = behaviorState?.isVoting || false;
    $: voteSuccess = behaviorState?.voteSuccess || false;
    $: lastVoteType = behaviorState?.lastVoteType || null;
    $: voteError = behaviorState?.error || null;

    const dispatch = createEventDispatcher<{
        modeChange: { mode: NodeMode };
        visibilityChange: { isHidden: boolean };
    }>();

    function syncVoteState() {
        if (voteBehaviour) {
            const state = voteBehaviour.getCurrentState();
            userVoteStatus = state.userVoteStatus;
            isVoting = state.isVoting;
            voteSuccess = state.voteSuccess;
            lastVoteType = state.lastVoteType;
        }
    }
    
    async function updateVoteState(voteType: 'agree' | 'disagree' | 'none') {
        if (!voteBehaviour) return false;
        
        userVoteStatus = voteType;
        isVoting = true;
        
        try {
            const success = await voteBehaviour.handleVote(voteType);
            if (success) {
                syncVoteState();
                triggerDataUpdate();
            } else {
                syncVoteState();
            }
            return success;
        } catch (error) {
            syncVoteState();
            return false;
        }
    }

    function handleModeChange() {
        if (!modeBehaviour) return;
        const newMode = modeBehaviour.handleModeChange();
        dispatch('modeChange', { mode: newMode });
    }

    function handleVote(event: CustomEvent<{ voteType: any }>) {
        if (!voteBehaviour) return;
        updateVoteState(event.detail.voteType);
    }

    function handleVisibilityChange(event: CustomEvent<{ isHidden: boolean }>) {
        if (!visibilityBehaviour) return;
        visibilityBehaviour.handleVisibilityChange(event.detail.isHidden);
        dispatch('visibilityChange', event.detail);
    }

    let wordCreatorDetails: any = null;
    let showDiscussionButton = false;

    onMount(async () => {
        console.log('[WordNode] Mounting with word:', {
            id: node.id,
            word: displayWord,
            mode: node.mode,
            initialPositiveVotes: wordData.positiveVotes,
            initialNegativeVotes: wordData.negativeVotes
        });
        
        wordViewStore.setWordData(wordData);
        
        await new Promise(resolve => setTimeout(resolve, 0));
        
        const initPromises = [];
        
        if (dataBehaviour) {
            initPromises.push(dataBehaviour.initialize());
        }
        
        if (voteBehaviour) {
            initPromises.push(voteBehaviour.initialize({
                positiveVotes: wordData.positiveVotes,
                negativeVotes: wordData.negativeVotes
            }));
        }
        
        if (visibilityBehaviour) {
            initPromises.push(visibilityBehaviour.initialize(netVotes));
        }
        
        if (initPromises.length > 0) {
            await Promise.all(initPromises);
            syncVoteState();
        }
        
        if (wordData.createdBy && wordData.createdBy !== 'FreeDictionaryAPI') {
            try {
                wordCreatorDetails = await getUserDetails(wordData.createdBy);
            } catch (e) {
                console.error('[WordNode] Error fetching creator details:', e);
            }
        }
        
        showDiscussionButton = !!wordData.discussion;
    });

    onDestroy(() => {
        if (dataBehaviour && dataBehaviour.destroy) {
            dataBehaviour.destroy();
        }
    });
</script>

{#if isDetail}
    <BaseDetailNode {node} on:modeChange={handleModeChange}>
        <svelte:fragment slot="default" let:radius>
            <NodeHeader title="Word" {radius} />
            
            <ContentBox 
                nodeType="word" 
                mode="detail" 
                showBorder={false}
            >
                <svelte:fragment slot="content" let:x let:y let:width let:height let:layoutConfig>
                    <text
                        x="0"
                        y={y + layoutConfig.titleYOffset}
                        class="main-word"
                        style:font-family="Inter"
                        style:font-size="32px"
                        style:font-weight="700"
                        style:fill="white"
                        style:text-anchor="middle"
                        style:filter="drop-shadow(0 0 12px rgba(255, 255, 255, 0.4))"
                    >
                        {displayWord}
                    </text>
                    
                    <foreignObject
                        x={x}
                        y={y + layoutConfig.mainTextYOffset}
                        width={width}
                        height={height - layoutConfig.mainTextYOffset}
                    >
                        <div 
                            class="instruction-text"
                            style="
                                font-family: Inter;
                                font-size: 14px;
                                font-weight: 400;
                                color: rgba(255, 255, 255, 0.85);
                                text-align: center;
                                line-height: 1.4;
                                padding: 0;
                                margin: 0;
                                box-sizing: border-box;
                                width: 100%;
                                height: 100%;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            "
                        >
                            {wrapTextForWidth(
                                "Vote whether to include this keyword in ProjectZer0. You can change your vote anytime using the voting controls below.", 
                                width,
                                { fontSize: 14, fontFamily: 'Inter' }
                            ).join(' ')}
                        </div>
                    </foreignObject>
                    
                    <rect
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        rx="8"
                        ry="8"
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.03)"
                        stroke-width="1"
                    />
                </svelte:fragment>
                
                <svelte:fragment slot="voting" let:x let:y let:width let:height>
                    <rect
                        x={x + 5}
                        y={y + 5}
                        width={width - 10}
                        height={height - 10}
                        rx="6"
                        ry="6"
                        fill="rgba(255, 255, 255, 0.01)"
                        stroke="rgba(255, 255, 255, 0.03)"
                        stroke-width="1"
                    />
                    
                    <VoteControls 
                        {userVoteStatus}
                        {positiveVotes}
                        {negativeVotes}
                        {netVotes}
                        {isVoting}
                        {userName}
                        showStats={false}
                        showUserStatus={false}
                        {voteSuccess}
                        {lastVoteType}
                        compact={false}
                        mode="detail"
                        availableWidth={width}
                        containerY={height / 2}
                        on:vote={handleVote}
                    />
                </svelte:fragment>
                
                <svelte:fragment slot="stats" let:x let:y let:width let:height>
                    <VoteControls 
                        {userVoteStatus}
                        {positiveVotes}
                        {negativeVotes}
                        {netVotes}
                        {isVoting}
                        {userName}
                        showStats={true}
                        showUserStatus={true}
                        showVotingButtons={false}
                        {voteSuccess}
                        {lastVoteType}
                        compact={true}
                        mode="detail"
                        availableWidth={width}
                        containerY={0}
                        statsOffsetY={0}
                        showStatsBackground={false}
                        on:vote={() => {}}
                    />
                </svelte:fragment>
            </ContentBox>
            
            {#if wordData.createdBy}
                <CreatorCredits 
                    createdBy={wordData.createdBy}
                    publicCredit={wordData.publicCredit}
                    creatorDetails={wordCreatorDetails}
                    {radius}
                    prefix="created by:"
                />
            {/if}
        </svelte:fragment>
    </BaseDetailNode>
{:else}
    <BasePreviewNode {node} on:modeChange={handleModeChange}>
        <svelte:fragment slot="title" let:radius>
            <NodeHeader 
                title="Word" 
                {radius} 
                size="medium"
            />
        </svelte:fragment>

        <svelte:fragment slot="content" let:radius>
            <text
                y="10"
                class="word-preview"
                style:font-family="Inter"
                style:font-size="20px"
                style:font-weight="500"
                style:fill="white"
                style:text-anchor="middle"
            >
                {displayWord}
            </text>
        </svelte:fragment>

        <svelte:fragment slot="score" let:radius>
            <text
                y={radius - 30}
                class="score"
                style:font-family="Inter"
                style:font-size="14px"
                style:font-weight="500"
                style:fill="rgba(255, 255, 255, 0.8)"
                style:text-anchor="middle"
            >
                {scoreDisplay}
            </text>
        </svelte:fragment>
    </BasePreviewNode>
{/if}

<style>
    .main-word {
        text-anchor: middle;
        dominant-baseline: middle;
    }

    .word-preview {
        text-anchor: middle;
        dominant-baseline: middle;
    }

    .score {
        text-anchor: middle;
        dominant-baseline: middle;
    }
</style>