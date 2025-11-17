<!-- src/lib/components/graph/nodes/evidence/EvidenceNode.svelte -->
<!-- REORGANIZED: Clean 3-section semantic structure - contentText / inclusionVoting / peerReview -->
<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
    import type { VoteStatus, Keyword } from '$lib/types/domain/nodes';
    import { isEvidenceData } from '$lib/types/graph/enhanced';
    import BasePreviewNode from '../base/BasePreviewNode.svelte';
    import BaseDetailNode from '../base/BaseDetailNode.svelte';
    import { TextContent, NodeHeader, InclusionVoteButtons, VoteStats, CategoryTags, KeywordTags, NodeMetadata, CreatorCredits } from '../ui';
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
        // Create voting behaviour for inclusion votes
        inclusionVoting = createVoteBehaviour(node.id, 'evidence', {
            apiIdentifier: evidenceData.id,
            dataObject: evidenceData,
            dataProperties: {
                positiveVotesKey: 'inclusionPositiveVotes',
                negativeVotesKey: 'inclusionNegativeVotes'
            },
            getVoteEndpoint: (id) => `/nodes/evidence/${id}/vote`,
            getRemoveVoteEndpoint: (id) => `/nodes/evidence/${id}/vote`,
            graphStore,
            onDataUpdate: () => {
                // Trigger reactivity
                evidenceData = { ...evidenceData };
            },
            metadataConfig: {
                nodeMetadata: node.metadata,
                voteStatusKey: 'inclusionVoteStatus',
                metadataGroup: getMetadataGroup()
            },
            voteKind: 'INCLUSION'
        });

        // Initialize with current vote data
        await inclusionVoting.initialize({
            positiveVotes: inclusionPositiveVotes,
            negativeVotes: inclusionNegativeVotes,
            skipVoteStatusFetch: false
        });
    });

    // Vote handler - now uses behaviour
    async function handleInclusionVote(event: CustomEvent<{ voteType: VoteStatus }>) {
        if (!inclusionVoting) return;
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
    <BaseDetailNode 
        {node} 
        categoryTagsYOffset={0.95}
        keywordTagsYOffset={0.85}
        on:modeChange={handleModeChange} 
        on:visibilityChange={handleVisibilityChange}
    >
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

        <!-- REORGANIZED: Section 1 - Content Text (Evidence Details) -->
        <svelte:fragment slot="contentText" let:x let:y let:width let:height let:positioning>
            <!-- Title -->
            <foreignObject 
                {x} 
                y={y + Math.floor(height * (positioning.title || 0))} 
                {width} 
                height={Math.floor(height * (positioning.titleHeight || 0.20))}
            >
                <div class="evidence-title">{displayTitle}</div>
            </foreignObject>

            <!-- Evidence Type Badge -->
            <g transform="translate({x + width/2 - 100}, {y + Math.floor(height * (positioning.typeBadge || 0.22))})">
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
                <foreignObject 
                    {x} 
                    y={y + Math.floor(height * (positioning.authors || 0.35))} 
                    {width} 
                    height="20"
                >
                    <div class="evidence-meta">
                        Authors: <span class="evidence-meta-value">{formattedAuthors}</span>
                    </div>
                </foreignObject>
            {/if}

            <!-- Publication Date -->
            {#if formattedDate}
                <foreignObject 
                    {x} 
                    y={y + Math.floor(height * (positioning.pubDate || 0.42))} 
                    {width} 
                    height="20"
                >
                    <div class="evidence-meta">
                        Published: <span class="evidence-meta-value">{formattedDate}</span>
                    </div>
                </foreignObject>
            {/if}

            <!-- URL Link -->
            <foreignObject 
                {x} 
                y={y + Math.floor(height * (positioning.url || 0.50))} 
                {width} 
                height="20"
            >
                <div 
                    class="evidence-url" 
                    on:click={handleUrlClick}
                    on:keydown={(e) => e.key === 'Enter' && handleUrlClick()}
                    role="button"
                    tabindex="0"
                >
                    🔗 {displayUrl}
                </div>
            </foreignObject>

            <!-- Description -->
            {#if displayDescription}
                <foreignObject 
                    {x} 
                    y={y + Math.floor(height * (positioning.description || 0.58))} 
                    {width} 
                    height={Math.floor(height * (positioning.descriptionHeight || 0.25))}
                >
                    <div class="evidence-description">{displayDescription}</div>
                </foreignObject>
            {/if}

            <!-- Parent Node Reference -->
            {#if parentInfo}
                <foreignObject 
                    {x} 
                    y={y + Math.floor(height * (positioning.parentLabel || 0.85))} 
                    {width} 
                    height="20"
                >
                    <div class="parent-label">
                        Supports {parentNodeType === 'StatementNode' ? 'Statement' : 
                                  parentNodeType === 'AnswerNode' ? 'Answer' : 'Quantity'}:
                    </div>
                </foreignObject>
                <foreignObject 
                    {x} 
                    y={y + Math.floor(height * (positioning.parentTitle || 0.92))} 
                    {width} 
                    height="25"
                >
                    <div class="parent-title">{parentInfo.title}</div>
                </foreignObject>
            {/if}
        </svelte:fragment>

        <!-- REORGANIZED: Section 2 - Inclusion Voting (Complete system) -->
        <svelte:fragment slot="inclusionVoting" let:x let:y let:width let:height let:positioning>
            <!-- Inclusion vote prompt -->
            <foreignObject 
                {x} 
                y={y + Math.floor(height * positioning.prompt)} 
                {width} 
                height="24"
            >
                <div class="vote-prompt">
                    <strong>Include/Exclude:</strong> Is this evidence relevant?
                </div>
            </foreignObject>

            <!-- Inclusion vote buttons -->
            <g transform="translate(0, {y + Math.floor(height * positioning.buttons)})">
                <InclusionVoteButtons
                    userVoteStatus={inclusionUserVoteStatus}
                    positiveVotes={inclusionPositiveVotes}
                    negativeVotes={inclusionNegativeVotes}
                    isVoting={votingState.isVoting}
                    voteSuccess={votingState.voteSuccess}
                    lastVoteType={votingState.lastVoteType}
                    availableWidth={width}
                    mode="detail"
                    on:vote={handleInclusionVote}
                />
            </g>

            <!-- Inclusion vote stats -->
            <g transform="translate({width * (positioning.statsXOffset || 0)}, {y + Math.floor(height * positioning.stats)})">
                <VoteStats
                    userVoteStatus={inclusionUserVoteStatus}
                    positiveVotes={inclusionPositiveVotes}
                    negativeVotes={inclusionNegativeVotes}
                    positiveLabel="Include"
                    negativeLabel="Exclude"
                    availableWidth={width * (positioning.statsWidth || 1.0)}
                    showUserStatus={false}
                    showBackground={false}
                />
            </g>
        </svelte:fragment>

        <!-- REORGANIZED: Section 3 - Peer Review Assessment System -->
        <svelte:fragment slot="contentVoting" let:x let:y let:width let:height let:positioning>
            <!-- Section header -->
            <foreignObject 
                {x} 
                y={y + Math.floor(height * (positioning.header || 0))} 
                {width} 
                height="30"
            >
                <div class="section-header">PEER REVIEW ASSESSMENT</div>
            </foreignObject>

            <!-- Community Scores -->
            {#if reviewCount > 0}
                <foreignObject 
                    {x} 
                    y={y + Math.floor(height * (positioning.communityLabel || 0.08))} 
                    {width} 
                    height="20"
                >
                    <div class="review-subsection">
                        Community Scores ({reviewCount} review{reviewCount === 1 ? '' : 's'}):
                    </div>
                </foreignObject>

                <foreignObject 
                    {x} 
                    y={y + Math.floor(height * (positioning.communityScores || 0.13))} 
                    {width} 
                    height="120"
                >
                    <div class="community-scores">
                        <div class="review-metric">
                            Quality: <span class="review-stars">{renderStars(avgQualityScore)}</span>
                            <span class="review-score">{avgQualityScore.toFixed(1)}</span>
                        </div>
                        <div class="review-metric">
                            Independence: <span class="review-stars">{renderStars(avgIndependenceScore)}</span>
                            <span class="review-score">{avgIndependenceScore.toFixed(1)}</span>
                        </div>
                        <div class="review-metric">
                            Relevance: <span class="review-stars">{renderStars(avgRelevanceScore)}</span>
                            <span class="review-score">{avgRelevanceScore.toFixed(1)}</span>
                        </div>
                        <div class="review-overall">
                            Overall: <span class="review-stars">{renderStars(overallScore)}</span>
                            <span class="review-score">{overallScore.toFixed(1)}</span>
                        </div>
                    </div>
                </foreignObject>
            {:else}
                <foreignObject 
                    {x} 
                    y={y + Math.floor(height * (positioning.noReviews || 0.10))} 
                    {width} 
                    height="30"
                >
                    <div class="no-reviews">No peer reviews yet. Be the first to assess this evidence!</div>
                </foreignObject>
            {/if}

            <!-- User's Review Section -->
            <foreignObject 
                {x} 
                y={y + Math.floor(height * (positioning.userLabel || (reviewCount > 0 ? 0.42 : 0.20)))} 
                {width} 
                height="20"
            >
                <div class="review-subsection">Your Assessment:</div>
            </foreignObject>

            {#if hasUserReview && userReview}
                <!-- Display user's existing review -->
                <foreignObject 
                    {x} 
                    y={y + Math.floor(height * (positioning.userScores || (reviewCount > 0 ? 0.48 : 0.26)))} 
                    {width} 
                    height="120"
                >
                    <div class="user-scores">
                        <div class="review-metric">
                            Quality: <span class="review-stars">{renderStars(userReview.qualityScore)}</span>
                            <span class="review-score">{userReview.qualityScore}</span>
                        </div>
                        <div class="review-metric">
                            Independence: <span class="review-stars">{renderStars(userReview.independenceScore)}</span>
                            <span class="review-score">{userReview.independenceScore}</span>
                        </div>
                        <div class="review-metric">
                            Relevance: <span class="review-stars">{renderStars(userReview.relevanceScore)}</span>
                            <span class="review-score">{userReview.relevanceScore}</span>
                        </div>
                        <div class="review-overall">
                            Your Overall: <span class="review-stars">{renderStars((userReview.qualityScore + userReview.independenceScore + userReview.relevanceScore) / 3)}</span>
                            <span class="review-score">{((userReview.qualityScore + userReview.independenceScore + userReview.relevanceScore) / 3).toFixed(1)}</span>
                        </div>
                    </div>
                </foreignObject>

                <!-- Update and Clear buttons -->
                <foreignObject 
                    {x} 
                    y={y + Math.floor(height * (positioning.userButtons || (reviewCount > 0 ? 0.75 : 0.63)))} 
                    {width} 
                    height="40"
                >
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
                <foreignObject 
                    {x} 
                    y={y + Math.floor(height * (positioning.inputStars || (reviewCount > 0 ? 0.48 : 0.26)))} 
                    {width} 
                    height="90"
                >
                    <div class="star-inputs">
                        <div class="star-input-row">
                            <span class="review-input-label">Quality:</span>
                            <div class="stars">
                                {#each [1, 2, 3, 4, 5] as score}
                                    <span
                                        class="star-input"
                                        class:selected={score <= qualityScore}
                                        on:click={() => handleScoreClick('quality', score)}
                                        on:keydown={(e) => e.key === 'Enter' && handleScoreClick('quality', score)}
                                        role="button"
                                        tabindex="0"
                                        aria-label={`Rate quality ${score} out of 5`}
                                    >
                                        {score <= qualityScore ? '★' : '☆'}
                                    </span>
                                {/each}
                            </div>
                        </div>
                        <div class="star-input-row">
                            <span class="review-input-label">Independence:</span>
                            <div class="stars">
                                {#each [1, 2, 3, 4, 5] as score}
                                    <span
                                        class="star-input"
                                        class:selected={score <= independenceScore}
                                        on:click={() => handleScoreClick('independence', score)}
                                        on:keydown={(e) => e.key === 'Enter' && handleScoreClick('independence', score)}
                                        role="button"
                                        tabindex="0"
                                        aria-label={`Rate independence ${score} out of 5`}
                                    >
                                        {score <= independenceScore ? '★' : '☆'}
                                    </span>
                                {/each}
                            </div>
                        </div>
                        <div class="star-input-row">
                            <span class="review-input-label">Relevance:</span>
                            <div class="stars">
                                {#each [1, 2, 3, 4, 5] as score}
                                    <span
                                        class="star-input"
                                        class:selected={score <= relevanceScore}
                                        on:click={() => handleScoreClick('relevance', score)}
                                        on:keydown={(e) => e.key === 'Enter' && handleScoreClick('relevance', score)}
                                        role="button"
                                        tabindex="0"
                                        aria-label={`Rate relevance ${score} out of 5`}
                                    >
                                        {score <= relevanceScore ? '★' : '☆'}
                                    </span>
                                {/each}
                            </div>
                        </div>
                    </div>
                </foreignObject>

                <!-- Submit button -->
                <foreignObject 
                    {x} 
                    y={y + Math.floor(height * (positioning.submitButton || (reviewCount > 0 ? 0.65 : 0.53)))} 
                    {width} 
                    height="40"
                >
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
                    <foreignObject 
                        {x} 
                        y={y + Math.floor(height * (positioning.errorMessage || (reviewCount > 0 ? 0.75 : 0.63)))} 
                        {width} 
                        height="30"
                    >
                        <div class="error-message">{reviewError}</div>
                    </foreignObject>
                {/if}
            {/if}
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

        <svelte:fragment slot="contentText" let:x let:y let:width let:height let:positioning>
            <foreignObject
                {x}
                y={y + Math.floor(height * (positioning.text || 0))}
                {width}
                height={Math.floor(height * (positioning.textHeight || 0.70))}
            >
                <div class="evidence-preview">
                    {#each titleLines.slice(0, 2) as line}
                        <div class="title-line">{line}</div>
                    {/each}
                </div>
            </foreignObject>
            <foreignObject
                {x}
                y={y + Math.floor(height * (positioning.typeBadge || 0.75))}
                {width}
                height="30"
            >
                <div class="type-badge" style:color={evidenceTypeConfig.color}>
                    {evidenceTypeConfig.icon} {evidenceTypeConfig.label}
                </div>
            </foreignObject>
        </svelte:fragment>

        <svelte:fragment slot="inclusionVoting" let:x let:y let:width let:height let:positioning>
            <g transform="translate(0, {y + Math.floor(height * positioning.buttons)})">
                <InclusionVoteButtons
                    userVoteStatus={inclusionUserVoteStatus}
                    positiveVotes={inclusionPositiveVotes}
                    negativeVotes={inclusionNegativeVotes}
                    isVoting={votingState.isVoting}
                    voteSuccess={votingState.voteSuccess}
                    lastVoteType={votingState.lastVoteType}
                    availableWidth={width}
                    mode="preview"
                    on:vote={handleInclusionVote}
                />
            </g>
        </svelte:fragment>
    </BasePreviewNode>
{/if}

<style>
    /* Evidence Title */
    :global(.evidence-title) {
        color: white;
        font-family: 'Inter', sans-serif;
        font-size: 16px;
        font-weight: 600;
        line-height: 1.3;
        text-align: left;
        padding: 0 5px;
        display: flex;
        align-items: flex-start;
        height: 100%;
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
    :global(.evidence-meta) {
        font-family: 'Inter', sans-serif;
        font-size: 12px;
        font-weight: 400;
        color: rgba(255, 255, 255, 0.7);
        text-align: left;
        padding: 0 5px;
        display: flex;
        align-items: center;
        height: 100%;
    }

    :global(.evidence-meta-value) {
        color: rgba(255, 255, 255, 0.9);
        font-weight: 500;
        margin-left: 5px;
    }

    /* URL Link */
    :global(.evidence-url) {
        font-family: 'Inter', sans-serif;
        font-size: 11px;
        font-weight: 400;
        color: rgba(52, 152, 219, 0.9);
        text-align: left;
        padding: 0 5px;
        cursor: pointer;
        text-decoration: underline;
        display: flex;
        align-items: center;
        height: 100%;
    }

    :global(.evidence-url:hover) {
        color: rgba(52, 152, 219, 1);
    }

    /* Description */
    :global(.evidence-description) {
        color: rgba(255, 255, 255, 0.85);
        font-family: 'Inter', sans-serif;
        font-size: 11px;
        font-weight: 400;
        line-height: 1.4;
        text-align: left;
        padding: 0 5px;
        overflow-y: auto;
        height: 100%;
    }

    /* Parent Node Reference */
    :global(.parent-label),
    :global(.parent-title) {
        font-family: 'Inter', sans-serif;
        font-size: 11px;
        text-align: left;
        padding: 0 5px;
        display: flex;
        align-items: center;
        height: 100%;
    }

    :global(.parent-label) {
        font-weight: 400;
        color: rgba(255, 255, 255, 0.6);
    }

    :global(.parent-title) {
        font-weight: 500;
        color: rgba(255, 255, 255, 0.9);
    }

    /* Vote Prompt */
    :global(.vote-prompt) {
        font-family: Inter, sans-serif;
        font-size: 11px;
        font-weight: 400;
        color: rgba(255, 255, 255, 0.7);
        text-align: center;
        line-height: 1.3;
        padding: 2px 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
    }

    :global(.vote-prompt strong) {
        color: rgba(255, 255, 255, 0.9);
        font-weight: 600;
    }

    /* Section Headers */
    :global(.section-header) {
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        font-weight: 600;
        color: rgba(26, 188, 156, 0.9);
        letter-spacing: 0.5px;
        text-align: center;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
    }

    :global(.review-subsection) {
        font-family: 'Inter', sans-serif;
        font-size: 12px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.9);
        text-align: left;
        padding: 0 5px;
        display: flex;
        align-items: center;
        height: 100%;
    }

    /* Community/User Scores Display */
    :global(.community-scores),
    :global(.user-scores) {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 5px;
        height: 100%;
        justify-content: space-around;
    }

    :global(.review-metric),
    :global(.review-overall) {
        font-family: 'Inter', sans-serif;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.8);
        display: flex;
        align-items: center;
        gap: 8px;
    }

    :global(.review-overall) {
        font-size: 13px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.95);
    }

    :global(.review-stars) {
        color: rgba(241, 196, 15, 0.9);
        font-size: 14px;
    }

    :global(.review-score) {
        color: rgba(26, 188, 156, 0.9);
        font-weight: 600;
        font-size: 12px;
    }

    :global(.no-reviews) {
        font-family: 'Inter', sans-serif;
        font-size: 11px;
        font-weight: 400;
        color: rgba(255, 255, 255, 0.6);
        font-style: italic;
        text-align: center;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: 0 10px;
    }

    /* Star Input UI */
    :global(.star-inputs) {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 5px;
        height: 100%;
        justify-content: space-around;
    }

    :global(.star-input-row) {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    :global(.review-input-label) {
        font-family: 'Inter', sans-serif;
        font-size: 12px;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.9);
        min-width: 100px;
    }

    :global(.stars) {
        display: flex;
        gap: 5px;
    }

    :global(.star-input) {
        font-size: 20px;
        color: rgba(255, 255, 255, 0.3);
        cursor: pointer;
        user-select: none;
        transition: color 0.2s ease;
    }

    :global(.star-input:hover) {
        color: rgba(241, 196, 15, 0.6);
    }

    :global(.star-input.selected) {
        color: rgba(241, 196, 15, 0.9);
    }

    /* Review Buttons */
    :global(.review-buttons) {
        display: flex;
        gap: 10px;
        justify-content: center;
        align-items: center;
        height: 100%;
    }

    :global(.review-button) {
        padding: 8px 16px;
        border-radius: 4px;
        font-family: 'Inter', sans-serif;
        font-size: 12px;
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
    :global(.error-message) {
        font-family: 'Inter', sans-serif;
        font-size: 11px;
        font-weight: 400;
        color: #ff4444;
        text-align: center;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
    }

    /* Preview Mode */
    :global(.evidence-preview) {
        font-family: 'Inter', sans-serif;
        font-size: 11px;
        font-weight: 400;
        color: rgba(255, 255, 255, 0.9);
        text-align: center;
        line-height: 1.3;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        padding: 5px;
        box-sizing: border-box;
    }

    :global(.title-line) {
        margin-bottom: 3px;
    }

    :global(.type-badge) {
        font-family: 'Inter', sans-serif;
        font-size: 10px;
        font-weight: 500;
        opacity: 0.8;
        text-align: center;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
    }
</style>