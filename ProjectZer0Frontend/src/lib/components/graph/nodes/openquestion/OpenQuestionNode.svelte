<!-- src/lib/components/graph/nodes/openquestion/OpenQuestionNode.svelte -->
<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import type { RenderableNode, NodeMode, ViewType } from '$lib/types/graph/enhanced';
	import type { OpenQuestionNode, VoteStatus } from '$lib/types/domain/nodes';
	import { isOpenQuestionData } from '$lib/types/graph/enhanced';
	import { NODE_CONSTANTS } from '$lib/constants/graph/nodes';
	import BasePreviewNode from '../base/BasePreviewNode.svelte';
	import BaseDetailNode from '../base/BaseDetailNode.svelte';
	import { userStore } from '$lib/stores/userStore';
	import { graphStore } from '$lib/stores/graphStore';
	import { getUserDetails } from '$lib/services/userLookup';
	
	// ENHANCED: Import all possible vote stores
	import { openQuestionViewStore } from '$lib/stores/openQuestionViewStore';
	import { universalGraphStore } from '$lib/stores/universalGraphStore';
	
	// Import the shared UI components
	import VoteButtons from '../ui/VoteButtons.svelte';
	import VoteStats from '../ui/VoteStats.svelte';
	import NodeHeader from '../ui/NodeHeader.svelte';
	import CreatorCredits from '../ui/CreatorCredits.svelte';
	import ContentBox from '../ui/ContentBox.svelte';

	export let node: RenderableNode;
	export let questionText: string = '';
	export let nodeX: number | undefined = undefined;
	export let nodeY: number | undefined = undefined;
	
	// ENHANCED: Optional props for explicit context control
	export let viewType: ViewType | undefined = undefined;
	export let voteStore: any = undefined; // Allow explicit store override

	// Debug toggle - set to true to show ContentBox borders
	const DEBUG_SHOW_BORDERS = false;

	if (!isOpenQuestionData(node.data)) {
		throw new Error('Invalid node data type for OpenQuestionNode');
	}

	const questionData = node.data as OpenQuestionNode;

	// Get the question text
	$: displayQuestionText = questionText || questionData.questionText;

	// ENHANCED: Context-aware store detection
	$: detectedViewType = detectViewContext(viewType);
	$: contextVoteStore = selectVoteStore(detectedViewType, voteStore);

	/**
	 * ROBUST: Detect current view context using multiple methods
	 */
	function detectViewContext(explicitViewType?: ViewType): ViewType {
		// Method 1: Use explicit viewType prop if provided
		if (explicitViewType) {
			return explicitViewType;
		}

		// Method 2: Detect from URL path
		if (typeof window !== 'undefined') {
			const pathname = window.location.pathname;
			if (pathname.includes('/universal')) return 'universal';
			if (pathname.includes('/openquestion')) return 'openquestion';
			if (pathname.includes('/discussion')) return 'discussion';
		}

		// Method 3: Detect from graph store context
		if (graphStore) {
			const currentViewType = graphStore.getViewType?.();
			if (currentViewType) return currentViewType;
		}

		// Default fallback
		return 'openquestion';
	}

	/**
	 * FLEXIBLE: Select appropriate vote store based on context
	 */
	function selectVoteStore(detectedViewType: ViewType, explicitStore?: any) {
		// Method 1: Use explicit store override if provided
		if (explicitStore) {
			return explicitStore;
		}

		// Method 2: Select based on detected view type
		switch (detectedViewType) {
			case 'universal':
				return universalGraphStore;
			
			case 'openquestion':
				return openQuestionViewStore;
			
			case 'discussion':
				// Discussion view might use openquestion store or its own
				return openQuestionViewStore;
			
			default:
				// Safe fallback
				return openQuestionViewStore;
		}
	}

	// CRITICAL: NO vote behavior creation for universal view - use data-only approach
	let voteBehaviour: any = null;
	let visibilityBehaviour: any = null;
	let modeBehaviour: any = null;
	let dataBehaviour: any = null;

	$: isDetail = node.mode === 'detail';
	$: userName = $userStore?.preferred_username || $userStore?.name || 'Anonymous';

	function getNeo4jNumber(value: any): number {
		return value && typeof value === 'object' && 'low' in value ? Number(value.low) : Number(value || 0);
	}

	// OPTIMIZED: Get all data from node metadata and data - NO API CALLS
	$: dataPositiveVotes = getNeo4jNumber(questionData.positiveVotes) || 0;
	$: dataNegativeVotes = getNeo4jNumber(questionData.negativeVotes) || 0;

	// FIXED: Extract vote data from node metadata properly (universal view)
	$: metadataVotes = (() => {
		if (node.metadata?.votes && typeof node.metadata.votes === 'object' && 'positive' in node.metadata.votes) {
			// Use vote data from metadata.votes object (preferred for universal view)
			const votesObj = node.metadata.votes as any;
			const positive = getNeo4jNumber(votesObj.positive) || 0;
			const negative = getNeo4jNumber(votesObj.negative) || 0;
			const net = getNeo4jNumber(votesObj.net);
			
			return {
				positive,
				negative,
				net: net !== undefined ? net : (positive - negative)
			};
		} else if (node.metadata?.net_votes !== undefined) {
			// Fallback: use net_votes with data for positive/negative (original logic)
			return {
				positive: dataPositiveVotes,
				negative: dataNegativeVotes,
				net: getNeo4jNumber(node.metadata.net_votes)
			};
		}
		return null;
	})();

	// Use metadata votes if available, otherwise use data votes
	$: positiveVotes = metadataVotes?.positive ?? dataPositiveVotes;
	$: negativeVotes = metadataVotes?.negative ?? dataNegativeVotes;
	$: netVotes = metadataVotes?.net ?? (positiveVotes - negativeVotes);

	// CRITICAL: User vote status from metadata ONLY - no API calls
	$: userVoteStatus = (node.metadata?.userVoteStatus?.status || 'none') as VoteStatus;

	// FIXED: Get answer count from multiple sources with proper fallback
	$: answerCount = (() => {
		// Priority 1: From node metadata (universal graph)
		if (node.metadata?.answer_count !== undefined) {
			return node.metadata.answer_count;
		}
		
		// Priority 2: From questionData.answerCount (direct API data)
		if (questionData.answerCount !== undefined) {
			return getNeo4jNumber(questionData.answerCount);
		}
		
		// Priority 3: From questionData.answers array length
		if (questionData.answers && Array.isArray(questionData.answers)) {
			return questionData.answers.length;
		}
		
		// Default fallback
		return 0;
	})();

	// CRITICAL: Visibility determination - community-based with user override
	$: communityHidden = netVotes < 0; // Community default: hide if net votes < 0
	$: userVisibilityOverride = node.metadata?.userVisibilityPreference?.isVisible;
	$: isNodeHidden = userVisibilityOverride !== undefined ? !userVisibilityOverride : communityHidden;

	// Voting state - only for active interactions
	let isVoting = false;
	let voteSuccess = false;
	let lastVoteType: VoteStatus | null = null;

	// FIXED: Consistent cyan styling (not vote-based)
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
	}>();

	/**
	 * OPTIMIZED: Handle vote - only makes API call when user actually votes
	 */
	async function updateVoteState(voteType: VoteStatus) {
		// Prevent multiple simultaneous votes
		if (isVoting) return false;
		
		isVoting = true;
		lastVoteType = voteType;
		
		try {
			// Make API call to vote
			const endpoint = voteType === 'none' 
				? `/nodes/openquestion/${node.id}/vote/remove`
				: `/nodes/openquestion/${node.id}/vote`;
				
			const method = 'POST';
			const body = voteType !== 'none' ? JSON.stringify({
				isPositive: voteType === 'agree'
			}) : undefined;
			
			// Import fetchWithAuth dynamically to avoid circular dependencies
			const { fetchWithAuth } = await import('$lib/services/api');
			
			const result = await fetchWithAuth(endpoint, {
				method,
				body
			});
			
			if (result) {
				// Update vote counts from API response
				const newPositiveVotes = getNeo4jNumber(result.positiveVotes);
				const newNegativeVotes = getNeo4jNumber(result.negativeVotes);
				
				// Update local state
				positiveVotes = newPositiveVotes;
				negativeVotes = newNegativeVotes;
				netVotes = newPositiveVotes - newNegativeVotes;
				
				// FIXED: Set userVoteStatus based on what was just voted, not API response
				// This fixes the vote icon color issue since API doesn't return status field
				userVoteStatus = voteType;
				
				// Update store if available
				if (contextVoteStore?.updateVoteData) {
					contextVoteStore.updateVoteData(node.id, newPositiveVotes, newNegativeVotes);
				}
				
				// FIXED: Also update user vote status in store
				if (contextVoteStore?.updateUserVoteStatus) {
					const storeVoteStatus = voteType === 'none' ? null : voteType;
					contextVoteStore.updateUserVoteStatus(node.id, storeVoteStatus);
				}
				
				// Update graph store visibility if needed
				if (graphStore) {
					graphStore.recalculateNodeVisibility(node.id, newPositiveVotes, newNegativeVotes);
				}
				
				// Show success animation
				voteSuccess = true;
				setTimeout(() => {
					voteSuccess = false;
					lastVoteType = null;
				}, 1000);
				
				return true;
			}
			
			return false;
		} catch (error) {
			console.error('[OpenQuestionNode] Error voting:', error);
			return false;
		} finally {
			isVoting = false;
		}
	}

	/**
	 * Handle visibility change - only makes API call when user changes preference
	 */
	async function updateVisibilityPreference(isVisible: boolean) {
		try {
			// Update visibility preference via API
			const { fetchWithAuth } = await import('$lib/services/api');
			
			await fetchWithAuth(`/users/visibility-preferences`, {
				method: 'POST',
				body: JSON.stringify({
					[node.id]: {
						isVisible,
						source: 'user',
						timestamp: Date.now()
					}
				})
			});
			
			// Update store if available
			if (contextVoteStore?.updateUserVisibilityPreference) {
				contextVoteStore.updateUserVisibilityPreference(node.id, isVisible, 'user');
			}
			
			// Update graph store
			if (graphStore) {
				graphStore.updateNodeVisibility(node.id, !isVisible, 'user');
			}
			
			return true;
		} catch (error) {
			console.error('[OpenQuestionNode] Error updating visibility preference:', error);
			return false;
		}
	}

	function handleModeChange(event: CustomEvent<{ 
		mode: NodeMode; 
		position?: { x: number; y: number };
		nodeId?: string;
	}>) {
		console.log('[OpenQuestionNode] MODE EVENT - Received from ExpandCollapseButton:', {
			nodeId: node.id.substring(0, 8),
			currentNodeMode: node.mode,
			eventMode: event.detail.mode,
			eventNodeId: event.detail.nodeId?.substring(0, 8),
			eventPosition: event.detail.position,
			hasPosition: !!event.detail.position
		});
		
		// CRITICAL: Don't use modeBehaviour - forward directly to manager via Graph
		const eventData = {
			nodeId: node.id,
			mode: event.detail.mode,
			position: event.detail.position || { x: node.position.x, y: node.position.y }
		};
		
		console.log('[OpenQuestionNode] MODE EVENT - Dispatching to Graph component:', eventData);
		
		// Forward the event with node ID
		dispatch('modeChange', eventData);
		
		console.log('[OpenQuestionNode] MODE EVENT - Successfully dispatched to parent');
	}

	function handleVote(event: CustomEvent<{ voteType: any }>) {
		updateVoteState(event.detail.voteType);
	}

	function handleVisibilityChange(event: CustomEvent<{ isHidden: boolean }>) {
		// Update user preference when visibility is manually changed
		updateVisibilityPreference(!event.detail.isHidden);
		dispatch('visibilityChange', event.detail);
	}

	let questionCreatorDetails: any = null;

	onMount(async () => {
		// NO behavior initialization - we use data-only approach
		
		// Only fetch creator details if needed
		if (questionData.createdBy) {
			try {
				questionCreatorDetails = await getUserDetails(questionData.createdBy);
			} catch (e) {
				console.error('[OpenQuestionNode] Error fetching creator details:', e);
			}
		}
		
		// REMOVED: Individual node initialization logging that was causing spam
		// Only log if there are issues or in development mode
		if (import.meta.env.DEV && (!positiveVotes && !negativeVotes && !userVoteStatus && !answerCount)) {
			console.warn('[OpenQuestionNode] Node may have incomplete data:', {
				nodeId: node.id,
				hasVotes: !!(positiveVotes || negativeVotes),
				hasUserStatus: !!userVoteStatus,
				hasAnswerCount: !!answerCount
			});
		}
	});

	onDestroy(() => {
		// No cleanup needed since we don't create behaviors
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

					<!-- Answer Count Display - FIXED: Use computed answerCount -->
					{#if answerCount > 0}
						<foreignObject
							x={x}
							y={y + height - 140}
							width={width}
							height="30"
						>
							<div class="answer-count">
								{answerCount} answer{answerCount !== 1 ? 's' : ''}
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
	
	.answer-count {
		font-family: Inter;
		font-size: 11px;
		font-weight: 400;
		color: rgba(0, 188, 212, 0.8);  /* CYAN for answer count */
		text-align: center;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
	}
</style>