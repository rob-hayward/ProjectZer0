<!-- src/routes/graph/discussion/[nodeType]/[nodeId]/+page.svelte -->
<script lang="ts">
    import { onMount, onDestroy, afterUpdate } from 'svelte';
    import * as auth0 from '$lib/services/auth0';
    import Graph from '$lib/components/graph/Graph.svelte';
    import WordNode from '$lib/components/graph/nodes/word/WordNode.svelte';
    import DefinitionNode from '$lib/components/graph/nodes/definition/DefinitionNode.svelte';
    import StatementNode from '$lib/components/graph/nodes/statement/StatementNode.svelte';
    import QuantityNode from '$lib/components/graph/nodes/quantity/QuantityNode.svelte';
    import OpenQuestionNode from '$lib/components/graph/nodes/openquestion/OpenQuestionNode.svelte'; // ADDED
    import NavigationNode from '$lib/components/graph/nodes/navigation/NavigationNode.svelte';
    import CommentNode from '$lib/components/graph/nodes/comment/CommentNode.svelte';
    import CommentFormNode from '$lib/components/forms/comment/CommentForm.svelte';
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
        isOpenQuestionNode, // ADDED
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

    // CRITICAL FIX: Enhanced comment submit handler with proper parent ID handling
    async function handleCommentSubmit(event: CustomEvent<{ text: string; parentId: string | null }>) {
        const { text, parentId } = event.detail;
        console.log('[STATE_DEBUG] Comment submit event:', { 
            text: text.substring(0, 50) + '...', 
            parentId, 
            parentIdType: typeof parentId 
        });
        
        try {
            // Show loading indicator
            isLoading = true;
            
            // CRITICAL FIX: Convert null to undefined for the API call, but preserve the actual value
            // The discussionService expects undefined, not null
            const parentIdForApi = parentId === null ? undefined : parentId;
            
            console.log('[STATE_DEBUG] Calling discussionStore.addComment with:', {
                nodeType,
                nodeId,
                parentIdForApi,
                nodeText
            });
            
            // Pass nodeText for word nodes and convert null to undefined for API compatibility
            const newComment = await discussionStore.addComment(
                nodeType, 
                nodeId, 
                text, 
                parentIdForApi, // Convert null -> undefined for API
                nodeText
            );
            
            if (newComment) {
                console.log('[STATE_DEBUG] Comment added successfully:', {
                    commentId: newComment.id,
                    parentCommentId: newComment.parentCommentId,
                    expectedParent: parentId
                });
                
                // Reset state
                isAddingRootComment = false;
                
                // Force graph data update to show the new comment
                console.log('[STATE_DEBUG] Forcing graph data update after comment creation');
                graphData = createGraphData();
                
                // Center the view on the new comment after a short delay
                setTimeout(() => {
                    if (graphComponent && typeof graphComponent.centerOnNodeById === 'function') {
                        console.log('[STATE_DEBUG] Centering on new comment:', newComment.id);
                        graphComponent.centerOnNodeById(newComment.id);
                    }
                }, 300);
            } else {
                console.error('[STATE_DEBUG] Comment creation returned null');
            }
        } catch (err) {
            console.error('[STATE_DEBUG] Error adding comment:', err);
            // You could add an error toast/notification here
            error = err instanceof Error ? err.message : 'Failed to add comment';
        } finally {
            isLoading = false;
        }
    }

// CRITICAL FIX: Enhanced graph data creation with explicit comment node sizing
    function createGraphData(): GraphData {
        console.log('[STATE_DEBUG] Creating graph data, central node:', centralNode?.id);
        if (!centralNode) {
            return { nodes: [], links: [] };
        }
        
        // CRITICAL FIX: Define constants for comment node radius
        const COMMENT_RADIUS = 90; // Standard 90px radius for visible comments
        const HIDDEN_RADIUS = 50;  // Standard 50px radius for hidden nodes
        
       // CRITICAL FIX: Enhanced form node creation with better parent ID extraction
        function createCommentFormNode(parentId: string | null): GraphNode {
            // Generate a unique ID
            const timestamp = Date.now();
            const formId = parentId 
                ? `comment-form-reply-${parentId}-${timestamp}`
                : `comment-form-root-${timestamp}`;
            
            console.log('[STATE_DEBUG] Creating comment form node:', {
                formId,
                parentId,
                isReply: !!parentId
            });
            
            // CRITICAL: Create form data with explicit parentCommentId handling
            const formData: CommentFormData = {
                id: formId,
                parentCommentId: parentId, // Keep as null for type compatibility
                sub: `form-${timestamp}`,
                label: parentId ? 'Reply' : 'Comment',
                word: ''
            };
            
            // CRITICAL: Create metadata with explicit parentCommentId
            const metadata: NodeMetadata = { 
                group: 'comment-form' as NodeMetadata['group'],
                parentCommentId: parentId || undefined // Convert null to undefined for metadata
            };
            
            // Create comment form node with all parent ID sources
            // FIX: Use type assertion to avoid TypeScript errors
            const formNode = {
                id: formId,
                type: 'comment-form' as NodeType,
                data: formData,
                group: 'comment-form' as NodeGroup,
                mode: 'preview' as NodeMode,
                metadata: metadata
            } as GraphNode;
            
            // CRITICAL FIX: Set radius as a property after creation to avoid type errors
            (formNode as any).radius = COMMENT_RADIUS;
            
            console.log('[STATE_DEBUG] Created form node:', {
                id: formNode.id,
                dataParentId: formData.parentCommentId,
                metadataParentId: metadata.parentCommentId,
                radius: (formNode as any).radius
            });
            
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
        
        // CRITICAL FIX: First, create all comment nodes with complete metadata and EXPLICIT radius
        comments.forEach(comment => {
            // CRITICAL FIX: Get visibility preference for this comment and set radius accordingly
            const netVotes = comment.positiveVotes - comment.negativeVotes;
            const isHidden = !visibilityStore.getPreference(comment.id);
            const commentRadius = isHidden ? HIDDEN_RADIUS : COMMENT_RADIUS;
            
            // CRITICAL: Properly handle parent-child metadata
            const commentMetadata: NodeMetadata = {
                group: 'comment' as NodeMetadata['group'],
                parentCommentId: comment.parentCommentId, // Keep original value
                votes: netVotes,
                createdAt: typeof comment.createdAt === 'string' ? comment.createdAt : undefined,
                depth: comment.depth || 0,
                isExpanded: comment.isExpanded || false
            };
            
            // CRITICAL: Create comment node with explicit parent ID preservation
            // FIX: Create without radius first, then add it to avoid type errors
            const commentNode = {
                id: comment.id,
                type: 'comment' as NodeType,
                data: {
                    ...comment,
                    // CRITICAL: Ensure parentCommentId is explicitly copied to the data
                    parentCommentId: comment.parentCommentId
                } as unknown as CommentNodeType,
                group: 'comment' as NodeGroup,
                mode: 'preview' as NodeMode, // CRITICAL: Always set mode to preview
                metadata: commentMetadata
            } as GraphNode;
            
            // FIX: Add radius property after creation to avoid type errors
            (commentNode as any).radius = commentRadius;
            
            console.log(`[STATE_DEBUG] Created comment node ${comment.id} with radius ${commentRadius} (${isHidden ? 'hidden' : 'visible'})`);
            commentNodes.push(commentNode);
        });
        
        // CRITICAL: Create links with proper parent-child relationship handling
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
                        metadata: {
                            linkType: 'reply',
                            parentId: comment.parentCommentId,
                            childId: comment.id
                        }
                    });
                    
                    console.log('[STATE_DEBUG] Created reply link:', {
                        from: comment.parentCommentId,
                        to: comment.id,
                        type: 'reply'
                    });
                } else {
                    // Fallback: Parent doesn't exist, link to central node
                    console.warn(`[STATE_DEBUG] Parent ${comment.parentCommentId} not found for comment ${comment.id}, linking to central node`);
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
                
                console.log('[STATE_DEBUG] Created root comment link:', {
                    from: centralNode.id,
                    to: comment.id,
                    type: 'comment'
                });
            }
        });
        
        // CRITICAL FIX: Handle comment forms with proper parent ID tracking
        // We can only have one comment form at a time
        if (isAddingRootComment) {
            console.log('[STATE_DEBUG] Creating root comment form');
            const formNode = createCommentFormNode(null);
            commentNodes.push(formNode);
            
            // Link to central node
            commentLinks.push({
                id: `form-link-${centralNode.id}-${formNode.id}`,
                source: centralNode.id,
                target: formNode.id,
                type: 'comment-form' as LinkType,
                metadata: {
                    linkType: 'root-comment-form'
                }
            });
            
            console.log('[STATE_DEBUG] Added root comment form:', formNode.id);
        } 
        // Only add a reply form if we're not adding a root comment
        else if ($discussionStore.isAddingReply && $discussionStore.replyToCommentId) {
            const parentId = $discussionStore.replyToCommentId;
            
            console.log('[STATE_DEBUG] Creating reply form for parent:', parentId);
            
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
                        linkType: 'reply-form',
                        parentId
                    }
                });
                
                console.log('[STATE_DEBUG] Added reply form:', {
                    formId: formNode.id,
                    parentId: parentId,
                    linkCreated: true
                });
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

    // ADDED: Event handler for answer question events
    function handleAnswerQuestion(event: CustomEvent<{ questionId: string }>) {
        console.log('Answer question event received:', event.detail.questionId);
        // TODO: Navigate to create statement form with this question as parent
        // For now, we'll just log it
        alert('Answer question functionality coming soon!');
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
            {:else if isOpenQuestionNode(node)}
                <OpenQuestionNode 
                    {node}
                    questionText={centralNode.questionText || ''}
                    on:modeChange={handleModeChange}
                    on:answerQuestion={handleAnswerQuestion}
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

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>