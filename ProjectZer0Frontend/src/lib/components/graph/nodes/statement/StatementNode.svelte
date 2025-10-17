<!-- src/lib/components/graph/nodes/statement/StatementNode.svelte - CORRECTED VERSION -->
<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import type { RenderableNode, NodeMode, ViewType } from '$lib/types/graph/enhanced';
	import type { StatementNode, VoteStatus } from '$lib/types/domain/nodes';
	import { isStatementData } from '$lib/types/graph/enhanced';
	import { NODE_CONSTANTS } from '$lib/constants/graph/nodes';
	import BasePreviewNode from '../base/BasePreviewNode.svelte';
	import BaseDetailNode from '../base/BaseDetailNode.svelte';
	import { userStore } from '$lib/stores/userStore';
	import { graphStore } from '$lib/stores/graphStore';
	import { getUserDetails } from '$lib/services/userLookup';
	
	// Import all possible vote stores
	import { statementNetworkStore } from '$lib/stores/statementNetworkStore';
	import { universalGraphStore } from '$lib/stores/universalGraphStore';
	
	// Import the shared UI components
	import VoteButtons from '../ui/ContentVoteButtons.svelte';
	import VoteStats from '../ui/VoteStats.svelte';
	import NodeHeader from '../ui/NodeHeader.svelte';
	import CreatorCredits from '../ui/CreatorCredits.svelte';
	import ContentBox from '../ui/ContentBox.svelte';

	export let node: RenderableNode;
	export let statementText: string = '';
	export let nodeX: number | undefined = undefined;
	export let nodeY: number | undefined = undefined;
	
	// Optional props for explicit context control
	export let viewType: ViewType | undefined = undefined;
	export let voteStore: any = undefined;

	// Debug toggle
	const DEBUG_SHOW_BORDERS = false;

	if (!isStatementData(node.data)) {
		throw new Error('Invalid node data type for StatementNode');
	}

	const statementData = node.data as StatementNode;

	// Get the statement text
	$: displayStatementText = statementText || statementData.statement;

	// Context-aware store detection
	$: detectedViewType = detectViewContext(viewType);
	$: contextVoteStore = selectVoteStore(detectedViewType, voteStore);

	/**
	 * Detect current view context using multiple methods
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
			if (pathname.includes('/statement-network')) return 'statement-network';
			if (pathname.includes('/discussion')) return 'discussion';
		}

		// Method 3: Detect from graph store context
		if (graphStore) {
			const currentViewType = graphStore.getViewType?.();
			if (currentViewType) return currentViewType;
		}

		// Default fallback
		return 'statement-network';
	}

	/**
	 * Select appropriate vote store based on context
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
			
			case 'statement-network':
				return statementNetworkStore;
			
			case 'discussion':
				return statementNetworkStore;
			
			default:
				return statementNetworkStore;
		}
	}

	// REMOVED: No more behavior creation - use node.mode directly from manager
	// Use mode directly from node (controlled by manager)
	$: isDetail = node.mode === 'detail';
	$: userName = $userStore?.preferred_username || $userStore?.name || 'Anonymous';

	function getNeo4jNumber(value: any): number {
		return value && typeof value === 'object' && 'low' in value ? Number(value.low) : Number(value || 0);
	}

	// Get all data from node metadata and data - NO API CALLS
	$: dataPositiveVotes = getNeo4jNumber(statementData.positiveVotes) || 0;
	$: dataNegativeVotes = getNeo4jNumber(statementData.negativeVotes) || 0;

	// Extract vote data from node metadata properly (universal view)
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

	// User vote status from metadata ONLY - no API calls
	$: userVoteStatus = (node.metadata?.userVoteStatus?.status || 'none') as VoteStatus;

	// Get related statements count from node metadata
	$: relatedStatementsCount = (node.metadata as any)?.related_statements_count || statementData.relatedStatements?.length || 0;

	// Visibility determination - community-based with user override
	$: communityHidden = netVotes < 0;
	$: userVisibilityOverride = node.metadata?.userVisibilityPreference?.isVisible;
	$: isNodeHidden = userVisibilityOverride !== undefined ? !userVisibilityOverride : communityHidden;

	// Voting state - only for active interactions
	let isVoting = false;
	let voteSuccess = false;
	let lastVoteType: VoteStatus | null = null;

	// Consistent green styling
	$: {
		if (node.style) {
			node.style.highlightColor = NODE_CONSTANTS.COLORS.STATEMENT.border;
		}
	}

	// Consistent styling - NOT vote-based
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
			nodeId: string;
			mode: NodeMode;
			position?: { x: number; y: number };
		};
		visibilityChange: { isHidden: boolean };
	}>();

	/**
	 * Handle vote - only makes API call when user actually votes
	 */
	async function updateVoteState(voteType: VoteStatus) {
		if (isVoting) return false;
		
		isVoting = true;
		lastVoteType = voteType;
		
		try {
			const endpoint = voteType === 'none' 
				? `/nodes/statement/${node.id}/vote/remove`
				: `/nodes/statement/${node.id}/vote`;
				
			const method = 'POST';
			const body = voteType !== 'none' ? JSON.stringify({
				isPositive: voteType === 'agree'
			}) : undefined;
			
			const { fetchWithAuth } = await import('$lib/services/api');
			
			const result = await fetchWithAuth(endpoint, {
				method,
				body
			});
			
			if (result) {
				const newPositiveVotes = getNeo4jNumber(result.positiveVotes);
				const newNegativeVotes = getNeo4jNumber(result.negativeVotes);
				
				positiveVotes = newPositiveVotes;
				negativeVotes = newNegativeVotes;
				netVotes = newPositiveVotes - newNegativeVotes;
				
				userVoteStatus = voteType;
				
				if (contextVoteStore?.updateVoteData) {
					contextVoteStore.updateVoteData(node.id, newPositiveVotes, newNegativeVotes);
				}
				
				if (contextVoteStore?.updateUserVoteStatus) {
					const storeVoteStatus = voteType === 'none' ? null : voteType;
					contextVoteStore.updateUserVoteStatus(node.id, storeVoteStatus);
				}
				
				if (graphStore) {
					graphStore.recalculateNodeVisibility(node.id, newPositiveVotes, newNegativeVotes);
				}
				
				voteSuccess = true;
				setTimeout(() => {
					voteSuccess = false;
					lastVoteType = null;
				}, 1000);
				
				return true;
			}
			
			return false;
		} catch (error) {
			console.error('[StatementNode] Error voting:', error);
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
			
			if (contextVoteStore?.updateUserVisibilityPreference) {
				contextVoteStore.updateUserVisibilityPreference(node.id, isVisible, 'user');
			}
			
			if (graphStore) {
				graphStore.updateNodeVisibility(node.id, !isVisible, 'user');
			}
			
			return true;
		} catch (error) {
			console.error('[StatementNode] Error updating visibility preference:', error);
			return false;
		}
	}

	// CORRECTED: Mode change handler - forward events to NodeRenderer
	function handleModeChange(event: CustomEvent<{ 
		mode: NodeMode; 
		position?: { x: number; y: number };
		nodeId?: string;
	}>) {
		console.log('[StatementNode] MODE EVENT - Received from ExpandCollapseButton:', {
			nodeId: node.id.substring(0, 8),
			currentNodeMode: node.mode,
			eventMode: event.detail.mode,
			eventNodeId: event.detail.nodeId?.substring(0, 8),
			eventPosition: event.detail.position,
			hasPosition: !!event.detail.position
		});
		
		// CRITICAL: Forward directly to NodeRenderer/Graph - don't use behaviors
		const eventData = {
			nodeId: node.id, // Always use our node ID
			mode: event.detail.mode,
			position: event.detail.position || { x: node.position.x, y: node.position.y }
		};
		
		console.log('[StatementNode] MODE EVENT - Dispatching to NodeRenderer:', eventData);
		
		// Forward the event
		dispatch('modeChange', eventData);
		
		console.log('[StatementNode] MODE EVENT - Successfully dispatched to parent');
		
		// DEBUG: Also dispatch to window for testing
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent('debug-statement-mode', {
				detail: eventData
			}));
			console.log('[StatementNode] DEBUG - Also dispatched debug event to window');
		}
	}

	function handleVote(event: CustomEvent<{ voteType: any }>) {
		updateVoteState(event.detail.voteType);
	}

	function handleVisibilityChange(event: CustomEvent<{ isHidden: boolean }>) {
		updateVisibilityPreference(!event.detail.isHidden);
		dispatch('visibilityChange', event.detail);
	}

	let statementCreatorDetails: any = null;

	onMount(async () => {
		// REMOVED: No behavior initialization - we use data-only approach
		
		// Only fetch creator details if needed
		if (statementData.createdBy) {
			try {
				statementCreatorDetails = await getUserDetails(statementData.createdBy);
			} catch (e) {
				console.error('[StatementNode] Error fetching creator details:', e);
			}
		}
		
		// Only log if there are issues or in development mode
		if (import.meta.env.DEV && (!positiveVotes && !negativeVotes && !userVoteStatus)) {
			console.warn('[StatementNode] Node may have incomplete data:', {
				nodeId: node.id,
				hasVotes: !!(positiveVotes || negativeVotes),
				hasUserStatus: !!userVoteStatus
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
			<NodeHeader title="Statement" radius={radius} mode="detail" />
			<ContentBox nodeType="statement" mode="detail" showBorder={DEBUG_SHOW_BORDERS}>
				<svelte:fragment slot="content" let:x let:y let:width let:height let:layoutConfig>
					<!-- Main statement text -->
					<foreignObject
						x={x}
						y={y + layoutConfig.titleYOffset + 0}
						width={width}
						height={height - layoutConfig.titleYOffset - 90}
					>
						<div class="statement-display">
							{displayStatementText}
						</div>
					</foreignObject>

					<!-- Keywords Display (if any) -->
					{#if statementData.keywords && statementData.keywords.length > 0}
						<foreignObject
							x={x}
							y={y}
							width={width}
							height="50"
						>
							<div class="keywords-section">
								<div class="keywords-container">
									{#each statementData.keywords as keyword}
										<div class="keyword-chip" class:ai-keyword={keyword.source === 'ai'} class:user-keyword={keyword.source === 'user'}>
											{keyword.word}
										</div>
									{/each}
								</div>
							</div>
						</foreignObject>
					{/if}

					<!-- Related Statements Count Display -->
					{#if relatedStatementsCount > 0}
						<foreignObject
							x={x}
							y={y + height - 140}
							width={width}
							height="30"
						>
							<div class="related-count">
								{relatedStatementsCount} related statement{relatedStatementsCount !== 1 ? 's' : ''}
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

			{#if statementData.createdBy}
				<CreatorCredits
					createdBy={statementData.createdBy}
					publicCredit={statementData.publicCredit}
					creatorDetails={statementCreatorDetails}
					radius={radius}
					prefix="created by:"
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
			<NodeHeader title="Statement" radius={radius} size="small" mode="preview" />
		</svelte:fragment>

		<svelte:fragment slot="content" let:x let:y let:width let:height let:layoutConfig>
			<!-- Main statement text -->
			<foreignObject
				x={x}
				y={y - 55}
				width={width}
				height={height - layoutConfig.titleYOffset}
			>
				<div class="statement-preview">
					{displayStatementText}
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
	.statement-display {
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

	.statement-preview {
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
		background: rgba(46, 204, 113, 0.2);  /* GREEN background for statements */
		border: 1px solid rgba(46, 204, 113, 0.3);  /* GREEN border for statements */
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
		background: rgba(46, 204, 113, 0.2);  /* GREEN for user keywords on statements */
		border: 1px solid rgba(46, 204, 113, 0.3);
	}
	
	.related-count {
		font-family: Inter;
		font-size: 11px;
		font-weight: 400;
		color: rgba(46, 204, 113, 0.8);  /* GREEN for related statement count */
		text-align: center;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
	}
</style>