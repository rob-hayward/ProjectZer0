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
	import TextContent from '../ui/TextContent.svelte';

	export let node: RenderableNode;
	export let wordText: string = '';

	// Debug toggle - set to true to show ContentBox borders
	const DEBUG_SHOW_BORDERS = false;

	if (!isDefinitionData(node.data)) {
		throw new Error('Invalid node data type for DefinitionNode');
	}

	const definitionData = node.data as Definition;
	const subtype = node.group === 'live-definition' ? 'live' : 'alternative';
	const nodeTitle = subtype === 'live' ? 'Live Definition' : 'Alternative Definition';

	// Get the definition text
	$: definitionText = definitionData.definitionText;
	$: displayContent = `${wordText}: ${definitionText}`;

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
				displayContent: `${wordText}: ${rawData.definitionText}`,
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
		hover: { isHovered: boolean };
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

	function handleHover(event: CustomEvent<{ isHovered: boolean }>) {
		dispatch('hover', event.detail);
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

	// Preview mode text wrapping
	$: textWidth = node.radius * 2;
	$: maxCharsPerLine = Math.floor(textWidth / 8);
	$: previewLines = displayContent.split(' ').reduce((acc, word) => {
		const currentLine = acc[acc.length - 1] || '';
		const testLine = currentLine + (currentLine ? ' ' : '') + word;
		
		if (!currentLine || testLine.length <= maxCharsPerLine) {
			acc[acc.length - 1] = testLine;
		} else {
			acc.push(word);
		}
		return acc;
	}, ['']);

	// Score display
	$: scoreDisplay = netVotes > 0 ? `+${netVotes}` : netVotes.toString();
</script>

{#if isDetail}
	<BaseDetailNode {node} on:modeChange={handleModeChange}>
		<svelte:fragment slot="default" let:radius>
			<NodeHeader title={nodeTitle} radius={radius} mode="detail" />
			<ContentBox nodeType="definition" mode="detail" showBorder={DEBUG_SHOW_BORDERS}>
				<svelte:fragment slot="content" let:x let:y let:width let:height let:layoutConfig>
					<!-- Definition Display - using full height available -->
					<foreignObject
						x={x}
						y={y + layoutConfig.titleYOffset}
						width={width}
						height={height - layoutConfig.titleYOffset - 80}
					>
						<div class="definition-container">
							<div class="definition-display">
								<span class="word-text">{wordText}:</span>
								<span class="definition-text">{definitionText}</span>
							</div>
						</div>
					</foreignObject>

					<!-- Instruction Text - positioned at bottom of content area -->
					<foreignObject
						x={x}
						y={y + height - 100}
						width={width}
						height="80"
					>
						<div class="instruction-text">
							Vote whether you agree with this definition for this word, within the context of ProjectZer0. You can change your vote anytime using the voting controls below.
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
						containerY={height / 2}
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
						containerY={0}
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
	<BasePreviewNode {node} on:modeChange={handleModeChange} on:hover={handleHover} useContentBox={true} showContentBoxBorder={DEBUG_SHOW_BORDERS}>
		<svelte:fragment slot="title" let:radius>
			<NodeHeader title={nodeTitle} radius={radius} size="small" mode="preview" />
		</svelte:fragment>

		<svelte:fragment slot="content" let:radius let:style>
			<TextContent
				text={displayContent}
				{radius}
				mode="preview"
				fontSize="12px"
				fontFamily="Inter"
				fontWeight="400"
				alignment="center"
				maxLines={10}
			/>
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
				mode="preview"
				on:vote={handleVote}
			/>
		</svelte:fragment>
	</BasePreviewNode>
{/if}

<style>
	.definition-container {
	width: 100%;
	height: 100%;
	overflow-y: auto;
	overflow-x: hidden;
	padding-right: 10px;
}

.definition-display {
	font-family: Inter;
	font-size: 16px;
	line-height: 1.5;
	color: white;
	text-align: center;
	padding: 0;
	margin: 0;
	width: 100%;
}

.word-text {
	font-weight: 600;
	margin-right: 0px;
	display: inline;
}

.definition-text {
	font-weight: 400;
	display: inline;
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

/* Scrollbar styling for definition container */
.definition-container::-webkit-scrollbar {
	width: 6px;
}

.definition-container::-webkit-scrollbar-track {
	background: rgba(255, 255, 255, 0.05);
	border-radius: 3px;
}

.definition-container::-webkit-scrollbar-thumb {
	background: rgba(255, 255, 255, 0.2);
	border-radius: 3px;
}

.definition-container::-webkit-scrollbar-thumb:hover {
	background: rgba(255, 255, 255, 0.3);
}
</style>