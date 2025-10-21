<!-- src/lib/components/graph/nodes/comment/CommentNode.svelte -->
<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
	import type { CommentNode } from '$lib/types/domain/nodes';
	import { isCommentData } from '$lib/types/graph/enhanced';
	import BasePreviewNode from '../base/BasePreviewNode.svelte';
	import BaseDetailNode from '../base/BaseDetailNode.svelte';
	import { TextContent, NodeHeader, ContentVoteButtons, VoteStats, CreatorCredits, ReplyButton } from '../ui';
	import { userStore } from '$lib/stores/userStore';
	import { graphStore } from '$lib/stores/graphStore';
	import { discussionStore } from '$lib/stores/discussionStore';
	import { getUserDetails } from '$lib/services/userLookup';
	import { createVoteBehaviour, type VoteBehaviour } from '../behaviours/voteBehaviour';
	import { getNeo4jNumber } from '$lib/utils/neo4j-utils';

	export let node: RenderableNode;
	export let isReply: boolean = false;

	if (!isCommentData(node.data)) {
		throw new Error('Invalid node data type for CommentNode');
	}

	let commentData = node.data as CommentNode;
	let voteBehaviour: VoteBehaviour;

	$: isReplying = $discussionStore.isAddingReply && $discussionStore.replyToCommentId === node.id;
	$: isDetail = node.mode === 'detail';
	$: userName = $userStore?.preferred_username || $userStore?.name || 'Anonymous';

	$: positiveVotes = getNeo4jNumber(commentData.positiveVotes) || 0;
	$: negativeVotes = getNeo4jNumber(commentData.negativeVotes) || 0;
	$: netVotes = positiveVotes - negativeVotes;

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

	async function handleVote(event: CustomEvent<{ voteType: any }>) {
		if (!voteBehaviour) return;
		await voteBehaviour.handleVote(event.detail.voteType);
	}

	function handleReply() {
		dispatch('reply', { commentId: node.id });
		discussionStore.startReply(node.id);
	}

	function handleReplyButtonClick(event: CustomEvent<{ nodeId: string | undefined }>) {
		handleReply();
	}

	let commentCreatorDetails: any = null;

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
				commentData = { ...commentData };
			},
			metadataConfig: {
				nodeMetadata: node.metadata,
				voteStatusKey: 'contentVoteStatus'
			}
		});

		await voteBehaviour.initialize({
			positiveVotes: commentData.positiveVotes,
			negativeVotes: commentData.negativeVotes,
			skipVoteStatusFetch: false
		});

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
</script>

{#if isDetail}
	<BaseDetailNode {node} on:modeChange={handleModeChange}>
		<svelte:fragment slot="title" let:radius>
			<NodeHeader title={isReply ? "Reply" : "Comment"} {radius} mode="detail" />
		</svelte:fragment>

		<svelte:fragment slot="content" let:x let:y let:width let:height>
			<foreignObject {x} {y} {width} {height}>
				<TextContent text={commentData.commentText} mode="detail" />
			</foreignObject>
		</svelte:fragment>

		<svelte:fragment slot="voting" let:width let:height let:y>
			<ContentVoteButtons
				userVoteStatus={userVoteStatus}
				positiveVotes={positiveVotes}
				negativeVotes={negativeVotes}
				isVoting={isVoting}
				voteSuccess={voteSuccess}
				lastVoteType={lastVoteType}
				availableWidth={width}
				containerY={y}
				mode="detail"
				on:vote={handleVote}
			/>
		</svelte:fragment>

		<svelte:fragment slot="stats" let:width let:y>
			<VoteStats
				userVoteStatus={userVoteStatus}
				positiveVotes={positiveVotes}
				negativeVotes={negativeVotes}
				positiveLabel="Agree"
				negativeLabel="Disagree"
				availableWidth={width}
				containerY={y}
				showUserStatus={false}
			/>
		</svelte:fragment>

		<svelte:fragment slot="metadata" let:radius>
			{#if commentData.createdAt}
				<text
					x="0"
					y={radius * 0.78}
					class="comment-date"
					text-anchor="middle"
					fill="rgba(255, 255, 255, 0.6)"
					font-size="11px"
					font-family="Inter"
				>
					{formatDate(commentData.createdAt)}
				</text>
			{/if}
		</svelte:fragment>

		<svelte:fragment slot="credits" let:radius>
			{#if commentData.createdBy}
				<CreatorCredits
					createdBy={commentData.createdBy}
					publicCredit={commentData.publicCredit}
					{radius}
					prefix="by:"
				/>
			{/if}
		</svelte:fragment>

		<svelte:fragment slot="createChild" let:radius>
			{#if !isReply}
				<ReplyButton
					y={-radius * 0.7071}
					x={radius * 0.7071}
					nodeId={node.id}
					on:reply={handleReplyButtonClick}
				/>
			{/if}
		</svelte:fragment>
	</BaseDetailNode>
{:else}
	<BasePreviewNode {node} canExpand={true} on:modeChange={handleModeChange}>
		<svelte:fragment slot="title" let:radius>
			<NodeHeader title={isReply ? "Reply" : "Comment"} {radius} mode="preview" size="small" />
		</svelte:fragment>

		<svelte:fragment slot="content" let:x let:y let:width let:height>
			<foreignObject {x} {y} {width} {height}>
				<TextContent text={commentData.commentText} mode="preview" />
			</foreignObject>
		</svelte:fragment>

		<svelte:fragment slot="voting" let:width let:height let:y>
			<ContentVoteButtons
				userVoteStatus={userVoteStatus}
				positiveVotes={positiveVotes}
				negativeVotes={negativeVotes}
				isVoting={isVoting}
				voteSuccess={voteSuccess}
				lastVoteType={lastVoteType}
				availableWidth={width}
				containerY={y}
				mode="preview"
				on:vote={handleVote}
			/>
		</svelte:fragment>
	</BasePreviewNode>
{/if}

<style>
	.comment-date {
		font-family: Inter, sans-serif;
		font-size: 11px;
		font-weight: 400;
	}
</style>