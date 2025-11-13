<!-- src/lib/components/graph/nodes/evidence/EvidenceNode.svelte -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    import type { VoteStatus, Keyword } from '$lib/types/domain/nodes';
    import { isEvidenceData } from '$lib/types/graph/enhanced';
    import BasePreviewNode from '../base/BasePreviewNode.svelte';
    import BaseDetailNode from '../base/BaseDetailNode.svelte';
    import NodeHeader from '../ui/NodeHeader.svelte';
    import InclusionVoteButtons from '../ui/InclusionVoteButtons.svelte';
    import VoteStats from '../ui/VoteStats.svelte';
    import CategoryTags from '../ui/CategoryTags.svelte';
    import KeywordTags from '../ui/KeywordTags.svelte';
    import NodeMetadata from '../ui/NodeMetadata.svelte';
    import CreatorCredits from '../ui/CreatorCredits.svelte';
    import { hasMetInclusionThreshold } from '$lib/constants/graph/voting';
    import { getNeo4jNumber } from '$lib/utils/neo4j-utils';
    import { fetchWithAuth } from '$lib/services/api';
    import { createVoteBehaviour, type VoteBehaviour } from '../behaviours/voteBehaviour';
    import { graphStore } from '$lib/stores/graphStore';

    export let node: RenderableNode;

    // Type validation
    if (!isEvidenceData(node.data)) {
        throw new Error('Invalid node data type for EvidenceNode');
    }

    // CRITICAL: Change const to let for reactivity
    let evidenceData = node.data;

    // Helper to get correct metadata group
    function getMetadataGroup(): 'evidence' {
        return 'evidence';
    }

    // Evidence type configuration
    const EVIDENCE_TYPE_CONFIG = {
        peer_reviewed_study: { icon: '🔬', label: 'Peer Reviewed Study', color: '#3498db' },
        government_report: { icon: '🏛️', label: 'Government Report', color: '#2ecc71' },
        news_article: { icon: '📰', label: 'News Article', color: '#e74c3c' },
        expert_opinion: { icon: '👨‍🏫', label: 'Expert Opinion', color: '#9b59b6' },
        dataset: { icon: '📊', label: 'Dataset', color: '#1abc9c' },
        video: { icon: '🎥', label: 'Video', color: '#f39c12' },
        image: { icon: '🖼️', label: 'Image', color: '#e67e22' },
        other: { icon: '📎', label: 'Other', color: '#95a5a6' }
    };

    // Data extraction
    $: displayTitle = evidenceData.title;
    $: displayUrl = evidenceData.url;
    $: displayDescription = evidenceData.description || '';
    $: evidenceType = evidenceData.evidenceType;
    $: evidenceTypeConfig = EVIDENCE_TYPE_CONFIG[evidenceType] || EVIDENCE_TYPE_CONFIG.other;
    $: authors = evidenceData.authors || [];
    $: publicationDate = evidenceData.publicationDate;

    // Format authors (max 3, then "et al.")
    $: formattedAuthors = formatAuthors(authors);
    
    function formatAuthors(authorList: string[]): string {
        if (!authorList || authorList.length === 0) return '';
        if (authorList.length <= 3) return authorList.join(', ');
        return `${authorList.slice(0, 3).join(', ')}, et al.`;
    }

    // Format publication date
    $: formattedDate = publicationDate ? formatDate(publicationDate) : '';
    
    function formatDate(date: Date | string): string {
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    // Parent node info
    $: parentNodeId = evidenceData.parentNodeId;
    $: parentNodeType = evidenceData.parentNodeType;
    $: parentInfo = evidenceData.parentInfo;

     let inclusionVoting: VoteBehaviour;

    // CRITICAL: Extract store references for Svelte's $ auto-subscription
    $: positiveVotesStore = inclusionVoting?.positiveVotes;
    $: negativeVotesStore = inclusionVoting?.negativeVotes;
    $: netVotesStore = inclusionVoting?.netVotes;
    $: userVoteStatusStore = inclusionVoting?.userVoteStatus;
    $: isVotingStore = inclusionVoting?.isVoting;
    $: voteSuccessStore = inclusionVoting?.voteSuccess;
    $: lastVoteTypeStore = inclusionVoting?.lastVoteType;

    // FIXED: Subscribe to stores (reactive), fallback to data
    $: inclusionPositiveVotes = positiveVotesStore 
        ? $positiveVotesStore
        : (getNeo4jNumber(evidenceData.inclusionPositiveVotes) || 0);
    
    $: inclusionNegativeVotes = negativeVotesStore 
        ? $negativeVotesStore
        : (getNeo4jNumber(evidenceData.inclusionNegativeVotes) || 0);
    
    $: inclusionNetVotes = netVotesStore 
        ? $netVotesStore
        : (getNeo4jNumber(evidenceData.inclusionNetVotes) || (inclusionPositiveVotes - inclusionNegativeVotes));
    
    $: inclusionUserVoteStatus = (userVoteStatusStore 
        ? $userVoteStatusStore
        : (node.metadata?.inclusionVoteStatus?.status || 'none')) as VoteStatus;

    // FIXED: Create votingState from store subscriptions
    $: votingState = {
        isVoting: isVotingStore ? $isVotingStore : false,
        voteSuccess: voteSuccessStore ? $voteSuccessStore : false,
        lastVoteType: lastVoteTypeStore ? $lastVoteTypeStore : null
    };

    // Threshold check for expansion
    $: canExpand = hasMetInclusionThreshold(inclusionNetVotes);

    // Extract categories
    $: categories = (() => {
        const cats = evidenceData.categories || [];
        if (cats.length === 0) return [];
        
        if (typeof cats[0] === 'object' && 'id' in cats[0]) {
            return cats as Array<{ id: string; name: string }>;
        }
        
        return [];
    })();

    // Extract keywords
    $: keywords = evidenceData.keywords || [];

    // Peer review metrics (community aggregates)
    $: avgQualityScore = evidenceData.avgQualityScore || 0;
    $: avgIndependenceScore = evidenceData.avgIndependenceScore || 0;
    $: avgRelevanceScore = evidenceData.avgRelevanceScore || 0;
    $: overallScore = evidenceData.overallScore || 0;
    $: reviewCount = evidenceData.reviewCount || 0;

    // User's own peer review
    $: userReview = node.metadata?.userReview || null;
    $: hasUserReview = userReview !== null && userReview !== undefined;

    // Peer review state (NOT voting - separate quality assessment system)
    let isSubmittingReview = false;
    let qualityScore: number = 0;
    let independenceScore: number = 0;
    let relevanceScore: number = 0;
    let reviewError: string | null = null;

    // Update scores when userReview changes
    $: {
        if (userReview) {
            qualityScore = userReview.qualityScore;
            independenceScore = userReview.independenceScore;
            relevanceScore = userReview.relevanceScore;
        } else {
            qualityScore = 0;
            independenceScore = 0;
            relevanceScore = 0;
        }
    }

    // Mode state
    $: isDetail = node.mode === 'detail';

    // Event dispatcher
    const dispatch = createEventDispatcher<{
        modeChange: { mode: NodeMode; position?: { x: number; y: number }; nodeId: string };
        visibilityChange: { isHidden: boolean };
        categoryClick: { categoryId: string; categoryName: string };
        keywordClick: { word: string };
        parentNodeClick: { parentId: string; parentType: string };
        urlClick: { url: string };
    }>();

    // Initialize voting behaviour on mount
    onMount(async () => {
        console.log('[EvidenceNode] Initializing vote behaviour for', node.id);
        
        // Create voting behaviour for inclusion votes
        inclusionVoting = createVoteBehaviour(node.id, 'evidence', {
            apiIdentifier: evidenceData.id,
            dataObject: evidenceData,
            dataProperties: {
                positiveVotesKey: 'inclusionPositiveVotes',
                negativeVotesKey: 'inclusionNegativeVotes'
            },
            apiResponseKeys: {
                positiveVotesKey: 'inclusionPositiveVotes',
                negativeVotesKey: 'inclusionNegativeVotes'
            },
            getVoteEndpoint: (id) => `/nodes/evidence/${id}/vote`,
            getRemoveVoteEndpoint: (id) => `/nodes/evidence/${id}/vote`,
            getVoteStatusEndpoint: (id) => `/nodes/evidence/${id}/vote-status`,
            graphStore,
            // NOTE: No onDataUpdate callback needed!
            // We're now subscribed directly to voteBehaviour's reactive stores
            metadataConfig: {
                nodeMetadata: node.metadata,
                voteStatusKey: 'inclusionVoteStatus'
            }
        });

        // Initialize with current vote data
        await inclusionVoting.initialize({
            positiveVotes: inclusionPositiveVotes,
            negativeVotes: inclusionNegativeVotes,
            skipVoteStatusFetch: false
        });
        
        console.log('[EvidenceNode] Vote behaviour initialized:', {
            nodeId: node.id,
            initialVotes: { inclusionPositiveVotes, inclusionNegativeVotes, inclusionNetVotes },
            initialStatus: inclusionUserVoteStatus
        });
    });

    // Vote handler - now uses behaviour
    async function handleInclusionVote(event: CustomEvent<{ voteType: VoteStatus }>) {
        if (!inclusionVoting) {
            console.error('[EvidenceNode] Vote behaviour not initialized');
            return;
        }
        console.log('[EvidenceNode] Handling vote:', event.detail.voteType);
        await inclusionVoting.handleVote(event.detail.voteType);
    }

    function handleModeChange(event: CustomEvent<{ mode: NodeMode }>) {
        dispatch('modeChange', {
            mode: event.detail.mode,
            nodeId: node.id
        });
    }

    function handleVisibilityChange(event: CustomEvent<{ isHidden: boolean }>) {
        dispatch('visibilityChange', event.detail);
    }

    function handleCategoryClick(event: CustomEvent<{ categoryId: string; categoryName: string }>) {
        dispatch('categoryClick', event.detail);
    }

    function handleKeywordClick(event: CustomEvent<{ word: string }>) {
        dispatch('keywordClick', event.detail);
    }

    function handleParentNodeClick() {
        if (parentNodeId && parentNodeType) {
            dispatch('parentNodeClick', {
                parentId: parentNodeId,
                parentType: parentNodeType
            });
        }
    }

    function handleUrlClick() {
        if (displayUrl) {
            window.open(displayUrl, '_blank', 'noopener,noreferrer');
            dispatch('urlClick', { url: displayUrl });
        }
    }

    // Peer review handlers (SEPARATE from voting system)
    function handleScoreClick(metric: 'quality' | 'independence' | 'relevance', score: number) {
        if (metric === 'quality') qualityScore = score;
        if (metric === 'independence') independenceScore = score;
        if (metric === 'relevance') relevanceScore = score;
    }

    async function handleSubmitReview() {
        if (isSubmittingReview) return;
        
        // Validation
        if (qualityScore === 0 || independenceScore === 0 || relevanceScore === 0) {
            reviewError = 'Please rate all three criteria';
            return;
        }

        isSubmittingReview = true;
        reviewError = null;

        try {
            const endpoint = hasUserReview && userReview
                ? `/evidence/${evidenceData.id}/peer-review/${userReview.id || evidenceData.id}`
                : `/evidence/${evidenceData.id}/peer-review`;

            const response = await fetchWithAuth(endpoint, {
                method: hasUserReview ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    qualityScore,
                    independenceScore,
                    relevanceScore
                })
            });

            if (response.ok) {
                const result = await response.json();
                
                // Update local data
                evidenceData.avgQualityScore = result.avgQualityScore;
                evidenceData.avgIndependenceScore = result.avgIndependenceScore;
                evidenceData.avgRelevanceScore = result.avgRelevanceScore;
                evidenceData.overallScore = result.overallScore;
                evidenceData.reviewCount = result.reviewCount;

                // Trigger reactivity
                evidenceData = { ...evidenceData };

                // Update user's review in metadata
                if (!node.metadata) {
                    node.metadata = { group: getMetadataGroup() };
                }
                node.metadata.userReview = {
                    qualityScore,
                    independenceScore,
                    relevanceScore
                };
            }
        } catch (error) {
            console.error('Error submitting peer review:', error);
            reviewError = 'Failed to submit review';
        } finally {
            isSubmittingReview = false;
        }
    }

    async function handleClearReview() {
        if (!hasUserReview || !userReview) return;
        if (isSubmittingReview) return;

        isSubmittingReview = true;

        try {
            // TypeScript: userReview is guaranteed non-null here due to guard above
            const safeUserReview = userReview as NonNullable<typeof userReview>;
            const reviewId = safeUserReview.id || evidenceData.id;
            const response = await fetchWithAuth(
                `/evidence/${evidenceData.id}/peer-review/${reviewId}`,
                { method: 'DELETE' }
            );

            if (response.ok) {
                const result = await response.json();
                
                // Update local data
                evidenceData.avgQualityScore = result.avgQualityScore;
                evidenceData.avgIndependenceScore = result.avgIndependenceScore;
                evidenceData.avgRelevanceScore = result.avgRelevanceScore;
                evidenceData.overallScore = result.overallScore;
                evidenceData.reviewCount = result.reviewCount;

                // Trigger reactivity
                evidenceData = { ...evidenceData };

                // Clear user's review
                qualityScore = 0;
                independenceScore = 0;
                relevanceScore = 0;
                
                if (node.metadata) {
                    node.metadata.userReview = null;
                }
            }
        } catch (error) {
            console.error('Error clearing peer review:', error);
            reviewError = 'Failed to clear review';
        } finally {
            isSubmittingReview = false;
        }
    }

    // Helper to render stars
    function renderStars(score: number, maxStars: number = 5): string {
        const fullStars = Math.floor(score);
        const hasHalfStar = score % 1 >= 0.5;
        const emptyStars = maxStars - fullStars - (hasHalfStar ? 1 : 0);
        
        return '★'.repeat(fullStars) + 
               (hasHalfStar ? '☆' : '') + 
               '☆'.repeat(emptyStars);
    }

    // Text wrapping for preview mode
    $: textWidth = node.radius * 2 - 45;
    $: maxCharsPerLine = Math.floor(textWidth / 8);
    $: titleLines = displayTitle.split(' ').reduce((acc, word) => {
        const currentLine = acc[acc.length - 1] || '';
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        
        if (!currentLine || testLine.length <= maxCharsPerLine) {
            acc[acc.length - 1] = testLine;
        } else {
            acc.push(word);
        }
        return acc;
    }, ['']);
</script>

{#if isDetail}
    <!-- DETAIL MODE -->
    <BaseDetailNode {node} on:modeChange={handleModeChange} on:visibilityChange={handleVisibilityChange}>
        <svelte:fragment slot="title" let:radius>
            <NodeHeader title="Evidence" {radius} mode="detail" />
        </svelte:fragment>

        <!-- CategoryTags (if any) -->
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

        <!-- KeywordTags (if any) -->
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

        <!-- Main Content -->
        <svelte:fragment slot="content" let:x let:y let:width let:height>
            <!-- Evidence Details Section -->
            <g transform="translate({x}, {y})">
                <!-- Title -->
                <foreignObject x="0" y="0" {width} height="60">
                    <div class="evidence-title">{displayTitle}</div>
                </foreignObject>

                <!-- Evidence Type Badge -->
                <g transform="translate(0, 70)">
                    <rect
                        x="0"
                        y="0"
                        width="200"
                        height="28"
                        rx="14"
                        ry="14"
                        fill={evidenceTypeConfig.color}
                        fill-opacity="0.2"
                        stroke={evidenceTypeConfig.color}
                        stroke-width="1.5"
                    />
                    <text
                        x="100"
                        y="14"
                        class="evidence-type-text"
                        style:fill={evidenceTypeConfig.color}
                    >
                        {evidenceTypeConfig.icon} {evidenceTypeConfig.label}
                    </text>
                </g>

                <!-- Authors -->
                {#if formattedAuthors}
                    <text x="0" y="120" class="evidence-meta left-align">
                        Authors: <tspan class="evidence-meta-value">{formattedAuthors}</tspan>
                    </text>
                {/if}

                <!-- Publication Date -->
                {#if formattedDate}
                    <text x="0" y="145" class="evidence-meta left-align">
                        Published: <tspan class="evidence-meta-value">{formattedDate}</tspan>
                    </text>
                {/if}

                <!-- URL Link -->
                <g 
                    transform="translate(0, 170)" 
                    class="url-link" 
                    on:click={handleUrlClick}
                    role="button"
                    tabindex="0"
                    on:keydown={(e) => e.key === 'Enter' && handleUrlClick()}
                >
                    <text x="0" y="0" class="evidence-url">
                        🔗 {displayUrl}
                    </text>
                </g>

                <!-- Description -->
                {#if displayDescription}
                    <foreignObject x="0" y="200" {width} height="80">
                        <div class="evidence-description">{displayDescription}</div>
                    </foreignObject>
                {/if}

                <!-- Parent Node Reference -->
                {#if parentInfo}
                    <g transform="translate(0, {displayDescription ? 290 : 210})">
                        <text x="0" y="0" class="parent-label left-align">
                            Supports {parentNodeType === 'StatementNode' ? 'Statement' : 
                                      parentNodeType === 'AnswerNode' ? 'Answer' : 'Quantity'}:
                        </text>
                        <text x="0" y="25" class="parent-title left-align">
                            {parentInfo.title}
                        </text>
                        <g 
                            transform="translate(0, 50)" 
                            class="parent-link" 
                            on:click={handleParentNodeClick}
                            role="button"
                            tabindex="0"
                            on:keydown={(e) => e.key === 'Enter' && handleParentNodeClick()}
                        >
                            <rect
                                x="0"
                                y="0"
                                width="160"
                                height="32"
                                rx="4"
                                ry="4"
                                fill="rgba(26, 188, 156, 0.2)"
                                stroke="rgba(26, 188, 156, 0.4)"
                                stroke-width="1"
                            />
                            <text x="80" y="16" class="parent-link-text">
                                → View Parent Node
                            </text>
                        </g>
                    </g>
                {/if}
            </g>
        </svelte:fragment>

        <!-- Inclusion Voting Section (after content, before peer review) -->
        <svelte:fragment slot="voting" let:x let:y let:width let:height>
            <g transform="translate({x}, {y})">
                <text x="0" y="-10" class="section-header left-align">
                    INCLUSION VOTING
                </text>

                <VoteStats
                    userVoteStatus={inclusionUserVoteStatus}
                    positiveVotes={inclusionPositiveVotes}
                    negativeVotes={inclusionNegativeVotes}
                    showUserStatus={false}
                    availableWidth={width * 0.5}
                    containerY={10}
                    positiveLabel="Total Agree"
                    negativeLabel="Total Disagree"
                    netLabel="Net Votes"
                />

                <g transform="translate({width * 0.3}, 10)">
                    <InclusionVoteButtons
                        userVoteStatus={inclusionUserVoteStatus}
                        positiveVotes={inclusionPositiveVotes}
                        negativeVotes={inclusionNegativeVotes}
                        isVoting={votingState.isVoting}
                        voteSuccess={votingState.voteSuccess}
                        lastVoteType={votingState.lastVoteType}
                        availableWidth={width * 0.4}
                        containerY={50}
                        mode="detail"
                        on:vote={handleInclusionVote}
                    />
                </g>
            </g>
        </svelte:fragment>

        <!-- Peer Review Section (custom stats slot) -->
        <svelte:fragment slot="stats" let:x let:y let:width let:height>
            <g transform="translate({x}, {y})">
                <text x="0" y="0" class="section-header left-align">
                    PEER REVIEW ASSESSMENT
                </text>

                <!-- Community Scores -->
                {#if reviewCount > 0}
                    <g transform="translate(0, 30)">
                        <text x="0" y="0" class="review-subsection left-align">
                            Community Scores ({reviewCount} review{reviewCount === 1 ? '' : 's'}):
                        </text>

                        <text x="0" y="30" class="review-metric left-align">
                            Quality: <tspan class="review-stars">{renderStars(avgQualityScore)}</tspan>
                            <tspan class="review-score">{avgQualityScore.toFixed(1)}</tspan>
                        </text>

                        <text x="0" y="55" class="review-metric left-align">
                            Independence: <tspan class="review-stars">{renderStars(avgIndependenceScore)}</tspan>
                            <tspan class="review-score">{avgIndependenceScore.toFixed(1)}</tspan>
                        </text>

                        <text x="0" y="80" class="review-metric left-align">
                            Relevance: <tspan class="review-stars">{renderStars(avgRelevanceScore)}</tspan>
                            <tspan class="review-score">{avgRelevanceScore.toFixed(1)}</tspan>
                        </text>

                        <text x="0" y="110" class="review-overall left-align">
                            Overall: <tspan class="review-stars">{renderStars(overallScore)}</tspan>
                            <tspan class="review-score">{overallScore.toFixed(1)}</tspan>
                        </text>
                    </g>
                {:else}
                    <text x="0" y="40" class="no-reviews left-align">
                        No peer reviews yet. Be the first to assess this evidence!
                    </text>
                {/if}

                <!-- User's Review Section -->
                <g transform="translate(0, {reviewCount > 0 ? 170 : 80})">
                    <text x="0" y="0" class="review-subsection left-align">
                        Your Assessment:
                    </text>

                    {#if hasUserReview && userReview}
                        <!-- Display user's existing review -->
                        <text x="0" y="30" class="review-metric left-align">
                            Quality: <tspan class="review-stars">{renderStars(userReview.qualityScore)}</tspan>
                            <tspan class="review-score">{userReview.qualityScore}</tspan>
                        </text>

                        <text x="0" y="55" class="review-metric left-align">
                            Independence: <tspan class="review-stars">{renderStars(userReview.independenceScore)}</tspan>
                            <tspan class="review-score">{userReview.independenceScore}</tspan>
                        </text>

                        <text x="0" y="80" class="review-metric left-align">
                            Relevance: <tspan class="review-stars">{renderStars(userReview.relevanceScore)}</tspan>
                            <tspan class="review-score">{userReview.relevanceScore}</tspan>
                        </text>

                        <text x="0" y="110" class="review-overall left-align">
                            Your Overall: <tspan class="review-stars">{renderStars((userReview.qualityScore + userReview.independenceScore + userReview.relevanceScore) / 3)}</tspan>
                            <tspan class="review-score">{((userReview.qualityScore + userReview.independenceScore + userReview.relevanceScore) / 3).toFixed(1)}</tspan>
                        </text>

                        <!-- Update and Clear buttons -->
                        <foreignObject x="0" y="130" width="250" height="40">
                            <div class="review-buttons">
                                <button class="review-button update-button" on:click={handleSubmitReview} disabled={isSubmittingReview}>
                                    {isSubmittingReview ? 'Updating...' : 'Update Assessment'}
                                </button>
                                <button class="review-button clear-button" on:click={handleClearReview} disabled={isSubmittingReview}>
                                    Clear
                                </button>
                            </div>
                        </foreignObject>
                    {:else}
                        <!-- Interactive rating input -->
                        <g transform="translate(0, 30)">
                            <text x="0" y="0" class="review-input-label left-align">Quality:</text>
                            {#each [1, 2, 3, 4, 5] as score}
                                <text
                                    x={110 + (score - 1) * 25}
                                    y="0"
                                    class="star-input"
                                    class:selected={score <= qualityScore}
                                    on:click={() => handleScoreClick('quality', score)}
                                    on:keydown={(e) => e.key === 'Enter' && handleScoreClick('quality', score)}
                                    role="button"
                                    tabindex="0"
                                    aria-label={`Rate quality ${score} out of 5`}
                                >
                                    {score <= qualityScore ? '★' : '☆'}
                                </text>
                            {/each}
                        </g>

                        <g transform="translate(0, 30)">
                            <text x="0" y="25" class="review-input-label left-align">Independence:</text>
                            {#each [1, 2, 3, 4, 5] as score}
                                <text
                                    x={110 + (score - 1) * 25}
                                    y="25"
                                    class="star-input"
                                    class:selected={score <= independenceScore}
                                    on:click={() => handleScoreClick('independence', score)}
                                    on:keydown={(e) => e.key === 'Enter' && handleScoreClick('independence', score)}
                                    role="button"
                                    tabindex="0"
                                    aria-label={`Rate independence ${score} out of 5`}
                                >
                                    {score <= independenceScore ? '★' : '☆'}
                                </text>
                            {/each}
                        </g>

                        <g transform="translate(0, 30)">
                            <text x="0" y="50" class="review-input-label left-align">Relevance:</text>
                            {#each [1, 2, 3, 4, 5] as score}
                                <text
                                    x={110 + (score - 1) * 25}
                                    y="50"
                                    class="star-input"
                                    class:selected={score <= relevanceScore}
                                    on:click={() => handleScoreClick('relevance', score)}
                                    on:keydown={(e) => e.key === 'Enter' && handleScoreClick('relevance', score)}
                                    role="button"
                                    tabindex="0"
                                    aria-label={`Rate relevance ${score} out of 5`}
                                >
                                    {score <= relevanceScore ? '★' : '☆'}
                                </text>
                            {/each}
                        </g>

                        <!-- Submit button -->
                        <foreignObject x="0" y="110" width="200" height="40">
                            <button
                                class="review-button submit-button"
                                on:click={handleSubmitReview}
                                disabled={isSubmittingReview || qualityScore === 0 || independenceScore === 0 || relevanceScore === 0}
                            >
                                {isSubmittingReview ? 'Submitting...' : 'Submit Assessment'}
                            </button>
                        </foreignObject>

                        <!-- Error message -->
                        {#if reviewError}
                            <text x="0" y="165" class="error-message left-align">
                                {reviewError}
                            </text>
                        {/if}
                    {/if}
                </g>
            </g>
        </svelte:fragment>

        <!-- Creator credits -->
        <svelte:fragment slot="credits" let:radius>
            {#if evidenceData.createdBy}
                <CreatorCredits
                    createdBy={evidenceData.createdBy}
                    publicCredit={evidenceData.publicCredit}
                    creatorDetails={null}
                    {radius}
                    prefix="submitted by:"
                />
            {/if}
        </svelte:fragment>

        <!-- Node Metadata (timestamps) -->
        <svelte:fragment slot="metadata" let:radius>
            <NodeMetadata
                createdAt={evidenceData.createdAt}
                updatedAt={evidenceData.updatedAt}
                {radius}
            />
        </svelte:fragment>
    </BaseDetailNode>
{:else}
    <!-- PREVIEW MODE -->
    <BasePreviewNode {node} {canExpand} on:modeChange={handleModeChange} on:visibilityChange={handleVisibilityChange}>
        <svelte:fragment slot="title" let:radius>
            <NodeHeader title="Evidence" {radius} size="small" mode="preview" />
        </svelte:fragment>

        <svelte:fragment slot="content" let:x let:y let:width let:height>
            <foreignObject
                {x}
                {y}
                {width}
                {height}
            >
                <div class="evidence-preview">
                    {#each titleLines.slice(0, 2) as line}
                        <div class="title-line">{line}</div>
                    {/each}
                    <div class="type-badge" style:color={evidenceTypeConfig.color}>
                        {evidenceTypeConfig.icon} {evidenceTypeConfig.label}
                    </div>
                </div>
            </foreignObject>
        </svelte:fragment>

        <svelte:fragment slot="voting" let:width let:height>
            <InclusionVoteButtons
                userVoteStatus={inclusionUserVoteStatus}
                positiveVotes={inclusionPositiveVotes}
                negativeVotes={inclusionNegativeVotes}
                isVoting={votingState.isVoting}
                voteSuccess={votingState.voteSuccess}
                lastVoteType={votingState.lastVoteType}
                availableWidth={width}
                containerY={height / 2}
                mode="preview"
                on:vote={handleInclusionVote}
            />
        </svelte:fragment>
    </BasePreviewNode>
{/if}

<style>
    .left-align {
        text-anchor: start;
    }

    /* Evidence Title */
    :global(.evidence-title) {
        color: white;
        font-family: 'Inter', sans-serif;
        font-size: 18px;
        font-weight: 600;
        line-height: 1.4;
        text-align: left;
    }

    /* Evidence Type Badge */
    .evidence-type-text {
        font-family: 'Inter', sans-serif;
        font-size: 13px;
        font-weight: 500;
        text-anchor: middle;
        dominant-baseline: middle;
    }

    /* Evidence Metadata */
    .evidence-meta {
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        font-weight: 400;
        fill: rgba(255, 255, 255, 0.7);
    }

    .evidence-meta-value {
        fill: rgba(255, 255, 255, 0.9);
        font-weight: 500;
    }

    /* URL Link */
    .evidence-url {
        font-family: 'Inter', sans-serif;
        font-size: 13px;
        font-weight: 400;
        fill: rgba(52, 152, 219, 0.9);
        text-anchor: start;
        cursor: pointer;
        text-decoration: underline;
    }

    .url-link {
        cursor: pointer;
    }

    .url-link:hover .evidence-url {
        fill: rgba(52, 152, 219, 1);
    }

    /* Description */
    :global(.evidence-description) {
        color: rgba(255, 255, 255, 0.85);
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        font-weight: 400;
        line-height: 1.5;
        text-align: left;
    }

    /* Parent Node Reference */
    .parent-label {
        font-family: 'Inter', sans-serif;
        font-size: 13px;
        font-weight: 400;
        fill: rgba(255, 255, 255, 0.6);
    }

    .parent-title {
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        font-weight: 500;
        fill: rgba(255, 255, 255, 0.9);
    }

    .parent-link {
        cursor: pointer;
    }

    .parent-link-text {
        font-family: 'Inter', sans-serif;
        font-size: 13px;
        font-weight: 500;
        fill: rgba(26, 188, 156, 0.9);
        text-anchor: middle;
        dominant-baseline: middle;
    }

    .parent-link:hover rect {
        fill: rgba(26, 188, 156, 0.3);
    }

    /* Section Headers */
    .section-header {
        font-family: 'Inter', sans-serif;
        font-size: 16px;
        font-weight: 600;
        fill: rgba(26, 188, 156, 0.9);
        letter-spacing: 0.5px;
    }

    .review-subsection {
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        font-weight: 600;
        fill: rgba(255, 255, 255, 0.9);
    }

    /* Review Metrics */
    .review-metric {
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        font-weight: 400;
        fill: rgba(255, 255, 255, 0.8);
    }

    .review-overall {
        font-family: 'Inter', sans-serif;
        font-size: 15px;
        font-weight: 600;
        fill: rgba(255, 255, 255, 0.95);
    }

    .review-stars {
        font-family: 'Inter', sans-serif;
        font-size: 16px;
        fill: rgba(241, 196, 15, 0.9);
    }

    .review-score {
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        font-weight: 600;
        fill: rgba(26, 188, 156, 0.9);
    }

    .no-reviews {
        font-family: 'Inter', sans-serif;
        font-size: 13px;
        font-weight: 400;
        fill: rgba(255, 255, 255, 0.6);
        font-style: italic;
    }

    /* Review Input */
    .review-input-label {
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        font-weight: 500;
        fill: rgba(255, 255, 255, 0.9);
    }

    .star-input {
        font-family: 'Inter', sans-serif;
        font-size: 20px;
        fill: rgba(255, 255, 255, 0.3);
        text-anchor: middle;
        cursor: pointer;
        user-select: none;
        transition: fill 0.2s ease;
    }

    .star-input:hover {
        fill: rgba(241, 196, 15, 0.6);
    }

    .star-input.selected {
        fill: rgba(241, 196, 15, 0.9);
    }

    /* Review Buttons */
    :global(.review-buttons) {
        display: flex;
        gap: 10px;
    }

    :global(.review-button) {
        padding: 8px 16px;
        border-radius: 4px;
        font-family: 'Inter', sans-serif;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        border: none;
        color: white;
    }

    :global(.submit-button) {
        background: rgba(26, 188, 156, 0.3);
        border: 1px solid rgba(26, 188, 156, 0.5);
    }

    :global(.submit-button:hover:not(:disabled)) {
        background: rgba(26, 188, 156, 0.5);
    }

    :global(.update-button) {
        background: rgba(52, 152, 219, 0.3);
        border: 1px solid rgba(52, 152, 219, 0.5);
    }

    :global(.update-button:hover:not(:disabled)) {
        background: rgba(52, 152, 219, 0.5);
    }

    :global(.clear-button) {
        background: rgba(231, 76, 60, 0.2);
        border: 1px solid rgba(231, 76, 60, 0.4);
    }

    :global(.clear-button:hover:not(:disabled)) {
        background: rgba(231, 76, 60, 0.3);
    }

    :global(.review-button:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }

    /* Error Message */
    .error-message {
        font-family: 'Inter', sans-serif;
        font-size: 12px;
        font-weight: 400;
        fill: #ff4444;
    }

    /* Preview Mode */
    .evidence-preview {
        font-family: 'Inter', sans-serif;
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
        padding: 5px;
        box-sizing: border-box;
    }

    .title-line {
        margin-bottom: 3px;
    }

    .type-badge {
        font-size: 10px;
        font-weight: 500;
        margin-top: 5px;
        opacity: 0.8;
    }
</style>