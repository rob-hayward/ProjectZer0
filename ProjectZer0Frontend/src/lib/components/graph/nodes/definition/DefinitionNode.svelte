<!-- src/lib/components/graph/nodes/definition/DefinitionNode.svelte -->
<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
	import type { Definition } from '$lib/types/domain/nodes';
	import { isDefinitionData } from '$lib/types/graph/enhanced';
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

	// Import the shared UI components
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

	if (!isDefinitionData(node.data)) {
		throw new Error('Invalid node data type for DefinitionNode');
	}

	const definitionData = node.data as Definition;
	const subtype = node.group === 'live-definition' ? 'live' : 'alternative';
	const nodeTitle = subtype === 'live' ? 'Live Definition' : 'Alternative Definition';

	// Get the definition text
	$: definitionText = definitionData.definitionText;

	let voteBehaviour: any;
	let visibilityBehaviour: any;
	let modeBehaviour: any;
	let dataBehaviour: any;
	let behavioursInitialized = false;

	function triggerDataUpdate() {
		definitionDataWrapper = { ...definitionData };
	}

	$: if (node.id && !behavioursInitialized) {
		voteBehaviour = createVoteBehaviour(node.id, 'definition', {
			voteStore: wordViewStore,
			graphStore,
			apiIdentifier: definitionData.id,
			dataObject: definitionData,
			getVoteEndpoint: (id) => `/definitions/${id}/vote`,
			getRemoveVoteEndpoint: (id) => `/definitions/${id}/vote/remove`,
			onDataUpdate: triggerDataUpdate
		});

		visibilityBehaviour = createVisibilityBehaviour(node.id, { graphStore });
		modeBehaviour = createModeBehaviour(node.mode);
		dataBehaviour = createDataBehaviour('definition', definitionData, {
			transformData: (rawData) => ({
				...rawData,
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

	let definitionDataWrapper = definitionData;

	$: dataPositiveVotes = getNeo4jNumber(definitionDataWrapper.positiveVotes) || 0;
	$: dataNegativeVotes = getNeo4jNumber(definitionDataWrapper.negativeVotes) || 0;
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

	let definitionCreatorDetails: any = null;

	onMount(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));

		const initPromises = [];
		if (dataBehaviour) initPromises.push(dataBehaviour.initialize());
		if (voteBehaviour) {
			initPromises.push(
				voteBehaviour.initialize({
					positiveVotes: definitionData.positiveVotes,
					negativeVotes: definitionData.negativeVotes
				})
			);
		}
		if (visibilityBehaviour) initPromises.push(visibilityBehaviour.initialize(netVotes));
		if (initPromises.length > 0) await Promise.all(initPromises);

		syncVoteState();

		// Recalculate visibility after initialization
		if (graphStore) {
			graphStore.recalculateNodeVisibility(
				node.id,
				positiveVotes,
				negativeVotes
			);
		}

		if (definitionData.createdBy && definitionData.createdBy !== 'FreeDictionaryAPI') {
			try {
				definitionCreatorDetails = await getUserDetails(definitionData.createdBy);
			} catch (e) {
				console.error('[DefinitionNode] Error fetching creator details:', e);
			}
		}
	});

	onDestroy(() => {
		if (dataBehaviour?.destroy) dataBehaviour.destroy();
	});
</script>

{#if isDetail}
	<BaseDetailNode {node} on:modeChange={handleModeChange}>
		<svelte:fragment slot="default" let:radius>
			<NodeHeader title={nodeTitle} radius={radius} mode="detail" />
			<ContentBox nodeType="definition" mode="detail" showBorder={DEBUG_SHOW_BORDERS}>
				<svelte:fragment slot="content" let:x let:y let:width let:height let:layoutConfig>
			<!-- Combined word and definition text with proper wrapping -->
			{@const combinedText = `${wordText}: ${definitionText}`}
			{@const wrappedLines = wrapTextForWidth(
				combinedText,
				width,
				{ fontSize: 12, fontFamily: 'Inter', maxLines: 10 }
			)}
			
			<foreignObject
				x={x}
				y={y + layoutConfig.titleYOffset - 0}
				width={width}
				height={height - layoutConfig.titleYOffset}
			>
				<div class="definition-detial">
					{#each wrappedLines as line, i}
						<div class="preview-line">
							{#if i === 0}
								<!-- First line: check if it contains the word -->
								{@const colonIndex = line.indexOf(':')}
								{#if colonIndex !== -1}
									<span class="word-bold">{line.substring(0, colonIndex + 1)}</span>
									<span class="definition-text">{line.substring(colonIndex + 1)}</span>
								{:else}
									<span class="definition-text">{line}</span>
								{/if}
							{:else}
								<!-- Subsequent lines: just definition text -->
								<span class="definition-text">{line}</span>
							{/if}
						</div>
					{/each}
				</div>
			</foreignObject>
		

					<!-- Instruction Text -->
					<foreignObject
						x={x}
						y={y + height - 80}
						width={width}
						height="60"
					>
						<div class="instruction-text">
							{wrapTextForWidth(
								"Vote whether you agree with this definition for this word, within the context of ProjectZer0. You can change your vote anytime using the voting controls below.",
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
						containerY={26}
						showBackground={false}
					/>
				</svelte:fragment>
			</ContentBox>

			{#if definitionData.createdBy}
				<CreatorCredits
					createdBy={definitionData.createdBy}
					publicCredit={true}
					creatorDetails={definitionCreatorDetails}
					radius={radius}
					prefix="defined by:"
				/>
			{/if}
		</svelte:fragment>
	</BaseDetailNode>
{:else}
	<BasePreviewNode {node} on:modeChange={handleModeChange} showContentBoxBorder={DEBUG_SHOW_BORDERS}>
		<svelte:fragment slot="title" let:radius>
			<NodeHeader title={nodeTitle} radius={radius} size="small" mode="preview" />
		</svelte:fragment>

		<svelte:fragment slot="content" let:x let:y let:width let:height let:layoutConfig>
			<!-- Combined word and definition text with proper wrapping -->
			{@const combinedText = `${wordText}: ${definitionText}`}
			{@const wrappedLines = wrapTextForWidth(
				combinedText,
				width,
				{ fontSize: 10, fontFamily: 'Inter', maxLines: 10 }
			)}
			
			<foreignObject
				x={x}
				y={y + layoutConfig.titleYOffset - 0}
				width={width}
				height={height - layoutConfig.titleYOffset}
			>
				<div class="definition-preview">
					{#each wrappedLines as line, i}
						<div class="preview-line">
							{#if i === 0}
								<!-- First line: check if it contains the word -->
								{@const colonIndex = line.indexOf(':')}
								{#if colonIndex !== -1}
									<span class="word-bold">{line.substring(0, colonIndex + 1)}</span>
									<span class="definition-text">{line.substring(colonIndex + 1)}</span>
								{:else}
									<span class="definition-text">{line}</span>
								{/if}
							{:else}
								<!-- Subsequent lines: just definition text -->
								<span class="definition-text">{line}</span>
							{/if}
						</div>
					{/each}
				</div>
			</foreignObject>
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
				containerY={y + height / 2}
				mode="preview"
				on:vote={handleVote}
			/>
		</svelte:fragment>
	</BasePreviewNode>
{/if}

<style>
	.word-title {
		text-anchor: middle;
		dominant-baseline: middle;
	}

	.definition-display {
		font-family: Inter;
		font-size: 16px;
		font-weight: 400;
		color: white;
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

	.definition-preview {
		font-family: Inter;
		font-size: 12px;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.9);
		text-align: center;
		line-height: 1.4;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		padding: 0;
		margin: 0;
		box-sizing: border-box;
	}

	.preview-line {
		margin-bottom: 2px;
		width: 100%;
	}

	.word-bold {
		font-weight: 600;
		color: white;
	}

	.definition-text {
		font-weight: 400;
		color: rgba(255, 255, 255, 0.9);
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