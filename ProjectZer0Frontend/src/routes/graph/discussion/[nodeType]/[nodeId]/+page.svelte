<!-- src/routes/graph/discussion/[nodeType]/[nodeId]/+page.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import * as auth0 from '$lib/services/auth0';
    import Graph from '$lib/components/graph/Graph.svelte';
    import WordNode from '$lib/components/graph/nodes/word/WordNode.svelte';
    import DefinitionNode from '$lib/components/graph/nodes/definition/DefinitionNode.svelte';
    import StatementNode from '$lib/components/graph/nodes/statement/StatementNode.svelte';
    import QuantityNode from '$lib/components/graph/nodes/quantity/QuantityNode.svelte';
    import NavigationNode from '$lib/components/graph/nodes/navigation/NavigationNode.svelte';
    import CommentNode from '$lib/components/graph/nodes/comment/CommentNode.svelte';
    import CommentFormNode from '$lib/components/graph/nodes/comment/CommentForm.svelte';
    import { getNavigationOptions, NavigationContext } from '$lib/services/navigation';
    import { userStore } from '$lib/stores/userStore';
    import { discussionStore, type CommentSortMode } from '$lib/stores/discussionStore';
    import { graphStore } from '$lib/stores/graphStore';
    import { visibilityStore } from '$lib/stores/visibilityPreferenceStore';
    import type { 
        GraphData, 
        GraphNode, 
        GraphLink,
        RenderableNode,
        NodeType,
        NodeGroup,
        NodeMode,
        ViewType,
        LinkType,
        NodeMetadata
    } from '$lib/types/graph/enhanced';
    import { 
        isWordNode, 
        isDefinitionNode, 
        isStatementNode,
        isQuantityNode,
        isNavigationNode,
        isCommentNode
    } from '$lib/types/graph/enhanced';
    import type { CommentNode as CommentNodeType, CommentFormData } from '$lib/types/domain/nodes';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { fetchWithAuth } from '$lib/services/api';
    
    // View type with type assertion
    const viewType = 'discussion' as ViewType;
    
    // Extract parameters from URL
    $: nodeType = $page.params.nodeType || '';
    $: nodeId = $page.params.nodeId || '';
    
    // Track initialization states
    let authInitialized = false;
    let dataInitialized = false;
    
    // Track loading states
    let isLoading = true;
    let error: string | null = null;
    
    // Node data
    let centralNode: any = null;
    let sortMode: CommentSortMode = 'popularity';
    let isAddingRootComment = false;
    
    // Create a unique key for forcing re-renders
    let routeKey = `${viewType}-${nodeType}-${nodeId}-${Date.now()}`;
    
    // Initialize data and authenticate user
    async function initializeData() {
        try {
            await auth0.handleAuthCallback();
            const fetchedUser = await auth0.getAuth0User();
            
            if (!fetchedUser) {
                auth0.login();
                return;
            }
            
            authInitialized = true;
            userStore.set(fetchedUser);
            
            // Validate parameters
            if (!nodeType || !nodeId) {
                error = 'Invalid node type or ID';
                isLoading = false;
                return;
            }
            
            // Load discussion and comments
            await discussionStore.loadDiscussion(nodeType, nodeId, sortMode);
            
            // Load visibility preferences
            await visibilityStore.loadPreferences();
            
            // Fetch the central node data based on node type
            // Updated to use fetchWithAuth for consistent authentication and correct API path
            try {
                const centralNodeData = await fetchWithAuth(`/nodes/${nodeType}/${nodeId}`);
                
                if (centralNodeData) {
                    centralNode = centralNodeData;
                    dataInitialized = true;
                } else {
                    throw new Error(`No ${nodeType} data returned from API`);
                }
            } catch (nodeError) {
                console.error(`Error fetching ${nodeType} data:`, nodeError);
                throw new Error(`Failed to fetch ${nodeType} data`);
            }
            
            isLoading = false;
            
            // Set the correct view type in graph store and force update
            if (graphStore) {
                graphStore.setViewType(viewType);
                graphStore.forceTick();
            }
        } catch (err) {
            console.error('Error initializing discussion view:', err);
            error = err instanceof Error ? err.message : 'An error occurred';
            isLoading = false;
        }
    }
    
    // Event handlers
    function handleNodeModeChange(event: CustomEvent<{ nodeId: string; mode: NodeMode }>) {
        // Update the graph store
        if (graphStore) {
            graphStore.updateNodeMode(event.detail.nodeId, event.detail.mode);
        }
    }
    
    function handleVisibilityChange(event: CustomEvent<{ nodeId: string; isHidden: boolean }>) {
        // Update visibility in stores
        visibilityStore.setPreference(event.detail.nodeId, !event.detail.isHidden);
        discussionStore.setVisibilityPreference(event.detail.nodeId, !event.detail.isHidden);
        
        // Update graph store
        if (graphStore) {
            graphStore.updateNodeVisibility(event.detail.nodeId, event.detail.isHidden, 'user');
        }
    }
    
    function handleSortChange(mode: CommentSortMode) {
        sortMode = mode;
        discussionStore.setSortMode(mode);
        // Force re-render with new key
        routeKey = `${viewType}-${nodeType}-${nodeId}-${sortMode}-${Date.now()}`;
    }
    
    function handleAddRootComment() {
        isAddingRootComment = true;
    }
    
    async function handleCommentSubmit(event: CustomEvent<{ text: string; parentId: string | null }>) {
        const { text, parentId } = event.detail;
        
        try {
            // Convert null to undefined if needed for discussionStore API
            const newComment = await discussionStore.addComment(
                nodeType, 
                nodeId, 
                text, 
                parentId !== null ? parentId : undefined
            );
            
            if (newComment) {
                console.log('Comment added successfully:', newComment);
                // Reset state
                isAddingRootComment = false;
                // Force re-render
                routeKey = `${viewType}-${nodeType}-${nodeId}-${Date.now()}`;
            }
        } catch (err) {
            console.error('Error adding comment:', err);
        }
    }
    
    function handleCommentCancel() {
        isAddingRootComment = false;
        discussionStore.cancelAddingComment();
    }
    
    function handleReply(event: CustomEvent<{ commentId: string }>) {
        discussionStore.startReply(event.detail.commentId);
    }
    
    function handleEditComment(event: CustomEvent<{ commentId: string; text: string }>) {
        console.log('Edit comment:', event.detail);
        // TODO: Implement comment editing
    }
    
    function handleDeleteComment(event: CustomEvent<{ commentId: string }>) {
        console.log('Delete comment:', event.detail);
        // TODO: Implement comment deletion
    }
    
    // Create graph data
    function createGraphData(): GraphData {
        if (!centralNode) {
            return { nodes: [], links: [] };
        }
        
        // Get navigation options for discussion context
        // Use string literal instead of enum to avoid type issues
        const navigationNodes: GraphNode[] = getNavigationOptions('discussion')
            .map(option => ({
                id: option.id,
                type: 'navigation' as NodeType,
                data: option,
                group: 'navigation' as NodeGroup
            }));
        
        // Create central node based on node type
        const centralGraphNode: GraphNode = {
            id: centralNode.id,
            type: nodeType as NodeType,
            data: centralNode,
            group: 'central' as NodeGroup,
            mode: 'preview' as NodeMode // Start in preview mode
        };
        
        // Prepare base nodes
        const baseNodes = [
            centralGraphNode,
            ...navigationNodes
        ] as GraphNode[];
        
        // Add comment nodes
        const commentNodes: GraphNode[] = [];
        const commentLinks: GraphLink[] = [];
        
        // Get all comments from the discussion store
        const comments = $discussionStore.comments || [];
        
        // Process all comments
        comments.forEach(comment => {
            // Create metadata for the comment node
            const commentMetadata: NodeMetadata = {
                group: 'comment' as NodeMetadata['group'],
                parentCommentId: comment.parentCommentId,
                votes: comment.positiveVotes - comment.negativeVotes,
                createdAt: typeof comment.createdAt === 'string' ? comment.createdAt : undefined,
                depth: comment.depth || 0,
                isExpanded: comment.isExpanded || false
            };
            
            // Create comment node with proper metadata
            const commentNode: GraphNode = {
                id: comment.id,
                type: 'comment' as NodeType,
                data: comment as unknown as CommentNodeType,
                group: 'comment' as NodeGroup,
                mode: 'preview' as NodeMode, // Start in preview mode
                metadata: commentMetadata
            };
            
            commentNodes.push(commentNode);
            
            // Create link to parent
            if (comment.parentCommentId) {
                // Link to parent comment
                commentLinks.push({
                    id: `${comment.parentCommentId}-${comment.id}`,
                    source: comment.parentCommentId,
                    target: comment.id,
                    type: 'reply' as LinkType
                });
            } else {
                // Link to central node
                commentLinks.push({
                    id: `${centralNode.id}-${comment.id}`,
                    source: centralNode.id,
                    target: comment.id,
                    type: 'comment' as LinkType
                });
            }
        });
        
        // Add comment form node if adding a comment
        if (isAddingRootComment) {
            const formData: CommentFormData = {
                id: `comment-form-${Date.now()}`,
                parentCommentId: null,
                // Add minimum required properties to satisfy union type
                sub: `comment-form-${Date.now()}`,
                label: 'Comment Form',
                word: ''
            };
            
            // Create metadata for the form node
            const formMetadata: NodeMetadata = {
                group: 'comment-form' as NodeMetadata['group']
            };
            
            const commentFormNode: GraphNode = {
                id: formData.id,
                type: 'comment-form' as NodeType,
                data: formData as any, // Type assertion
                group: 'comment-form' as NodeGroup,
                mode: 'detail' as NodeMode,
                metadata: formMetadata
            };
            
            commentNodes.push(commentFormNode);
            
            // Link form to central node
            commentLinks.push({
                id: `${centralNode.id}-${commentFormNode.id}`,
                source: centralNode.id,
                target: commentFormNode.id,
                type: 'comment-form' as LinkType
            });
        }
        
        // Add reply forms if replying to comments
        if ($discussionStore.isAddingReply && $discussionStore.replyToCommentId) {
            const parentId = $discussionStore.replyToCommentId;
            
            const formData: CommentFormData = {
                id: `reply-form-${parentId}-${Date.now()}`,
                parentCommentId: parentId,
                // Add minimum required properties to satisfy union type
                sub: `reply-form-${Date.now()}`,
                label: 'Reply Form',
                word: ''
            };
            
            // Create metadata for the reply form node
            const replyFormMetadata: NodeMetadata = {
                group: 'comment-form' as NodeMetadata['group'],
                parentCommentId: parentId
            };
            
            const replyFormNode: GraphNode = {
                id: formData.id,
                type: 'comment-form' as NodeType,
                data: formData as any, // Type assertion
                group: 'comment-form' as NodeGroup,
                mode: 'detail' as NodeMode,
                metadata: replyFormMetadata
            };
            
            commentNodes.push(replyFormNode);
            
            // Link form to parent comment
            commentLinks.push({
                id: `${parentId}-${replyFormNode.id}`,
                source: parentId,
                target: replyFormNode.id,
                type: 'reply-form' as LinkType
            });
        }
        
        return {
            nodes: [...baseNodes, ...commentNodes],
            links: commentLinks
        };
    }
    
    // Reactive declarations
    $: isReady = authInitialized && dataInitialized && !!centralNode;
    $: graphData = isReady ? createGraphData() : { nodes: [], links: [] };
    $: commentCount = $discussionStore.comments ? $discussionStore.comments.length : 0;
    
    // Initialize on mount
    onMount(() => {
        initializeData();
    });
    
    // Clean up on destroy
    onDestroy(() => {
        discussionStore.reset();
    });
    
    // Force update when discussion store changes
    $: if ($discussionStore && isReady) {
        routeKey = `${viewType}-${nodeType}-${nodeId}-${Date.now()}`;
    }
</script>

{#if isLoading}
    <div class="loading-container">
        <div class="loading-spinner" />
        <span class="loading-text">Loading discussion...</span>
    </div>
{:else if error}
    <div class="error-container">
        <div class="error-message">{error}</div>
        <button class="back-button" on:click={() => goto('/graph/dashboard')}>
            Return to Dashboard
        </button>
    </div>
{:else if !$userStore}
    <div class="loading-container">
        <div class="loading-text">Authentication required</div>
    </div>
{:else if !centralNode}
    <div class="loading-container">
        <div class="loading-text">Node data not found</div>
    </div>
{:else}
    <!-- Discussion controls -->
    <div class="discussion-controls">
        <div class="discussion-header">
            <h2>Discussion: {centralNode.word || centralNode.statement || centralNode.question || 'Node'}</h2>
            <span class="comment-count">{commentCount} {commentCount === 1 ? 'comment' : 'comments'}</span>
        </div>
        
        <div class="discussion-actions">
            <div class="sort-controls">
                <span>Sort by:</span>
                <button 
                    class="sort-button" 
                    class:active={sortMode === 'popularity'}
                    on:click={() => handleSortChange('popularity')}
                >
                    Popular
                </button>
                <button 
                    class="sort-button" 
                    class:active={sortMode === 'newest'}
                    on:click={() => handleSortChange('newest')}
                >
                    Newest
                </button>
                <button 
                    class="sort-button" 
                    class:active={sortMode === 'oldest'}
                    on:click={() => handleSortChange('oldest')}
                >
                    Oldest
                </button>
            </div>
            
            <button class="add-comment-button" on:click={handleAddRootComment}>
                Add Comment
            </button>
        </div>
    </div>

    {#key routeKey}
    <Graph 
        data={graphData}
        viewType={viewType}
        on:modechange={handleNodeModeChange}
        on:visibilitychange={handleVisibilityChange}
    >
        <svelte:fragment slot="default" let:node let:handleModeChange>
            {#if isWordNode(node)}
                <WordNode 
                    {node}
                    wordText={centralNode.word}
                    on:modeChange={handleModeChange}
                />
            {:else if isDefinitionNode(node)}
                <DefinitionNode 
                    {node}
                    wordText={centralNode.word || ''}
                    on:modeChange={handleModeChange}
                />
            {:else if isStatementNode(node)}
                <StatementNode 
                    {node}
                    on:modeChange={handleModeChange}
                />
            {:else if isQuantityNode(node)}
                <QuantityNode 
                    {node}
                    on:modeChange={handleModeChange}
                />
            {:else if isNavigationNode(node)}
                <NavigationNode 
                    {node}
                    on:hover={() => {}} 
                />
            {:else if node.type === 'comment'}
                <CommentNode 
                    {node}
                    isReply={!!node.metadata?.parentCommentId}
                    on:modeChange={handleModeChange}
                    on:reply={handleReply}
                    on:edit={handleEditComment}
                    on:delete={handleDeleteComment}
                />
            {:else if node.type === 'comment-form'}
                <CommentFormNode 
                    {node}
                    parentCommentId={node.metadata?.parentCommentId || null}
                    isReply={!!node.metadata?.parentCommentId}
                    on:submit={handleCommentSubmit}
                    on:cancel={handleCommentCancel}
                />
            {:else}
                <!-- Fallback for unrecognized node types -->
                <g>
                    <text 
                        dy="-10" 
                        class="error-text"
                    >
                        Unknown node type: {node.type}
                    </text>
                </g>
            {/if}
        </svelte:fragment>
    </Graph>
    {/key}
{/if}

<style>
    :global(html, body) {
        height: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: black;
    }

    .loading-container, .error-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: black;
        color: rgba(255, 255, 255, 0.8);
        gap: 1rem;
    }

    .loading-spinner {
        width: 650px;
        height: 650px;
        border: 3px solid rgba(255, 255, 255, 0.1);
        border-top-color: rgba(255, 255, 255, 0.8);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    .loading-text, .error-message {
        font-family: 'Orbitron', sans-serif;
        font-size: 1.2rem;
    }
    
    .error-message {
        color: rgba(231, 76, 60, 0.9);
        margin-bottom: 2rem;
    }
    
    .back-button {
        padding: 0.75rem 1.5rem;
        background-color: rgba(52, 152, 219, 0.2);
        border: 1px solid rgba(52, 152, 219, 0.4);
        border-radius: 4px;
        color: white;
        font-family: 'Orbitron', sans-serif;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .back-button:hover {
        background-color: rgba(52, 152, 219, 0.3);
        transform: translateY(-2px);
    }

    /* Add styling for the error text via CSS instead of inline attributes */
    :global(.error-text) {
        fill: red;
        font-size: 14px;
        text-anchor: middle;
    }
    
    /* Discussion controls styling */
    .discussion-controls {
        position: absolute;
        top: 1rem;
        left: 1rem;
        right: 1rem;
        display: flex;
        flex-direction: column;
        background-color: rgba(0, 0, 0, 0.6);
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        padding: 1rem;
        z-index: 100;
        color: white;
        font-family: 'Orbitron', sans-serif;
    }
    
    .discussion-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
    }
    
    .discussion-header h2 {
        margin: 0;
        font-size: 1.2rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 70%;
    }
    
    .comment-count {
        font-size: 0.9rem;
        color: rgba(255, 255, 255, 0.6);
    }
    
    .discussion-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .sort-controls {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.9rem;
    }
    
    .sort-button {
        background-color: transparent;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        color: rgba(255, 255, 255, 0.8);
        font-family: 'Orbitron', sans-serif;
        font-size: 0.8rem;
        padding: 0.25rem 0.5rem;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .sort-button:hover {
        background-color: rgba(255, 255, 255, 0.1);
    }
    
    .sort-button.active {
        background-color: rgba(52, 152, 219, 0.2);
        border-color: rgba(52, 152, 219, 0.4);
        color: rgba(52, 152, 219, 0.9);
    }
    
    .add-comment-button {
        background-color: rgba(46, 204, 113, 0.2);
        border: 1px solid rgba(46, 204, 113, 0.4);
        border-radius: 4px;
        color: white;
        font-family: 'Orbitron', sans-serif;
        font-size: 0.9rem;
        padding: 0.5rem 1rem;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .add-comment-button:hover {
        background-color: rgba(46, 204, 113, 0.3);
        transform: translateY(-1px);
    }
    
    .add-comment-button:active {
        transform: translateY(0);
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>