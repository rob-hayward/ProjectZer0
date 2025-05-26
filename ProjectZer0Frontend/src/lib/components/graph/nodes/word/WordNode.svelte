<!-- src/lib/components/graph/nodes/word/WordNode.svelte -->
<script lang="ts">
    // === SECTION 1: IMPORTS ===
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import { writable } from 'svelte/store';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    import { isWordNodeData } from '$lib/types/graph/enhanced';
    import { NODE_CONSTANTS } from '$lib/constants/graph/nodes';
    import BasePreviewNode from '../base/BasePreviewNode.svelte';
    import BaseDetailNode from '../base/BaseDetailNode.svelte';
    import { userStore } from '$lib/stores/userStore';
    import { graphStore } from '$lib/stores/graphStore';
    import { wordViewStore } from '$lib/stores/wordViewStore';
    import { getUserDetails } from '$lib/services/userLookup';
    
    // Behaviour modules
    import { 
        createVoteBehaviour, 
        createVisibilityBehaviour, 
        createModeBehaviour, 
        createDataBehaviour 
    } from '../behaviours';
    
    // UI components
    import VoteControls from '../ui/VoteControls.svelte';
    import NodeHeader from '../ui/NodeHeader.svelte';
    import CreatorCredits from '../ui/CreatorCredits.svelte';
    import TextContent from '../ui/TextContent.svelte';
    import ContentBox from '../ui/ContentBox.svelte';
    
    // Enhanced text utilities
    import { wrapTextForDetail, wrapTextForPreview } from '../utils/textUtils';

    // === SECTION 2: PROPS AND TYPE CHECKING ===
    export let node: RenderableNode;
    export let wordText: string = '';
    
    // Type guard for word node data
    if (!isWordNodeData(node.data)) {
        throw new Error('Invalid node data type for WordNode');
    }

    const wordData = node.data;
    
    // === SECTION 3: DATA EXTRACTION ===
    $: displayWord = wordData.word || wordText;
    
    // Debug when mode changes
    $: console.debug(`[WordNode:${node.id}] Mode changed:`, { 
        mode: node.mode, 
        isDetail 
    });

    // === SECTION 4: BEHAVIOURS ===
    // Create behaviours once after displayWord is computed, but don't recreate them
    let voteBehaviour: any;
    let visibilityBehaviour: any;
    let modeBehaviour: any;
    let dataBehaviour: any;
    let behavioursInitialized = false;
    
    // Function to trigger reactivity when vote data changes
    function triggerDataUpdate() {
        // Force reactivity by reassigning the wrapper
        wordDataWrapper = { ...wordData };
        console.log('[WordNode] Data wrapper updated via callback');
    }
    
    // Initialize behaviours only once when displayWord is available
    $: if (displayWord && !behavioursInitialized) {
        console.log('[WordNode] Initializing behaviours for word:', displayWord);
        
        voteBehaviour = createVoteBehaviour(node.id, 'word', {
            voteStore: wordViewStore,
            graphStore: graphStore,
            // Use display word for API calls instead of node ID
            apiIdentifier: displayWord,
            // Pass data object for direct updates (maintains reactivity)
            dataObject: wordData,
            getVoteEndpoint: (word: string) => `/nodes/word/${word}/vote`,
            getRemoveVoteEndpoint: (word: string) => `/nodes/word/${word}/vote/remove`,
            // Callback to trigger reactivity
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
        console.log('[WordNode] Behaviours initialized');
    }

    // === SECTION 5: REACTIVE DECLARATIONS ===
    // Mode management
    $: isDetail = node.mode === 'detail';
    
    // User info from store
    $: userName = $userStore?.preferred_username || $userStore?.name || 'Anonymous';
    
    // SIMPLER APPROACH: Read directly from wordData and force updates via data reassignment
    function getNeo4jNumber(value: any): number {
        if (value && typeof value === 'object' && 'low' in value) {
            return Number(value.low);
        }
        return Number(value || 0);
    }
    
    // Create a reactive data wrapper that will trigger updates
    let wordDataWrapper = wordData;
    
    // Vote data - read from the wrapper and store
    $: dataPositiveVotes = getNeo4jNumber(wordDataWrapper.positiveVotes) || 0;
    $: dataNegativeVotes = getNeo4jNumber(wordDataWrapper.negativeVotes) || 0;
    $: storeVoteData = wordViewStore.getVoteData(node.id);
    
    // Use data object as primary source, store as fallback
    $: positiveVotes = dataPositiveVotes || storeVoteData.positiveVotes;
    $: negativeVotes = dataNegativeVotes || storeVoteData.negativeVotes;
    $: netVotes = positiveVotes - negativeVotes;
    $: scoreDisplay = netVotes > 0 ? `+${netVotes}` : netVotes.toString();
    $: wordStatus = netVotes > 0 ? 'agreed' : netVotes < 0 ? 'disagreed' : 'undecided';
    
    // Get other vote state from behaviour (without cyclical dependency)
    $: behaviorState = voteBehaviour ? voteBehaviour.getCurrentState() : null;
    $: userVoteStatus = behaviorState?.userVoteStatus || 'none';
    $: isVoting = behaviorState?.isVoting || false;
    $: voteSuccess = behaviorState?.voteSuccess || false;
    $: lastVoteType = behaviorState?.lastVoteType || null;
    $: voteError = behaviorState?.error || null;
    
    // Text wrapping using new utilities - improved instruction text
    $: contextLines = wrapTextForDetail(
        "Vote whether to include this keyword in ProjectZer0. You can change your vote anytime using the voting controls below.", 
        'word', 
        'content'
    );

    // Visibility data
    $: visibilityState = visibilityBehaviour ? visibilityBehaviour.getCurrentState() : {
        isHidden: false,
        hiddenReason: 'community' as any,
        userPreference: undefined,
        communityHidden: false
    };
    $: isHidden = visibilityState.isHidden;
    $: hiddenReason = visibilityState.hiddenReason;

    // === SECTION 6: EVENT HANDLING ===
    const dispatch = createEventDispatcher<{
        modeChange: { mode: NodeMode };
        visibilityChange: { isHidden: boolean };
    }>();

    // Function to sync state from voteBehaviour to local variables
    function syncVoteState() {
        if (voteBehaviour) {
            const state = voteBehaviour.getCurrentState();
            userVoteStatus = state.userVoteStatus;
            isVoting = state.isVoting;
            voteSuccess = state.voteSuccess;
            lastVoteType = state.lastVoteType;
            console.log('[WordNode] Synced vote state from behaviour:', {
                userVoteStatus,
                isVoting,
                voteSuccess,
                lastVoteType
            });
        }
    }
    
    // Function to update voteBehaviour state and sync back
    async function updateVoteState(voteType: 'agree' | 'disagree' | 'none') {
        if (!voteBehaviour) return false;
        
        // Optimistic update (like original)
        userVoteStatus = voteType;
        isVoting = true;
        
        try {
            const success = await voteBehaviour.handleVote(voteType);
            if (success) {
                // Sync final state from behaviour
                syncVoteState();
                // Trigger data wrapper update for vote counts
                triggerDataUpdate();
            } else {
                // Revert optimistic update on failure
                syncVoteState();
            }
            return success;
        } catch (error) {
            // Revert optimistic update on error
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
        
        // Use our hybrid approach instead of calling voteBehaviour directly
        updateVoteState(event.detail.voteType);
    }

    function handleVisibilityChange(event: CustomEvent<{ isHidden: boolean }>) {
        if (!visibilityBehaviour) return;
        visibilityBehaviour.handleVisibilityChange(event.detail.isHidden);
        dispatch('visibilityChange', event.detail);
    }

    // === SECTION 7: COMPUTED VALUES ===
    $: textWidth = node.radius * 2 - 45;

    // Additional word-specific state
    let wordCreatorDetails: any = null;
    let showDiscussionButton = false;

    // === SECTION 8: LIFECYCLE ===
    onMount(async () => {
        console.log('[WordNode] Mounting with word:', {
            id: node.id,
            word: displayWord,
            mode: node.mode,
            initialPositiveVotes: wordData.positiveVotes,
            initialNegativeVotes: wordData.negativeVotes
        });
        
        // Set word data in the store first
        wordViewStore.setWordData(wordData);
        
        // Wait for behaviours to be created
        await new Promise(resolve => setTimeout(resolve, 0));
        
        // Initialize all behaviours (only if they exist)
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
            
            // CRITICAL: Sync vote state after initialization (like original)
            syncVoteState();
        }
        
        // Fetch creator details if needed
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
        // Clean up behaviours
        if (dataBehaviour && dataBehaviour.destroy) {
            dataBehaviour.destroy();
        }
    });
</script>

{#if isDetail}
    <!-- DETAIL MODE with ContentBox Layout -->
    <BaseDetailNode {node} on:modeChange={handleModeChange}>
        <svelte:fragment slot="default" let:radius>
            <!-- Title (outside content box) -->
            <NodeHeader title="Word" {radius} />
            
            <!-- Structured Content Box -->
            <ContentBox nodeType="word" mode="detail" showBorder={false}>
                <!-- Main Content Section (60% of box) -->
                <svelte:fragment slot="content" let:x let:y let:width let:height>
                    <!-- Main Word Display -->
                    <text
                        x="0"
                        y={y + 45}
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
                    
                    <!-- Context Text - using provided content box dimensions directly -->
                    <foreignObject
                        x={x}
                        y={y + 75}
                        width={width}
                        height={height - 90}
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
                                word-wrap: break-word;
                                hyphens: auto;
                                padding: 10px;
                                margin: 0;
                                box-sizing: border-box;
                            "
                        >
                            {contextLines}
                        </div>
                    </foreignObject>
                    
                    <!-- Subtle content area border for visual definition -->
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
                
                <!-- Voting Section (25% of box) -->
                <svelte:fragment slot="voting" let:x let:y let:width let:height>
                    <!-- Subtle voting area background -->
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
                        showStats={true}
                        showUserStatus={true}
                        {voteSuccess}
                        {lastVoteType}
                        compact={false}
                        mode="detail"
                        availableWidth={width}
                        availableHeight={height}
                        containerY={15}
                        on:vote={handleVote}
                    />
                </svelte:fragment>
                
                <!-- Statistics Section (15% of box) - Now handled by VoteControls -->
                <svelte:fragment slot="stats" let:x let:y let:width let:height>
                    <!-- Statistics now integrated within VoteControls component above -->
                </svelte:fragment>
            </ContentBox>
            
            <!-- Creator credits (outside content box) -->
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
    <!-- PREVIEW MODE - Keep existing layout for now -->
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

    .context-text {
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