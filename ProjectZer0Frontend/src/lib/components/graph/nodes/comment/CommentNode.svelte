<!-- src/lib/components/graph/nodes/comment/CommentNode.svelte -->
<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
	import type { CommentNode } from '$lib/types/domain/nodes';
	import { isCommentData } from '$lib/types/graph/enhanced';
	import { NODE_CONSTANTS } from '$lib/constants/graph/nodes';
	import BasePreviewNode from '../base/BasePreviewNode.svelte';
	import BaseDetailNode from '../base/BaseDetailNode.svelte';
	import { userStore } from '$lib/stores/userStore';
	import { graphStore } from '$lib/stores/graphStore';
	import { discussionStore } from '$lib/stores/discussionStore';
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
	import ReplyButton from '../ui/ReplyButton.svelte';
	import { wrapTextForWidth } from '../utils/textUtils';

	export let node: RenderableNode;
	export let isReply: boolean = false;

	// Debug toggle - set to true to show ContentBox borders
	const DEBUG_SHOW_BORDERS = false;

	if (!isCommentData(node.data)) {
		throw new Error('Invalid node data type for CommentNode');
	}

	const commentData = node.data as CommentNode;

	let voteBehaviour: any;
	let visibilityBehaviour: any;
	let modeBehaviour: any;
	let dataBehaviour: any;
	let behavioursInitialized = false;

	// Track replying state from discussionStore
	$: isReplying = $discussionStore.isAddingReply && $discussionStore.replyToCommentId === node.id;

	function triggerDataUpdate() {
		commentDataWrapper = { ...commentData };
	}

	$: if (node.id && !behavioursInitialized) {
		voteBehaviour = createVoteBehaviour(node.id, 'comment', {
			voteStore: discussionStore,
			graphStore,
			apiIdentifier: node.id,
			dataObject: commentData,
			getVoteEndpoint: (id) => `/comments/${id}/vote`,
			getRemoveVoteEndpoint: (id) => `/comments/${id}/vote/remove`,
			onDataUpdate: triggerDataUpdate
		});

		visibilityBehaviour = createVisibilityBehaviour(node.id, { graphStore });
		modeBehaviour = createModeBehaviour(node.mode);
		dataBehaviour = createDataBehaviour('comment', commentData, {
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

	let commentDataWrapper = commentData;

	$: dataPositiveVotes = getNeo4jNumber(commentDataWrapper.positiveVotes) || 0;
	$: dataNegativeVotes = getNeo4jNumber(commentDataWrapper.negativeVotes) || 0;
	$: storeVoteData = discussionStore.getVoteData(node.id);

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
		reply: { commentId: string };
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

	// Reply functionality
	function handleReply() {
		console.log(`[CommentNode] handleReply called for comment: ${node.id}`);
		dispatch('reply', { commentId: node.id });
		// Update the discussion store to track that we're replying to this comment
		discussionStore.startReply(node.id);
	}

	function handleReplyButtonClick(event: CustomEvent<{ nodeId: string | undefined }>) {
		console.log(`[CommentNode] Reply button clicked for comment: ${node.id}`);
		handleReply();
	}

	let commentCreatorDetails: any = null;

	// Format the creation date for display
	function formatDate(date: string | Date): string {
		if (!date) return '';
		const d = new Date(date);
		return d.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	onMount(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));

		const initPromises = [];
		if (dataBehaviour) initPromises.push(dataBehaviour.initialize());
		if (voteBehaviour) {
			initPromises.push(
				voteBehaviour.initialize({
					positiveVotes: commentData.positiveVotes,
					negativeVotes: commentData.negativeVotes
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

		if (commentData.createdBy) {
			try {
				commentCreatorDetails = await getUserDetails(commentData.createdBy);
			} catch (e) {
				console.error('[CommentNode] Error fetching creator details:', e);
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
			<NodeHeader title={isReply ? "Reply" : "Comment"} radius={radius} mode="detail" />
			<ContentBox nodeType="comment" mode="detail" showBorder={DEBUG_SHOW_BORDERS}>
				<svelte:fragment slot="content" let:x let:y let:width let:height let:layoutConfig>
					<!-- Main comment text using wrapTextForWidth -->
					<foreignObject
						x={x}
						y={y + layoutConfig.titleYOffset + 10}
						width={width}
						height={height - layoutConfig.titleYOffset - 50}
					>
						<div class="comment-display">
							{wrapTextForWidth(
								commentData.commentText,
								width,
								{ fontSize: 14, fontFamily: 'Inter' }
							).join(' ')}
						</div>
					</foreignObject>

					<!-- Author and date metadata -->
					<foreignObject
						x={x}
						y={y + height - 40}
						width={width}
						height="30"
					>
						<div class="metadata-display">
							{commentData.createdBy} · {formatDate(commentData.createdAt)}
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

			{#if commentData.createdBy}
				<CreatorCredits
					createdBy={commentData.createdBy}
					publicCredit={commentData.publicCredit || true}
					creatorDetails={commentCreatorDetails}
					radius={radius}
					prefix="by:"
				/>
			{/if}
		</svelte:fragment>
	</BaseDetailNode>
{:else}
	<BasePreviewNode {node} on:modeChange={handleModeChange} showContentBoxBorder={DEBUG_SHOW_BORDERS}>
		<svelte:fragment slot="title" let:radius>
			<NodeHeader title={isReply ? "Reply" : "Comment"} radius={radius} size="small" mode="preview" />
		</svelte:fragment>

		<svelte:fragment slot="content" let:x let:y let:width let:height let:layoutConfig>
			<!-- Main comment text using wrapTextForWidth -->
			<foreignObject
				x={x}
				y={y - 25}
				width={width}
				height={height - layoutConfig.titleYOffset - 20}
			>
				<div class="comment-preview">
					{wrapTextForWidth(
						commentData.commentText,
						width,
						{ fontSize: 10, fontFamily: 'Inter' }
					).join(' ')}
				</div>
			</foreignObject>

			<!-- Author info at bottom of content area -->
			<foreignObject
				x={x}
				y={y + height - 15}
				width={width}
				height="15"
			>
				<div class="metadata-preview">
					{commentData.createdBy} · {formatDate(commentData.createdAt)}
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

<!-- Reply Button - positioned outside the node at 1:30 position (45 degrees) -->
<ReplyButton 
	x={node.radius * 0.7071}
	y={-node.radius * 0.7071}
	nodeId={node.id}
	on:reply={handleReplyButtonClick}
/>

<!-- Visual indicator when this comment is being replied to -->
{#if isReplying}
	<circle
		cx="0"
		cy="0"
		r={node.radius + 5}
		fill="none"
		stroke="rgba(46, 204, 113, 0.6)"
		stroke-width="2"
		stroke-dasharray="5 5"
		class="reply-indicator"
	/>
{/if}

<style>
	.comment-display {
		font-family: Inter;
		font-size: 14px;
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

	.comment-preview {
		font-family: Inter;
		font-size: 10px;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.9);
		text-align: center;
		line-height: 1.3;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		padding: 0;
		margin: 0;
		box-sizing: border-box;
	}

	.metadata-display {
		font-family: Inter;
		font-size: 10px;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.6);
		text-align: center;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		padding: 0;
		margin: 0;
		box-sizing: border-box;
	}

	.metadata-preview {
		font-family: Inter;
		font-size: 8px;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.6);
		text-align: center;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		padding: 0;
		margin: 0;
		box-sizing: border-box;
	}

	.reply-indicator {
		animation: rotate 10s linear infinite;
		pointer-events: none;
	}

	@keyframes rotate {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>