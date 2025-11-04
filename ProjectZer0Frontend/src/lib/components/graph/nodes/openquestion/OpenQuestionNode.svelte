<!-- src/lib/components/graph/nodes/openquestion/OpenQuestionNode.svelte -->
<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
	import type { VoteStatus, Keyword } from '$lib/types/domain/nodes';
	import { isOpenQuestionData } from '$lib/types/graph/enhanced';
	import BasePreviewNode from '../base/BasePreviewNode.svelte';
	import BaseDetailNode from '../base/BaseDetailNode.svelte';
	import { TextContent, NodeHeader, InclusionVoteButtons, VoteStats, CategoryTags, KeywordTags, NodeMetadata, CreatorCredits, CreateLinkedNodeButton } from '../ui';
	import { hasMetInclusionThreshold } from '$lib/constants/graph/voting';
	import { getNeo4jNumber } from '$lib/utils/neo4j-utils';
	import { createVoteBehaviour, type VoteBehaviour } from '../behaviours/voteBehaviour';
	import { graphStore } from '$lib/stores/graphStore';

	export let node: RenderableNode;

	if (!isOpenQuestionData(node.data)) {
		throw new Error('Invalid node data type for OpenQuestionNode');
	}

	let questionData = node.data;

	function getMetadataGroup(): 'openquestion' {
		return 'openquestion';
	}

	$: displayQuestion = questionData.questionText;

	$: inclusionPositiveVotes = getNeo4jNumber(questionData.inclusionPositiveVotes) || 0;
	$: inclusionNegativeVotes = getNeo4jNumber(questionData.inclusionNegativeVotes) || 0;
	$: inclusionNetVotes = getNeo4jNumber(questionData.inclusionNetVotes) || 
		(inclusionPositiveVotes - inclusionNegativeVotes);
	
	$: inclusionUserVoteStatus = (node.metadata?.inclusionVoteStatus?.status || 'none') as VoteStatus;
	
	$: canExpand = hasMetInclusionThreshold(inclusionNetVotes);

	$: categories = (() => {
		const cats = questionData.categories || [];
		if (cats.length === 0) return [];
		if (typeof cats[0] === 'object' && 'id' in cats[0]) {
			return cats as Array<{ id: string; name: string }>;
		}
		return [];
	})();

	$: keywords = questionData.keywords || [];
	$: answerCount = questionData.answerCount || 0;

	let inclusionVoting: VoteBehaviour;

	$: isDetail = node.mode === 'detail';

	const dispatch = createEventDispatcher<{
		modeChange: { mode: NodeMode; position?: { x: number; y: number }; nodeId: string };
		visibilityChange: { isHidden: boolean };
		createChildNode: { parentId: string; parentType: string; childType: string };
		categoryClick: { categoryId: string; categoryName: string };
		keywordClick: { word: string };
	}>();

	onMount(async () => {
		inclusionVoting = createVoteBehaviour(node.id, 'openquestion', {
			apiIdentifier: questionData.id,
			dataObject: questionData,
			dataProperties: {
				positiveVotesKey: 'inclusionPositiveVotes',
				negativeVotesKey: 'inclusionNegativeVotes'
			},
			getVoteEndpoint: (id) => `/nodes/openquestion/${id}/vote-inclusion`,
			getRemoveVoteEndpoint: (id) => `/nodes/openquestion/${id}/vote/remove`,
			graphStore,
			onDataUpdate: () => {
				questionData = { ...questionData };
			},
			metadataConfig: {
				nodeMetadata: node.metadata,
				voteStatusKey: 'inclusionVoteStatus'
			}
		});

		await inclusionVoting.initialize({
			positiveVotes: inclusionPositiveVotes,
			negativeVotes: inclusionNegativeVotes,
			skipVoteStatusFetch: false
		});
	});

	async function handleInclusionVote(event: CustomEvent<{ voteType: VoteStatus }>) {
		if (!inclusionVoting) return;
		await inclusionVoting.handleVote(event.detail.voteType);
	}

	$: votingState = inclusionVoting?.getCurrentState() || {
		isVoting: false,
		voteSuccess: false,
		lastVoteType: null
	};

	function handleModeChange(event: CustomEvent) {
		dispatch('modeChange', {
			...event.detail,
			nodeId: node.id
		});
	}

	function handleCategoryClick(event: CustomEvent<{ categoryId: string; categoryName: string }>) {
		dispatch('categoryClick', event.detail);
	}

	function handleKeywordClick(event: CustomEvent<{ word: string }>) {
		dispatch('keywordClick', event.detail);
	}

	function handleCreateChild() {
		dispatch('createChildNode', {
			parentId: node.id,
			parentType: 'openquestion',
			childType: 'answer'
		});
	}
</script>

{#if isDetail}
	<BaseDetailNode {node} on:modeChange={handleModeChange}>
		<svelte:fragment slot="title" let:radius>
			<NodeHeader title="Open Question" {radius} mode="detail" />
		</svelte:fragment>

		<svelte:fragment slot="categoryTags" let:radius>
			{#if categories.length > 0}
				<CategoryTags 
					{categories}
					{radius}
					maxDisplay={3}
					on:categoryClick={handleCategoryClick}
				/>
			{/if}
		</svelte:fragment>

		<svelte:fragment slot="keywordTags" let:radius>
			{#if keywords.length > 0}
				<KeywordTags 
					{keywords}
					{radius}
					maxDisplay={8}
					on:keywordClick={handleKeywordClick}
				/>
			{/if}
		</svelte:fragment>

		<svelte:fragment slot="content" let:x let:y let:width let:height>
			<foreignObject {x} {y} {width} height={height - 80}>
				<TextContent text={displayQuestion} mode="detail" />
			</foreignObject>

			{#if answerCount > 0}
				<foreignObject {x} y={y + height - 70} {width} height="60">
					<div class="answer-count">
						{answerCount} answer{answerCount !== 1 ? 's' : ''}
					</div>
				</foreignObject>
			{/if}
		</svelte:fragment>

		<svelte:fragment slot="voting" let:width let:height let:y>
			<InclusionVoteButtons
				userVoteStatus={inclusionUserVoteStatus}
				positiveVotes={inclusionPositiveVotes}
				negativeVotes={inclusionNegativeVotes}
				isVoting={votingState.isVoting}
				voteSuccess={votingState.voteSuccess}
				lastVoteType={votingState.lastVoteType}
				availableWidth={width}
				containerY={y}
				mode="detail"
				on:vote={handleInclusionVote}
			/>
		</svelte:fragment>

		<svelte:fragment slot="stats" let:width let:y>
			<VoteStats
				userVoteStatus={inclusionUserVoteStatus}
				positiveVotes={inclusionPositiveVotes}
				negativeVotes={inclusionNegativeVotes}
				positiveLabel="Include"
				negativeLabel="Exclude"
				availableWidth={width}
				containerY={y}
				showUserStatus={false}
			/>
		</svelte:fragment>

		<svelte:fragment slot="metadata" let:radius>
			<NodeMetadata
				createdAt={questionData.createdAt}
				updatedAt={questionData.updatedAt}
				{radius}
			/>
		</svelte:fragment>

		<svelte:fragment slot="credits" let:radius>
			<CreatorCredits
				createdBy={questionData.createdBy}
				publicCredit={questionData.publicCredit}
				{radius}
				prefix="asked by:"
			/>
		</svelte:fragment>

		<svelte:fragment slot="createChild" let:radius>
			{#if canExpand}
				<CreateLinkedNodeButton
					y={-radius * 0.7071}
					x={radius * 0.7071}
					nodeId={node.id}
					nodeType="openquestion"
					on:click={handleCreateChild}
				/>
			{/if}
		</svelte:fragment>
	</BaseDetailNode>
{:else}
	<BasePreviewNode {node} {canExpand} on:modeChange={handleModeChange}>
		<svelte:fragment slot="title" let:radius>
			<NodeHeader title="Question" {radius} mode="preview" />
		</svelte:fragment>

		<svelte:fragment slot="content" let:x let:y let:width let:height>
			<foreignObject {x} {y} {width} {height}>
				<TextContent text={displayQuestion} mode="preview" />
			</foreignObject>
		</svelte:fragment>

		<svelte:fragment slot="voting" let:x let:y let:width let:height>
			<InclusionVoteButtons
				userVoteStatus={inclusionUserVoteStatus}
				positiveVotes={inclusionPositiveVotes}
				negativeVotes={inclusionNegativeVotes}
				isVoting={votingState.isVoting}
				voteSuccess={votingState.voteSuccess}
				lastVoteType={votingState.lastVoteType}
				availableWidth={width}
				containerY={y}
				mode="preview"
				on:vote={handleInclusionVote}
			/>
		</svelte:fragment>
	</BasePreviewNode>
{/if}

<style>
	.answer-count {
		font-family: Inter, sans-serif;
		font-size: 12px;
		font-weight: 500;
		color: rgba(0, 188, 212, 0.9);
		text-align: center;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
	}
</style>