<!-- src/routes/graph/universal/+page.svelte - PHASE 2.1: Sequential Batch Rendering -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import * as auth0 from '$lib/services/auth0';
    import Graph from '$lib/components/graph/Graph.svelte';
    import NavigationNode from '$lib/components/graph/nodes/navigation/NavigationNode.svelte';
    import ControlNode from '$lib/components/graph/nodes/controlNode/ControlNode.svelte';
    import StatementNode from '$lib/components/graph/nodes/statement/StatementNode.svelte';
    import OpenQuestionNode from '$lib/components/graph/nodes/openquestion/OpenQuestionNode.svelte';
    import { getNavigationOptions, NavigationContext } from '$lib/services/navigation';
    import { userStore } from '$lib/stores/userStore';
    
    // ENHANCED: Import optimized graph store factory
    import { createOptimizedGraphStore } from '$lib/stores/graphStore';
    import { universalGraphStore, type UniversalSortType, type UniversalSortDirection } from '$lib/stores/universalGraphStore';
    import { graphFilterStore, type FilterOperator } from '$lib/stores/graphFilterStore';
    import { visibilityStore } from '$lib/stores/visibilityPreferenceStore';
    import { wordListStore } from '$lib/stores/wordListStore';
    import { fetchWithAuth } from '$lib/services/api';
    
    import type { 
        GraphData, 
        GraphNode, 
        GraphLink,
        GraphPageData,
        RenderableNode,
        NodeType,
        NodeGroup,
        NodeMode,
        ViewType,
        LinkType
    } from '$lib/types/graph/enhanced';
    import { 
        isStatementNode,
        isOpenQuestionNode,
        isNavigationNode,
        isStatementData,
        isOpenQuestionData,
    } from '$lib/types/graph/enhanced';
    import type { NavigationOption } from '$lib/types/domain/navigation';

    // Define view type
    const viewType: ViewType = 'universal';
    
    // Control node settings
    const controlNodeId = 'universal-graph-controls';
    let controlNodeMode: NodeMode = 'detail'; 
    
    // PHASE 2.1: Sequential batch rendering settings
    let enableBatchRendering = true; // Enable by default
    let enableSequentialRendering = true; // NEW: Enable sequential rendering
    const maxBatchesToRender = 2; // HARDCODED: Render 2 batches of 10 nodes each
    const batchSize = 10; // Nodes per batch
    let batchRenderingStatus = {
        enabled: true,
        sequential: true,
        renderedNodes: 0,
        totalNodes: 0,
        currentBatch: 0,
        maxBatches: maxBatchesToRender,
        isRendering: false,
        isComplete: false
    };
    
    // Initialization states
    let authInitialized = false;
    let dataInitialized = false;
    let nodesLoaded = false;
    let visibilityPreferencesLoaded = false;
    
    // Control settings with default values
    let sortType: UniversalSortType = 'netVotes';
    let sortDirection: UniversalSortDirection = 'desc';
    let filterKeywords: string[] = [];
    let keywordOperator: FilterOperator = 'OR';
    let showOnlyMyItems = false;
    let availableKeywords: string[] = [];
    let selectedNodeTypes: Set<'openquestion' | 'statement'> = new Set(['openquestion', 'statement']);
    let minNetVotes = -50;
    let maxNetVotes = 50;
    
    // Loading state
    let nodesLoading = true;
    
    // Graph data
    let graphData: GraphData = { nodes: [], links: [] };
    
    // NEW: Flag to prevent duplicate graph updates
    let isUpdatingGraph = false;
    
    // NEW: Create optimized graph store for universal view
    let graphStore = createOptimizedGraphStore('universal');
    
    // Get data from the universal graph store
    $: nodes = $universalGraphStore?.nodes || [];
    $: relationships = $universalGraphStore?.relationships || [];
    $: isReady = authInitialized && dataInitialized;
    
    // Typed helper functions for node filtering
    $: questionNodes = nodes.filter((n: any) => n.type === 'openquestion');
    $: statementNodes = nodes.filter((n: any) => n.type === 'statement');
    
    // Debug reactive updates - SIMPLIFIED
    $: {
        if (nodes.length > 0 && !isUpdatingGraph) {
            if (enableBatchRendering) {
                updateBatchRenderingStatus();
            }
        }
    }
    
    // Create navigation nodes
    let navigationNodes = getNavigationOptions(NavigationContext.DASHBOARD)
        .map(option => ({
            id: option.id,
            type: 'navigation' as const,
            data: option,
            group: 'navigation' as const
        }));
        
    // Navigation options for the transformer
    let navigationOptions: NavigationOption[] = getNavigationOptions(NavigationContext.DASHBOARD);

    // Create control node for sorting and filtering
    let controlNode: GraphNode = {
        id: controlNodeId,
        type: 'dashboard' as NodeType,
        data: {
            sub: 'universal-controls',
            name: 'Universal Graph Controls',
            email: '',
            picture: '',
            'https://projectzer0.co/user_metadata': {
                handle: 'universal-controls'
            }
        },
        group: 'central' as NodeGroup,
        mode: controlNodeMode
    };

    // PHASE 2.1: Update batch rendering status
    function updateBatchRenderingStatus() {
        if (graphStore && typeof graphStore.getPerformanceMetrics === 'function') {
            const metrics = graphStore.getPerformanceMetrics();
            batchRenderingStatus = {
                enabled: enableBatchRendering,
                sequential: enableSequentialRendering,
                renderedNodes: metrics?.renderedNodeCount || 0,
                totalNodes: metrics?.totalNodeCount || 0,
                currentBatch: metrics?.currentBatch || 0,
                maxBatches: maxBatchesToRender,
                isRendering: false, // Will be updated by sequential state events
                isComplete: false
            };
        }
    }

    // PHASE 2.1: Listen for sequential batch state changes - SIMPLIFIED
    function setupSequentialBatchListeners() {
        if (typeof window !== 'undefined') {
            window.addEventListener('sequential-batch-state-change', ((event: CustomEvent) => {
                const state = event.detail;
                
                // Update batch rendering status with sequential state
                batchRenderingStatus = {
                    ...batchRenderingStatus,
                    currentBatch: state.currentBatch,
                    isRendering: state.isRendering,
                    isComplete: state.isComplete,
                    renderedNodes: state.currentBatch * batchSize + navigationNodes.length + 1
                };
            }) as EventListener);
        }
    }

    // ADDED: Debug backend response function - SIMPLIFIED
    async function debugBackendResponse() {
        if (!$userStore) return;
        
        try {
            // Make direct API call to see raw response
            const data = await fetchWithAuth('/graph/universal/nodes?node_types=openquestion&node_types=statement&limit=5');
            
            // Only log summary, not full raw data
        } catch (error) {
            console.error('Debug API call failed:', error);
        }
    }
    
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
            
            // Initialize navigation nodes and options
            navigationOptions = getNavigationOptions(NavigationContext.DASHBOARD);
            navigationNodes = navigationOptions.map(option => ({
                id: option.id,
                type: 'navigation' as const,
                data: option,
                group: 'navigation' as const
            }));
            
            // Initialize the graph filter store
            (graphFilterStore as any).setViewType('universal', true);
            
            // Initialize visibility preferences
            visibilityStore.initialize();
            
            // Load visibility preferences from the server
            if (!visibilityPreferencesLoaded) {
                await visibilityStore.loadPreferences();
                visibilityPreferencesLoaded = true;
            }
            
            // Load word list for keyword filtering
            try {
                await wordListStore.loadAllWords(true);
                const allWords = wordListStore.getAllWords();
                
                if (allWords.length === 0) {
                    // Provide fallback keywords
                    availableKeywords = [
                        'democracy', 'freedom', 'justice', 'equality', 'society', 
                        'government', 'truth', 'privacy', 'rights', 'liberty',
                        'security', 'capitalism', 'socialism', 'economy', 'education',
                        'health', 'environment', 'climate', 'technology', 'science'
                    ];
                } else {
                    availableKeywords = allWords;
                }
            } catch (error) {
                console.error('[UNIVERSAL-GRAPH] Error loading word list:', error);
                availableKeywords = [
                    'democracy', 'freedom', 'justice', 'equality', 'society', 
                    'government', 'truth', 'privacy', 'rights', 'liberty'
                ];
            }
            
            // Start with just navigation and control nodes (WITHOUT batch rendering)
            createInitialGraphData();
            dataInitialized = true;
            
            // Set the correct view type in graph store
            if (graphStore) {
                graphStore.setViewType(viewType);
                
                // PHASE 2.1: Enable sequential batch rendering
                if (typeof graphStore.enableBatchRendering === 'function') {
                    graphStore.enableBatchRendering(enableBatchRendering);
                }
                
                if (typeof graphStore.fixNodePositions === 'function') {
                    graphStore.fixNodePositions();
                }
            }
            
            // PHASE 2.1: Setup sequential batch listeners
            setupSequentialBatchListeners();
            
            // Load universal graph data
            await loadUniversalGraphData();
            
            // SIMPLIFIED: Only debug in development or when needed
            // await debugBackendResponse();
        } catch (error) {
            console.error('[UNIVERSAL-GRAPH] Error in initializeData:', error);
            auth0.login();
        }
    }

    // Load universal graph data
    async function loadUniversalGraphData() {
        if (!$userStore) {
            console.error('[UNIVERSAL-GRAPH] No user store available');
            return;
        }
        try {
            // Apply current filters to the store - SIMPLIFIED
            universalGraphStore.setSortType(sortType);
            universalGraphStore.setSortDirection(sortDirection);
            universalGraphStore.setNodeTypeFilter(Array.from(selectedNodeTypes));
            universalGraphStore.setKeywordFilter(filterKeywords, keywordOperator);
            universalGraphStore.setNetVotesFilter(minNetVotes, maxNetVotes);
            
            if (showOnlyMyItems) {
                universalGraphStore.setUserFilter($userStore.sub);
            } else {
                universalGraphStore.setUserFilter(undefined);
            }
            
            // Load nodes from the API
            await universalGraphStore.loadNodes($userStore);
            // Note: UniversalGraphStore may log many relationship processing messages
            
            // Mark nodes as loaded
            nodesLoaded = true;
            nodesLoading = false;
            
            // Update graph with loaded data
            updateGraphWithUniversalData();
        } catch (error) {
            console.error('[UNIVERSAL-GRAPH] Error loading universal graph data:', error);
            
            // Still consider nodes loaded, even if empty
            nodesLoaded = true;
            nodesLoading = false;
        }
    }
    
    // Create initial graph data with just navigation and control nodes
    function createInitialGraphData() {
        graphData = {
            nodes: [...navigationNodes, controlNode],
            links: []
        };
        
        if (graphStore) {
            graphStore.setData(graphData, { skipAnimation: true });
            if (typeof graphStore.fixNodePositions === 'function') {
                graphStore.fixNodePositions();
            }
        }
    }
    
    // FIXED: Helper function to safely get Neo4j numbers
    function getNeo4jNumber(value: any): number {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'object' && value !== null && 'low' in value) {
            return Number(value.low);
        }
        return Number(value || 0);
    }
    
    // PHASE 2.1: Update graph with universal data - CLEANED UP LOGGING
    function updateGraphWithUniversalData() {
        if (isUpdatingGraph) {
            return;
        }
        
        isUpdatingGraph = true;
        
        if (!nodesLoaded) {
            isUpdatingGraph = false;
            return;
        }
        
        // Enable batch rendering on graph store before processing data
        if (enableBatchRendering && graphStore && typeof graphStore.enableBatchRendering === 'function') {
            graphStore.enableBatchRendering(enableBatchRendering);
        }
        
        // Deduplicate nodes by ID - SIMPLIFIED LOGGING
        const deduplicatedNodes = nodes.reduce((acc: any[], node: any) => {
            const existingIndex = acc.findIndex(existing => existing.id === node.id);
            if (existingIndex === -1) {
                acc.push(node);
            } else {
                const existing = acc[existingIndex];
                const nodeVotes = node.metadata?.votes;
                const existingVotes = existing.metadata?.votes;
                
                if ((!existingVotes && nodeVotes) || 
                    (new Date(node.created_at) > new Date(existing.created_at))) {
                    acc[existingIndex] = node;
                }
            }
            return acc;
        }, []);
        
        // PHASE 2.1: Add net votes to nodes for batch rendering
        const nodesWithNetVotes = deduplicatedNodes.map((node: any) => {
            // Calculate net votes for sorting
            const netVotes = getNeo4jNumber(node.metadata?.votes?.net) || 
                           (getNeo4jNumber(node.metadata?.votes?.positive) - getNeo4jNumber(node.metadata?.votes?.negative)) || 0;
            
            return {
                ...node,
                netVotes: netVotes
            };
        });
        
        // Sort nodes by net votes for batch rendering - SIMPLIFIED
        if (enableBatchRendering) {
            nodesWithNetVotes.sort((a: any, b: any) => (b.netVotes || 0) - (a.netVotes || 0));
        }
        
        // Filter to batch size for rendering - SIMPLIFIED
        let nodesToProcess = nodesWithNetVotes;
        if (enableBatchRendering) {
            const totalContentNodes = maxBatchesToRender * batchSize; // 2 * 10 = 20
            nodesToProcess = nodesWithNetVotes.slice(0, totalContentNodes);
        }
        
        // FIXED: Transform universal nodes to graph nodes with proper data structures
        const universalGraphNodes: GraphNode[] = nodesToProcess.map((node: any) => {
            
            // Extract common properties
            const commonProperties = {
                id: node.id,
                participant_count: node.participant_count,
                created_at: node.created_at,
                created_by: node.created_by,
                public_credit: node.public_credit,
                keywords: node.metadata.keywords || [],
                // Add vote data using the same extraction logic as OpenQuestionNode
                positiveVotes: getNeo4jNumber(node.metadata.votes?.positive) || 0,
                negativeVotes: getNeo4jNumber(node.metadata.votes?.negative) || 0,
                netVotes: getNeo4jNumber(node.metadata.votes?.net) || 0,
                // Add user-specific data
                userVoteStatus: node.metadata.userVoteStatus?.status || 'none',
                userVisibilityPreference: node.metadata.userVisibilityPreference
            };
            
            // Build type-specific node data
            let nodeData: any;
            
            if (node.type === 'openquestion') {
                nodeData = {
                    ...commonProperties,
                    questionText: node.content, // Map content to questionText
                    answerCount: getNeo4jNumber(node.metadata.answer_count) || 0
                };
            } else if (node.type === 'statement') {
                // FIXED: Use the same data structure as StatementNode expects
                nodeData = {
                    ...commonProperties,
                    statement: node.content, // Map content to statement
                    // Add statement-specific properties from metadata
                    relatedStatements: node.metadata.relatedStatements || [],
                    parentQuestion: node.metadata.parentQuestion,
                    discussionId: node.metadata.discussionId,
                    initialComment: node.metadata.initialComment || ''
                };
            } else {
                // Fallback for unknown types
                nodeData = {
                    ...commonProperties,
                    content: node.content
                };
            }
            
            return {
                id: node.id,
                type: node.type as NodeType,
                data: nodeData,
                group: node.type as NodeGroup, // Use node type as group
                mode: 'preview' as NodeMode,
                metadata: {
                    group: node.type as any, // Match the group
                    participant_count: node.participant_count,
                    net_votes: node.metadata.votes?.net,
                    createdAt: node.created_at,
                    // FIXED: Add answer_count and related_statements_count to metadata for components
                    answer_count: node.type === 'openquestion' ? getNeo4jNumber(node.metadata.answer_count) || 0 : undefined,
                    related_statements_count: node.type === 'statement' ? (node.metadata.relatedStatements?.length || 0) : undefined,
                    // Store user-specific data in metadata properly
                    userVoteStatus: node.metadata.userVoteStatus,
                    userVisibilityPreference: node.metadata.userVisibilityPreference,
                    // PHASE 2.1: Add votes object for proper vote handling
                    votes: node.metadata.votes
                }
            };
        });
        
        // Filter relationships to only include those between rendered nodes
        const renderedNodeIds = new Set([...navigationNodes.map(n => n.id), controlNode.id, ...universalGraphNodes.map(n => n.id)]);
        const filteredLinks = relationships.filter((rel: any) => {
            return renderedNodeIds.has(rel.source) && renderedNodeIds.has(rel.target);
        });
        
        // Transform relationships to graph links
        const graphLinks: GraphLink[] = filteredLinks.map((rel: any) => ({
            id: rel.id,
            source: rel.source,
            target: rel.target,
            type: rel.type as LinkType,
            strength: rel.metadata?.strength,
            metadata: rel.metadata
        }));
        
        // Combine all nodes and links
        graphData = {
            nodes: [...navigationNodes, controlNode, ...universalGraphNodes],
            links: graphLinks
        };
        
        // Update the graph - SIMPLIFIED
        if (graphStore) {
            graphStore.setData(graphData);
            
            // Update batch rendering status after a short delay
            setTimeout(() => {
                updateBatchRenderingStatus();
                isUpdatingGraph = false; // Reset flag after update completes
            }, 100);
        } else {
            isUpdatingGraph = false;
        }
    }
    
    // Handle control changes (filters, sorting)
    async function handleControlChange() {
        if (!$userStore) return;
        
        nodesLoading = true;
        await loadUniversalGraphData();
    }

    // Handle node mode changes
    function handleNodeModeChange(event: CustomEvent<{ nodeId: string; mode: NodeMode; radius?: number }>) {
        // If this is the control node, update its mode
        if (event.detail.nodeId === controlNodeId) {
            controlNodeMode = event.detail.mode;
            
            // Update the control node mode in our local state
            controlNode = {
                ...controlNode,
                mode: event.detail.mode
            };
            
            // Update in graph store
            if (graphStore) {
                graphStore.updateNodeMode(event.detail.nodeId, event.detail.mode);
                if (typeof graphStore.fixNodePositions === 'function') {
                    graphStore.fixNodePositions();
                }
                if (typeof graphStore.forceTick === 'function') {
                    graphStore.forceTick(5);
                }
            }
        }
    }

    // Handle node visibility changes
    function handleVisibilityChange(event: CustomEvent<{ nodeId: string; isHidden: boolean }>) {
        const { nodeId, isHidden } = event.detail;
        
        // Skip visibility updates for non-content nodes
        const node = graphData.nodes.find(n => n.id === nodeId);
        if (!node || ['navigation', 'dashboard', 'control'].includes(node.type)) {
            return;
        }
        
        // Update visibility preference
        visibilityStore.setPreference(nodeId, !isHidden, 'user');
        
        // Update node visibility in graph
        if (graphStore) {
            graphStore.updateNodeVisibility(nodeId, isHidden, 'user');
        }
    }

    // UPDATED: Toggle node type function - now supports both types
    function toggleNodeType(nodeType: 'openquestion' | 'statement') {
        if (selectedNodeTypes.has(nodeType)) {
            selectedNodeTypes.delete(nodeType);
        } else {
            selectedNodeTypes.add(nodeType);
        }
        // Trigger reactive update
        selectedNodeTypes = new Set(selectedNodeTypes);
        handleControlChange();
    }

    // PHASE 2.1: Toggle batch rendering mode (now includes sequential option)
    function toggleBatchRendering() {
        enableBatchRendering = !enableBatchRendering;
        
        // Update graph store
        if (graphStore && typeof graphStore.enableBatchRendering === 'function') {
            graphStore.enableBatchRendering(enableBatchRendering);
        }
        
        // Re-render with new mode only if we have content loaded
        if (nodesLoaded && nodes.length > 0) {
            updateGraphWithUniversalData();
        }
    }

    // Initialize on mount
    onMount(() => {
        initializeData();
    });

    // Cleanup on destroy
    onDestroy(() => {
        // Any cleanup needed
    });
</script>

{#if !authInitialized}
    <div class="loading-container">
        <div class="loading-spinner" />
        <span class="loading-text">Authenticating...</span>
    </div>
{:else if !$userStore}
    <div class="loading-container">
        <div class="loading-text">Authentication required</div>
    </div>
{:else if !dataInitialized}
    <div class="loading-container">
        <div class="loading-spinner" />
        <span class="loading-text">Initializing universal graph...</span>
    </div>
{:else}
    <!-- PHASE 2.1: Enhanced sequential batch rendering status display -->
    {#if enableBatchRendering}
        <div class="batch-status">
            <div class="batch-info">
                <span class="batch-label">
                    Phase 2.1 {enableSequentialRendering ? 'Sequential' : 'Static'} Batch Rendering: ON
                </span>
                <span class="batch-progress">
                    {#if enableSequentialRendering}
                        {#if batchRenderingStatus.isRendering}
                            Rendering batch {batchRenderingStatus.currentBatch}/{maxBatchesToRender}...
                        {:else if batchRenderingStatus.isComplete}
                            Complete: {batchRenderingStatus.renderedNodes} nodes ({maxBatchesToRender} batches)
                        {:else}
                            Ready: {maxBatchesToRender} batches of {batchSize} nodes each
                        {/if}
                    {:else}
                        {batchRenderingStatus.renderedNodes} / {batchRenderingStatus.totalNodes} nodes
                        ({maxBatchesToRender} batches of {batchSize} nodes each)
                    {/if}
                </span>
            </div>
        </div>
    {/if}

    <!-- Graph visualization -->
    <Graph 
        data={graphData}
        viewType={viewType}
        on:modechange={handleNodeModeChange}
        on:visibilitychange={handleVisibilityChange}
    >
        <svelte:fragment slot="default" let:node let:handleModeChange>
            {#if isStatementNode(node)}
                <!-- ADDED: Statement nodes -->
                <StatementNode 
                    {node}
                    statementText={isStatementData(node.data) ? node.data.statement : ''}
                    viewType="universal"
                />
            {:else if isOpenQuestionNode(node)}
                <!-- ENHANCED: Pass viewType to ensure correct store usage -->
                <OpenQuestionNode
                    {node}
                    questionText={isOpenQuestionData(node.data) ? node.data.questionText : ''}
                    viewType="universal"
                />
            {:else if isNavigationNode(node)}
                <NavigationNode 
                    {node}
                />
            {:else if node.id === controlNodeId}
                <ControlNode 
                    {node}
                >
                    <!-- PHASE 2.1: Universal Graph Controls - Enhanced for sequential rendering -->
                    <div class="control-content">
                        <h3>Universal Graph Controls - Phase 2.1</h3>
                        
                        <!-- PHASE 2.1: Enhanced rendering mode controls -->
                        <div class="control-section">
                            <h4>Rendering Mode</h4>
                            <label class="batch-toggle">
                                <input 
                                    type="checkbox" 
                                    bind:checked={enableBatchRendering}
                                    on:change={toggleBatchRendering}
                                />
                                Enable Batch Rendering ({maxBatchesToRender} batches of {batchSize} nodes)
                            </label>
                            
                            {#if enableBatchRendering}
                                <div class="batch-info-detail">
                                    <small>
                                        <strong>Sequential Mode:</strong> 
                                        {enableSequentialRendering ? 'ON' : 'OFF'}<br>
                                        {#if enableSequentialRendering}
                                            Batches render progressively: Batch 1 → wait → Batch 2<br>
                                            Prevents performance issues with large node sets<br>
                                        {:else}
                                            All {maxBatchesToRender * batchSize} nodes render simultaneously<br>
                                        {/if}
                                        Currently: {batchRenderingStatus.renderedNodes} nodes rendered
                                    </small>
                                </div>
                            {/if}
                        </div>
                        
                        <!-- Node Type Filter - UPDATED for both types -->
                        <div class="control-section">
                            <h4>Node Types</h4>
                            <div class="checkbox-group">
                                <label>
                                    <input 
                                        type="checkbox" 
                                        checked={selectedNodeTypes.has('openquestion')}
                                        on:change={() => toggleNodeType('openquestion')}
                                    />
                                    Questions
                                </label>
                                <label>
                                    <input 
                                        type="checkbox" 
                                        checked={selectedNodeTypes.has('statement')}
                                        on:change={() => toggleNodeType('statement')}
                                    />
                                    Statements
                                </label>
                            </div>
                        </div>
                        
                        <!-- Sort Options - UPDATED for both types -->
                        <div class="control-section">
                            <h4>Sort By</h4>
                            <select bind:value={sortType} on:change={handleControlChange}>
                                <option value="netVotes">Net Votes</option>
                                <option value="participants">Participants</option>
                                <option value="chronological">Date Created</option>
                            </select>
                            
                            <select bind:value={sortDirection} on:change={handleControlChange}>
                                <option value="desc">Descending</option>
                                <option value="asc">Ascending</option>
                            </select>
                        </div>
                        
                        <!-- Net Votes Filter -->
                        <div class="control-section">
                            <h4>Net Votes Range</h4>
                            <div class="range-inputs">
                                <label>
                                    Min: 
                                    <input 
                                        type="number" 
                                        min="-100" 
                                        max="100" 
                                        step="1"
                                        bind:value={minNetVotes}
                                        on:change={handleControlChange}
                                    />
                                </label>
                                <label>
                                    Max: 
                                    <input 
                                        type="number" 
                                        min="-100" 
                                        max="100" 
                                        step="1"
                                        bind:value={maxNetVotes}
                                        on:change={handleControlChange}
                                    />
                                </label>
                            </div>
                        </div>
                        
                        <!-- Keyword Filter -->
                        <div class="control-section">
                            <h4>Keywords</h4>
                            <p style="font-size: 0.8rem; opacity: 0.7;">Keyword filtering coming soon...</p>
                        </div>
                        
                        <!-- User Filter -->
                        <div class="control-section">
                            <label>
                                <input 
                                    type="checkbox" 
                                    bind:checked={showOnlyMyItems}
                                    on:change={handleControlChange}
                                />
                                Show only my content
                            </label>
                        </div>
                        
                        {#if nodesLoading}
                            <div class="loading-indicator">Loading content...</div>
                        {/if}
                        
                        <!-- PHASE 2.1: Enhanced DEBUG INFO with sequential rendering details -->
                        <div class="debug-section">
                            <h4>Phase 2.1 Debug Info</h4>
                            <p style="font-size: 0.7rem; opacity: 0.6;">
                                Nodes: {nodes.length} | 
                                Questions: {questionNodes.length} |
                                Statements: {statementNodes.length} |
                                Relationships: {relationships.length} |
                                Batch Mode: {enableBatchRendering ? 'ON' : 'OFF'}
                                {#if enableBatchRendering}
                                    | Sequential: {enableSequentialRendering ? 'ON' : 'OFF'} | Max Batches: {maxBatchesToRender}
                                {/if}
                            </p>
                            <p style="font-size: 0.7rem; opacity: 0.6;">
                                {#if enableBatchRendering && enableSequentialRendering}
                                    Sequential Mode: Batches render progressively (Batch 1 → wait → Batch 2)
                                {:else if enableBatchRendering}
                                    Static Mode: {navigationNodes.length + 1 + (maxBatchesToRender * batchSize)} total nodes 
                                    ({navigationNodes.length + 1} system + {maxBatchesToRender * batchSize} content)
                                {:else}
                                    Standard rendering: All {nodes.length} nodes simultaneously
                                {/if}
                            </p>
                            <p style="font-size: 0.7rem; opacity: 0.6;">
                                Check console for detailed Phase 2.1 sequential rendering output
                            </p>
                        </div>
                    </div>
                </ControlNode>
            {/if}
        </svelte:fragment>
    </Graph>
{/if}

<style>
    .loading-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.7);
        color: rgba(255, 255, 255, 0.8);
        gap: 1rem;
        z-index: 50;
        pointer-events: none;
    }

    .loading-spinner {
        width: 50px;
        height: 50px;
        border: 3px solid rgba(255, 255, 255, 0.1);
        border-top-color: rgba(255, 255, 255, 0.8);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    .loading-text {
        font-family: 'Orbitron', sans-serif;
        font-size: 1.2rem;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    /* PHASE 2.1: Enhanced batch rendering status styles */
    .batch-status {
        position: fixed;
        top: 1rem;
        right: 1rem;
        background: rgba(0, 0, 0, 0.8);
        border: 1px solid rgba(0, 188, 212, 0.3);
        border-radius: 8px;
        padding: 0.5rem 1rem;
        color: white;
        font-family: 'Orbitron', sans-serif;
        font-size: 0.8rem;
        z-index: 40;
    }

    .batch-info {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .batch-label {
        color: rgba(0, 188, 212, 1);
        font-weight: 600;
    }

    .batch-progress {
        opacity: 0.8;
    }

    /* Control styles */
    .control-content {
        padding: 1rem;
        color: white;
        font-family: 'Orbitron', sans-serif;
    }

    .control-content h3 {
        margin: 0 0 1rem 0;
        font-size: 1.2rem;
    }

    .control-section {
        margin-bottom: 1.5rem;
    }

    .control-section h4 {
        margin: 0 0 0.5rem 0;
        font-size: 0.9rem;
        opacity: 0.8;
    }

    .checkbox-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .checkbox-group label, .batch-toggle {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
    }

    .batch-info-detail {
        margin-top: 0.5rem;
        padding: 0.5rem;
        background: rgba(0, 188, 212, 0.1);
        border-radius: 4px;
        border-left: 3px solid rgba(0, 188, 212, 0.5);
    }

    select {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: white;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        margin-right: 0.5rem;
    }

    .range-inputs {
        display: flex;
        gap: 1rem;
    }

    .range-inputs input[type="number"] {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: white;
        padding: 0.25rem;
        border-radius: 4px;
        width: 60px;
    }

    .loading-indicator {
        text-align: center;
        opacity: 0.7;
        font-style: italic;
    }

    .debug-section {
        border-top: 1px solid rgba(255, 255, 255, 0.2);
        padding-top: 1rem;
        margin-top: 1rem;
    }
</style>