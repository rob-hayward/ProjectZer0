<!-- src/routes/graph/universal/+page.svelte - UPDATED WITH MODE ROUTING -->
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
	import { BATCH_RENDERING } from '$lib/constants/graph/universal-graph';

    // Define view type
    const viewType: ViewType = 'universal';
    
    // Control node settings
    const controlNodeId = 'universal-graph-controls';
    let controlNodeMode: NodeMode = 'detail'; 
    
    // Sequential batch rendering settings
    let enableBatchRendering = true;
    let enableSequentialRendering = true;
    const maxBatchesToRender = BATCH_RENDERING.MAX_BATCHES;
    const batchSize = 10;
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
    
    // Phantom links status tracking
    let phantomLinksStatus = {
        enabled: false,
        linksCount: 0,
        revealState: 'hidden' as 'hidden' | 'revealing' | 'revealed'
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
    
    // Graph data - SINGLE SOURCE OF TRUTH
    let graphData: GraphData = { nodes: [], links: [] };
    
    // CRITICAL: Single graph store instance - managed by Graph component
    let graphStore: any = null; // Will be set by Graph component via binding
    
    // Data processing state
    let isUpdatingGraph = false;
    
    // Get data from the universal graph store
    $: nodes = $universalGraphStore?.nodes || [];
    $: relationships = $universalGraphStore?.relationships || [];
    $: isReady = authInitialized && dataInitialized;
    
    // Typed helper functions for node filtering
    $: questionNodes = nodes.filter((n: any) => n.type === 'openquestion');
    $: statementNodes = nodes.filter((n: any) => n.type === 'statement');
    
    // Update phantom links status when graph store is ready
    $: if (graphStore && typeof graphStore.getShouldRenderLinks === 'function') {
        phantomLinksStatus.enabled = graphStore.getShouldRenderLinks();
        phantomLinksStatus.linksCount = graphData.links.length;
        
        // Get reveal status if available
        if (typeof graphStore.getRevealStatus === 'function') {
            const revealStatus = graphStore.getRevealStatus();
            phantomLinksStatus.revealState = revealStatus.linkRenderingEnabled ? 'revealed' : 'hidden';
        }
    }
    
    // Wait for graph store to be properly bound AND initialized before processing data
    $: if (graphStore && typeof graphStore.getPerformanceMetrics === 'function' && nodes.length > 0 && !isUpdatingGraph) {
        updateBatchRenderingStatus();
        
        // Only process data when graph store is fully ready and we haven't processed it yet
        if (nodesLoaded && graphData.nodes.length <= navigationNodes.length + 1) {
            console.log('[UNIVERSAL-PAGE] Graph store bound and ready, processing data');
            updateGraphWithUniversalData();
        }
    }

    $: if (graphStore) {
        console.log('[UNIVERSAL-PAGE] Graph store bound and ready:', {
            isUniversalManager: typeof graphStore.updateNodeMode === 'function',
            hasEnableBatchRendering: typeof graphStore.enableBatchRendering === 'function',
            hasGetPerformanceMetrics: typeof graphStore.getPerformanceMetrics === 'function',
            constructor: graphStore.constructor?.name,
            availableMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(graphStore)).filter(name => 
                typeof graphStore[name] === 'function' && !name.startsWith('_')
            )
        });
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

    // Event listeners for manager events
    let modeChangeListener: EventListener;
    let sequentialBatchListener: EventListener;
    let phantomLinksListener: EventListener;

    // Update batch rendering status
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
                isRendering: false,
                isComplete: false
            };
        }
    }

    // Listen for sequential batch state changes
    function setupSequentialBatchListeners() {
        if (typeof window !== 'undefined') {
            sequentialBatchListener = ((event: CustomEvent) => {
                const state = event.detail;
                
                batchRenderingStatus = {
                    ...batchRenderingStatus,
                    currentBatch: state.currentBatch,
                    isRendering: state.isRendering,
                    isComplete: state.isComplete,
                    renderedNodes: state.currentBatch * batchSize + navigationNodes.length + 1
                };
            }) as EventListener;
            
            phantomLinksListener = ((event: CustomEvent) => {
                const state = event.detail;
                phantomLinksStatus = {
                    enabled: state.enabled,
                    linksCount: state.linksCount,
                    revealState: state.revealState
                };
                console.log('[UNIVERSAL-PAGE] 🔗 Phantom links state updated:', phantomLinksStatus);
            }) as EventListener;
            
            modeChangeListener = ((event: CustomEvent) => {
                const { nodeId, mode, position } = event.detail;
                console.log('[UNIVERSAL-PAGE] Manager mode change event:', { nodeId, mode, position });
                
                // Update local state if needed (e.g., for control node)
                if (nodeId === controlNodeId) {
                    controlNodeMode = mode;
                    controlNode = { ...controlNode, mode };
                    console.log('[UNIVERSAL-PAGE] Control node mode updated to:', mode);
                }
            }) as EventListener;
            
            window.addEventListener('sequential-batch-state-change', sequentialBatchListener);
            window.addEventListener('phantom-links-state-change', phantomLinksListener);
            window.addEventListener('node-mode-change', modeChangeListener);
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
                try {
                    await visibilityStore.loadPreferences();
                    visibilityPreferencesLoaded = true;
                    console.log('[UNIVERSAL-PAGE] Visibility preferences loaded successfully');
                } catch (error) {
                    console.error('[UNIVERSAL-PAGE] Error loading visibility preferences:', error);
                    visibilityPreferencesLoaded = false;
                }
            }
            
            // Load word list for keyword filtering
            try {
                await wordListStore.loadAllWords(true);
                const allWords = wordListStore.getAllWords();
                
                if (allWords.length === 0) {
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
                console.error('[UNIVERSAL-PAGE] Error loading word list:', error);
                availableKeywords = [
                    'democracy', 'freedom', 'justice', 'equality', 'society', 
                    'government', 'truth', 'privacy', 'rights', 'liberty'
                ];
            }
            
            // Start with just navigation and control nodes
            createInitialGraphData();
            dataInitialized = true;
            
            // Setup sequential batch listeners
            setupSequentialBatchListeners();
            
            // Load universal graph data
            await loadUniversalGraphData();
            
        } catch (error) {
            console.error('[UNIVERSAL-PAGE] Error in initializeData:', error);
            auth0.login();
        }
    }

    // Load universal graph data
    async function loadUniversalGraphData() {
        if (!$userStore) {
            console.error('[UNIVERSAL-PAGE] No user store available');
            return;
        }
        try {
            // Apply current filters to the store
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
            
            // Mark nodes as loaded
            nodesLoaded = true;
            nodesLoading = false;
            
        } catch (error) {
            console.error('[UNIVERSAL-PAGE] Error loading universal graph data:', error);
            
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
        
        console.log('[UNIVERSAL-PAGE] Initial graph data created:', {
            nodes: graphData.nodes.length,
            links: graphData.links.length
        });
    }
    
    // Helper function to safely get Neo4j numbers
    function getNeo4jNumber(value: any): number {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'object' && value !== null && 'low' in value) {
            return Number(value.low);
        }
        return Number(value || 0);
    }
    
    // Update graph with universal data
    function updateGraphWithUniversalData() {
        if (isUpdatingGraph) {
            console.log('[UNIVERSAL-PAGE] Skipping update - already in progress');
            return;
        }
        
        isUpdatingGraph = true;
        
        if (!nodesLoaded) {
            isUpdatingGraph = false;
            return;
        }
        
        // Wait for graph store to be ready
        if (!graphStore) {
            console.log('[UNIVERSAL-PAGE] Waiting for graph store to initialize');
            setTimeout(() => {
                isUpdatingGraph = false;
                updateGraphWithUniversalData();
            }, 100);
            return;
        }
        
        // Verify we have the specialized universal manager
        const isUniversalManager = typeof graphStore.enableBatchRendering === 'function';
        
        if (!isUniversalManager) {
            console.warn('[UNIVERSAL-PAGE] Expected universal manager but got standard manager');
            isUpdatingGraph = false;
            return;
        }
        
        // Enable batch rendering on graph store before processing data
        if (enableBatchRendering && graphStore.enableBatchRendering) {
            graphStore.enableBatchRendering(enableBatchRendering);
        }
        
        // Deduplicate nodes by ID
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
        
        // Add net votes to nodes for batch rendering
        const nodesWithNetVotes = deduplicatedNodes.map((node: any) => {
            const netVotes = getNeo4jNumber(node.metadata?.votes?.net) || 
                        (getNeo4jNumber(node.metadata?.votes?.positive) - getNeo4jNumber(node.metadata?.votes?.negative)) || 0;
            
            return {
                ...node,
                netVotes: netVotes
            };
        });
        
        // Sort nodes by net votes for batch rendering
        if (enableBatchRendering) {
            nodesWithNetVotes.sort((a: any, b: any) => (b.netVotes || 0) - (a.netVotes || 0));
        }
        
        // Filter to batch size for rendering
        let nodesToProcess = nodesWithNetVotes;
        if (enableBatchRendering) {
            const totalContentNodes = maxBatchesToRender * batchSize;
            nodesToProcess = nodesWithNetVotes.slice(0, totalContentNodes);
        }
        
        // Transform universal nodes to graph nodes
        const universalGraphNodes: GraphNode[] = nodesToProcess.map((node: any) => {
            
            // Extract common properties
            const commonProperties = {
                id: node.id,
                participant_count: node.participant_count,
                created_at: node.created_at,
                created_by: node.created_by,
                public_credit: node.public_credit,
                keywords: node.metadata.keywords || [],
                positiveVotes: getNeo4jNumber(node.metadata.votes?.positive) || 0,
                negativeVotes: getNeo4jNumber(node.metadata.votes?.negative) || 0,
                netVotes: getNeo4jNumber(node.metadata.votes?.net) || 0,
                userVoteStatus: node.metadata.userVoteStatus?.status || 'none',
                userVisibilityPreference: node.metadata.userVisibilityPreference
            };
            
            // Build type-specific node data
            let nodeData: any;
            
            if (node.type === 'openquestion') {
                nodeData = {
                    ...commonProperties,
                    questionText: node.content,
                    answerCount: getNeo4jNumber(node.metadata.answer_count) || 0
                };
            } else if (node.type === 'statement') {
                nodeData = {
                    ...commonProperties,
                    statement: node.content,
                    relatedStatements: node.metadata.relatedStatements || [],
                    parentQuestion: node.metadata.parentQuestion,
                    discussionId: node.metadata.discussionId,
                    initialComment: node.metadata.initialComment || ''
                };
            } else {
                nodeData = {
                    ...commonProperties,
                    content: node.content
                };
            }
            
            return {
                id: node.id,
                type: node.type as NodeType,
                data: nodeData,
                group: node.type as NodeGroup,
                mode: 'preview' as NodeMode,
                metadata: {
                    group: node.type as any,
                    participant_count: node.participant_count,
                    net_votes: node.metadata.votes?.net,
                    createdAt: node.created_at,
                    answer_count: node.type === 'openquestion' ? getNeo4jNumber(node.metadata.answer_count) || 0 : undefined,
                    related_statements_count: node.type === 'statement' ? (node.metadata.relatedStatements?.length || 0) : undefined,
                    userVoteStatus: node.metadata.userVoteStatus,
                    userVisibilityPreference: node.metadata.userVisibilityPreference,
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
        
        console.log('[UNIVERSAL-PAGE] Graph data prepared:', {
            totalNodes: graphData.nodes.length,
            contentNodes: universalGraphNodes.length,
            links: graphData.links.length,
            hasGraphStore: !!graphStore
        });
        
        // Update phantom links status
        phantomLinksStatus.linksCount = graphData.links.length;
        
        // Set data on graph store
        if (graphStore) {
            console.log('[UNIVERSAL-PAGE] Setting data on bound graph store');
            graphStore.setData(graphData);
            
            // Apply visibility preferences after setting data
            if (visibilityPreferencesLoaded) {
                setTimeout(() => {
                    try {
                        const preferences = visibilityStore.getAllPreferences();
                        if (Object.keys(preferences).length > 0) {
                            console.log('[UNIVERSAL-PAGE] Applying visibility preferences:', {
                                count: Object.keys(preferences).length,
                                nodeCount: universalGraphNodes.length
                            });
                            graphStore.applyVisibilityPreferences(preferences);
                        } else {
                            console.log('[UNIVERSAL-PAGE] No visibility preferences to apply');
                        }
                    } catch (error) {
                        console.error('[UNIVERSAL-PAGE] Error applying visibility preferences:', error);
                    }
                }, 200);
            }
        }
        
        // Update batch rendering status after a short delay
        setTimeout(() => {
            updateBatchRenderingStatus();
            isUpdatingGraph = false;
        }, 100);
    }

    // Handle control changes (filters, sorting)
    async function handleControlChange() {
        if (!$userStore) return;
        
        nodesLoading = true;
        await loadUniversalGraphData();
    }

    function handleNodeModeChange(event: CustomEvent<{ nodeId: string; mode: NodeMode; radius?: number }>) {
        const { nodeId, mode } = event.detail;
        
        console.log('[UNIVERSAL-PAGE] MODE ROUTING - Mode change received from Graph:', { 
            nodeId: nodeId.substring(0, 8), 
            mode,
            isControlNode: nodeId === controlNodeId,
            currentControlMode: controlNodeMode
        });
        
        // Update local state for control node (UI consistency)
        if (nodeId === controlNodeId) {
            console.log('[UNIVERSAL-PAGE] MODE ROUTING - Updating control node mode from', controlNodeMode, 'to', mode);
            controlNodeMode = mode;
            controlNode = {
                ...controlNode,
                mode
            };
            
            console.log('[UNIVERSAL-PAGE] Control node mode updated locally to:', mode);
        }
        
        // The UniversalGraphManager handles all the visual changes
        // No need to do anything else here - just maintain local state consistency
        console.log('[UNIVERSAL-PAGE] Mode change handled by UniversalGraphManager');
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
        
        console.log('[UNIVERSAL-PAGE] Visibility changed:', { nodeId, isHidden });
        
        // The Graph component handles the actual visibility change via its store
    }

    // Toggle node type function
    function toggleNodeType(nodeType: 'openquestion' | 'statement') {
        if (selectedNodeTypes.has(nodeType)) {
            selectedNodeTypes.delete(nodeType);
        } else {
            selectedNodeTypes.add(nodeType);
        }
        selectedNodeTypes = new Set(selectedNodeTypes);
        handleControlChange();
    }

    // Toggle batch rendering mode
    function toggleBatchRendering() {
        enableBatchRendering = !enableBatchRendering;
        
        // Update graph store if available
        if (graphStore && typeof graphStore.enableBatchRendering === 'function') {
            graphStore.enableBatchRendering(enableBatchRendering);
        }
        
        // Re-render with new mode only if we have content loaded
        if (nodesLoaded && nodes.length > 0) {
            updateGraphWithUniversalData();
        }
    }

    // Force reveal all phantom links (for debugging)
    function forceRevealPhantomLinks() {
        if (graphStore && typeof graphStore.forceRevealAll === 'function') {
            console.log('[UNIVERSAL-PAGE] 🚀 Forcing phantom links reveal');
            graphStore.forceRevealAll();
        }
    }

    // Initialize on mount
    onMount(() => {
        initializeData();
    });

    // Cleanup on destroy
    onDestroy(() => {
        console.log('[UNIVERSAL-PAGE] Component destroying');
        
        // Clean up event listeners
        if (typeof window !== 'undefined') {
            if (sequentialBatchListener) {
                window.removeEventListener('sequential-batch-state-change', sequentialBatchListener);
            }
            if (phantomLinksListener) {
                window.removeEventListener('phantom-links-state-change', phantomLinksListener);
            }
            if (modeChangeListener) {
                window.removeEventListener('node-mode-change', modeChangeListener);
            }
        }
        
        if (graphStore && typeof graphStore.dispose === 'function') {
            graphStore.dispose();
        }
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
    <!-- Phantom links status display -->
    {#if enableBatchRendering}
        <div class="batch-status">
            <div class="batch-info">
                <span class="batch-label">
                    Phase 2.2 Phantom Links: {phantomLinksStatus.enabled ? 'ENABLED' : 'DISABLED'}
                </span>
                <span class="batch-progress">
                    {#if enableSequentialRendering}
                        {#if batchRenderingStatus.isRendering}
                            Rendering batch {batchRenderingStatus.currentBatch}/{maxBatchesToRender}...
                        {:else if batchRenderingStatus.isComplete}
                            Complete: {batchRenderingStatus.renderedNodes} nodes | 
                            Links: {phantomLinksStatus.linksCount} ({phantomLinksStatus.revealState})
                        {:else}
                            Ready: {maxBatchesToRender} batches | Links: {phantomLinksStatus.linksCount}
                        {/if}
                    {:else}
                        {batchRenderingStatus.renderedNodes} / {batchRenderingStatus.totalNodes} nodes |
                        Links: {phantomLinksStatus.linksCount} ({phantomLinksStatus.revealState})
                    {/if}
                </span>
            </div>
        </div>
    {/if}

   <!-- Graph visualization - CORRECTED VERSION -->
<Graph 
    data={graphData}
    viewType={viewType}
    bind:graphStore={graphStore}
    on:modechange={handleNodeModeChange}
    on:visibilitychange={handleVisibilityChange}
>
    <svelte:fragment slot="default" let:node let:handleModeChange>
        {#if isStatementNode(node)}
            <StatementNode 
                {node}
            />
        {:else if isOpenQuestionNode(node)}
            <OpenQuestionNode
                {node}
            />
        {:else if isNavigationNode(node)}
            <NavigationNode 
                {node}
            />
        {:else if node.id === controlNodeId}
            <ControlNode 
                {node}
            >
                    <!-- Universal Graph Controls -->
                    <div class="control-content">
                        <h3>Universal Graph Controls - Phase 2.2</h3>
                        
                        <!-- Phantom Links status section -->
                        <div class="control-section phantom-links-section">
                            <h4>🔗 Phantom Links System</h4>
                            <div class="phantom-status">
                                <div class="status-item">
                                    <span class="status-label">Status:</span>
                                    <span class="status-value {phantomLinksStatus.enabled ? 'enabled' : 'disabled'}">
                                        {phantomLinksStatus.enabled ? 'ENABLED' : 'DISABLED'}
                                    </span>
                                </div>
                                <div class="status-item">
                                    <span class="status-label">Links Count:</span>
                                    <span class="status-value">{phantomLinksStatus.linksCount}</span>
                                </div>
                                <div class="status-item">
                                    <span class="status-label">Reveal State:</span>
                                    <span class="status-value state-{phantomLinksStatus.revealState}">
                                        {phantomLinksStatus.revealState.toUpperCase()}
                                    </span>
                                </div>
                            </div>
                            
                            <!-- DEBUG: Force reveal button -->
                            {#if !phantomLinksStatus.enabled}
                                <button 
                                    class="force-reveal-btn"
                                    on:click={forceRevealPhantomLinks}
                                >
                                    🚀 Force Reveal Links (Debug)
                                </button>
                            {/if}
                        </div>
                        
                        <!-- Enhanced rendering mode controls -->
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
                        
                        <!-- Node Type Filter -->
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
                        
                        <!-- Sort Options -->
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
                        
                        <!-- Phase 2.2 DEBUG INFO with phantom links -->
                        <div class="debug-section">
                            <h4>Phase 2.2 Debug Info</h4>
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
                                🔗 Phantom Links: {phantomLinksStatus.enabled ? 'ACTIVE' : 'INACTIVE'} | 
                                Links: {phantomLinksStatus.linksCount} | 
                                State: {phantomLinksStatus.revealState}
                            </p>
                            <p style="font-size: 0.7rem; opacity: 0.6;">
                                MODE ROUTING: UniversalGraphManager Authority | 
                                Control Mode: {controlNodeMode} | 
                                Local State Sync: Active
                            </p>
                            <p style="font-size: 0.7rem; opacity: 0.6;">
                                {#if enableBatchRendering && enableSequentialRendering}
                                    Sequential Mode: Batches render progressively → Links reveal post-settlement
                                {:else if enableBatchRendering}
                                    Static Mode: {navigationNodes.length + 1 + (maxBatchesToRender * batchSize)} total nodes 
                                    ({navigationNodes.length + 1} system + {maxBatchesToRender * batchSize} content)
                                {:else}
                                    Standard rendering: All {nodes.length} nodes simultaneously
                                {/if}
                            </p>
                            <p style="font-size: 0.7rem; opacity: 0.6;">
                                Graph Store: {graphStore ? 'Connected' : 'Not Ready'} | 
                                Data Nodes: {graphData.nodes.length} | 
                                Data Links: {graphData.links.length}
                            </p>
                            <p style="font-size: 0.7rem; opacity: 0.6;">
                                Phantom Links Architecture: Links included in physics but conditionally rendered to DOM
                            </p>
                            <p style="font-size: 0.7rem; opacity: 0.6;">
                                Mode Management: Page maintains UI state, Manager handles visual state, Store handles data
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

    /* ENHANCED: Phantom links status styles */
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

    /* ENHANCED: Phantom links section styles */
    .phantom-links-section {
        background: rgba(0, 188, 212, 0.1);
        border: 1px solid rgba(0, 188, 212, 0.3);
        border-radius: 6px;
        padding: 1rem;
        margin-bottom: 2rem;
    }

    .phantom-status {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-bottom: 1rem;
    }

    .status-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .status-label {
        font-size: 0.8rem;
        opacity: 0.8;
    }

    .status-value {
        font-size: 0.8rem;
        font-weight: 600;
    }

    .status-value.enabled {
        color: #00ff88;
    }

    .status-value.disabled {
        color: #ff6b6b;
    }

    .status-value.state-hidden {
        color: #ff6b6b;
    }

    .status-value.state-revealing {
        color: #ffa500;
    }

    .status-value.state-revealed {
        color: #00ff88;
    }

    .force-reveal-btn {
        background: rgba(255, 107, 107, 0.2);
        border: 1px solid rgba(255, 107, 107, 0.5);
        color: white;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.8rem;
        transition: all 0.2s ease;
    }

    .force-reveal-btn:hover {
        background: rgba(255, 107, 107, 0.3);
        border-color: rgba(255, 107, 107, 0.7);
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