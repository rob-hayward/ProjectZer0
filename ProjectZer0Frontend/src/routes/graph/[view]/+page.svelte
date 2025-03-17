<!-- src/routes/graph/[view]/+page.svelte -->
<script lang="ts">
    import { onMount, onDestroy, afterUpdate } from 'svelte';
    import { page } from '$app/stores';
    import * as auth0 from '$lib/services/auth0';
    import type { UserActivity } from '$lib/services/userActivity';
    import { getUserActivity } from '$lib/services/userActivity';
    import { getWordData } from '$lib/services/word'; 
    import Graph from '$lib/components/graph/Graph.svelte';
    import CreateAlternativeDefinitionNode from '$lib/components/graph/nodes/createNode/CreateAlternativeDefinitionNode.svelte';
    import NavigationNode from '$lib/components/graph/nodes/navigation/NavigationNode.svelte';
    import { getNavigationOptions } from '$lib/services/navigation';
    import { NavigationContext } from '$lib/services/navigation';
    import { userStore } from '$lib/stores/userStore';
    import { wordStore } from '$lib/stores/wordStore';
    import { graphStore } from '$lib/stores/graphStore';
    import { statementNetworkStore } from '$lib/stores/statementNetworkStore';
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
    import type { RelatedStatement } from '$lib/types/domain/nodes';
    import {
        isNavigationNode
    } from '$lib/types/graph/enhanced';
    
    export let data: GraphPageData;

    // Initialization states
    let authInitialized = false;
    let dataInitialized = false;
    let userActivity: UserActivity | undefined;
    
    // Statement network loading state
    let networkNodesLoading = true;
    let networkLoadingTimeout: NodeJS.Timeout;

    // Use data from page data for initial state
    $: initialWordData = data.wordData;
    
    // Derive viewType directly from URL parameters
    $: viewType = $page.params.view as ViewType;
    $: view = viewType;
    
    // Statement network data
    $: statements = $statementNetworkStore?.filteredStatements || [];
    
    // Load statement network data when view is statement-network
    $: if (viewType === 'statement-network' && isReady) {
        console.log('[NETWORK] Loading statement network data');
        loadStatementNetworkData();
    }

    // Check for alternative definition creation view
    $: isCreateAlternative = view === 'create-alternative';
    
    // View type checks
    $: isStatementNetworkView = view === 'statement-network';
    
    // But we still need to load word data for create-alternative
    $: needsWordDataLoaded = isCreateAlternative;

    // Force immediate graph updates on navigation
    function forceGraphUpdate(newViewType: ViewType) {
        console.log('[FORCE-UPDATE] Forcing graph update to:', newViewType);
        
        if (graphStore) {
            // Update the graph store
            graphStore.setViewType(newViewType);
            
            // Force immediate simulation ticks
            if (graphStore.forceTick) {
                graphStore.forceTick();
            }
            
            // Force render with new route key
            routeKey = `${newViewType}-${Date.now()}`;
        }
    }

    // Load statement network data
    async function loadStatementNetworkData() {
        if (!$userStore) return;
        
        try {
            // Set loading state
            networkNodesLoading = true;
            
            // Load statements using the network store
            await statementNetworkStore.loadStatements();
            
            console.log('[NETWORK] Loaded statement data:', {
                total: $statementNetworkStore.allStatements.length,
                filtered: $statementNetworkStore.filteredStatements.length
            });
            
            // Add a delay before showing the nodes to let the force simulation settle
            if (networkLoadingTimeout) clearTimeout(networkLoadingTimeout);
            networkLoadingTimeout = setTimeout(() => {
                // Only set loading to false after a delay to let forces settle
                networkNodesLoading = false;
            }, 800); // Delay showing nodes to reduce visual flickering
            
        } catch (error) {
            console.error('[NETWORK] Error loading statement network data:', error);
            
            // Show empty state even on error, after a delay
            if (networkLoadingTimeout) clearTimeout(networkLoadingTimeout);
            networkLoadingTimeout = setTimeout(() => {
                networkNodesLoading = false;
            }, 800);
        }
    }

    async function initializeData() {
        console.log('[INIT] Starting data initialization');
        try {
            await auth0.handleAuthCallback();
            const fetchedUser = await auth0.getAuth0User();
            
            if (!fetchedUser) {
                console.log('[INIT] No user found, redirecting to login');
                auth0.login();
                return;
            }
            
            console.log('[INIT] User authenticated', {
                userId: fetchedUser.sub
            });
            authInitialized = true;
            userStore.set(fetchedUser);
            userActivity = await getUserActivity();
            
            // Handle word data for create-alternative view
            if (needsWordDataLoaded) {
                console.log(`[INIT] ${view} view detected, loading word data`);
                const wordParam = new URL(window.location.href).searchParams.get('word');
                if (wordParam) {
                    const loadedWord = await getWordData(wordParam);
                    if (loadedWord) {
                        console.log('[INIT] Setting word data', {
                            wordId: loadedWord.id,
                            definitionCount: loadedWord.definitions?.length,
                            view
                        });
                        wordStore.set(loadedWord);
                    }
                }
            }
            
            // Handle statement network data
            if (isStatementNetworkView) {
                console.log(`[INIT] ${view} view detected, loading statement network data`);
                await loadStatementNetworkData();
            }
            
            console.log('[INIT] Data initialization complete');
            dataInitialized = true;
            
            // Force a graph update after initialization completes
            forceGraphUpdate(viewType);
        } catch (error) {
            console.error('[INIT-ERROR] Error in initializeData:', error);
            auth0.login();
        }
    }

    onMount(() => {
        console.log("✅ USING UNIVERSAL COMPONENT");
        initializeData();
        console.log('[NAVIGATION] Mounted, listening for URL changes');
    });
    
    onDestroy(() => {
        if (networkLoadingTimeout) clearTimeout(networkLoadingTimeout);
    });
    
    // Ensure graph store stays in sync with URL
    afterUpdate(() => {
        if (graphStore && viewType) {
            console.log('[AFTER-UPDATE] Current view type from URL:', viewType);
            
            if (graphStore.getViewType() !== viewType) {
                console.log('[AFTER-UPDATE] Fixing mismatched view types:', {
                    storeType: graphStore.getViewType(),
                    urlType: viewType
                });
                graphStore.setViewType(viewType);
            }
        }
    });

    // Data reactivity
    $: wordData = needsWordDataLoaded ? ($wordStore || initialWordData) : null;
    $: isReady = authInitialized && dataInitialized;
    
    // Enhanced route key with timestamp to ensure uniqueness
    $: routeKey = `${viewType}-${Date.now()}`;

    // Event handlers (not used for statement node mode changes anymore)
    function handleNodeModeChange(event: CustomEvent<{ nodeId: string; mode: NodeMode }>) {
        console.log('[MODE-CHANGE] Node mode change', {
            nodeId: event.detail.nodeId,
            newMode: event.detail.mode
        });
    }

    // Updated central node type handling - only for views that need a central node
    $: centralNode = isReady && $userStore && (
        {
            // User profile for other views (except statement-network)
            id: $userStore.sub,
            type: isCreateAlternative ? 'create-node' as const : 
                  isStatementNetworkView ? 'dashboard' as const : // Fallback type for statement-network
                  view as NodeType,
            data: $userStore,
            group: 'central' as const
        }
    );

    // Create graph data
    function createGraphData(): GraphData {
        // For statement network view - special case with no central node
        if (view === 'statement-network') {
            console.log('[DATA] Creating statement network view data', {
                statementCount: statements.length,
                loading: networkNodesLoading
            });

            // Only include navigation nodes during loading to avoid flickering
            if (networkNodesLoading) {
                console.log('[DATA] Network in loading state, showing only navigation nodes');
                return {
                    nodes: [...navigationNodes],
                    links: []
                };
            }

            // Create statement nodes - ALL in preview mode initially
            const statementNodes: GraphNode[] = statements.map(statement => ({
                id: statement.id,
                type: 'statement' as NodeType,
                data: statement,
                group: 'statement' as NodeGroup, // Not 'central'
                mode: 'preview' as NodeMode
            }));

            // Create links between statements based on shared keywords and direct relationships
            const statementLinks: GraphLink[] = [];
            
            // Add links based on relatedStatements from each statement
            statements.forEach(statement => {
                if (statement.relatedStatements && statement.relatedStatements.length > 0) {
                    statement.relatedStatements.forEach(related => {
                        // Check if target statement exists in our filtered data
                        const targetExists = statements.some(s => s.id === related.nodeId);
                        if (targetExists) {
                            statementLinks.push({
                                id: `${statement.id}-${related.nodeId}-${related.sharedWord || 'unknown'}`,
                                source: statement.id,
                                target: related.nodeId,
                                type: related.sharedWord === 'direct' ? 'related' as LinkType : 'alternative' as LinkType
                            });
                        }
                    });
                }
            });

            console.log('[DATA] Created statement network structure', {
                nodeCount: navigationNodes.length + statementNodes.length,
                linkCount: statementLinks.length
            });

            // Return ONLY navigation nodes and statement nodes - NO central node
            return {
                nodes: [...navigationNodes, ...statementNodes],
                links: statementLinks
            };
        }

        // For all other views, use the central node approach
        if (!centralNode) {
            return { nodes: [], links: [] };
        }

        // Debug central node
        console.debug('[DATA] Central node details:', {
            id: centralNode.id, 
            type: centralNode.type
        });

        const baseNodes = [centralNode, ...navigationNodes] as GraphNode[];
        
        // Default case for all other views
        console.log('[DATA] Created base graph structure', {
            nodeCount: baseNodes.length
        });
        return { nodes: baseNodes, links: [] };
    }

    // Define navigation context based on the current view
    $: context = 
        view === 'create-node' ? NavigationContext.CREATE_NODE :
        view === 'edit-profile' ? NavigationContext.EDIT_PROFILE :
        view === 'create-alternative' ? NavigationContext.WORD : // Use word context for alternative definition
        view === 'statement-network' ? NavigationContext.DASHBOARD : // Use dashboard context for statement network
        NavigationContext.DASHBOARD;

    $: navigationNodes = getNavigationOptions(context)
        .map(option => ({
            id: option.id,
            type: 'navigation' as const,
            data: option,
            group: 'navigation' as const
        }));

    // Create graph data reactively
    $: graphData = isReady ? createGraphData() : { nodes: [], links: [] };
</script>

{#if !isReady}
    <div class="loading-container">
        <div class="loading-spinner" />
        <span class="loading-text">Loading...</span>
    </div>
{:else if !$userStore}
    <div class="loading-container">
        <div class="loading-text">Authentication required</div>
    </div>
{:else}
{#key routeKey}
<Graph 
    data={graphData}
    {viewType}
    on:modechange={handleNodeModeChange}
>
    <svelte:fragment slot="default" let:node let:handleModeChange>
        {#if isCreateAlternative && wordData && node.type === 'create-node'}
            <!-- Create alternative definition node handling kept for now -->
            <CreateAlternativeDefinitionNode 
                {node}
                on:modeChange={handleModeChange}
            />
        {:else if isNavigationNode(node)}
            <NavigationNode 
                {node}
                on:hover={() => {}} 
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

    .loading-text {
        font-family: 'Orbitron', sans-serif;
        font-size: 1.2rem;
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