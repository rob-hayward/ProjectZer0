<!-- src/routes/graph/universal/+page.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import * as auth0 from '$lib/services/auth0';
    import Graph from '$lib/components/graph/Graph.svelte';
    import NavigationNode from '$lib/components/graph/nodes/navigation/NavigationNode.svelte';
    import ControlNode from '$lib/components/graph/nodes/controlNode/ControlNode.svelte';
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
    
    import { universalGraphStore, type UniversalSortType, type UniversalSortDirection } from '$lib/stores/universalGraphStore';
    import { graphFilterStore, type FilterOperator } from '$lib/stores/graphFilterStore';
    import { visibilityStore } from '$lib/stores/visibilityPreferenceStore';
    import { wordListStore } from '$lib/stores/wordListStore';
    import { fetchWithAuth } from '$lib/services/api';
    import { fetchCategoryExpansion, type CategoryExpansionResponse } from '$lib/services/graph/CategoryExpansionService';
    import { fetchWordExpansion, type WordExpansionResponse } from '$lib/services/graph/WordExpansionService';
    
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
    
    // Control settings with default values
    let sortType: UniversalSortType = 'netVotes';
    let sortDirection: UniversalSortDirection = 'desc';
    let filterKeywords: string[] = [];
    let keywordOperator: FilterOperator = 'OR';
    let showOnlyMyItems = false;
    let availableKeywords: string[] = [];
    
    // UPDATED: Support all 5 content node types
    let selectedNodeTypes: Set<'openquestion' | 'statement' | 'answer' | 'quantity' | 'evidence'> = 
        new Set(['openquestion', 'statement', 'answer', 'quantity', 'evidence']);
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
                const allTypes: Array<'openquestion' | 'statement' | 'answer' | 'quantity' | 'evidence'> = 
                    ['openquestion', 'statement', 'answer', 'quantity', 'evidence'];
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
        
        // ✅ NEW: Extract word nodes from the expansion data
        const wordApiNodes = expansionData.nodes.filter((n: any) => n.type === 'word');
        
        // ✅ NEW: Create words array for the category data
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
                wordCount: categoryApiNode.wordCount || wordsArray.length,  // ✅ UPDATED: Use actual word count
                contentCount: categoryApiNode.contentCount || 0,
                childCount: categoryApiNode.childCount || 0,
                words: wordsArray,  // ✅ CHANGED: Use extracted words array instead of categoryApiNode.words
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
            categoryHasWords: wordsArray.length > 0,  // ✅ UPDATED: Show if words were included
            wordsInCategory: wordsArray.map(w => w.word),  // ✅ NEW: Show which words
            relevantLinks: relevantLinks.length,
            excludedWordNodes: expansionData.nodes.filter((n: any) => n.type === 'word').length,
            excludedComposedOfLinks: expansionData.relationships.filter((r: any) => 
                r.type === 'composed_of' || r.type === 'COMPOSED_OF'
            ).length
        });
        
        // Add only the category node to store arrays (for state management)
        nodes = [...nodes, categoryApiNode];
        
        // Filter original API relationships for the store (must match UniversalRelationshipData type)
        const relevantApiRelationships = expansionData.relationships.filter((rel: any) => {
            const sourceExists = existingNodeIds.has(rel.source);
            const targetExists = existingNodeIds.has(rel.target);
            const isComposedOf = rel.type === 'composed_of' || rel.type === 'COMPOSED_OF';
            
            return sourceExists && targetExists && !isComposedOf;
        });
        
        relationships = [...relationships, ...relevantApiRelationships];
        
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
            }
            // Fallback: regular setData (will cause restart)
            else {
                console.warn('[UNIVERSAL-PAGE] updateState not available, using setData');
                graphStore.setData(expandedGraphData);
            }
            
            // Update our local graphData reference
            // graphData = expandedGraphData;
        }
        
        // Center on the new category node
        setTimeout(() => {
            console.log('[UNIVERSAL-PAGE] Centering on new category node...');
            if (graphStore && typeof (graphStore as any).centerOnNodeById === 'function') {
                (graphStore as any).centerOnNodeById(categoryGraphNode.id, 750);
            }
        }, 500);
        
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
        
        // Center on word node after delay for settling
        setTimeout(() => {
            console.log('[UNIVERSAL-PAGE] Centering on word node...');
            if (graphStore && typeof (graphStore as any).centerOnNodeById === 'function') {
                (graphStore as any).centerOnNodeById(wordGraphNode.id, 750);
            }
        }, 500);
        
        console.log('[UNIVERSAL-PAGE] Word expansion complete');
        
    } catch (error) {
        console.error('[UNIVERSAL-PAGE] Error expanding word:', error);
    }
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
    function toggleNodeType(nodeType: 'openquestion' | 'statement' | 'answer' | 'quantity' | 'evidence') {
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
            {:else if node.id === controlNodeId}
                <!-- CRITICAL: Added applyMode="manual" prop -->
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