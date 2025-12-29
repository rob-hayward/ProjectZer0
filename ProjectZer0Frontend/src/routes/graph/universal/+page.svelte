<!-- src/routes/graph/universal/+page.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import * as auth0 from '$lib/services/auth0';
    import Graph from '$lib/components/graph/Graph.svelte';
    import NavigationNode from '$lib/components/graph/nodes/navigation/NavigationNode.svelte';
    import ControlNode from '$lib/components/graph/nodes/controlNode/ControlNode.svelte';
    import DashboardNode from '$lib/components/graph/nodes/dashboard/DashboardNode.svelte';
    import EditProfileNode from '$lib/components/graph/nodes/editProfile/EditProfileNode.svelte';
    import CreateNodeNode from '$lib/components/graph/nodes/createNode/CreateNodeNode.svelte';
    import StatementNode from '$lib/components/graph/nodes/statement/StatementNode.svelte';
    import OpenQuestionNode from '$lib/components/graph/nodes/openquestion/OpenQuestionNode.svelte';
    import AnswerNode from '$lib/components/graph/nodes/answer/AnswerNode.svelte';
    import QuantityNode from '$lib/components/graph/nodes/quantity/QuantityNode.svelte';
    import EvidenceNode from '$lib/components/graph/nodes/evidence/EvidenceNode.svelte';
    import CategoryNode from '$lib/components/graph/nodes/category/CategoryNode.svelte';
    import WordNode from '$lib/components/graph/nodes/word/WordNode.svelte';
    import DefinitionNode from '$lib/components/graph/nodes/definition/DefinitionNode.svelte';
    import CommentNode from '$lib/components/graph/nodes/comment/CommentNode.svelte';
    import { getNavigationOptions, NavigationContext } from '$lib/services/navigation';
    import { userStore } from '$lib/stores/userStore';
    import { getUserActivity, type UserActivity } from '$lib/services/userActivity';
    
    import { universalGraphStore, type UniversalSortType, type UniversalSortDirection } from '$lib/stores/universalGraphStore';
    import { graphFilterStore, type FilterOperator } from '$lib/stores/graphFilterStore';
    import { visibilityStore } from '$lib/stores/visibilityPreferenceStore';
    import { wordListStore } from '$lib/stores/wordListStore';
    import { fetchWithAuth } from '$lib/services/api';
    import { fetchCategoryExpansion, type CategoryExpansionResponse } from '$lib/services/graph/CategoryExpansionService';
    import { fetchWordExpansion, type WordExpansionResponse } from '$lib/services/graph/WordExpansionService';
    import { fetchStatementExpansion, type StatementExpansionResponse } from '$lib/services/graph/StatementExpansionService';
    import { fetchOpenQuestionExpansion, type OpenQuestionExpansionResponse } from '$lib/services/graph/OpenQuestionExpansionService';
    import { fetchQuantityExpansion, type QuantityExpansionResponse } from '$lib/services/graph/QuantityExpansionService';
    import { fetchAnswerExpansion } from '$lib/services/graph/AnswerExpansionService';
    import { fetchDefinitionExpansion } from '$lib/services/graph/DefinitionExpansionService';
    import { fetchEvidenceExpansion } from '$lib/services/graph/EvidenceExpansionService';
    import { calculateNavigationRingPositions } from '$lib/services/graph/universal/NavigationRingPositioning';
    
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
        isAnswerNode,
        isQuantityNode,
        isEvidenceNode,
        isNavigationNode,
        isCategoryNode,
        isWordNode,
        isDefinitionNode,
        isCommentNode,
        isDashboardNode,
        isEditProfileNode,
        isCreateNodeNode,
        isStatementData,
        isOpenQuestionData,
        isAnswerData,
        isQuantityData,
        isEvidenceData,
        isCategoryData,
        isDefinitionData,
        isCommentData
    } from '$lib/types/graph/enhanced';
    import type { NavigationOption } from '$lib/types/domain/navigation';
	import { BATCH_RENDERING } from '$lib/constants/graph/universal-graph';

    // Define view type
    const viewType: ViewType = 'universal';
    
    // Control node settings
    const controlNodeId = 'universal-graph-controls';
    let controlNodeMode: NodeMode = 'preview'; 
    let controlNodeRef: any = null;
    
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

    // User activity data for dashboard
    let userActivity: UserActivity | undefined = undefined;
    
    // Control settings with default values
    let sortType: UniversalSortType = 'netVotes';
    let sortDirection: UniversalSortDirection = 'desc';
    let filterKeywords: string[] = [];
    let keywordOperator: FilterOperator = 'OR';
    let showOnlyMyItems = false;
    let availableKeywords: string[] = [];
    
    // UPDATED: Support all 5 content node types
    let selectedNodeTypes = new Set<
        'openquestion' | 'statement' | 'answer' | 'quantity' | 'evidence' | 
        'word' | 'category' | 'definition'
    >([
        'openquestion', 
        'statement', 
        'answer', 
        'quantity', 
        'evidence',
        'word',
        'category',
        'definition'
    ]);
    let minNetVotes = -50;
    let maxNetVotes = 50;
    
    // Loading state
    let nodesLoading = true;
    let universalDataProcessed = false;
    
    // BULLETPROOF: Request management for filter operations
    let currentAbortController: AbortController | null = null;
    let requestSequence = 0;
    let isFilterOperationLocked = false;
    
    // Graph data - SINGLE SOURCE OF TRUTH
    let graphData: GraphData = { nodes: [], links: [] };
    
    // Graph store instance - managed by Graph component
    let graphStore: any = null;
    
    // Data processing state
    let isUpdatingGraph = false;
    
    // Get data from the universal graph store
    $: nodes = $universalGraphStore?.nodes || [];
    $: relationships = $universalGraphStore?.relationships || [];
    $: isReady = authInitialized && dataInitialized;
    
    // UPDATED: Typed helper functions for node filtering - all 5 types
    $: questionNodes = nodes.filter((n: any) => n.type === 'openquestion');
    $: statementNodes = nodes.filter((n: any) => n.type === 'statement');
    $: answerNodes = nodes.filter((n: any) => n.type === 'answer');
    $: quantityNodes = nodes.filter((n: any) => n.type === 'quantity');
    $: evidenceNodes = nodes.filter((n: any) => n.type === 'evidence');
    
    // Combined content nodes for overall stats
    $: contentNodes = nodes.filter((n: any) => 
        ['openquestion', 'statement', 'answer', 'quantity', 'evidence'].includes(n.type)
    );
    
    // Update phantom links status when graph store is ready
    $: if (graphStore && typeof graphStore.getShouldRenderLinks === 'function') {
        phantomLinksStatus.enabled = graphStore.getShouldRenderLinks();
        phantomLinksStatus.linksCount = graphData.links.length;
        
        if (typeof graphStore.getRevealStatus === 'function') {
            const revealStatus = graphStore.getRevealStatus();
            phantomLinksStatus.revealState = revealStatus.linkRenderingEnabled ? 'revealed' : 'hidden';
        }
    }
    
    // Wait for graph store to be properly bound AND initialized before processing data
    $: if (graphStore && typeof graphStore.getPerformanceMetrics === 'function' && nodes.length > 0 && !isUpdatingGraph && !nodesLoading) {
        updateBatchRenderingStatus();
        
        if (nodesLoaded && !universalDataProcessed) {
            console.log('[UNIVERSAL-PAGE] Graph store bound and ready, processing data', {
                nodeCount: nodes.length,
                nodesLoading,
                universalDataProcessed
            });
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

    /**
     * Wait for a node to be positioned by D3 simulation, then center viewport on it
     * This is necessary because newly added nodes need time for force simulation to position them
     */
    async function waitForNodePositionAndCenter(
        graphStore: any,
        nodeId: string,
        maxAttempts: number = 20,
        delayMs: number = 100,
        centerDuration: number = 750
    ): Promise<boolean> {
        console.log('[UNIVERSAL-PAGE] Waiting for node positioning:', {
            nodeId: nodeId.substring(0, 20),
            maxAttempts,
            delayMs
        });

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            // Check if node exists and has a valid position
            const store = graphStore.getState ? graphStore.getState() : graphStore;
            const nodes = store?.nodes || [];
            const node = nodes.find((n: any) => n.id === nodeId);

            if (node?.position?.x !== undefined && node?.position?.y !== undefined) {
                console.log('[UNIVERSAL-PAGE] ✅ Node positioned after', attempt, 'attempts:', {
                    nodeId: nodeId.substring(0, 20),
                    position: { x: node.position.x.toFixed(1), y: node.position.y.toFixed(1) },
                    totalWaitTime: (attempt * delayMs) + 'ms'
                });

                // Center on the node
                if (typeof (graphStore as any).centerOnNodeById === 'function') {
                    const success = (graphStore as any).centerOnNodeById(nodeId, centerDuration);
                    console.log('[UNIVERSAL-PAGE] Centering result:', success ? '✅ Success' : '❌ Failed');
                    return success;
                }
                return false;
            }

            // Log progress every 5 attempts
            if (attempt % 5 === 0) {
                console.log('[UNIVERSAL-PAGE] Still waiting for node position...', {
                    attempt,
                    maxAttempts,
                    nodeExists: !!node,
                    hasPosition: !!(node?.position),
                    positionValid: !!(node?.position?.x !== undefined && node?.position?.y !== undefined)
                });
            }

            // Wait before next attempt
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        // Timeout - node never got positioned
        console.error('[UNIVERSAL-PAGE] ❌ Timeout waiting for node position:', {
            nodeId: nodeId.substring(0, 20),
            totalWaitTime: (maxAttempts * delayMs) + 'ms',
            attempts: maxAttempts
        });
        return false;
    }
    
    // Create navigation nodes
    function createNavigationNodesWithPositions(controlMode: NodeMode): GraphNode[] {
        const options = getNavigationOptions(NavigationContext.DASHBOARD);
        const positions = calculateNavigationRingPositions(options.length, controlMode);
        
        return options.map((option, index) => ({
            id: option.id,
            type: 'navigation' as const,
            data: option,
            group: 'navigation' as const,
            metadata: {
                group: 'navigation' as const,
                fixed: true, // Mark as fixed so enforceFixedPositions recognizes them
                initialPosition: {
                    x: positions[index].x,
                    y: positions[index].y
                },
                angle: positions[index].angle
            }
        }));
    }
        
    let navigationNodes = createNavigationNodesWithPositions(controlNodeMode);
    // Navigation options for the transformer
    let navigationOptions: NavigationOption[] = getNavigationOptions(NavigationContext.DASHBOARD);

    // Create control node for sorting and filtering
    let controlNode: GraphNode = {
        id: controlNodeId,
        type: 'control' as NodeType,
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

    // Dashboard node - will be created when user data is available
    let dashboardNode: GraphNode | null = null;
    // Edit Profile node - will be created when user data is available
    let editProfileNode: GraphNode | null = null;
    // Create Node node - will be created when user data is available
    let createNodeNode: GraphNode | null = null;

    // Track which central node is currently active
    let currentCentralNodeType: 'control' | 'dashboard' | 'edit-profile' | 'create-node' = 'control';
    let activeCentralNode: GraphNode = controlNode;

    // Reactive: Create dashboard node when user data becomes available
    $: if ($userStore && !dashboardNode) {
        dashboardNode = {
            id: 'dashboard-central',
            type: 'dashboard' as NodeType,
            data: $userStore, // Now guaranteed to be non-null
            group: 'central' as NodeGroup,
            mode: 'detail' as NodeMode
        };
        console.log('[UNIVERSAL-PAGE] Dashboard node created');
    }

    // Reactive: Create edit profile node when user data becomes available
    $: if ($userStore && !editProfileNode) {
        editProfileNode = {
            id: 'edit-profile-central',
            type: 'edit-profile' as NodeType,
            data: $userStore,
            group: 'central' as NodeGroup,
            mode: 'detail' as NodeMode
        };
        console.log('[UNIVERSAL-PAGE] Edit profile node created');
    }

    // Reactive: Create create-node node when user data becomes available
    $: if ($userStore && !createNodeNode) {
        createNodeNode = {
            id: 'create-node-central',
            type: 'create-node' as NodeType,
            data: $userStore,
            group: 'central' as NodeGroup,
            mode: 'detail' as NodeMode
        };
        console.log('[UNIVERSAL-PAGE] Create node node created');
    }

    // ============================================================================
    // CENTRAL NODE SWITCHING HELPERS
    // ============================================================================
    
    /**
     * Create a central node of the specified type
     */
    function createCentralNode(type: 'control' | 'dashboard' | 'edit-profile' | 'create-node', mode: NodeMode): GraphNode | null {
        if (type === 'control') {
            return {
                id: controlNodeId,
                type: 'control' as NodeType,
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
                mode
            };
        } else if (type === 'dashboard') {
            // Only create if user data is available
            if (!$userStore) {
                console.warn('[UNIVERSAL-PAGE] Cannot create dashboard node - no user data');
                return null;
            }
            return {
                id: 'dashboard-central',
                type: 'dashboard' as NodeType,
                data: $userStore,
                group: 'central' as NodeGroup,
                mode
            };
        } else if (type === 'edit-profile') {
            // Only create if user data is available
            if (!$userStore) {
                console.warn('[UNIVERSAL-PAGE] Cannot create edit profile node - no user data');
                return null;
            }
            return {
                id: 'edit-profile-central',
                type: 'edit-profile' as NodeType,
                data: $userStore,
                group: 'central' as NodeGroup,
                mode
            };
        } else if (type === 'create-node') {
            // Only create if user data is available
            if (!$userStore) {
                console.warn('[UNIVERSAL-PAGE] Cannot create create node node - no user data');
                return null;
            }
            return {
                id: 'create-node-central',
                type: 'create-node' as NodeType,
                data: $userStore,
                group: 'central' as NodeGroup,
                mode
            };
        }
        
        // Fallback - should never reach here
        return null;
    }

    /**
     * Switch to a different central node type
     * Uses direct manager call - NO graphData replacement
     */
    async function switchCentralNode(newType: 'control' | 'dashboard' | 'edit-profile' | 'create-node') {
        console.log('[UNIVERSAL-PAGE] 🔄 Switching central node:', {
            from: currentCentralNodeType,
            to: newType
        });
        
        // Already this type - no need to switch
        if (newType === currentCentralNodeType) {
            console.log('[UNIVERSAL-PAGE] Already showing', newType);
            return;
        }
        
        // Load user activity if switching to dashboard (and not already loaded)
        if (newType === 'dashboard' && !userActivity) {
            await loadUserActivity();
        }
        
        // Edit profile doesn't need additional data loading (uses $userStore directly)
        
        // Determine the mode for the new central node
        const nodeMode: NodeMode = newType === 'control' ? 'preview' : 'detail';
        
        // Create the new central node
        const newCentralNode = createCentralNode(newType, nodeMode);
        
        // Check if creation was successful
        if (!newCentralNode) {
            console.error('[UNIVERSAL-PAGE] Failed to create central node of type:', newType);
            return;
        }
        
        // Update local tracking
        currentCentralNodeType = newType;
        activeCentralNode = newCentralNode;
        
        // Direct manager call - NO graphData replacement
        if (graphStore && typeof graphStore.switchCentralNode === 'function') {
            console.log('[UNIVERSAL-PAGE] Calling graphStore.switchCentralNode');
            graphStore.switchCentralNode(newCentralNode);
        } else {
            console.error('[UNIVERSAL-PAGE] switchCentralNode method not available');
        }
    }

    /**
     * Load user activity data for dashboard
     */
    async function loadUserActivity() {
        if (!$userStore) {
            console.warn('[UNIVERSAL-PAGE] Cannot load user activity - no user');
            return;
        }
        
        try {
            console.log('[UNIVERSAL-PAGE] Loading user activity...');
            userActivity = await getUserActivity();
            console.log('[UNIVERSAL-PAGE] User activity loaded:', userActivity);
        } catch (error) {
            console.error('[UNIVERSAL-PAGE] Error loading user activity:', error);
            userActivity = {
                nodesCreated: 0,
                votesCast: 0,
                commentsMade: 0
            };
        }
    }

    // Watch BOTH activeCentralNode reference AND its mode property
    $: if (activeCentralNode && activeCentralNode.mode !== undefined && graphData && graphStore) {
        // Force reactivity by accessing the mode in the condition
        const currentMode = activeCentralNode.mode;
        const currentType = activeCentralNode.type;
        
        const newPositions = calculateNavigationRingPositions(
            navigationNodes.length, 
            currentMode  // Use the mode we extracted
        );
        
        const positionsChanged = navigationNodes.some((node, index) => {
            const currentPos = node.metadata?.initialPosition;
            const newPos = newPositions[index];
            return !currentPos || 
                Math.abs(currentPos.x - newPos.x) > 0.1 || 
                Math.abs(currentPos.y - newPos.y) > 0.1;
        });
        
        if (positionsChanged) {
            console.log('[UNIVERSAL-PAGE] 🎯 Central node/mode changed, updating positions:', {
                nodeId: activeCentralNode.id,
                nodeType: currentType,
                mode: currentMode,
                navigationCount: navigationNodes.length,
                newRingRadius: Math.sqrt(newPositions[0].x ** 2 + newPositions[0].y ** 2).toFixed(1)
            });
            
            // Update navigation nodes with new positions
            navigationNodes = navigationNodes.map((node, index) => ({
                ...node,
                metadata: {
                    group: 'navigation' as const,
                    fixed: true,
                    isDetail: false,
                    votes: 0,
                    ...node.metadata,
                    initialPosition: {
                        x: newPositions[index].x,
                        y: newPositions[index].y
                    },
                    angle: newPositions[index].angle
                }
            }));

            // Update graph data
            graphData = {
                ...graphData,
                nodes: [
                    ...navigationNodes,
                    activeCentralNode,
                    ...graphData.nodes.filter(n => 
                        n.type !== 'navigation' && 
                        n.id !== controlNodeId && 
                        n.id !== 'dashboard-central' &&
                        n.id !== 'edit-profile-central' &&
                        n.id !== 'create-node-central'
                    )
                ]
            };

            // CLEAN DIRECT METHOD CALL
            if (graphStore && typeof graphStore.updateNavigationPositions === 'function') {
                console.log('[UNIVERSAL-PAGE] 🎯 Updating navigation positions via graphStore');
                graphStore.updateNavigationPositions(navigationNodes);
            } else {
                console.error('[UNIVERSAL-PAGE] ❌ updateNavigationPositions method not available on graphStore');
            }
        }
    }

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
        // Only include the ACTIVE central node
        graphData = {
            nodes: [...navigationNodes, activeCentralNode],
            links: []
        };
        
        console.log('[UNIVERSAL-PAGE] Initial graph data created:', {
            nodes: graphData.nodes.length,
            links: graphData.links.length,
            centralNodeType: currentCentralNodeType
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
            
            // Extract common properties (same for all node types)
         const commonProperties = {
                id: node.id,
                participant_count: node.participant_count,
                created_at: node.created_at,
                created_by: node.created_by,
                public_credit: node.public_credit,
                keywords: node.keywords || [],
                categories: node.categories || [], 
                positiveVotes: getNeo4jNumber(node.metadata?.votes?.positive) || 0,
                negativeVotes: getNeo4jNumber(node.metadata.votes?.negative) || 0,
                netVotes: getNeo4jNumber(node.metadata.votes?.net) || 0,
                userVoteStatus: node.metadata.userVoteStatus?.status || 'none',
                userVisibilityPreference: node.metadata.userVisibilityPreference
            };
            
            // UPDATED: Build type-specific node data using switch statement
            let nodeData: any;
            
            switch (node.type) {
                case 'openquestion':
                    nodeData = {
                        ...commonProperties,
                        questionText: node.content,
                        answerCount: getNeo4jNumber(node.metadata.answer_count) || 0,
                        categories: node.metadata.categories || []
                    };
                    break;
                    
              case 'statement':
                nodeData = {
                    ...commonProperties,
                    statement: node.content,
                    relatedStatements: node.metadata?.relatedStatements || [],
                    parentQuestion: node.metadata?.parentQuestion,
                    discussionId: node.discussionId,  // ✅ FIXED - top level
                    initialComment: node.metadata?.initialComment || '',
                };
                break;
                    
               case 'answer':
                    nodeData = {
                        ...commonProperties,
                        answerText: node.content,
                        questionId: node.metadata?.parentQuestion?.nodeId || node.metadata?.discussionId || '',
                        parentQuestion: node.metadata?.parentQuestion,
                        discussionId: node.discussionId,  // ✅ Top level
                    };
                    break;
                    
                case 'quantity':
                    nodeData = {
                        ...commonProperties,
                        question: node.content,
                        unitCategoryId: node.unitCategoryId || node.metadata?.unitCategoryId || '',
                        defaultUnitId: node.defaultUnitId || node.metadata?.defaultUnitId || '',
                        discussionId: node.discussionId,  // ✅ Top level
                    };
                    break;
                    
                case 'evidence':
                    nodeData = {
                        ...commonProperties,
                        title: node.content,
                        url: node.metadata?.sourceUrl || '',
                        parentNodeId: node.metadata?.parentNode?.nodeId || node.metadata?.parentNode || '',
                        evidenceType: node.metadata?.evidenceType || '',
                        sourceUrl: node.metadata?.sourceUrl,
                        parentNode: node.metadata?.parentNode,
                        discussionId: node.discussionId,  // ✅ Top level
                    };
                    break;

                case 'category':
                    nodeData = {
                        ...commonProperties,
                        name: node.content || node.name,
                        wordCount: node.metadata?.wordCount || 0,
                        contentCount: node.metadata?.contentCount || 0,
                        childCount: node.metadata?.childCount || 0,
                        words: node.metadata?.words || [],
                        parentCategory: node.metadata?.parentCategory || null,
                        childCategories: node.metadata?.childCategories || [],
                        discussionId: node.discussionId
                    };
                    break;

                case 'word':
                    nodeData = {
                        ...commonProperties,
                        word: node.content || node.word,
                        definitionCount: node.metadata?.definitionCount || 0,
                        usageCount: node.metadata?.usageCount || 0,
                        categoryId: node.metadata?.categoryId || node.categoryId,
                        definitions: node.metadata?.definitions || []
                    };
                    break;    
                    
                default:
                    // Fallback for unknown types
                    console.warn(`[UNIVERSAL-PAGE] Unknown node type: ${node.type}`);
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
                    
                    // Type-specific metadata
                    answer_count: node.type === 'openquestion' ? getNeo4jNumber(node.metadata.answer_count) || 0 : undefined,
                    related_statements_count: node.type === 'statement' ? (node.metadata.relatedStatements?.length || 0) : undefined,
                    parent_question: node.type === 'answer' ? node.metadata.parentQuestion : undefined,
                    parent_node: node.type === 'evidence' ? node.metadata.parentNode : undefined,
                    source_url: node.type === 'evidence' ? node.metadata.sourceUrl : undefined,
                    
                    // User context
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
            nodeTypes: universalGraphNodes.reduce((acc: any, n) => {
                acc[n.type] = (acc[n.type] || 0) + 1;
                return acc;
            }, {}),
            links: graphData.links.length,
            hasGraphStore: !!graphStore
        });
        
        // Update phantom links status
        phantomLinksStatus.linksCount = graphData.links.length;
        
        // Set data on graph store
        if (graphStore) {
            console.log('[UNIVERSAL-PAGE] Setting data on bound graph store');
            // Force restart to ensure nodes reposition when sort/filter changes
            graphStore.setData(graphData, { forceRestart: true });
            
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
            universalDataProcessed = true;
        }, 100);
    }

    // ============================================================================
    // BULLETPROOF FILTER CHANGE HANDLER - Eliminates ALL race conditions
    // ============================================================================
    function handleFilterChange(event: CustomEvent) {
        console.log('[UNIVERSAL-PAGE] 🔥 Filter change received');
        
        // CRITICAL: Immediately lock to prevent any other operations
        if (isFilterOperationLocked) {
            console.warn('[UNIVERSAL-PAGE] ⛔ Filter operation already in progress - BLOCKING');
            return;
        }
        
        isFilterOperationLocked = true;
        console.log('[UNIVERSAL-PAGE] 🔒 Filter operation LOCKED');
        
        const filters = event.detail;
        
        // CRITICAL: Abort any in-flight API request
        if (currentAbortController) {
            currentAbortController.abort();
            console.log('[UNIVERSAL-PAGE] ⛔ Aborted previous API request');
        }
        
        // Create new AbortController for this request
        currentAbortController = new AbortController();
        
        // Increment sequence number for this request
        requestSequence++;
        const thisRequestSequence = requestSequence;
        console.log('[UNIVERSAL-PAGE] 🎯 Starting request #', thisRequestSequence);
        
        console.log('[UNIVERSAL-PAGE] Filter details:', filters);
        
        if (!$userStore) {
            console.warn('[UNIVERSAL-PAGE] No user available, skipping filter update');
            isFilterOperationLocked = false;
            return;
        }
        
        // Update ALL filter settings in the store
        
        // 1. Node Types Filter
        if (filters.nodeTypes !== undefined) {
            console.log('[UNIVERSAL-PAGE] Updating node type filter:', filters.nodeTypes);
            
            if (filters.nodeTypes.length > 0) {
                selectedNodeTypes = new Set(filters.nodeTypes);
                universalGraphStore.setNodeTypeFilter(filters.nodeTypes);
            } else {
                // No node types selected = show all types (default behavior)
                const allTypes: Array<
                    'openquestion' | 'statement' | 'answer' | 'quantity' | 'evidence' | 
                    'word' | 'category' | 'definition'
                > = [
                    'openquestion', 
                    'statement', 
                    'answer', 
                    'quantity', 
                    'evidence',
                    'word',
                    'category',
                    'definition'
                ];
                selectedNodeTypes = new Set(allTypes);
                universalGraphStore.setNodeTypeFilter(allTypes);
            }
        }
        
        // 2. Sort Options
        if (filters.sortBy !== undefined) {
            console.log('[UNIVERSAL-PAGE] Updating sort by:', filters.sortBy);
            // Map frontend sortBy to backend sort field names
            const sortByMapping: Record<string, UniversalSortType> = {
                'inclusion_votes': 'netVotes',
                'content_votes': 'netVotes',
                'chronological': 'chronological',
                'latest_activity': 'chronological',
                'participants': 'participants'
            };
            sortType = sortByMapping[filters.sortBy] || 'netVotes';
            universalGraphStore.setSortType(sortType);
        }
        
        if (filters.sortDirection !== undefined) {
            console.log('[UNIVERSAL-PAGE] Updating sort direction:', filters.sortDirection);
            sortDirection = filters.sortDirection;
            universalGraphStore.setSortDirection(sortDirection);
        }
        
        // 3. Keyword Filter
        if (filters.keywords !== undefined) {
            console.log('[UNIVERSAL-PAGE] Updating keyword filter:', filters.keywords);
            filterKeywords = filters.keywords;
            universalGraphStore.setKeywordFilter(filterKeywords, keywordOperator);
        }
        
        // 4. Category Filter
        if (filters.categories !== undefined) {
            console.log('[UNIVERSAL-PAGE] Updating category filter:', filters.categories);
            // Categories filter will be implemented when backend support is added
        }
        
        // 5. User Filter
        if (filters.showOnlyMyItems !== undefined) {
            console.log('[UNIVERSAL-PAGE] Updating user filter:', {
                showOnlyMyItems: filters.showOnlyMyItems,
                userFilterMode: filters.userFilterMode
            });
            
            showOnlyMyItems = filters.showOnlyMyItems;
            
            if (showOnlyMyItems) {
                universalGraphStore.setUserFilter($userStore.sub);
            } else {
                universalGraphStore.setUserFilter(undefined);
            }
        }
        
        // Now trigger a reload of the data from the backend
        console.log('[UNIVERSAL-PAGE] 🔄 Reloading graph data with new filters...');
        universalDataProcessed = false;
        nodesLoading = true;
        
        universalGraphStore.loadNodes($userStore, thisRequestSequence)
            .then(() => {
                // CRITICAL: Check if this is still the latest request
                if (thisRequestSequence !== requestSequence) {
                    console.warn(`[UNIVERSAL-PAGE] ⛔ Discarding stale response #${thisRequestSequence}, latest is #${requestSequence}`);
                    return;
                }
                
                nodesLoading = false;
                isFilterOperationLocked = false;
                console.log('[UNIVERSAL-PAGE] ✅ Graph data reloaded successfully');
                console.log('[UNIVERSAL-PAGE] 🔓 Filter operation UNLOCKED');
            })
            .catch(error => {
                // Check if this was an abort (which is expected)
                if (error?.name === 'AbortError') {
                    console.log('[UNIVERSAL-PAGE] Request aborted (expected)');
                    return;
                }
                
                console.error('[UNIVERSAL-PAGE] ❌ Error reloading graph data:', error);
                
                // Only unlock if this is still the latest request
                if (thisRequestSequence === requestSequence) {
                    nodesLoading = false;
                    isFilterOperationLocked = false;
                    console.log('[UNIVERSAL-PAGE] 🔓 Filter operation UNLOCKED (error)');
                }
            });
    }

    function handleNodeModeChange(event: CustomEvent<{ nodeId: string; mode: NodeMode; radius?: number }>) {
        const { nodeId, mode } = event.detail;
        
        console.log('[UNIVERSAL-PAGE] 🔄 MODE CHANGE EVENT:', { 
            nodeId: nodeId.substring(0, 20), 
            mode,
            isControlNode: nodeId === controlNodeId,
            isDashboardNode: nodeId === 'dashboard-central',
            currentCentralType: currentCentralNodeType,
            willUpdateActiveCentral: (nodeId === controlNodeId && currentCentralNodeType === 'control') ||
                                    (nodeId === 'dashboard-central' && currentCentralNodeType === 'dashboard')
        });
        
        // Update the control node if it changed
        if (nodeId === controlNodeId) {
            console.log('[UNIVERSAL-PAGE] 🎮 Updating control node mode:', controlNodeMode, '→', mode);
            controlNodeMode = mode;
            controlNode = {
                ...controlNode,
                mode
            };
            
            // CRITICAL: If control node is the ACTIVE central node, update activeCentralNode to trigger reactivity
            if (currentCentralNodeType === 'control') {
                console.log('[UNIVERSAL-PAGE] ⭐ Control is ACTIVE central - updating activeCentralNode to trigger repositioning');
                activeCentralNode = {
                    ...controlNode,
                    mode
                };
            }
        } 
        // Update the dashboard node if it changed
            else if (nodeId === 'dashboard-central' && dashboardNode) {
            console.log('[UNIVERSAL-PAGE] 📊 Updating dashboard node mode to:', mode);
            dashboardNode = {
                ...dashboardNode,
                mode
            };
            
            // If dashboard is the ACTIVE central node, update activeCentralNode to trigger reactivity
            if (currentCentralNodeType === 'dashboard') {
                console.log('[UNIVERSAL-PAGE] ⭐ Dashboard is ACTIVE central - updating activeCentralNode to trigger repositioning');
                activeCentralNode = {
                    ...dashboardNode,
                    mode
                };
            }
        } else if (nodeId === 'edit-profile-central' && editProfileNode) {
            console.log('[UNIVERSAL-PAGE] ⚙️ Updating edit profile node mode to:', mode);
            editProfileNode = {
                ...editProfileNode,
                mode
            };
            
            // If edit profile is the ACTIVE central node, update activeCentralNode to trigger reactivity
            if (currentCentralNodeType === 'edit-profile') {
                console.log('[UNIVERSAL-PAGE] ⭐ Edit Profile is ACTIVE central - updating activeCentralNode to trigger repositioning');
                activeCentralNode = {
                    ...editProfileNode,
                    mode
                };
            }
        } else if (nodeId === 'create-node-central' && createNodeNode) {
            console.log('[UNIVERSAL-PAGE] 🔨 Updating create node node mode to:', mode);
            createNodeNode = {
                ...createNodeNode,
                mode
            };
            
            // If create node is the ACTIVE central node, update activeCentralNode to trigger reactivity
            if (currentCentralNodeType === 'create-node') {
                console.log('[UNIVERSAL-PAGE] ⭐ Create Node is ACTIVE central - updating activeCentralNode to trigger repositioning');
                activeCentralNode = {
                    ...createNodeNode,
                    mode
                };
            }
        }
    }

    // Handle node visibility changes
    function handleVisibilityChange(event: CustomEvent<{ nodeId: string; isHidden: boolean }>) {
        const { nodeId, isHidden } = event.detail;
        
        // Skip visibility updates for non-content nodes
        const node = graphData.nodes.find(n => n.id === nodeId);
        if (!node || ['navigation', 'control'].includes(node.type)) {
            return;
        }
        
        // Update visibility preference
        visibilityStore.setPreference(nodeId, !isHidden, 'user');
        
        console.log('[UNIVERSAL-PAGE] Visibility changed:', { nodeId, isHidden });
    }

    /**
     * Handle category tag click - expand category in graph
     * 
     * Process:
     * 1. Check if category already exists in graph
     * 2. If exists: center on existing node
     * 3. If not exists: fetch category data, add to graph, center on new node
     * 4. Reheat simulation to allow nodes to settle
     */


async function handleExpandCategory(event: CustomEvent<{
    categoryId: string;
    categoryName: string;
    sourceNodeId: string;
    sourcePosition: { x: number; y: number };
}>) {
    const { categoryId, categoryName, sourceNodeId, sourcePosition } = event.detail;
    
    console.log('[UNIVERSAL-PAGE] Category expansion requested:', {
        categoryId, categoryName, sourceNodeId, sourcePosition
    });
    
    try {
        // Check if category already exists in graphData (not store array to avoid type issues)
        const existingCategoryNode = graphData.nodes.find(n => 
            n.type === 'category' && n.id === categoryId
        );
        
        if (existingCategoryNode) {
            console.log('[UNIVERSAL-PAGE] Category already exists, centering on it:', categoryId);
            if (graphStore && typeof (graphStore as any).centerOnNodeById === 'function') {
                (graphStore as any).centerOnNodeById(categoryId, 750);
            }
            return;
        }
        
        console.log('[UNIVERSAL-PAGE] Category not in graph, fetching expansion data...');
        
        // Fetch category data (includes category + word nodes)
        const expansionData = await fetchCategoryExpansion(categoryId);
        
        console.log('[UNIVERSAL-PAGE] Category expansion data received:', {
            totalNodeCount: expansionData.nodes.length,
            totalRelationshipCount: expansionData.relationships.length
        });
        
        // FILTER: Extract ONLY the category node (first node in response)
        const categoryApiNode = expansionData.nodes.find((n: any) => n.type === 'category');
        
        if (!categoryApiNode) {
            console.error('[UNIVERSAL-PAGE] No category node found in expansion response');
            return;
        }
        
        console.log('[UNIVERSAL-PAGE] Extracted category node:', {
            categoryId: categoryApiNode.id,
            categoryName: categoryApiNode.name || categoryApiNode.content,
            wordCount: expansionData.nodes.filter((n: any) => n.type === 'word').length
        });
        
        // Extract word nodes from the expansion data
        const wordApiNodes = expansionData.nodes.filter((n: any) => n.type === 'word');
        
        // Create words array for the category data
        const wordsArray = wordApiNodes.map((w: any) => ({
            id: w.id || w.word,
            word: w.word || w.content,
            inclusionNetVotes: w.inclusionNetVotes || 0
        }));
        
        console.log('[UNIVERSAL-PAGE] Extracted words for category:', {
            wordCount: wordsArray.length,
            words: wordsArray.map(w => w.word)
        });
        
        // Calculate position near source node
        const categoryPosition = calculateProximalPosition(
            sourcePosition,
            graphData.nodes as any[],  // Cast to avoid type issues
            150  // Distance from source node
        );
        
        console.log('[UNIVERSAL-PAGE] Calculated position for category node:', categoryPosition);
        
        // Transform the category node to GraphNode format
        const categoryGraphNode: GraphNode = {
            id: categoryApiNode.id,
            type: 'category' as NodeType,
            data: {
                id: categoryApiNode.id,
                name: categoryApiNode.name || categoryApiNode.content,
                createdBy: categoryApiNode.created_by || categoryApiNode.createdBy,
                publicCredit: categoryApiNode.public_credit ?? categoryApiNode.publicCredit ?? true,
                createdAt: categoryApiNode.created_at || categoryApiNode.createdAt,
                updatedAt: categoryApiNode.updated_at || categoryApiNode.updatedAt,
                inclusionPositiveVotes: categoryApiNode.inclusionPositiveVotes || 0,
                inclusionNegativeVotes: categoryApiNode.inclusionNegativeVotes || 0,
                inclusionNetVotes: categoryApiNode.inclusionNetVotes || 0,
                wordCount: categoryApiNode.wordCount || wordsArray.length,
                contentCount: categoryApiNode.contentCount || 0,
                childCount: categoryApiNode.childCount || 0,
                words: wordsArray,
                parentCategory: categoryApiNode.parentCategory || null,
                childCategories: categoryApiNode.childCategories || [],
                discussionId: categoryApiNode.discussionId
            },
            group: 'category' as NodeGroup,
            mode: 'preview' as NodeMode,
            metadata: {
                group: 'category' as any,
                initialPosition: categoryPosition,
                ...(categoryApiNode.metadata || {})
            }
        };
        
        // FILTER: Only include relationships that connect the category to EXISTING nodes
        // Get IDs of nodes that will be in the graph after we add the category
        const existingNodeIds = new Set([
            ...graphData.nodes.map(n => n.id),
            categoryGraphNode.id
        ]);
        
        // Filter GraphLinks for the graph update
        const relevantLinks: GraphLink[] = expansionData.relationships
            .filter((rel: any) => {
                const sourceExists = existingNodeIds.has(rel.source);
                const targetExists = existingNodeIds.has(rel.target);
                const isComposedOf = rel.type === 'composed_of' || rel.type === 'COMPOSED_OF';
                
                return sourceExists && targetExists && !isComposedOf;
            })
            .map((rel: any) => ({
                id: rel.id,
                source: rel.source,
                target: rel.target,
                type: rel.type as LinkType,
                strength: rel.metadata?.strength,
                metadata: rel.metadata
            }));
        
        console.log('[UNIVERSAL-PAGE] Adding ONLY category node to graph:', {
            categoryNodeId: categoryGraphNode.id,
            categoryHasWords: wordsArray.length > 0,
            wordsInCategory: wordsArray.map(w => w.word),
            relevantLinks: relevantLinks.length,
            excludedWordNodes: expansionData.nodes.filter((n: any) => n.type === 'word').length,
            excludedComposedOfLinks: expansionData.relationships.filter((r: any) => 
                r.type === 'composed_of' || r.type === 'COMPOSED_OF'
            ).length
        });
        
        // Create COMPLETE graph data with the new category node
        if (graphStore) {
            const expandedGraphData: GraphData = {
                nodes: [...graphData.nodes, categoryGraphNode],
                links: [...graphData.links, ...relevantLinks]
            };
            
            console.log('[UNIVERSAL-PAGE] Adding category node via updateState...', {
                previousNodeCount: graphData.nodes.length,
                newNodeCount: expandedGraphData.nodes.length,
                addedNodes: 1,  // Only 1 category node
                previousLinkCount: graphData.links.length,
                newLinkCount: expandedGraphData.links.length,
                addedLinks: relevantLinks.length
            });
            
            // Use updateState with low wake power to add the category node gently
            if (typeof (graphStore as any).updateState === 'function') {
                console.log('[UNIVERSAL-PAGE] Calling updateState with 0.6 wake power');
                (graphStore as any).updateState(expandedGraphData, 0.6);
                // CRITICAL: Don't update graphData here - prevents gentle sync override
            }
            // Fallback: regular setData (will cause restart)
            else {
                console.warn('[UNIVERSAL-PAGE] updateState not available, using setData');
                graphStore.setData(expandedGraphData);
            }
        }
        
        // Wait for node to be positioned, then center (up to 2 seconds)
        waitForNodePositionAndCenter(graphStore, categoryGraphNode.id, 20, 100, 750);
        
        console.log('[UNIVERSAL-PAGE] Category node addition complete');
        
    } catch (error) {
        console.error('[UNIVERSAL-PAGE] Error expanding category:', error);
    }
}

/**
 * Handle keyword tag click - expand word and definitions in graph
 * 
 * Process:
 * 1. Check if word node already exists
 * 2. If exists: center on existing word node
 * 3. If not exists: fetch word + definitions, add to graph, center on word
 * 4. Definitions are sorted by contentNetVotes (highest first) and positioned closest to word
 */
async function handleExpandWord(event: CustomEvent<{
    word: string;
    sourceNodeId: string;
    sourcePosition: { x: number; y: number };
}>) {
    const { word, sourceNodeId, sourcePosition } = event.detail;
    
    console.log('[UNIVERSAL-PAGE] Word expansion requested:', {
        word, sourceNodeId, sourcePosition
    });
    
    try {
        // Check if word node already exists
        const existingWordNode = graphData.nodes.find(n => 
            n.type === 'word' && 
            (n.data as any).word?.toLowerCase() === word.toLowerCase()
        );
        
        if (existingWordNode) {
            console.log('[UNIVERSAL-PAGE] Word already exists, centering:', word);
            if (graphStore && typeof (graphStore as any).centerOnNodeById === 'function') {
                (graphStore as any).centerOnNodeById(existingWordNode.id, 750);
            }
            return;
        }
        
        console.log('[UNIVERSAL-PAGE] Word not in graph, fetching expansion data...');
        
        // Fetch word + definitions
        const expansionData = await fetchWordExpansion(word);
        
        console.log('[UNIVERSAL-PAGE] Word expansion data received:', {
            totalNodeCount: expansionData.nodes.length,
            definitionCount: expansionData.nodes.filter(n => n.type === 'definition').length
        });
        
        // Extract word node and definition nodes
        const wordApiNode = expansionData.nodes.find(n => n.type === 'word');
        const definitionApiNodes = expansionData.nodes.filter(n => n.type === 'definition');
        
        if (!wordApiNode) {
            console.error('[UNIVERSAL-PAGE] No word node in expansion response');
            return;
        }
        
        // Sort definitions by content net votes (highest first)
            const sortedDefinitions = [...definitionApiNodes].sort((a, b) => {
            const aVotes = a.content_net_votes || a.contentNetVotes || 0;
            const bVotes = b.content_net_votes || b.contentNetVotes || 0;
            return bVotes - aVotes;
        });

        console.log('[UNIVERSAL-PAGE] Sorted definitions by content votes:', 
            sortedDefinitions.map(d => ({
                id: d.id,
                contentNetVotes: d.content_net_votes || d.contentNetVotes || 0
            }))
        );
        
        // Calculate position for word node (near source)
        const wordPosition = calculateProximalPosition(
            sourcePosition,
            graphData.nodes as any[],
            150
        );
        
        console.log('[UNIVERSAL-PAGE] Calculated word position:', wordPosition);
        
        // Calculate positions for definitions (ring around word, sorted by votes)
        const definitionPositions = calculateDefinitionRing(
            wordPosition,
            sortedDefinitions.length,
            220  // Radius of ring around word
        );
        
        // Transform word node to GraphNode
        const wordGraphNode: GraphNode = {
            id: wordApiNode.id || word.toLowerCase(),
            type: 'word' as NodeType,
            data: {
                id: wordApiNode.id || word.toLowerCase(),
                word: wordApiNode.word || word,
                createdBy: wordApiNode.created_by || wordApiNode.createdBy || '',
                publicCredit: wordApiNode.public_credit ?? wordApiNode.publicCredit ?? true,
                inclusionPositiveVotes: wordApiNode.inclusion_positive_votes || wordApiNode.inclusionPositiveVotes || 0,
                inclusionNegativeVotes: wordApiNode.inclusion_negative_votes || wordApiNode.inclusionNegativeVotes || 0,
                inclusionNetVotes: wordApiNode.inclusion_net_votes || wordApiNode.inclusionNetVotes || 0,
                contentPositiveVotes: 0,
                contentNegativeVotes: 0,
                contentNetVotes: 0,
                createdAt: wordApiNode.created_at || wordApiNode.createdAt || new Date().toISOString(),
                updatedAt: wordApiNode.updated_at || wordApiNode.updatedAt || new Date().toISOString(),
                categories: [],
                keywords: []
            },
            group: 'word' as NodeGroup,
            mode: 'preview' as NodeMode,
            metadata: {
                group: 'word',
                initialPosition: wordPosition,
                net_votes: wordApiNode.inclusion_net_votes || wordApiNode.inclusionNetVotes || 0
            }
        };
        
        // Transform definition nodes to GraphNode (using sorted order)
        const definitionGraphNodes: GraphNode[] = sortedDefinitions.map((defNode, index) => ({
            id: defNode.id,
            type: 'definition' as NodeType,
            data: {
                id: defNode.id,
                word: word,
                definitionText: defNode.definitionText || '',
                createdBy: defNode.created_by || defNode.createdBy || '',
                publicCredit: defNode.public_credit ?? defNode.publicCredit ?? true,
                isApiDefinition: defNode.is_api_definition ?? defNode.isApiDefinition ?? false,
                isAICreated: defNode.is_ai_created ?? defNode.isAICreated ?? false,
                // ✅ NEW: Mark if this is the live definition (highest content votes = index 0)
                isLiveDefinition: index === 0,
                inclusionPositiveVotes: defNode.inclusion_positive_votes || defNode.inclusionPositiveVotes || 0,
                inclusionNegativeVotes: defNode.inclusion_negative_votes || defNode.inclusionNegativeVotes || 0,
                inclusionNetVotes: defNode.inclusion_net_votes || defNode.inclusionNetVotes || 0,
                contentPositiveVotes: defNode.content_positive_votes || defNode.contentPositiveVotes || 0,
                contentNegativeVotes: defNode.content_negative_votes || defNode.contentNegativeVotes || 0,
                contentNetVotes: defNode.content_net_votes || defNode.contentNetVotes || 0,
                createdAt: defNode.created_at || defNode.createdAt || new Date().toISOString(),
                updatedAt: defNode.updated_at || defNode.updatedAt || new Date().toISOString(),
            },
            group: 'definition' as NodeGroup,
            mode: 'preview' as NodeMode,
            metadata: {
                group: 'definition',
                initialPosition: definitionPositions[index],
                net_votes: defNode.inclusion_net_votes || defNode.inclusionNetVotes || 0,
                // ✅ NEW: Also store in metadata for easy access
                isLiveDefinition: index === 0
            }
        }));
        
        // Get existing node IDs for relationship filtering
        const existingNodeIds = new Set(graphData.nodes.map(n => n.id));
        existingNodeIds.add(wordGraphNode.id);
        definitionGraphNodes.forEach(n => existingNodeIds.add(n.id));
        
        // Transform relationships
        const relevantLinks: GraphLink[] = expansionData.relationships
            .filter(rel => {
                const sourceExists = existingNodeIds.has(rel.source);
                const targetExists = existingNodeIds.has(rel.target);
                return sourceExists && targetExists;
            })
            .map(rel => ({
                id: rel.id,
                source: rel.source,
                target: rel.target,
                type: rel.type as LinkType,
                metadata: rel.metadata
            }));
        
        console.log('[UNIVERSAL-PAGE] Adding word + definitions to graph:', {
            wordNodeId: wordGraphNode.id,
            definitionCount: definitionGraphNodes.length,
            relevantLinks: relevantLinks.length,
            definitionOrder: definitionGraphNodes.map(d => ({
                id: d.id,
                contentVotes: (d.data as any).contentNetVotes
            }))
        });
        
        // Filter relationships for store
        const relevantApiRelationships = expansionData.relationships.filter(rel => {
            const sourceExists = existingNodeIds.has(rel.source);
            const targetExists = existingNodeIds.has(rel.target);
            return sourceExists && targetExists;
        });
        
        // Create expanded graph data
        if (graphStore) {
            const expandedGraphData: GraphData = {
                nodes: [...graphData.nodes, wordGraphNode, ...definitionGraphNodes],
                links: [...graphData.links, ...relevantLinks]
            };
            
            console.log('[UNIVERSAL-PAGE] Adding nodes via updateState...', {
                previousNodeCount: graphData.nodes.length,
                newNodeCount: expandedGraphData.nodes.length,
                addedNodes: 1 + definitionGraphNodes.length,
                previousLinkCount: graphData.links.length,
                newLinkCount: expandedGraphData.links.length
            });
            
            // Use updateState with 0.6 wake power to add nodes gently
            if (typeof (graphStore as any).updateState === 'function') {
                console.log('[UNIVERSAL-PAGE] Calling updateState with 0.6 wake power');
                (graphStore as any).updateState(expandedGraphData, 0.6);
                // CRITICAL: Don't update graphData here - prevents gentle sync override
            }
            // Fallback: regular setData (will cause restart)
            else {
                console.warn('[UNIVERSAL-PAGE] updateState not available, using setData');
                graphStore.setData(expandedGraphData);
                graphData = expandedGraphData;
            }
        }
        
        // Wait for node to be positioned, then center (up to 2 seconds)
        waitForNodePositionAndCenter(graphStore, wordGraphNode.id, 20, 100, 750);
        
        console.log('[UNIVERSAL-PAGE] Word expansion complete');
        
    } catch (error) {
        console.error('[UNIVERSAL-PAGE] Error expanding word:', error);
    }
}

async function handleExpandStatement(event: CustomEvent<{
    statementId: string;
    sourceNodeId: string;
    sourcePosition: { x: number; y: number };
}>) {
    const { statementId, sourceNodeId, sourcePosition } = event.detail;
    
    console.log('[UNIVERSAL-PAGE] Statement expansion requested:', {
        statementId, sourceNodeId, sourcePosition
    });
    
    try {
        // Check if statement already exists
        const existingStatementNode = graphData.nodes.find(n => 
            n.type === 'statement' && n.id === statementId
        );
        
        if (existingStatementNode) {
            console.log('[UNIVERSAL-PAGE] Statement already exists, centering:', statementId);
            if (graphStore && typeof (graphStore as any).centerOnNodeById === 'function') {
                (graphStore as any).centerOnNodeById(statementId, 750);
            }
            return;
        }
        
        console.log('[UNIVERSAL-PAGE] Statement not in graph, fetching expansion data...');
        
        // Fetch statement data
        const expansionData = await fetchStatementExpansion(statementId);
        
        console.log('[UNIVERSAL-PAGE] Statement expansion data received:', {
            statementId: expansionData.nodes[0]?.id,
            content: expansionData.nodes[0]?.content?.substring(0, 50)
        });
        
        // Extract statement node
        const statementApiNode = expansionData.nodes[0];
        
        if (!statementApiNode) {
            console.error('[UNIVERSAL-PAGE] No statement node in expansion response');
            return;
        }
        
        // Calculate position near source node
        const statementPosition = calculateProximalPosition(
            sourcePosition,
            graphData.nodes as any[],
            150
        );
        
        console.log('[UNIVERSAL-PAGE] Calculated statement position:', statementPosition);
        
        // Transform to GraphNode format
        const statementGraphNode: GraphNode = {
            id: statementApiNode.id,
            type: 'statement' as NodeType,
            data: {
                id: statementApiNode.id,
                statement: (statementApiNode as any).statement,
                createdBy: statementApiNode.created_by || statementApiNode.createdBy,
                publicCredit: statementApiNode.public_credit ?? statementApiNode.publicCredit ?? true,
                createdAt: statementApiNode.created_at || statementApiNode.createdAt,
                updatedAt: statementApiNode.updated_at || statementApiNode.updatedAt,
                keywords: statementApiNode.keywords || [],
                categories: statementApiNode.categories || [],
                positiveVotes: statementApiNode.metadata?.votes?.positive || 0,
                negativeVotes: statementApiNode.metadata?.votes?.negative || 0,
                netVotes: statementApiNode.metadata?.votes?.net || 0,
                relatedStatements: statementApiNode.metadata?.relatedStatements || [],
                parentQuestion: statementApiNode.metadata?.parentQuestion,
                discussionId: statementApiNode.metadata?.discussionId,
                initialComment: statementApiNode.metadata?.initialComment || ''
            },
            group: 'statement' as NodeGroup,
            mode: 'preview' as NodeMode,
            metadata: {
                group: 'statement' as any,
                initialPosition: statementPosition,
                net_votes: statementApiNode.metadata?.votes?.net || 0,
                participant_count: statementApiNode.participant_count || 0
            }
        };
        
        console.log('[UNIVERSAL-PAGE] Adding statement node to graph:', {
            statementId: statementGraphNode.id,
            position: statementPosition
        });
        
        // Create expanded graph data
        if (graphStore) {
            const expandedGraphData: GraphData = {
                nodes: [...graphData.nodes, statementGraphNode],
                links: [...graphData.links] // No new links for statement (no child nodes)
            };
            
            console.log('[UNIVERSAL-PAGE] Adding statement via updateState...', {
                previousNodeCount: graphData.nodes.length,
                newNodeCount: expandedGraphData.nodes.length
            });
            
            // Use updateState with 0.6 wake power to add statement gently
            if (typeof (graphStore as any).updateState === 'function') {
                console.log('[UNIVERSAL-PAGE] Calling updateState with 0.6 wake power');
                (graphStore as any).updateState(expandedGraphData, 0.6);
            }
            // Fallback: regular setData
            else {
                console.warn('[UNIVERSAL-PAGE] updateState not available, using setData');
                graphStore.setData(expandedGraphData);
            }
        }
        
        // Wait for node to be positioned, then center (up to 2 seconds)
        waitForNodePositionAndCenter(graphStore, statementGraphNode.id, 20, 100, 750);
        
        console.log('[UNIVERSAL-PAGE] Statement expansion complete');
        
    } catch (error) {
        console.error('[UNIVERSAL-PAGE] Error expanding statement:', error);
    }
}

async function handleExpandOpenQuestion(event: CustomEvent<{
    questionId: string;
    sourceNodeId: string;
    sourcePosition: { x: number; y: number };
}>) {
    const { questionId, sourceNodeId, sourcePosition } = event.detail;
    
    console.log('[UNIVERSAL-PAGE] OpenQuestion expansion requested:', {
        questionId, sourceNodeId, sourcePosition
    });
    
    try {
        // Check if already exists
        const existingNode = graphData.nodes.find(n => 
            n.type === 'openquestion' && n.id === questionId
        );
        
        if (existingNode) {
            console.log('[UNIVERSAL-PAGE] OpenQuestion already exists, centering:', questionId);
            if (graphStore && typeof (graphStore as any).centerOnNodeById === 'function') {
                (graphStore as any).centerOnNodeById(questionId, 750);
            }
            return;
        }
        
        console.log('[UNIVERSAL-PAGE] OpenQuestion not in graph, fetching expansion data...');
        
        // Fetch data
        const expansionData = await fetchOpenQuestionExpansion(questionId);
        const questionApiNode = expansionData.nodes[0];
        
        if (!questionApiNode) {
            console.error('[UNIVERSAL-PAGE] No question node in expansion response');
            return;
        }
        
        // Extract question text (try multiple field names)
        const questionText = (questionApiNode as any).questionText || 
                            (questionApiNode as any).content || 
                            (questionApiNode as any).text || 
                            '';
        
        if (!questionText) {
            console.error('[UNIVERSAL-PAGE] No question text found! Available fields:', 
                Object.keys(questionApiNode));
            return;
        }
        
        console.log('[UNIVERSAL-PAGE] Question text extracted:', questionText.substring(0, 50) + '...');
        
        // Calculate position
        const questionPosition = calculateProximalPosition(
            sourcePosition,
            graphData.nodes as any[],
            150
        );
        
        console.log('[UNIVERSAL-PAGE] Calculated position:', questionPosition);
        
        // Transform to GraphNode
        const questionGraphNode: GraphNode = {
            id: questionApiNode.id,
            type: 'openquestion' as NodeType,
            data: {
                id: questionApiNode.id,
                questionText: questionText,
                answerCount: (questionApiNode as any).metadata?.answer_count || 0,
                createdBy: (questionApiNode as any).created_by || 
                          (questionApiNode as any).createdBy || '',
                publicCredit: (questionApiNode as any).public_credit ?? 
                             (questionApiNode as any).publicCredit ?? true,
                createdAt: (questionApiNode as any).created_at || 
                          (questionApiNode as any).createdAt || new Date().toISOString(),
                updatedAt: (questionApiNode as any).updated_at || 
                          (questionApiNode as any).updatedAt,
                keywords: (questionApiNode as any).keywords || [],
                categories: (questionApiNode as any).categories || [],
                positiveVotes: (questionApiNode as any).metadata?.votes?.positive || 0,
                negativeVotes: (questionApiNode as any).metadata?.votes?.negative || 0,
                netVotes: (questionApiNode as any).metadata?.votes?.net || 0
            },
            group: 'openquestion' as NodeGroup,
            mode: 'preview' as NodeMode,
            metadata: {
                group: 'openquestion' as any,
                initialPosition: questionPosition,
                net_votes: (questionApiNode as any).metadata?.votes?.net || 0,
                answer_count: (questionApiNode as any).metadata?.answer_count || 0,
                participant_count: (questionApiNode as any).participant_count || 0
            }
        };
        
        console.log('[UNIVERSAL-PAGE] ✅ Created question node:', {
            questionId: questionGraphNode.id,
            questionText: questionText.substring(0, 50) + '...',
            position: questionPosition
        });
        
        // Create expanded graph data
        if (graphStore) {
            const expandedGraphData: GraphData = {
                nodes: [...graphData.nodes, questionGraphNode],
                links: [...graphData.links]
            };
            
            console.log('[UNIVERSAL-PAGE] Adding question via updateState...', {
                previousNodeCount: graphData.nodes.length,
                newNodeCount: expandedGraphData.nodes.length
            });
            
            // Use updateState with 0.6 wake power
            if (typeof (graphStore as any).updateState === 'function') {
                console.log('[UNIVERSAL-PAGE] Calling updateState with 0.6 wake power');
                (graphStore as any).updateState(expandedGraphData, 0.6);
            } else {
                console.warn('[UNIVERSAL-PAGE] updateState not available, using setData');
                graphStore.setData(expandedGraphData);
            }
        }
        
        // Wait for positioning then center
        waitForNodePositionAndCenter(graphStore, questionGraphNode.id, 20, 100, 750);
        
        console.log('[UNIVERSAL-PAGE] OpenQuestion expansion complete');
        
    } catch (error) {
        console.error('[UNIVERSAL-PAGE] Error expanding openquestion:', error);
    }
}

async function handleExpandQuantity(event: CustomEvent<{
    quantityId: string;
    sourceNodeId: string;
    sourcePosition: { x: number; y: number };
}>) {
    const { quantityId, sourceNodeId, sourcePosition } = event.detail;
    
    console.log('[UNIVERSAL-PAGE] Quantity expansion requested:', {
        quantityId, sourceNodeId, sourcePosition
    });
    
    try {
        // Check if already exists
        const existingNode = graphData.nodes.find(n => 
            n.type === 'quantity' && n.id === quantityId
        );
        
        if (existingNode) {
            console.log('[UNIVERSAL-PAGE] Quantity already exists, centering:', quantityId);
            if (graphStore && typeof (graphStore as any).centerOnNodeById === 'function') {
                (graphStore as any).centerOnNodeById(quantityId, 750);
            }
            return;
        }
        
        console.log('[UNIVERSAL-PAGE] Quantity not in graph, fetching expansion data...');
        
        // Fetch data
        const expansionData = await fetchQuantityExpansion(quantityId);
        const quantityApiNode = expansionData.nodes[0];
        
        if (!quantityApiNode) {
            console.error('[UNIVERSAL-PAGE] No quantity node in expansion response');
            return;
        }
        
        // Extract question text (try multiple field names)
        const questionText = (quantityApiNode as any).question || 
                            (quantityApiNode as any).content || 
                            (quantityApiNode as any).text || 
                            '';
        
        if (!questionText) {
            console.error('[UNIVERSAL-PAGE] No question text found! Available fields:', 
                Object.keys(quantityApiNode));
            return;
        }
        
        console.log('[UNIVERSAL-PAGE] Question text extracted:', questionText.substring(0, 50) + '...');
        
        // Calculate position
        const quantityPosition = calculateProximalPosition(
            sourcePosition,
            graphData.nodes as any[],
            150
        );
        
        console.log('[UNIVERSAL-PAGE] Calculated position:', quantityPosition);
        
        // Transform to GraphNode
        const quantityGraphNode: GraphNode = {
            id: quantityApiNode.id,
            type: 'quantity' as NodeType,
            data: {
                id: quantityApiNode.id,
                question: questionText,
                unitCategoryId: (quantityApiNode as any).unitCategoryId || null,
                defaultUnitId: (quantityApiNode as any).defaultUnitId || null,
                responses: (quantityApiNode as any).metadata?.responses || {},
                createdBy: (quantityApiNode as any).created_by || 
                          (quantityApiNode as any).createdBy || '',
                publicCredit: (quantityApiNode as any).public_credit ?? 
                             (quantityApiNode as any).publicCredit ?? true,
                createdAt: (quantityApiNode as any).created_at || 
                          (quantityApiNode as any).createdAt || new Date().toISOString(),
                updatedAt: (quantityApiNode as any).updated_at || 
                          (quantityApiNode as any).updatedAt,
                keywords: (quantityApiNode as any).keywords || [],
                categories: (quantityApiNode as any).categories || [],
                positiveVotes: (quantityApiNode as any).metadata?.votes?.positive || 0,
                negativeVotes: (quantityApiNode as any).metadata?.votes?.negative || 0,
                netVotes: (quantityApiNode as any).metadata?.votes?.net || 0
            },
            group: 'quantity' as NodeGroup,
            mode: 'preview' as NodeMode,
            metadata: {
                group: 'quantity' as any,
                initialPosition: quantityPosition,
                net_votes: (quantityApiNode as any).metadata?.votes?.net || 0,
                participant_count: (quantityApiNode as any).participant_count || 0
            }
        };
        
        console.log('[UNIVERSAL-PAGE] ✅ Created quantity node:', {
            quantityId: quantityGraphNode.id,
            questionText: questionText.substring(0, 50) + '...',
            position: quantityPosition
        });
        
        // Create expanded graph data
        if (graphStore) {
            const expandedGraphData: GraphData = {
                nodes: [...graphData.nodes, quantityGraphNode],
                links: [...graphData.links]
            };
            
            console.log('[UNIVERSAL-PAGE] Adding quantity via updateState...', {
                previousNodeCount: graphData.nodes.length,
                newNodeCount: expandedGraphData.nodes.length
            });
            
            // Use updateState with 0.6 wake power
            if (typeof (graphStore as any).updateState === 'function') {
                console.log('[UNIVERSAL-PAGE] Calling updateState with 0.6 wake power');
                (graphStore as any).updateState(expandedGraphData, 0.6);
            } else {
                console.warn('[UNIVERSAL-PAGE] updateState not available, using setData');
                graphStore.setData(expandedGraphData);
            }
        }
        
        // Wait for positioning then center
        waitForNodePositionAndCenter(graphStore, quantityGraphNode.id, 20, 100, 750);
        
        console.log('[UNIVERSAL-PAGE] Quantity expansion complete');
        
    } catch (error) {
        console.error('[UNIVERSAL-PAGE] Error expanding quantity:', error);
    }
}

/**
 * Handle answer question - create contextual answer creation node
 */
function handleAnswerQuestion(event: CustomEvent<{
    questionId: string;
    questionText: string;
    sourceNodeId: string;
    sourcePosition: { x: number; y: number };
}>) {
    const { questionId, questionText, sourceNodeId, sourcePosition } = event.detail;
    
    console.log('[UNIVERSAL-PAGE] Answer question requested:', {
        questionId,
        questionText: questionText.substring(0, 50) + '...',
        sourcePosition
    });
    
    // Generate unique ID for the answer creation node
    const answerCreationNodeId = `create-answer-${questionId}-${Date.now()}`;
    
    // Calculate position near the question node
    const answerFormPosition = calculateProximalPosition(
        sourcePosition,
        graphData.nodes as any[],
        150
    );
    
    console.log('[UNIVERSAL-PAGE] Calculated answer form position:', answerFormPosition);
    
    // Create contextual CreateNodeNode configured for answer creation
   const answerCreationNode: GraphNode = {
        id: answerCreationNodeId,
        type: 'create-node' as NodeType,
        data: $userStore!,
        group: 'content' as any,  // ← CHANGED: Use content group to allow positioning
        mode: 'detail' as NodeMode,
        metadata: {
            group: 'content' as any,  // ← CHANGED
            initialPosition: answerFormPosition,
            contextualConfig: {
                nodeType: 'answer',
                parentNodeId: questionId,
                parentNodeType: 'openquestion',
                parentDisplayText: questionText,
                parentPosition: sourcePosition
            }
        } as any
    };
    
    console.log('[UNIVERSAL-PAGE] Created contextual answer creation node:', {
        nodeId: answerCreationNodeId,
        position: answerFormPosition,
        contextualConfig: (answerCreationNode.metadata as any)?.contextualConfig
    });
    
    // Add the answer creation node to the graph
    const expandedGraphData: GraphData = {  // ← CHANGED: Added type annotation
        nodes: [...graphData.nodes, answerCreationNode],
        links: [...graphData.links]
    };
    
    // Update graph with modest wake power (form node is interactive)
    if (graphStore && typeof (graphStore as any).updateState === 'function') {
        console.log('[UNIVERSAL-PAGE] Calling updateState with 0.4 wake power');
        (graphStore as any).updateState(expandedGraphData, 0.4);  // ← CHANGED: Use graphStore.updateState
    } else {
        console.warn('[UNIVERSAL-PAGE] updateState not available, using setData');
        graphStore?.setData(expandedGraphData);
    }
    
    console.log('[UNIVERSAL-PAGE] Answer creation node added to graph');
    
    // Center viewport on the new form node
    setTimeout(() => {
        if (graphStore && typeof (graphStore as any).centerOnNodeById === 'function') {
            (graphStore as any).centerOnNodeById(answerCreationNodeId, 750);
        }
    }, 300);
}

/**
 * Handle answer expansion - add created answer to graph
 */
async function handleExpandAnswer(event: CustomEvent<{
    answerId: string;
    sourceNodeId: string;
    sourcePosition: { x: number; y: number };
}>) {
    const { answerId, sourceNodeId, sourcePosition } = event.detail;
    
    console.log('[UNIVERSAL-PAGE] Answer expansion requested:', {
        answerId,
        sourceNodeId,
        sourcePosition
    });
    
    try {
        // Check if answer already exists in graph
        const existingAnswerNode = graphData.nodes.find(n => 
            n.type === 'answer' && n.id === answerId
        );
        
        if (existingAnswerNode) {
            console.log('[UNIVERSAL-PAGE] Answer already exists, centering on it:', answerId);
            
            // Remove the CreateNodeNode (source)
            const filteredNodes = graphData.nodes.filter(n => n.id !== sourceNodeId);
            const cleanedGraphData: GraphData = {
                nodes: filteredNodes,
                links: graphData.links
            };
            
            if (graphStore && typeof (graphStore as any).updateState === 'function') {
                (graphStore as any).updateState(cleanedGraphData, 0.3);
            } else {
                graphStore?.setData(cleanedGraphData);
            }
            
            // Center on existing answer
            if (graphStore && typeof (graphStore as any).centerOnNodeById === 'function') {
                (graphStore as any).centerOnNodeById(answerId, 750);
            }
            return;
        }
        
        console.log('[UNIVERSAL-PAGE] Answer not in graph, fetching expansion data...');
        
        // Fetch answer expansion data
        const expansionData = await fetchAnswerExpansion(answerId);
        const answerApiNode = expansionData.nodes[0];
        
        if (!answerApiNode) {
            console.error('[UNIVERSAL-PAGE] No answer node in expansion response');
            return;
        }
        
        // Extract answer text
        const answerText = (answerApiNode as any).answerText || 
                          (answerApiNode as any).content || 
                          (answerApiNode as any).text || 
                          '';
        
        if (!answerText) {
            console.error('[UNIVERSAL-PAGE] No answer text found! Available fields:', 
                Object.keys(answerApiNode));
            return;
        }
        
        console.log('[UNIVERSAL-PAGE] Answer text extracted:', answerText.substring(0, 50) + '...');
        
        // Use the same position as the CreateNodeNode (sourcePosition)
        const answerPosition = sourcePosition;
        
        // Transform to GraphNode
        const answerGraphNode: GraphNode = {
            id: answerApiNode.id,
            type: 'answer' as NodeType,
            data: {
                id: answerApiNode.id,
                answerText: answerText,
                questionId: (answerApiNode as any).questionId || 
                           (answerApiNode as any).parentQuestionId || null,
                createdBy: (answerApiNode as any).created_by || 
                          (answerApiNode as any).createdBy || '',
                publicCredit: (answerApiNode as any).public_credit ?? 
                             (answerApiNode as any).publicCredit ?? false,
                categories: (answerApiNode as any).categories || [],
                keywords: (answerApiNode as any).keywords || []
            },
            group: 'content' as NodeGroup,
            mode: 'preview' as NodeMode,
            metadata: {
                group: 'content' as any,
                initialPosition: answerPosition
            }
        };
        
        console.log('[UNIVERSAL-PAGE] ✅ Created answer node:', {
            answerId: answerGraphNode.id,
            position: answerPosition,
            answerText: answerText.substring(0, 30) + '...'
        });
        
        // Remove the CreateNodeNode and add the real answer node
        const filteredNodes = graphData.nodes.filter(n => n.id !== sourceNodeId);
        const updatedGraphData: GraphData = {
            nodes: [...filteredNodes, answerGraphNode],
            links: graphData.links // Relationships created by backend
        };
        
        console.log('[UNIVERSAL-PAGE] Adding answer via updateState...');
        
        if (graphStore && typeof (graphStore as any).updateState === 'function') {
            console.log('[UNIVERSAL-PAGE] Calling updateState with 0.6 wake power');
            (graphStore as any).updateState(updatedGraphData, 0.6);
        } else {
            console.warn('[UNIVERSAL-PAGE] updateState not available, using setData');
            graphStore?.setData(updatedGraphData);
        }
        
        // Wait for positioning and center
        await waitForNodePositionAndCenter(
            graphStore,
            answerGraphNode.id,
            20,    // maxAttempts
            100,   // delayMs
            750    // centerDuration
        );
        
        console.log('[UNIVERSAL-PAGE] Answer expansion complete');
        
    } catch (error) {
        console.error('[UNIVERSAL-PAGE] Error expanding answer:', error);
    }
}

/**
 * Handle create definition - create contextual definition creation node
 */
function handleCreateDefinition(event: CustomEvent<{
    wordId: string;
    word: string;
    sourceNodeId: string;
    sourcePosition: { x: number; y: number };
}>) {
    const { wordId, word, sourceNodeId, sourcePosition } = event.detail;
    
    console.log('[UNIVERSAL-PAGE] Create definition requested:', {
        wordId,
        word,
        sourcePosition
    });
    
    // Generate unique ID for the definition creation node
    const definitionCreationNodeId = `create-definition-${wordId}-${Date.now()}`;
    
    // Calculate position near the word node
    const definitionFormPosition = calculateProximalPosition(
        sourcePosition,
        graphData.nodes as any[],
        150
    );
    
    console.log('[UNIVERSAL-PAGE] Calculated definition form position:', definitionFormPosition);
    
    // Create contextual CreateNodeNode configured for definition creation
    const definitionCreationNode: GraphNode = {
        id: definitionCreationNodeId,
        type: 'create-node' as NodeType,
        data: $userStore!,
        group: 'content' as any,
        mode: 'detail' as NodeMode,
        metadata: {
            group: 'content' as any,
            initialPosition: definitionFormPosition,
            contextualConfig: {
                nodeType: 'definition',
                parentNodeId: wordId,
                parentNodeType: 'word',
                parentDisplayText: word,
                parentPosition: sourcePosition
            }
        } as any
    };
    
    console.log('[UNIVERSAL-PAGE] Created contextual definition creation node:', {
        nodeId: definitionCreationNodeId,
        position: definitionFormPosition,
        contextualConfig: (definitionCreationNode.metadata as any)?.contextualConfig
    });
    
    // Add the definition creation node to the graph
    const expandedGraphData: GraphData = {
        nodes: [...graphData.nodes, definitionCreationNode],
        links: [...graphData.links]
    };
    
    // Update graph with modest wake power
    if (graphStore && typeof (graphStore as any).updateState === 'function') {
        console.log('[UNIVERSAL-PAGE] Calling updateState with 0.4 wake power');
        (graphStore as any).updateState(expandedGraphData, 0.4);
    } else {
        console.warn('[UNIVERSAL-PAGE] updateState not available, using setData');
        graphStore?.setData(expandedGraphData);
    }
    
    console.log('[UNIVERSAL-PAGE] Definition creation node added to graph');
    
    // Center viewport on the new form node
    setTimeout(() => {
        if (graphStore && typeof (graphStore as any).centerOnNodeById === 'function') {
            (graphStore as any).centerOnNodeById(definitionCreationNodeId, 750);
        }
    }, 300);
}

/**
 * Handle definition expansion - add created definition to graph
 */
async function handleExpandDefinition(event: CustomEvent<{
    definitionId: string;
    sourceNodeId: string;
    sourcePosition: { x: number; y: number };
}>) {
    const { definitionId, sourceNodeId, sourcePosition } = event.detail;
    
    console.log('[UNIVERSAL-PAGE] Definition expansion requested:', {
        definitionId,
        sourceNodeId,
        sourcePosition
    });
    
    try {
        // Check if definition already exists in graph
        const existingDefinitionNode = graphData.nodes.find(n => 
            n.type === 'definition' && n.id === definitionId
        );
        
        if (existingDefinitionNode) {
            console.log('[UNIVERSAL-PAGE] Definition already exists, centering on it:', definitionId);
            
            // Remove the CreateNodeNode (source)
            const filteredNodes = graphData.nodes.filter(n => n.id !== sourceNodeId);
            const cleanedGraphData: GraphData = {
                nodes: filteredNodes,
                links: graphData.links
            };
            
            if (graphStore && typeof (graphStore as any).updateState === 'function') {
                (graphStore as any).updateState(cleanedGraphData, 0.3);
            } else {
                graphStore?.setData(cleanedGraphData);
            }
            
            // Center on existing definition
            if (graphStore && typeof (graphStore as any).centerOnNodeById === 'function') {
                (graphStore as any).centerOnNodeById(definitionId, 750);
            }
            return;
        }
        
        console.log('[UNIVERSAL-PAGE] Definition not in graph, fetching expansion data...');
        
        // Fetch definition expansion data
        const expansionData = await fetchDefinitionExpansion(definitionId);
        const definitionApiNode = expansionData.nodes[0];
        
        if (!definitionApiNode) {
            console.error('[UNIVERSAL-PAGE] No definition node in expansion response');
            return;
        }
        
        // Extract definition text
        const definitionText = (definitionApiNode as any).definitionText || 
                              (definitionApiNode as any).content || 
                              (definitionApiNode as any).text || 
                              '';
        
        if (!definitionText) {
            console.error('[UNIVERSAL-PAGE] No definition text found! Available fields:', 
                Object.keys(definitionApiNode));
            return;
        }
        
        console.log('[UNIVERSAL-PAGE] Definition text extracted:', definitionText.substring(0, 50) + '...');
        
        // Use the same position as the CreateNodeNode (sourcePosition)
        const definitionPosition = sourcePosition;
        
        // Transform to GraphNode
        const definitionGraphNode: GraphNode = {
            id: definitionApiNode.id,
            type: 'definition' as NodeType,
            data: {
                id: definitionApiNode.id,
                word: (definitionApiNode as any).word || '',
                definitionText: definitionText,
                createdBy: (definitionApiNode as any).created_by || 
                          (definitionApiNode as any).createdBy || '',
                publicCredit: (definitionApiNode as any).public_credit ?? 
                             (definitionApiNode as any).publicCredit ?? true,
                isApiDefinition: (definitionApiNode as any).is_api_definition ?? 
                               (definitionApiNode as any).isApiDefinition ?? false,
                isAICreated: (definitionApiNode as any).is_ai_created ?? 
                            (definitionApiNode as any).isAICreated ?? false
            },
            group: 'definition' as NodeGroup,
            mode: 'preview' as NodeMode,
            metadata: {
                group: 'definition' as any,
                initialPosition: definitionPosition
            }
        };
        
        console.log('[UNIVERSAL-PAGE] ✅ Created definition node:', {
            definitionId: definitionGraphNode.id,
            position: definitionPosition,
            definitionText: definitionText.substring(0, 30) + '...'
        });
        
        // Remove the CreateNodeNode and add the real definition node
        const filteredNodes = graphData.nodes.filter(n => n.id !== sourceNodeId);
        const updatedGraphData: GraphData = {
            nodes: [...filteredNodes, definitionGraphNode],
            links: graphData.links // Relationships created by backend
        };
        
        console.log('[UNIVERSAL-PAGE] Adding definition via updateState...');
        
        if (graphStore && typeof (graphStore as any).updateState === 'function') {
            console.log('[UNIVERSAL-PAGE] Calling updateState with 0.6 wake power');
            (graphStore as any).updateState(updatedGraphData, 0.6);
        } else {
            console.warn('[UNIVERSAL-PAGE] updateState not available, using setData');
            graphStore?.setData(updatedGraphData);
        }
        
        // Wait for positioning and center
        await waitForNodePositionAndCenter(
            graphStore,
            definitionGraphNode.id,
            20,    // maxAttempts
            100,   // delayMs
            750    // centerDuration
        );
        
        console.log('[UNIVERSAL-PAGE] Definition expansion complete');
        
    } catch (error) {
        console.error('[UNIVERSAL-PAGE] Error expanding definition:', error);
    }
}

async function handleCreateEvidence(event: CustomEvent<{
        parentNodeId: string;
        parentNodeType: string;
        parentDisplayText: string;
        sourceNodeId: string;
        sourcePosition: { x: number; y: number };
    }>) {
        if (!graphStore) return;
        
        const { parentNodeId, parentNodeType, parentDisplayText, sourcePosition } = event.detail;
        
        console.log('[UNIVERSAL-PAGE] Creating evidence form node:', {
            parentNodeId,
            parentNodeType,
            parentDisplayText: parentDisplayText.substring(0, 50) + '...'
        });
        
        // Generate unique ID for the creation node
        const evidenceCreationNodeId = `create-evidence-${Date.now()}`;
        
        // Calculate position near parent (150px offset)
        const evidenceFormPosition = calculateProximalPosition(
            sourcePosition,
            graphData.nodes,
            150
        );
        
        console.log('[UNIVERSAL-PAGE] Evidence form position calculated:', evidenceFormPosition);
        
        // Create the evidence creation node with contextual config
        const evidenceCreationNode: GraphNode = {
            id: evidenceCreationNodeId,
            type: 'create-node' as NodeType,
            data: $userStore!,
            group: 'content' as any,
            mode: 'detail' as NodeMode,
            metadata: {
                group: 'content' as any,
                initialPosition: evidenceFormPosition,
                contextualConfig: {
                    nodeType: 'evidence',
                    parentNodeId: parentNodeId,
                    parentNodeType: parentNodeType,
                    parentDisplayText: parentDisplayText,
                    parentPosition: sourcePosition
                }
            } as any
        };
        
        // Add to graph
        const updatedGraphData: GraphData = {
            nodes: [...graphData.nodes, evidenceCreationNode],
            links: graphData.links
        };
        
        console.log('[UNIVERSAL-PAGE] Adding evidence creation node to graph');
        
        if (typeof (graphStore as any).updateState === 'function') {
            (graphStore as any).updateState(updatedGraphData, 0.4);
        } else {
            graphStore.setData(updatedGraphData);
        }
        
        // Center on the new creation node
        setTimeout(() => {
            if (graphStore && typeof (graphStore as any).centerOnNodeById === 'function') {
                (graphStore as any).centerOnNodeById(evidenceCreationNodeId, 750);
            }
        }, 100);
    }

    async function handleExpandEvidence(event: CustomEvent<{
        evidenceId: string;
        sourceNodeId: string;
        sourcePosition: { x: number; y: number };
    }>) {
        if (!graphStore) return;
        
        const { evidenceId, sourceNodeId, sourcePosition } = event.detail;
        
        console.log('[UNIVERSAL-PAGE] Expanding evidence node:', {
            evidenceId,
            sourceNodeId,
            sourcePosition
        });
        
        try {
            // Check if evidence already exists
            const existingEvidenceNode = graphData.nodes.find(n => 
                n.type === 'evidence' && n.id === evidenceId
            );
            
            if (existingEvidenceNode) {
                console.log('[UNIVERSAL-PAGE] Evidence already exists, centering on it:', evidenceId);
                
                // Remove CreateNodeNode
                const filteredNodes = graphData.nodes.filter(n => n.id !== sourceNodeId);
                const cleanedGraphData: GraphData = {
                    nodes: filteredNodes,
                    links: graphData.links
                };
                
                if (typeof (graphStore as any).updateState === 'function') {
                    (graphStore as any).updateState(cleanedGraphData, 0.3);
                } else {
                    graphStore.setData(cleanedGraphData);
                }
                
                // Center on existing evidence
                if (typeof (graphStore as any).centerOnNodeById === 'function') {
                    (graphStore as any).centerOnNodeById(evidenceId, 750);
                }
                return;
            }
            
            console.log('[UNIVERSAL-PAGE] Evidence not in graph, fetching expansion data...');
            
            // Fetch evidence expansion data
            const expansionData = await fetchEvidenceExpansion(evidenceId);
            const evidenceApiNode = expansionData.nodes[0];
            
            if (!evidenceApiNode) {
                console.error('[UNIVERSAL-PAGE] No evidence node in expansion response');
                return;
            }
            
            // Extract evidence data
            const title = evidenceApiNode.title || '';
            const url = evidenceApiNode.url || '';
            const evidenceType = evidenceApiNode.evidenceType || 'other';
            
            if (!title) {
                console.error('[UNIVERSAL-PAGE] No evidence title found! Available fields:', 
                    Object.keys(evidenceApiNode));
                return;
            }
            
            console.log('[UNIVERSAL-PAGE] Evidence data extracted:', {
                title: title.substring(0, 50) + '...',
                url,
                evidenceType
            });
            
            // Use the same position as the CreateNodeNode
            const evidencePosition = sourcePosition;
            
            // Transform to GraphNode
            const evidenceGraphNode: GraphNode = {
                id: evidenceApiNode.id,
                type: 'evidence' as NodeType,
                data: {
                    id: evidenceApiNode.id,
                    title: title,
                    url: url,
                    evidenceType: evidenceType,
                    parentNodeId: evidenceApiNode.parentNodeId,
                    parentNodeType: evidenceApiNode.parentNodeType,
                    createdBy: evidenceApiNode.created_by || evidenceApiNode.createdBy || '',
                    publicCredit: evidenceApiNode.public_credit ?? evidenceApiNode.publicCredit ?? false,
                    createdAt: evidenceApiNode.created_at || evidenceApiNode.createdAt,
                    updatedAt: evidenceApiNode.updated_at || evidenceApiNode.updatedAt,
                    keywords: evidenceApiNode.keywords || [],
                    categories: evidenceApiNode.categories || [],
                    positiveVotes: evidenceApiNode.metadata?.votes?.positive || 0,
                    negativeVotes: evidenceApiNode.metadata?.votes?.negative || 0,
                    netVotes: evidenceApiNode.metadata?.votes?.net || 0,
                    peerReview: evidenceApiNode.metadata?.peerReview,
                    discussionId: evidenceApiNode.metadata?.discussionId,
                    initialComment: evidenceApiNode.metadata?.initialComment || ''
                },
                group: 'content' as NodeGroup,
                mode: 'preview' as NodeMode,
                metadata: {
                    group: 'content' as any,
                    initialPosition: evidencePosition,
                    net_votes: evidenceApiNode.metadata?.votes?.net || 0
                }
            };
            
            console.log('[UNIVERSAL-PAGE] ✅ Created evidence node:', {
                evidenceId: evidenceGraphNode.id,
                position: evidencePosition,
                title: title.substring(0, 30) + '...'
            });
            
            // Remove CreateNodeNode and add real evidence node
            const filteredNodes = graphData.nodes.filter(n => n.id !== sourceNodeId);
            const updatedGraphData: GraphData = {
                nodes: [...filteredNodes, evidenceGraphNode],
                links: graphData.links // Relationships created by backend
            };
            
            console.log('[UNIVERSAL-PAGE] Adding evidence via updateState...');
            
            if (typeof (graphStore as any).updateState === 'function') {
                console.log('[UNIVERSAL-PAGE] Calling updateState with 0.6 wake power');
                (graphStore as any).updateState(updatedGraphData, 0.6);
            } else {
                console.warn('[UNIVERSAL-PAGE] updateState not available, using setData');
                graphStore.setData(updatedGraphData);
            }
            
            // Wait for positioning and center
            await waitForNodePositionAndCenter(
                graphStore,
                evidenceGraphNode.id,
                20,    // maxAttempts
                100,   // delayMs
                750    // centerDuration
            );
            
            console.log('[UNIVERSAL-PAGE] Evidence expansion complete');
            
        } catch (error) {
            console.error('[UNIVERSAL-PAGE] Error expanding evidence:', error);
        }
    }

/**
 * Handle create linked node - create contextual node creation form
 * Shows filtered node type selection (Statement, Quantity, Evidence, OpenQuestion)
 */
function handleCreateLinkedNode(event: CustomEvent<{
    nodeId: string;
    nodeType: string;
    sourcePosition: { x: number; y: number };
}>) {
    const { nodeId, nodeType, sourcePosition } = event.detail;
    
    console.log('[UNIVERSAL-PAGE] Create linked node requested:', {
        nodeId,
        nodeType,
        sourcePosition
    });
    
    // Find parent node
    const parentNode = graphData.nodes.find(n => n.id === nodeId);
    if (!parentNode) {
        console.error('[UNIVERSAL-PAGE] Parent node not found:', nodeId);
        return;
    }
    
    // Extract display text by type
    let parentDisplayText = '';
    switch (nodeType) {
        case 'statement':
            parentDisplayText = (parentNode.data as any).statement || '';
            break;
        case 'answer':
            parentDisplayText = (parentNode.data as any).answerText || '';
            break;
        case 'quantity':
            parentDisplayText = (parentNode.data as any).question || '';
            break;
        default:
            console.warn('[UNIVERSAL-PAGE] Unsupported parent type for linked node:', nodeType);
            return;
    }
    
    const createNodeId = `create-linked-${nodeId}-${Date.now()}`;
    
    console.log('[UNIVERSAL-PAGE] Parent node details:', {
        parentId: nodeId,
        parentType: nodeType,
        parentDisplayText: parentDisplayText.substring(0, 50) + '...',
        sourcePosition
    });
    
    // Calculate proximal position
    const formPosition = calculateProximalPosition(
        sourcePosition,
        graphData.nodes as any[],
        150
    );
    
    console.log('[UNIVERSAL-PAGE] Calculated form position:', formPosition);
    
    // Create CreateNodeNode with contextualConfig
    // CRITICAL: nodeType NOT set → NodeTypeSelect shows 4 filtered options
    const createNodeNode: GraphNode = {
        id: createNodeId,
        type: 'create-node' as NodeType,
        data: $userStore!,
        group: 'content' as any,
        mode: 'detail' as NodeMode,
        metadata: {
            group: 'content' as any,
            initialPosition: formPosition,
            contextualConfig: {
                // nodeType: undefined - NOT SET
                parentNodeId: nodeId,
                parentNodeType: nodeType,
                parentDisplayText: parentDisplayText,
                parentPosition: sourcePosition
            }
        } as any
    };
    
    console.log('[UNIVERSAL-PAGE] Created contextual create node:', {
        nodeId: createNodeId,
        position: formPosition,
        contextualConfig: (createNodeNode.metadata as any)?.contextualConfig
    });
    
    // Add to graph
    const expandedGraphData: GraphData = {
        nodes: [...graphData.nodes, createNodeNode],
        links: [...graphData.links]
    };
    
    // Update with modest wake power
    if (graphStore && typeof (graphStore as any).updateState === 'function') {
        console.log('[UNIVERSAL-PAGE] Calling updateState with 0.4 wake power');
        (graphStore as any).updateState(expandedGraphData, 0.4);
    } else {
        console.warn('[UNIVERSAL-PAGE] updateState not available, using setData');
        graphStore?.setData(expandedGraphData);
    }
    
    console.log('[UNIVERSAL-PAGE] Create node added to graph');
    
    // Center viewport
    setTimeout(() => {
        if (graphStore && typeof (graphStore as any).centerOnNodeById === 'function') {
            (graphStore as any).centerOnNodeById(createNodeId, 750);
        }
    }, 300);
}

/**
 * Calculate positions for definitions in a ring around word node
 * Definitions are positioned in order (sorted by content votes)
 * First definition gets angle 0 (rightmost), then counter-clockwise
 */
function calculateDefinitionRing(
    centerPosition: { x: number; y: number },
    count: number,
    radius: number
): Array<{ x: number; y: number }> {
    const positions: Array<{ x: number; y: number }> = [];
    
    if (count === 0) return positions;
    
    // Start at 0 degrees (right side) for highest-voted definition
    // Move counter-clockwise for subsequent definitions
    const angleStep = (2 * Math.PI) / count;
    
    for (let i = 0; i < count; i++) {
        const angle = i * angleStep;
        positions.push({
            x: centerPosition.x + Math.cos(angle) * radius,
            y: centerPosition.y + Math.sin(angle) * radius
        });
    }
    
    console.log('[UNIVERSAL-PAGE] Calculated definition ring positions:', {
        centerPosition,
        count,
        radius,
        positions: positions.map((p, i) => ({
            index: i,
            angle: (i * angleStep * 180 / Math.PI).toFixed(1) + '°',
            x: p.x.toFixed(1),
            y: p.y.toFixed(1)
        }))
    });
    
    return positions;
}

    /**
     * Calculate a position near the source node
     * Uses simple offset with collision avoidance
     */
    function calculateProximalPosition(
        sourcePosition: { x: number; y: number },
        existingNodes: any[],
        offset: number = 100
    ): { x: number; y: number } {
        const angle = Math.random() * 2 * Math.PI;  // Random angle
        
        let position = {
            x: sourcePosition.x + Math.cos(angle) * offset,
            y: sourcePosition.y + Math.sin(angle) * offset
        };
        
        // Simple collision check - if too close to another node, try again with larger offset
        const MIN_DISTANCE = 150;
        let attempts = 0;
        const MAX_ATTEMPTS = 5;
        
        while (attempts < MAX_ATTEMPTS) {
            const tooClose = existingNodes.some(node => {
                if (!node.position) return false;
                const dx = node.position.x - position.x;
                const dy = node.position.y - position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                return distance < MIN_DISTANCE;
            });
            
            if (!tooClose) break;
            
            // Try again with increased offset
            attempts++;
            const newOffset = offset + (attempts * 50);
            const newAngle = Math.random() * 2 * Math.PI;
            position = {
                x: sourcePosition.x + Math.cos(newAngle) * newOffset,
                y: sourcePosition.y + Math.sin(newAngle) * newOffset
            };
        }
        
        return position;
    }

    /**
     * Convert API node format to EnhancedNode format
     * This function handles both category and word nodes
     */
    function convertApiNodeToEnhanced(apiNode: any, position: { x: number; y: number }): any {
        // This is a simplified converter - expand based on your actual node structure
        // The category node will have type 'category', word nodes will have type 'word'
        
        return {
            id: apiNode.id,
            type: apiNode.type,
            data: apiNode,
            position: {
                x: position.x,
                y: position.y,
                svgTransform: `translate(${position.x}, ${position.y})`
            },
            mode: 'preview',
            group: apiNode.type,
            metadata: apiNode.metadata || {},
            // The graph manager will calculate radius based on type and mode
        };
    }

    // UPDATED: Toggle node type function - supports all 5 types
   function toggleNodeType(
        nodeType: 'openquestion' | 'statement' | 'answer' | 'quantity' | 'evidence' | 
                  'word' | 'category' | 'definition'
    ) {
        if (selectedNodeTypes.has(nodeType)) {
            selectedNodeTypes.delete(nodeType);
        } else {
            selectedNodeTypes.add(nodeType);
        }
        selectedNodeTypes = new Set(selectedNodeTypes);
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
        
        // Listen for navigation clicks to switch central node
        const navigationClickListener = ((event: CustomEvent) => {
            const { nodeType } = event.detail;
            console.log('[UNIVERSAL-PAGE] Navigation click event:', nodeType);
            
            if (nodeType === 'dashboard') {
                switchCentralNode('dashboard');
            } else if (nodeType === 'edit-profile') {
                switchCentralNode('edit-profile');
            } else if (nodeType === 'create-node') {
                switchCentralNode('create-node');
            } else if (nodeType === 'graph-controls') {
                switchCentralNode('control');
            }
        }) as EventListener;

        window.addEventListener('switch-central-node', navigationClickListener);
                
        // Listen for central node radius changes (need to reposition navigation ring)
        const radiusChangeListener = ((event: CustomEvent) => {
            const { nodeId, oldRadius, newRadius, mode } = event.detail;
            console.log('[UNIVERSAL-PAGE] 🔄 Central node radius changed:', {
                nodeId, oldRadius, newRadius, mode
            });
            
            // Recalculate navigation ring positions for the new radius
            const newPositions = calculateNavigationRingPositions(navigationNodes.length, mode);
            
            // Update navigation nodes with new positions
            navigationNodes = navigationNodes.map((node, index) => ({
                ...node,
                metadata: {
                    group: 'navigation' as const,  // Explicitly set group
                    fixed: true,
                    ...node.metadata,  // Preserve other metadata
                    initialPosition: {
                        x: newPositions[index].x,
                        y: newPositions[index].y
                    },
                    angle: newPositions[index].angle
                }
            }));
            
            // Update navigation positions in graph store
            if (graphStore && typeof graphStore.updateNavigationPositions === 'function') {
                console.log('[UNIVERSAL-PAGE] Updating navigation positions for radius change');
                graphStore.updateNavigationPositions(navigationNodes);
            }
        }) as EventListener;
        
        window.addEventListener('switch-central-node', navigationClickListener);
        window.addEventListener('central-node-radius-changed', radiusChangeListener);
        
        // Return cleanup function
        return () => {
            window.removeEventListener('switch-central-node', navigationClickListener);
            window.removeEventListener('central-node-radius-changed', radiusChangeListener);
        };
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

    <!-- BULLETPROOF: Blocking overlay during filter operations -->
    {#if isFilterOperationLocked && nodesLoading}
        <div class="filter-blocking-overlay">
            <div class="blocking-content">
                <div class="blocking-spinner"></div>
                <div class="blocking-text">Applying filters...</div>
                <div class="blocking-subtext">Please wait</div>
            </div>
        </div>
    {/if}

    <!-- Graph visualization -->
    <Graph 
        data={graphData}
        viewType={viewType}
        bind:graphStore={graphStore}
        on:modechange={handleNodeModeChange}
        on:visibilitychange={handleVisibilityChange}
        on:filterchange={handleFilterChange}
        on:expandCategory={handleExpandCategory}
        on:expandWord={handleExpandWord}
        on:expandStatement={handleExpandStatement}
        on:expandOpenQuestion={handleExpandOpenQuestion}
        on:expandQuantity={handleExpandQuantity}
        on:answerQuestion={handleAnswerQuestion}
        on:expandAnswer={handleExpandAnswer}
        on:createDefinition={handleCreateDefinition}    
        on:expandDefinition={handleExpandDefinition}
        on:createEvidence={handleCreateEvidence}
        on:expandEvidence={handleExpandEvidence}
        on:createLinkedNode={handleCreateLinkedNode}
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
        {:else if isAnswerNode(node)}
            <AnswerNode
                {node}
            />
        {:else if isQuantityNode(node)}
            <QuantityNode
                {node}
            />
        {:else if isEvidenceNode(node)}
            <EvidenceNode
                {node}
            />
        {:else if isCategoryNode(node)}
            <CategoryNode 
                {node} 
            />
        {:else if isWordNode(node)}
            <WordNode 
                {node} 
            />
        {:else if isDefinitionNode(node)}
            <DefinitionNode 
                {node} 
            />
        {:else if isCommentNode(node)}
            <CommentNode 
                {node} 
            />
        {:else if isNavigationNode(node)}
            <NavigationNode 
                {node}
            />
        {:else if isDashboardNode(node)}
            <DashboardNode 
                {node}
                {userActivity}
            />
        {:else if isEditProfileNode(node)}
            <EditProfileNode {node} />
        {:else if isCreateNodeNode(node)}
    <CreateNodeNode 
        {node}
        on:expandWord={handleExpandWord}
        on:expandCategory={handleExpandCategory}
        on:expandStatement={handleExpandStatement}
        on:expandOpenQuestion={handleExpandOpenQuestion}
        on:expandQuantity={handleExpandQuantity}
        on:expandAnswer={handleExpandAnswer}
        on:expandDefinition={handleExpandDefinition}
        on:expandEvidence={handleExpandEvidence}
    />
        {:else if node.id === controlNodeId}
            <ControlNode 
                bind:this={controlNodeRef}
                {node}
                isLoading={nodesLoading}
                applyMode="manual"
            />
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
    
    /* BULLETPROOF: Blocking overlay for filter operations */
    .filter-blocking-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 20, 0.85);
        backdrop-filter: blur(8px);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.2s ease-out;
    }
    
    @keyframes fadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
    
    .blocking-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        padding: 2rem;
        background: rgba(20, 20, 40, 0.9);
        border: 2px solid rgba(66, 153, 225, 0.5);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    }
    
    .blocking-spinner {
        width: 60px;
        height: 60px;
        border: 4px solid rgba(66, 153, 225, 0.2);
        border-top-color: rgba(66, 153, 225, 1);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }
    
    .blocking-text {
        font-family: 'Orbitron', sans-serif;
        font-size: 1.2rem;
        font-weight: 600;
        color: white;
        letter-spacing: 0.5px;
    }
    
    .blocking-subtext {
        font-family: 'Inter', sans-serif;
        font-size: 0.9rem;
        color: rgba(255, 255, 255, 0.6);
    }
</style>