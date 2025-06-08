<!-- src/lib/components/graph/nodes/openquestion/OpenQuestionNode.svelte -->
<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
	import type { OpenQuestionNode } from '$lib/types/domain/nodes';
	import { isOpenQuestionData } from '$lib/types/graph/enhanced';
	import { NODE_CONSTANTS } from '$lib/constants/graph/nodes';
	import BasePreviewNode from '../base/BasePreviewNode.svelte';
	import BaseDetailNode from '../base/BaseDetailNode.svelte';
	import { userStore } from '$lib/stores/userStore';
	import { graphStore } from '$lib/stores/graphStore';
	import { openQuestionViewStore } from '$lib/stores/openQuestionViewStore';
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
	import AnswerQuestionButton from '../ui/AnswerQuestionButton.svelte';
	import { wrapTextForWidth } from '../utils/textUtils';

	export let node: RenderableNode;
	export let questionText: string = '';
	export let nodeX: number | undefined = undefined;
	export let nodeY: number | undefined = undefined;

	// Debug toggle - set to true to show ContentBox borders
	const DEBUG_SHOW_BORDERS = false;

	if (!isOpenQuestionData(node.data)) {
		throw new Error('Invalid node data type for OpenQuestionNode');
	}

	const questionData = node.data as OpenQuestionNode;

	// Get the question text
	$: displayQuestionText = questionText || questionData.questionText;

	let voteBehaviour: any;
	let visibilityBehaviour: any;
	let modeBehaviour: any;
	let dataBehaviour: any;
	let behavioursInitialized = false;

	function triggerDataUpdate() {
		questionDataWrapper = { ...questionData };
	}

	$: if (node.id && !behavioursInitialized) {
		voteBehaviour = createVoteBehaviour(node.id, 'openquestion', {
			voteStore: openQuestionViewStore,
			graphStore,
			apiIdentifier: node.id,
			dataObject: questionData,
			getVoteEndpoint: (id) => `/nodes/openquestion/${id}/vote`,
			getRemoveVoteEndpoint: (id) => `/nodes/openquestion/${id}/vote/remove`,
			onDataUpdate: triggerDataUpdate
		});

		visibilityBehaviour = createVisibilityBehaviour(node.id, { graphStore });
		modeBehaviour = createModeBehaviour(node.mode);
		dataBehaviour = createDataBehaviour('openquestion', questionData, {
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

	let questionDataWrapper = questionData;

	$: dataPositiveVotes = getNeo4jNumber(questionDataWrapper.positiveVotes) || 0;
	$: dataNegativeVotes = getNeo4jNumber(questionDataWrapper.negativeVotes) || 0;
	$: storeVoteData = openQuestionViewStore.getVoteData(node.id);

	$: positiveVotes = dataPositiveVotes || storeVoteData.positiveVotes;
	$: negativeVotes = dataNegativeVotes || storeVoteData.negativeVotes;
	$: netVotes = positiveVotes - negativeVotes;

	$: behaviorState = voteBehaviour?.getCurrentState() || {};
	$: userVoteStatus = behaviorState.userVoteStatus || 'none';
	$: isVoting = behaviorState.isVoting || false;
	$: voteSuccess = behaviorState.voteSuccess || false;
	$: lastVoteType = behaviorState.lastVoteType || null;

	// FIXED: Consistent cyan styling (not vote-based)
	// Update node style with cyan highlight color
	$: {
		if (node.style) {
			node.style.highlightColor = NODE_CONSTANTS.COLORS.OPENQUESTION.border;
		}
	}

	// Consistent styling like definition nodes - NOT vote-based
	$: voteBasedStyles = {
		glow: {
			intensity: 8,
			opacity: 0.6
		},
		ring: {
			width: 6,
			opacity: 0.5
		}
	};

	const dispatch = createEventDispatcher<{
		modeChange: { 
			mode: NodeMode;
			position?: { x: number; y: number };
		};
		visibilityChange: { isHidden: boolean };
		answerQuestion: { questionId: string };
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

	function handleModeChange(event: CustomEvent<{ 
		mode: NodeMode; 
		position?: { x: number; y: number };
		nodeId?: string;
	}>) {
		console.log('[OpenQuestionNode] Mode change event:', event.detail);
		
		// Update the mode behaviour
		const newMode = event.detail.mode;
		if (modeBehaviour) {
			modeBehaviour.setMode(newMode);
		}
		
		// Forward the event with position data
		dispatch('modeChange', {
			mode: newMode,
			position: event.detail.position
		});
	}

	function handleVote(event: CustomEvent<{ voteType: any }>) {
		updateVoteState(event.detail.voteType);
	}

	function handleAnswerQuestion(event: CustomEvent<{ questionId: string }>) {
		console.log('Answer question clicked for:', event.detail.questionId);
		// TODO: Navigate to create statement form with this question as parent
		// This could trigger a modal, navigate to create node, or open an answer form
		dispatch('answerQuestion', { questionId: event.detail.questionId });
	}

	function handleVisibilityChange(event: CustomEvent<{ isHidden: boolean }>) {
		dispatch('visibilityChange', event.detail);
	}

	let questionCreatorDetails: any = null;

	onMount(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));

		const initPromises = [];
		if (dataBehaviour) initPromises.push(dataBehaviour.initialize());
		if (voteBehaviour) {
			initPromises.push(
				voteBehaviour.initialize({
					positiveVotes: questionData.positiveVotes,
					negativeVotes: questionData.negativeVotes
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

		if (questionData.createdBy) {
			try {
				questionCreatorDetails = await getUserDetails(questionData.createdBy);
			} catch (e) {
				console.error('[OpenQuestionNode] Error fetching creator details:', e);
			}
		}
	});

	onDestroy(() => {
		if (dataBehaviour?.destroy) dataBehaviour.destroy();
	});
</script>

{#if isDetail}
	<BaseDetailNode 
		{node} 
		{nodeX}
		{nodeY}
		{voteBasedStyles}
		on:modeChange={handleModeChange}
		on:visibilityChange={handleVisibilityChange}
	>
		<svelte:fragment slot="default" let:radius>
			<NodeHeader title="Open Question" radius={radius} mode="detail" />
			<ContentBox nodeType="openquestion" mode="detail" showBorder={DEBUG_SHOW_BORDERS}>
				<svelte:fragment slot="content" let:x let:y let:width let:height let:layoutConfig>
					<!-- Main question text -->
					<foreignObject
						x={x}
						y={y + layoutConfig.titleYOffset + 0}
						width={width}
						height={height - layoutConfig.titleYOffset - 90}
					>
						<div class="question-display">
							{displayQuestionText}
						</div>
					</foreignObject>

					<!-- Keywords Display (if any) -->
					{#if questionData.keywords && questionData.keywords.length > 0}
						<foreignObject
							x={x}
							y={y}
							width={width}
							height="50"
						>
							<div class="keywords-section">
								<div class="keywords-container">
									{#each questionData.keywords as keyword}
										<div class="keyword-chip" class:ai-keyword={keyword.source === 'ai'} class:user-keyword={keyword.source === 'user'}>
											{keyword.word}
										</div>
									{/each}
								</div>
							</div>
						</foreignObject>
					{/if}

					<!-- Answers Display (if any) -->
					{#if questionData.answers && questionData.answers.length > 0}
						<foreignObject
							x={x}
							y={y + height - 140}
							width={width}
							height="100"
						>
							<div class="answers-section">
								<div class="answers-header">Answers ({questionData.answers.length})</div>
								<div class="answers-container">
									{#each questionData.answers.slice(0, 3) as answer}
										<div class="answer-preview" title={answer.statement}>
											<span class="answer-text">{answer.statement.substring(0, 60)}{answer.statement.length > 60 ? '...' : ''}</span>
											<span class="answer-votes">+{answer.netVotes}</span>
										</div>
									{/each}
									{#if questionData.answers.length > 3}
										<div class="more-answers">+{questionData.answers.length - 3} more</div>
									{/if}
								</div>
							</div>
						</foreignObject>
					{/if}
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
					
					<!-- Answer Question Button -->
					<AnswerQuestionButton
						questionId={questionData.id}
						x={width / 2}
						y={height - 50}
						on:answerQuestion={handleAnswerQuestion}
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
						containerY={30}
						showBackground={false}
					/>
				</svelte:fragment>
			</ContentBox>

			{#if questionData.createdBy}
				<CreatorCredits
					createdBy={questionData.createdBy}
					publicCredit={questionData.publicCredit}
					creatorDetails={questionCreatorDetails}
					radius={radius}
					prefix="asked by:"
				/>
			{/if}
		</svelte:fragment>
	</BaseDetailNode>
{:else}
	<BasePreviewNode 
		{node} 
		{nodeX}
		{nodeY}
		{voteBasedStyles}
		on:modeChange={handleModeChange}
		on:visibilityChange={handleVisibilityChange}
		showContentBoxBorder={DEBUG_SHOW_BORDERS}
	>
		<svelte:fragment slot="title" let:radius>
			<NodeHeader title="Question" radius={radius} size="small" mode="preview" />
		</svelte:fragment>

		<svelte:fragment slot="content" let:x let:y let:width let:height let:layoutConfig>
			<!-- Main question text -->
			<foreignObject
				x={x}
				y={y - 55}
				width={width}
				height={height - layoutConfig.titleYOffset}
			>
				<div class="question-preview">
					{displayQuestionText}
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
			
			<!-- Answer Question Button for Preview Mode -->
			<AnswerQuestionButton
				questionId={questionData.id}
				x={width / 2}
				y={y + height / 2 + 40}
				on:answerQuestion={handleAnswerQuestion}
			/>
		</svelte:fragment>
	</BasePreviewNode>
{/if}

<style>
	.question-display {
		font-family: Inter;
		font-size: 16px;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.9);
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

	.question-preview {
		font-family: Inter;
		font-size: 12px;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.9);
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

	.keywords-section {
		font-family: Inter;
		color: rgba(255, 255, 255, 0.9);
		text-align: left;
		width: 100%;
		height: 100%;
		padding: 0;
		margin: 0;
		box-sizing: border-box;
	}

	.keywords-container {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.keyword-chip {
		background: rgba(0, 188, 212, 0.2);  /* CYAN background */
		border: 1px solid rgba(0, 188, 212, 0.3);  /* CYAN border */
		border-radius: 12px;
		padding: 4px 8px;
		font-size: 10px;
		color: white;
		font-family: Inter;
		font-weight: 500;
	}

	.keyword-chip.ai-keyword {
		background: rgba(52, 152, 219, 0.2);
		border: 1px solid rgba(52, 152, 219, 0.3);
	}

	.keyword-chip.user-keyword {
		background: rgba(0, 188, 212, 0.2);  /* CYAN for user keywords */
		border: 1px solid rgba(0, 188, 212, 0.3);
	}

	.answers-section {
		font-family: Inter;
		color: rgba(255, 255, 255, 0.9);
		text-align: left;
		width: 100%;
		height: 100%;
		padding: 8px;
		margin: 0;
		box-sizing: border-box;
		border-top: 1px solid rgba(0, 188, 212, 0.3);
	}

	.answers-header {
		font-size: 11px;
		font-weight: 600;
		color: rgba(0, 188, 212, 0.8);
		margin-bottom: 6px;
	}

	.answers-container {
		display: flex;
		flex-direction: column;
		gap: 4px;
		max-height: 80px;
		overflow-y: auto;
	}

	.answer-preview {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: rgba(0, 188, 212, 0.1);
		border: 1px solid rgba(0, 188, 212, 0.2);
		border-radius: 8px;
		padding: 4px 8px;
		font-size: 10px;
	}

	.answer-text {
		flex: 1;
		color: rgba(255, 255, 255, 0.8);
		margin-right: 8px;
	}

	.answer-votes {
		color: rgba(0, 188, 212, 0.9);
		font-weight: 600;
		font-size: 9px;
	}

	.more-answers {
		font-size: 9px;
		color: rgba(0, 188, 212, 0.6);
		text-align: center;
		font-style: italic;
		padding: 2px;
	}
</style>