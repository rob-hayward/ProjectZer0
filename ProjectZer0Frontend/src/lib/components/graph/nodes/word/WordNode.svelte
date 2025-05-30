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

	// Import the new separated components
	import VoteButtons from '../ui/VoteButtons.svelte';
	import VoteStats from '../ui/VoteStats.svelte';
	import NodeHeader from '../ui/NodeHeader.svelte';
	import CreatorCredits from '../ui/CreatorCredits.svelte';
	import ContentBox from '../ui/ContentBox.svelte';
	import { wrapTextForWidth } from '../utils/textUtils';

	export let node: RenderableNode;
	export let wordText: string = '';

	// Debug toggle - set to true to show ContentBox borders (NOW TRUE FOR DESIGN WORK)
	const DEBUG_SHOW_BORDERS = true;

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
	}

	$: if (displayWord && !behavioursInitialized) {
		voteBehaviour = createVoteBehaviour(node.id, 'word', {
			voteStore: wordViewStore,
			graphStore,
			apiIdentifier: displayWord,
			dataObject: wordData,
			getVoteEndpoint: (word) => `/nodes/word/${word}/vote`,
			getRemoveVoteEndpoint: (word) => `/nodes/word/${word}/vote/remove`,
			onDataUpdate: triggerDataUpdate
		});

		visibilityBehaviour = createVisibilityBehaviour(node.id, { graphStore });
		modeBehaviour = createModeBehaviour(node.mode);
		dataBehaviour = createDataBehaviour('word', wordData, {
			transformData: (rawData) => ({
				...rawData,
				displayWord: rawData.word || wordText,
				formattedDate: rawData.createdAt
					? new Date(rawData.createdAt).toLocaleDateString()
					: ''
			})
		});

		behavioursInitialized = true;
	}

	$: isDetail = node.mode === 'detail';
	$: userName = $userStore?.preferred_username || $userStore?.name || 'Anonymous';

	function getNeo4jNumber(value: any): number {
		return value && typeof value === 'object' && 'low' in value ? Number(value.low) : Number(value || 0);
	}

	let wordDataWrapper = wordData;

	$: dataPositiveVotes = getNeo4jNumber(wordDataWrapper.positiveVotes) || 0;
	$: dataNegativeVotes = getNeo4jNumber(wordDataWrapper.negativeVotes) || 0;
	$: storeVoteData = wordViewStore.getVoteData(node.id);

	$: positiveVotes = dataPositiveVotes || storeVoteData.positiveVotes;
	$: negativeVotes = dataNegativeVotes || storeVoteData.negativeVotes;
	$: netVotes = positiveVotes - negativeVotes;

	$: behaviorState = voteBehaviour?.getCurrentState() || {};
	$: userVoteStatus = behaviorState.userVoteStatus || 'none';
	$: isVoting = behaviorState.isVoting || false;
	$: voteSuccess = behaviorState.voteSuccess || false;
	$: lastVoteType = behaviorState.lastVoteType || null;

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
			syncVoteState();
			if (success) triggerDataUpdate();
			return success;
		} catch (error) {
			syncVoteState();
			return false;
		}
	}

	function handleModeChange() {
		const newMode = modeBehaviour?.handleModeChange();
		if (newMode) dispatch('modeChange', { mode: newMode });
	}

	function handleVote(event: CustomEvent<{ voteType: any }>) {
		updateVoteState(event.detail.voteType);
	}

	let wordCreatorDetails: any = null;
	let showDiscussionButton = false;

	onMount(async () => {
		wordViewStore.setWordData(wordData);
		await new Promise((resolve) => setTimeout(resolve, 0));

		const initPromises = [];
		if (dataBehaviour) initPromises.push(dataBehaviour.initialize());
		if (voteBehaviour) {
			initPromises.push(
				voteBehaviour.initialize({
					positiveVotes: wordData.positiveVotes,
					negativeVotes: wordData.negativeVotes
				})
			);
		}
		if (visibilityBehaviour) initPromises.push(visibilityBehaviour.initialize(netVotes));
		if (initPromises.length > 0) await Promise.all(initPromises);

		syncVoteState();

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
		if (dataBehaviour?.destroy) dataBehaviour.destroy();
	});
</script>

{#if isDetail}
	<BaseDetailNode {node} on:modeChange={handleModeChange}>
		<svelte:fragment slot="default" let:radius>
			<NodeHeader title="Word" radius={radius} mode="detail" />
			<ContentBox nodeType="word" mode="detail" showBorder={DEBUG_SHOW_BORDERS}>
				<svelte:fragment slot="content" let:x let:y let:width let:height let:layoutConfig>
					<text
						x="0"
						y={y + layoutConfig.titleYOffset +20}
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
						height={height - layoutConfig.mainTextYOffset + 115}
					>
						<div class="instruction-text">
							{wrapTextForWidth(
								"Vote whether to include this keyword in ProjectZer0. You can change your vote anytime using the voting controls below.",
								width,
								{ fontSize: 14, fontFamily: 'Inter' }
							).join(' ')}
						</div>
					</foreignObject>
				</svelte:fragment>

				<svelte:fragment slot="voting" let:width let:height>
					<VoteButtons
						{userVoteStatus}
						{positiveVotes}
						{negativeVotes}
						{isVoting}
						{voteSuccess}
						{lastVoteType}
						availableWidth={width}
						containerY={height}
						mode="detail"
						on:vote={handleVote}
					/>
				</svelte:fragment>

				<svelte:fragment slot="stats" let:width>
					<VoteStats
						{userVoteStatus}
						{positiveVotes}
						{negativeVotes}
						{userName}
						showUserStatus={true}
						availableWidth={width}
						containerY={10}
						showBackground={false}
					/>
				</svelte:fragment>
			</ContentBox>

			{#if wordData.createdBy}
				<CreatorCredits
					createdBy={wordData.createdBy}
					publicCredit={wordData.publicCredit}
					creatorDetails={wordCreatorDetails}
					radius={radius}
					prefix="created by:"
				/>
			{/if}
		</svelte:fragment>
	</BaseDetailNode>
{:else}
	<BasePreviewNode {node} on:modeChange={handleModeChange} showContentBoxBorder={DEBUG_SHOW_BORDERS}>
		<svelte:fragment slot="title" let:radius>
			<NodeHeader title="Word" {radius} size="medium" mode="preview" />
		</svelte:fragment>

		<svelte:fragment slot="content" let:x let:y let:width let:height let:layoutConfig>
			<text
				x="0"
				y={y + layoutConfig.titleYOffset + 40}
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

		<svelte:fragment slot="voting" let:x let:y let:width let:height let:layoutConfig>
			<VoteButtons
				{userVoteStatus}
				{positiveVotes}
				{negativeVotes}
				{isVoting}
				{voteSuccess}
				{lastVoteType}
				availableWidth={width}
				containerY={y + height / 1.6}
				mode="preview"
				on:vote={handleVote}
			/>
		</svelte:fragment>
	</BasePreviewNode>
{/if}

<style>
	.main-word,
	.word-preview {
		text-anchor: middle;
		dominant-baseline: middle;
	}

	.instruction-text {
		font-family: Inter;
		font-size: 14px;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.85);
		text-align: center;
		line-height: 1.4;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		padding: 0;
		margin: 0;
		box-sizing: border-box;
	}
</style>