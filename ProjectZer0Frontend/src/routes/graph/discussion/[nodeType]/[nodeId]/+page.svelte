<!-- src/routes/graph/discussion/[nodeType]/[nodeId]/+page.svelte -->
<script lang="ts">
    import { onMount, onDestroy, afterUpdate } from 'svelte';
    import * as auth0 from '$lib/services/auth0';
    import Graph from '$lib/components/graph/Graph.svelte';
    import WordNode from '$lib/components/graph/nodes/word/WordNode.svelte';
    import DefinitionNode from '$lib/components/graph/nodes/definition/DefinitionNode.svelte';
    import StatementNode from '$lib/components/graph/nodes/statement/StatementNode.svelte';
    import QuantityNode from '$lib/components/graph/nodes/quantity/QuantityNode.svelte';
    import NavigationNode from '$lib/components/graph/nodes/navigation/NavigationNode.svelte';
    import CommentNode from '$lib/components/graph/nodes/comment/CommentNode.svelte';
    import CommentFormNode from '$lib/components/graph/nodes/comment/CommentForm.svelte';
    import { 
        getNavigationOptions, 
        NavigationContext, 
        getNodeDataEndpoint 
    } from '$lib/services/navigation';
    import { userStore } from '$lib/stores/userStore';
    import { discussionStore, type CommentSortMode } from '$lib/stores/discussionStore';
    import { graphStore } from '$lib/stores/graphStore';
    import { visibilityStore } from '$lib/stores/visibilityPreferenceStore';
    import { discussionService } from '$lib/services/discussionService';
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
    
    // For word nodes, nodeId might be the word text
    $: nodeText = nodeType === 'word' ? nodeId : undefined;
    
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
    let graphData: GraphData = { nodes: [], links: [] }; // Properly declared
    
    // Reference to Graph component for direct method calls
    let graphComponent: any;
    
    // Create a unique key for forcing re-renders
    let routeKey = `${viewType}-${nodeType}-${nodeId}-${Date.now()}`;
    
    // Store last created graph data
    let lastGraphData: GraphData | null = null;
    
    // Initialize data and authenticate user
    async function initializeData() {
        console.log('[STATE_DEBUG] Starting data initialization...');
        try {
            await auth0.handleAuthCallback();
            const fetchedUser = await auth0.getAuth0User();
            
            if (!fetchedUser) {
                console.log('[STATE_DEBUG] No user found, redirecting to login');
                auth0.login();
                return;
            }
            
            authInitialized = true;
            userStore.set(fetchedUser);
            console.log('[STATE_DEBUG] User authenticated:', fetchedUser.sub);
            
            // Validate parameters
            if (!nodeType || !nodeId) {
                error = 'Invalid node type or ID';
                isLoading = false;
                console.error('[STATE_DEBUG] Missing node type or ID:', { nodeType, nodeId });
                return;
            }
            
            console.log(`[STATE_DEBUG] Loading discussion for ${nodeType}/${nodeId}`);
            
            // For word nodes, we need to handle them differently
            if (nodeType === 'word') {
                try {
                    console.log('[STATE_DEBUG] Handling word node, fetching all words first');
                    // First get all words to find the one with matching ID
                    const allWords = await fetchWithAuth('/nodes/word/all');
                    console.log('[STATE_DEBUG] Fetched all words, count:', allWords?.length);
                    
                    if (Array.isArray(allWords)) {
                        const wordData = allWords.find(word => word.id === nodeId);
                        if (wordData) {
                            console.log('[STATE_DEBUG] Found matching word:', wordData.word);
                            // Now we have the word text, fetch the full word data
                            const fullWordData = await fetchWithAuth(`/nodes/word/${wordData.word}`);
                            console.log('[STATE_DEBUG] Fetched full word data:', fullWordData?.id);
                            
                            if (fullWordData) {
                                centralNode = fullWordData;
                                nodeText = wordData.word; // Set nodeText for API calls
                                
                                // Load discussion using the word text
                                console.log(`[STATE_DEBUG] Loading discussion for word: ${nodeText}`);
                                await discussionStore.loadDiscussion(nodeType, nodeId, sortMode, nodeText);
                                console.log('[STATE_DEBUG] Discussion loaded, comments:', $discussionStore.comments?.length);
                                dataInitialized = true;
                            } else {
                                throw new Error(`Full word data not found for: ${wordData.word}`);
                            }
                        } else {
                            throw new Error(`Word with ID ${nodeId} not found`);
                        }
                    } else {
                        throw new Error('Failed to fetch word list');
                    }
                } catch (wordError) {
                    if (wordError instanceof Error) {
                        console.error(`[STATE_DEBUG] Error processing word node: ${wordError.message}`);
                    } else {
                        console.error('[STATE_DEBUG] Error processing word node:', wordError);
                    }
                    throw new Error(`Failed to process word node: ${wordError instanceof Error ? wordError.message : String(wordError)}`);
                }
            } else {
                // For other node types, proceed normally
                console.log(`[STATE_DEBUG] Loading discussion for ${nodeType}/${nodeId} directly`);
                // Load discussion and comments
                await discussionStore.loadDiscussion(nodeType, nodeId, sortMode, nodeText);
                console.log('[STATE_DEBUG] Discussion loaded, comments:', $discussionStore.comments?.length);
                
                // Fetch the central node data
                console.log(`[STATE_DEBUG] Fetching central node data for ${nodeType}/${nodeId}`);
                centralNode = await discussionService.getNodeData(nodeType, nodeId, nodeText);
                console.log('[STATE_DEBUG] Central node data fetched:', centralNode?.id);
                
                if (!centralNode) {
                    throw new Error(`No ${nodeType} data returned from API`);
                }
                
                dataInitialized = true;
            }
            
            // Load visibility preferences
            console.log('[STATE_DEBUG] Loading visibility preferences');
            await visibilityStore.loadPreferences();
            
            isLoading = false;
            
            // Set the correct view type in graph store and force update
            if (graphStore) {
                console.log('[STATE_DEBUG] Setting graph store view type to:', viewType);
                graphStore.setViewType(viewType);
                graphStore.forceTick();
            }
            
            console.log('[STATE_DEBUG] Data initialization complete');
        } catch (err) {
            console.error('[STATE_DEBUG] Error initializing discussion view:', err);
            error = err instanceof Error ? err.message : 'An error occurred';
            isLoading = false;
        }
    }
    
    // Debug state function
    function debugState() {
        console.log('[STATE_DEBUG] Debug info:', {
            graphStoreState: graphStore ? graphStore.getState() : 'not available',
            storeId: (graphStore as any).getStoreId?.(),
            discussionStore: $discussionStore,
            lastGraphData: lastGraphData
        });
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
        console.log('[STATE_DEBUG] Sort mode changed to:', mode);
        sortMode = mode;
        discussionStore.setSortMode(mode);
        // Force re-render with new key
        routeKey = `${viewType}-${nodeType}-${nodeId}-${sortMode}-${Date.now()}`;
    }
    
    function handleAddRootComment() {
        console.log('[STATE_DEBUG] Add root comment button clicked');
        isAddingRootComment = true;
    }
    
    function handleReply(event: CustomEvent<{ commentId: string }>) {
        const commentId = event.detail.commentId;
        console.log('[STATE_DEBUG] Reply event triggered for comment:', commentId);
        
        // Clear any existing forms first - this is critical for consistency
        isAddingRootComment = false; // Always reset this flag first
        discussionStore.cancelAddingComment(); // Cancel any existing reply forms
        
        // Check if this is the central node
        if (commentId === centralNode?.id) {
            console.log('[STATE_DEBUG] This is a reply to the central node');
            
            // Set flag to create a root comment form
            isAddingRootComment = true;
        } else {
            // For regular comments, start a reply
            discussionStore.startReply(commentId);
        }
        
        // Force graph data update with new form
        console.log('[STATE_DEBUG] Updating graph data for comment form');
        graphData = createGraphData();
        
        // Center on the new form after a short delay
        setTimeout(() => {
            if (!graphComponent) {
                console.log('[STATE_DEBUG] No graphComponent available');
                return;
            }
            
            // For central node (root comment)
            if (commentId === centralNode?.id) {
                const rootFormNodes = graphData.nodes.filter(n => 
                    n.type === 'comment-form' && 
                    !n.metadata?.parentCommentId
                );
                
                if (rootFormNodes.length > 0) {
                    const formNode = rootFormNodes[0];
                    console.log('[STATE_DEBUG] Found root form node in graphData:', formNode.id);
                    
                    // Center on it if possible
                    if (typeof graphComponent.centerOnNodeById === 'function') {
                        graphComponent.centerOnNodeById(formNode.id);
                    } else if (graphComponent.centerViewportOnCoordinates && (formNode as any).position) {
                        const position = (formNode as any).position;
                        graphComponent.centerViewportOnCoordinates(position.x, position.y);
                    }
                }
            } 
            // For regular comments
            else {
                // Try to find the form node
                if (typeof graphComponent.findFormNodeByParentId === 'function') {
                    const formNode = graphComponent.findFormNodeByParentId(commentId);
                    
                    if (formNode && formNode.position) {
                        console.log('[STATE_DEBUG] Found form node via Graph component:', {
                            id: formNode.id,
                            position: formNode.position
                        });
                        
                        // Center on the form node
                        if (typeof graphComponent.centerViewportOnCoordinates === 'function') {
                            graphComponent.centerViewportOnCoordinates(
                                formNode.position.x,
                                formNode.position.y
                            );
                        }
                    }
                }
            }
        }, 300);
    }

    async function handleCommentSubmit(event: CustomEvent<{ text: string; parentId: string | null }>) {
        const { text, parentId } = event.detail;
        console.log('[STATE_DEBUG] Comment submit event:', { text, parentId });
        
        try {
            // Show loading indicator
            isLoading = true;
            
            // Pass nodeText for word nodes and convert null to undefined if needed
            const newComment = await discussionStore.addComment(
                nodeType, 
                nodeId, 
                text, 
                parentId !== null ? parentId : undefined,
                nodeText
            );
            
            if (newComment) {
                console.log('[STATE_DEBUG] Comment added successfully:', newComment.id);
                // Reset state
                isAddingRootComment = false;
                
                // Force graph data update to show the new comment
                graphData = createGraphData();
                
                // Center the view on the new comment after a short delay
                setTimeout(() => {
                    if (graphComponent && typeof graphComponent.centerOnNodeById === 'function') {
                        graphComponent.centerOnNodeById(newComment.id);
                    }
                }, 300);
            }
        } catch (err) {
            console.error('[STATE_DEBUG] Error adding comment:', err);
            // Show error message to user
            // You could add an error toast/notification here
        } finally {
            isLoading = false;
        }
    }
    
    function handleCommentCancel() {
        console.log('[STATE_DEBUG] Comment cancelled');
        isAddingRootComment = false;
        discussionStore.cancelAddingComment();
    }
    
    function handleEditComment(event: CustomEvent<{ commentId: string; text: string }>) {
        console.log('[STATE_DEBUG] Edit comment event:', event.detail);
        // TODO: Implement comment editing
    }
    
    function handleDeleteComment(event: CustomEvent<{ commentId: string }>) {
        console.log('[STATE_DEBUG] Delete comment event:', event.detail);
        // TODO: Implement comment deletion
    }
        
    function createGraphData(): GraphData {
        console.log('[STATE_DEBUG] Creating graph data, central node:', centralNode?.id);
        if (!centralNode) {
            return { nodes: [], links: [] };
        }
        
        // Create a helper function to generate a form node
        function createCommentFormNode(parentId: string | null): GraphNode {
            // Generate a unique ID
            const timestamp = Date.now();
            const formId = parentId 
                ? `comment-form-reply-${parentId}-${timestamp}`
                : `comment-form-root-${timestamp}`;
            
            // Create form data with consistent structure
            const formData: CommentFormData = {
                id: formId,
                parentCommentId: parentId,  // CommentFormData accepts null
                sub: `form-${timestamp}`,
                label: parentId ? 'Reply' : 'Comment',
                word: ''
            };
            
            // Create metadata with explicit parentCommentId
            const metadata: NodeMetadata = { 
                group: 'comment-form' as NodeMetadata['group'],
                parentCommentId: parentId || undefined
            };
            
            // Create comment form node with consistent structure
            const formNode = {
                id: formId,
                type: 'comment-form' as NodeType,
                data: formData as any, // Type assertion
                group: 'comment-form' as NodeGroup,
                mode: 'detail' as NodeMode,
                metadata: metadata
            };
            
            return formNode;
        }
        
        // Get navigation options for discussion context
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
            mode: 'preview' as NodeMode
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
        console.log('[STATE_DEBUG] Comments from store, total count:', comments.length);
        
        // Build a map of comment IDs for fast lookup and validation
        const commentIdMap = new Map<string, boolean>();
        comments.forEach(comment => {
            commentIdMap.set(comment.id, true);
        });
        
        // First, create all comment nodes with complete metadata
        comments.forEach(comment => {
            // Create complete metadata for the comment node
            const commentMetadata: NodeMetadata = {
                group: 'comment' as NodeMetadata['group'],
                parentCommentId: comment.parentCommentId,
                votes: comment.positiveVotes - comment.negativeVotes,
                createdAt: typeof comment.createdAt === 'string' ? comment.createdAt : undefined,
                depth: comment.depth || 0,
                isExpanded: comment.isExpanded || false
            };
            
            // Create comment node with explicit copying of parentCommentId
            const commentNode: GraphNode = {
                id: comment.id,
                type: 'comment' as NodeType,
                data: {
                    ...comment,
                    // Ensure parentCommentId is explicitly copied to the data
                    parentCommentId: comment.parentCommentId
                } as unknown as CommentNodeType,
                group: 'comment' as NodeGroup,
                mode: 'preview' as NodeMode,
                metadata: commentMetadata
            };
            
            commentNodes.push(commentNode);
        });
        
        // CRITICAL: Create links in a separate pass to ensure all nodes exist first
        comments.forEach(comment => {
            if (comment.parentCommentId) {
                // Check if the parent comment actually exists in our current set
                const parentExists = commentIdMap.has(comment.parentCommentId);
                
                if (parentExists) {
                    // This is a reply - link to the parent comment
                    commentLinks.push({
                        id: `reply-${comment.parentCommentId}-${comment.id}`,
                        source: comment.parentCommentId,
                        target: comment.id,
                        type: 'reply' as LinkType,
                        // Add metadata to help debugging and ensure type integrity
                        metadata: {
                            linkType: 'reply',
                            parentId: comment.parentCommentId,
                            childId: comment.id
                        }
                    });
                } else {
                    // Fallback: Parent doesn't exist in the current set, link to central node
                    console.warn(`[STATE_DEBUG] Parent ${comment.parentCommentId} not found for comment ${comment.id}, linking to central node instead`);
                    commentLinks.push({
                        id: `comment-fallback-${centralNode.id}-${comment.id}`,
                        source: centralNode.id,
                        target: comment.id,
                        type: 'comment' as LinkType,
                        metadata: {
                            linkType: 'comment-fallback',
                            originalParentId: comment.parentCommentId
                        }
                    });
                }
            } else {
                // This is a root comment - link to the central node
                commentLinks.push({
                    id: `comment-${centralNode.id}-${comment.id}`,
                    source: centralNode.id,
                    target: comment.id,
                    type: 'comment' as LinkType,
                    metadata: {
                        linkType: 'root-comment'
                    }
                });
            }
        });
        
        // We can only have one comment form at a time
        // Either a root comment form or a reply form, not both
        if (isAddingRootComment) {
            console.log('[STATE_DEBUG] Creating root comment form');
            const formNode = createCommentFormNode(null);
            commentNodes.push(formNode);
            
            // Link to central node
            commentLinks.push({
                id: `form-link-${centralNode.id}-${formNode.id}`,
                source: centralNode.id,
                target: formNode.id,
                type: 'comment-form' as LinkType
            });
            
            console.log('[STATE_DEBUG] Added root comment form:', formNode.id);
        } 
        // Only add a reply form if we're not adding a root comment
        else if ($discussionStore.isAddingReply && $discussionStore.replyToCommentId) {
            const parentId = $discussionStore.replyToCommentId;
            
            // Verify parent exists
            if (commentIdMap.has(parentId)) {
                const formNode = createCommentFormNode(parentId);
                commentNodes.push(formNode);
                
                // Link to parent comment
                commentLinks.push({
                    id: `form-link-${parentId}-${formNode.id}`,
                    source: parentId,
                    target: formNode.id,
                    type: 'reply-form' as LinkType,
                    metadata: {
                        parentId
                    }
                });
                
                console.log('[STATE_DEBUG] Added reply form for comment:', parentId, 'form ID:', formNode.id);
            } else {
                console.error('[STATE_DEBUG] Cannot add reply form - parent not found:', parentId);
            }
        }
        
        const finalData = {
            nodes: [...baseNodes, ...commentNodes],
            links: commentLinks
        };
        
        console.log('[STATE_DEBUG] Final graph data created:', {
            nodeCount: finalData.nodes.length,
            linkCount: finalData.links.length,
            commentNodeCount: commentNodes.length,
            rootCommentCount: commentLinks.filter(l => l.type === 'comment').length,
            replyLinkCount: commentLinks.filter(l => l.type === 'reply').length,
            formNodeCount: finalData.nodes.filter(n => n.type === 'comment-form').length
        });
        
        return finalData;
    }
    
    // ADDED: Validation function for comment hierarchy
    function validateCommentHierarchy(data: GraphData): void {
        // Get all comment nodes
        const commentNodes = data.nodes.filter(n => n.type === 'comment');
        
        // Get all links
        const links = data.links;
        
        // Count link types
        const replyLinks = links.filter(l => l.type === 'reply');
        const commentLinks = links.filter(l => l.type === 'comment');
        const formLinks = links.filter(l => l.type === 'comment-form' || l.type === 'reply-form');
        
        // Verify each comment has exactly one incoming link
        const incomingLinkMap = new Map<string, GraphLink[]>();
        links.forEach(link => {
            const targetId = typeof link.target === 'string' ? link.target : link.target.id;
            if (!incomingLinkMap.has(targetId)) {
                incomingLinkMap.set(targetId, []);
            }
            incomingLinkMap.get(targetId)?.push(link);
        });
        
        // Check for comments with incorrect link counts
        let commentsWithNoLinks = 0;
        let commentsWithMultipleLinks = 0;
        
        commentNodes.forEach(node => {
            const incomingLinks = incomingLinkMap.get(node.id) || [];
            if (incomingLinks.length === 0) {
                commentsWithNoLinks++;
            } else if (incomingLinks.length > 1) {
                commentsWithMultipleLinks++;
            }
        });
        
        if (commentsWithNoLinks > 0 || commentsWithMultipleLinks > 0) {
            console.warn(`[STATE_DEBUG] Links validation: ${commentsWithNoLinks} comments with no links, ${commentsWithMultipleLinks} with multiple links`);
        }
    }
    
    // Reactive declarations
    $: isReady = authInitialized && dataInitialized && !!centralNode;
    
    // Create graph data reactively
    $: {
        if (isReady) {
            console.log('[STATE_DEBUG] Creating new graph data reactively');
            lastGraphData = createGraphData();
            graphData = lastGraphData;
            console.log('[STATE_DEBUG] New graph data created reactively, node count:', graphData.nodes.length);
        } else {
            graphData = { nodes: [], links: [] };
        }
    }
    
    $: commentCount = $discussionStore.comments ? $discussionStore.comments.length : 0;
    
    // Initialize on mount
    onMount(() => {
        console.log('[STATE_DEBUG] Component mounted');
        initializeData();
    });
    
    // After updates
    afterUpdate(() => {
        console.log('[STATE_DEBUG] Component updated, isReady:', isReady);
        if (isReady) {
            console.log('[STATE_DEBUG] Ready state - Comment count:', commentCount, 
                        'Graph store ID:', (graphStore as any).getStoreId?.());
        }
    });
    
    // Clean up on destroy
    onDestroy(() => {
        console.log('[STATE_DEBUG] Component being destroyed, cleaning up');
        discussionStore.reset();
    });
    
    // Force update when discussion store changes
    $: if ($discussionStore && isReady) {
        console.log('[STATE_DEBUG] Discussion store updated, triggering reactive update');
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

    <!-- Debug Panel -->
    <div class="debug-panel">
        <button class="debug-button" on:click={debugState}>
            Debug State
        </button>
    </div>

    <Graph 
    bind:this={graphComponent}
    data={graphData}
    viewType={viewType}
    on:modechange={handleNodeModeChange}
    on:visibilitychange={handleVisibilityChange}
    on:reply={handleReply} 
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

    /* Debug panel styling */
    .debug-panel {
        position: absolute;
        top: 5rem;
        right: 1rem;
        z-index: 1000;
    }

    .debug-button {
        background-color: rgba(0, 0, 0, 0.6);
        color: white;
        border: 1px solid rgba(52, 152, 219, 0.6);
        border-radius: 4px;
        padding: 0.5rem;
        font-family: 'Orbitron', sans-serif;
        font-size: 0.8rem;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .debug-button:hover {
        background-color: rgba(0, 0, 0, 0.8);
        transform: translateY(-1px);
        border-color: rgba(52, 152, 219, 0.8);
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>