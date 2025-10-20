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

	import { createVoteBehaviour, type VoteBehaviour } from '../behaviours/voteBehaviour';

	// Import the shared UI components
	import VoteButtons from '../ui/ContentVoteButtons.svelte';
	import VoteStats from '../ui/VoteStats.svelte';
	import NodeHeader from '../ui/NodeHeader.svelte';
	import CreatorCredits from '../ui/CreatorCredits.svelte';
	import ContentBox from '../ui/ContentBox.svelte';
	import ReplyButton from '../ui/ReplyButton.svelte';
	import { wrapTextForWidth } from '../utils/textUtils';
	import { getNeo4jNumber } from '$lib/utils/neo4j-utils';

	export let node: RenderableNode;
	export let isReply: boolean = false;

	// Debug toggle - set to true to show ContentBox borders
	const DEBUG_SHOW_BORDERS = false;

	if (!isCommentData(node.data)) {
		throw new Error('Invalid node data type for CommentNode');
	}

	// CRITICAL: Change const to let for reactivity
	let commentData = node.data as CommentNode;

	// Voting behaviour instance
	let voteBehaviour: VoteBehaviour;

	// Track replying state from discussionStore
	$: isReplying = $discussionStore.isAddingReply && $discussionStore.replyToCommentId === node.id;

	$: isDetail = node.mode === 'detail';
	$: userName = $userStore?.preferred_username || $userStore?.name || 'Anonymous';

	// Extract vote data with proper reactivity
	$: positiveVotes = getNeo4jNumber(commentData.positiveVotes) || 0;
	$: negativeVotes = getNeo4jNumber(commentData.negativeVotes) || 0;
	$: netVotes = positiveVotes - negativeVotes;

	// Get reactive state from behaviour
	$: votingState = voteBehaviour?.getCurrentState() || {
		userVoteStatus: 'none',
		isVoting: false,
		voteSuccess: false,
		lastVoteType: null
	};

	$: userVoteStatus = votingState.userVoteStatus;
	$: isVoting = votingState.isVoting;
	$: voteSuccess = votingState.voteSuccess;
	$: lastVoteType = votingState.lastVoteType;

	const dispatch = createEventDispatcher<{
		modeChange: { mode: NodeMode };
		visibilityChange: { isHidden: boolean };
		reply: { commentId: string };
	}>();

	function handleModeChange() {
		dispatch('modeChange', { mode: isDetail ? 'preview' : 'detail' });
	}

	// Vote handler - now uses behaviour
	async function handleVote(event: CustomEvent<{ voteType: any }>) {
		if (!voteBehaviour) return;
		await voteBehaviour.handleVote(event.detail.voteType);
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
		// Create voting behaviour for content votes
		// NOTE: Comments have ONLY content voting (no inclusion voting)
		// All comments are included by default (freedom of speech principle)
		// Users vote on the quality/agreement with the comment content
		voteBehaviour = createVoteBehaviour(node.id, 'comment', {
			voteStore: discussionStore,
			graphStore,
			apiIdentifier: node.id,
			dataObject: commentData,
			dataProperties: {
				positiveVotesKey: 'positiveVotes',
				negativeVotesKey: 'negativeVotes'
			},
			getVoteEndpoint: (id) => `/comments/${id}/vote`,
			getRemoveVoteEndpoint: (id) => `/comments/${id}/vote/remove`,
			onDataUpdate: () => {
				// Trigger reactivity
				commentData = { ...commentData };
			},
			metadataConfig: {
				nodeMetadata: node.metadata,
				voteStatusKey: 'contentVoteStatus' // Content voting only
			}
		});

		// Initialize with current vote data
		await voteBehaviour.initialize({
			positiveVotes: commentData.positiveVotes,
			negativeVotes: commentData.negativeVotes,
			skipVoteStatusFetch: false
		});

		// Recalculate visibility after initialization
		if (graphStore) {
			graphStore.recalculateNodeVisibility(
				node.id,
				positiveVotes,
				negativeVotes
			);
		}

		// Load creator details
		if (commentData.createdBy) {
			try {
				commentCreatorDetails = await getUserDetails(commentData.createdBy);
			} catch (e) {
				console.error('[CommentNode] Error fetching creator details:', e);
			}
		}
	});

	onDestroy(() => {
		// Cleanup if needed
	});
</script>

{#if isDetail}
	<BaseDetailNode {node} on:modeChange={handleModeChange}>
		<svelte:fragment slot="title" let:radius>
			<NodeHeader title={isReply ? "Reply" : "Comment"} {radius} mode="detail" />
		</svelte:fragment>

		<svelte:fragment slot="content" let:x let:y let:width let:height>
			<!-- Main comment text using wrapTextForWidth -->
			<foreignObject
				x={x}
				y={y + 10}
				width={width}
				height={height - 50}
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

		<svelte:fragment slot="voting" let:x let:y let:width let:height>
			<VoteButtons
				{userVoteStatus}
				{positiveVotes}
				{negativeVotes}
				{isVoting}
				{voteSuccess}
				{lastVoteType}
				availableWidth={width}
				containerY={y + height / 2}
				mode="detail"
				on:vote={handleVote}
			/>
		</svelte:fragment>

		<svelte:fragment slot="stats" let:x let:y let:width let:height>
			<VoteStats
				{userVoteStatus}
				{positiveVotes}
				{negativeVotes}
				{userName}
				showUserStatus={true}
				availableWidth={width}
				containerY={y}
				showBackground={false}
			/>
		</svelte:fragment>

		<svelte:fragment slot="credits" let:radius>
			{#if commentData.createdBy}
				<CreatorCredits
					createdBy={commentData.createdBy}
					publicCredit={commentData.publicCredit || true}
					creatorDetails={commentCreatorDetails}
					{radius}
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