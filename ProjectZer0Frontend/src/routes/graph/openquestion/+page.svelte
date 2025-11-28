<!-- src/routes/graph/openquestion/+page.svelte -->
<script lang="ts">
    import { onMount, onDestroy, tick } from 'svelte';
    import * as auth0 from '$lib/services/auth0';
    import { getOpenQuestionData } from '$lib/services/openQuestion';
    import Graph from '$lib/components/graph/Graph.svelte';
    import OpenQuestionNode from '$lib/components/graph/nodes/openquestion/OpenQuestionNode.svelte';
    import StatementNode from '$lib/components/graph/nodes/statement/StatementNode.svelte';
    import NavigationNode from '$lib/components/graph/nodes/navigation/NavigationNode.svelte';
    // import StatementAnswerForm from '$lib/components/forms/createNode/statement/StatementAnswerForm.svelte';
    import { getNavigationOptions, NavigationContext } from '$lib/services/navigation';
    import { userStore } from '$lib/stores/userStore';
    import { openQuestionStore } from '$lib/stores/openQuestionStore';
    import { openQuestionViewStore } from '$lib/stores/openQuestionViewStore';
    import { graphStore } from '$lib/stores/graphStore';
    import { visibilityStore } from '$lib/stores/visibilityPreferenceStore';
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
        isOpenQuestionNode, 
        isStatementNode, 
        isNavigationNode,
        isStatementData,
        isStatementAnswerFormNode
    } from '$lib/types/graph/enhanced';
    import type { StatementNode as StatementNodeType } from '$lib/types/domain/nodes';

    export let data: GraphPageData;

    // Initialization states
    let authInitialized = false;
    let dataInitialized = false;
    
    // Get initial question data from the page data
    let initialQuestionData = data.openQuestionData;
    
    // Define view type
    const viewType: ViewType = 'openquestion';
    
    // Node mode handling for question node (starts in detail mode)
    let questionNodeMode: NodeMode = 'detail'; 

    // Statement answer form state
    let showStatementAnswerForm = false;
    let statementAnswerFormNodeId = '';
    
    // Declare graphData variable
    let graphData: GraphData = { nodes: [], links: [] };
    
    // Reference to Graph component for viewport control
    let graphComponent: any;

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
            
            // Load question data if needed
            if (!initialQuestionData) {
                const questionId = new URL(window.location.href).searchParams.get('id');
                if (questionId) {
                    const loadedQuestion = await getOpenQuestionData(questionId);
                    if (loadedQuestion) {
                        openQuestionStore.set(loadedQuestion);
                        openQuestionViewStore.setQuestionData(loadedQuestion);
                    } else {
                        window.location.href = '/graph/dashboard';
                        return;
                    }
                } else {
                    window.location.href = '/graph/dashboard';
                    return;
                }
            } else {
                openQuestionStore.set(initialQuestionData);
                openQuestionViewStore.setQuestionData(initialQuestionData);
            }
            
            dataInitialized = true;
            
            // Set the correct view type in graph store and force update
            if (graphStore) {
                graphStore.setViewType(viewType);
                graphStore.forceTick();
            }
        } catch (error) {
            auth0.login();
        }
    }

    // Event handlers
    function handleNodeModeChange(event: CustomEvent<{ nodeId: string; mode: NodeMode }>) {
        // Handle question node mode changes specifically
        if (questionData && event.detail.nodeId === questionData.id) {
            questionNodeMode = event.detail.mode;
        }
        
        // Always update the graph store
        if (graphStore) {
            graphStore.updateNodeMode(event.detail.nodeId, event.detail.mode);
        }
    }

    function handleAnswerQuestion(event: CustomEvent<{ questionId: string }>) {
        console.log('[OpenQuestion Page] Answer question event received:', event.detail.questionId);
        
        if (!$userStore) {
            console.warn('[OpenQuestion Page] User not authenticated');
            return;
        }

        // Create a statement answer form node
        statementAnswerFormNodeId = `statement-answer-form-${Date.now()}`;
        showStatementAnswerForm = true;
        
        console.log('[OpenQuestion Page] Creating statement answer form for question:', event.detail.questionId);
        console.log('[OpenQuestion Page] Form node ID:', statementAnswerFormNodeId);
        console.log('[OpenQuestion Page] showStatementAnswerForm:', showStatementAnswerForm);
        
        // Force a tick to ensure reactive updates
        tick().then(() => {
            console.log('[OpenQuestion Page] After tick - graphData nodes:', graphData.nodes.length);
            console.log('[OpenQuestion Page] Form node exists in graphData:', 
                graphData.nodes.some((n: GraphNode) => n.id === statementAnswerFormNodeId)
            );
            
            // ENHANCEMENT: Center viewport on the form after a short delay
            setTimeout(() => {
                if (!graphComponent) {
                    return;
                }
                
                // Try to center on the form node
                if (typeof graphComponent.centerOnNodeById === 'function') {
                    console.log('[OpenQuestion Page] Centering on form node:', statementAnswerFormNodeId);
                    graphComponent.centerOnNodeById(statementAnswerFormNodeId);
                }
            }, 300); // 300ms delay to allow layout to stabilize
        });
    }

    async function handleStatementAnswerFormSuccess(event: CustomEvent<{ statementId: string; message: string }>) {
        console.log('[OpenQuestion Page] Statement answer form success:', event.detail);
        
        const receivedStatementId = event.detail.statementId;
        
        // Store the current answer IDs before update
        const previousAnswerIds = new Set(
            normalizedQuestionData?.answers?.map(a => a.id) || []
        );
        console.log('[OpenQuestion Page] Previous answer IDs:', Array.from(previousAnswerIds));
        
        // Hide the form immediately
        showStatementAnswerForm = false;
        statementAnswerFormNodeId = '';
        
        // Reload the question data to get the new answer
        if (questionData) {
            try {
                const updatedQuestion = await getOpenQuestionData(questionData.id);
                if (updatedQuestion) {
                    // Update stores
                    openQuestionStore.set(updatedQuestion);
                    openQuestionViewStore.setQuestionData(updatedQuestion);
                    
                    // Force graph data update and wait for it
                    await tick();
                    
                    // Force the graph data to rebuild
                    graphData = createGraphData();
                    
                    // Wait another tick for the graph to process the new data
                    await tick();
                    
                    // Determine which statement to center on
                    let statementIdToCenter: string | null = null;
                    
                    if (receivedStatementId === 'pending-find-newest') {
                        // Find the new answer by comparing with previous IDs
                        if (updatedQuestion.answers) {
                            for (const answer of updatedQuestion.answers) {
                                if (!previousAnswerIds.has(answer.id)) {
                                    statementIdToCenter = answer.id;
                                    console.log('[OpenQuestion Page] Found new answer that wasn\'t in previous list:', {
                                        id: answer.id,
                                        statement: answer.statement.substring(0, 50) + '...'
                                    });
                                    break;
                                }
                            }
                        }
                        
                        if (!statementIdToCenter) {
                            console.error('[OpenQuestion Page] Could not find new answer by ID comparison');
                        }
                    } else if (receivedStatementId && receivedStatementId !== 'pending-reload') {
                        // Normal case - we have the statement ID
                        statementIdToCenter = receivedStatementId;
                        console.log('[OpenQuestion Page] Using provided statement ID:', statementIdToCenter);
                        
                        // Verify it exists in the updated data
                        const nodeExists = updatedQuestion.answers?.some(a => a.id === statementIdToCenter);
                        if (!nodeExists) {
                            console.error('[OpenQuestion Page] Provided statement ID not found in updated answers!');
                            statementIdToCenter = null;
                        }
                    }
                    
                    // Center on the statement if we found one
                    if (statementIdToCenter) {
                        const finalId = statementIdToCenter;
                        console.log('[OpenQuestion Page] Will center on statement:', finalId);
                        
                        // Wait for layout to stabilize, then center
                        setTimeout(() => {
                            console.log('[OpenQuestion Page] Attempting to center after delay on:', finalId);
                            centerOnNewNode(finalId);
                        }, 1000); // Increased delay to ensure layout is fully stable
                    }
                }
            } catch (error) {
                console.error('[OpenQuestion Page] Error reloading question data:', error);
            }
        }
    }
    
    // Helper function to center on a node with multiple fallback methods
    function centerOnNewNode(nodeId: string) {
        console.log('[OpenQuestion Page] centerOnNewNode called for:', nodeId);
        
        if (!graphComponent) {
            console.error('[OpenQuestion Page] Graph component not available');
            return;
        }
        
        // First, let's check if the node exists in the current graph data
        const nodeInGraphData = graphData.nodes.find(n => n.id === nodeId);
        console.log('[OpenQuestion Page] Node in graph data:', nodeInGraphData ? {
            id: nodeInGraphData.id,
            type: nodeInGraphData.type,
            group: nodeInGraphData.group
        } : 'NOT FOUND');
        
        // Method 1: Try direct centerOnNodeById
        if (typeof graphComponent.centerOnNodeById === 'function') {
            const success = graphComponent.centerOnNodeById(nodeId);
            if (success) {
                return;
            } else {
            }
        }
        
        // Method 2: Try to get node state and center on coordinates
        if (typeof graphComponent.getInternalState === 'function') {
            const state = graphComponent.getInternalState();
            if (state && state.nodes) {
                console.log('[OpenQuestion Page] Graph state has', state.nodes.length, 'nodes');
                const node = state.nodes.find((n: any) => n.id === nodeId);
                if (node && node.position) {
                    console.log('[OpenQuestion Page] Found node in state:', {
                        id: node.id,
                        position: node.position,
                        type: node.type
                    });
                    if (typeof graphComponent.centerViewportOnCoordinates === 'function') {
                        graphComponent.centerViewportOnCoordinates(node.position.x, node.position.y);
                        return;
                    }
                } else {
                }
            }
        }
        
        // Method 3: Dispatch a custom event (like discussion view does)
        window.dispatchEvent(new CustomEvent('center-on-node', { 
            detail: { 
                nodeId: nodeId,
                duration: 750
            }
        }));
    }

    function handleStatementAnswerFormCancel() {
        // Hide the form
        showStatementAnswerForm = false;
        statementAnswerFormNodeId = '';
    }

    // Handle node visibility changes  
    function handleVisibilityChange(event: CustomEvent<{ nodeId: string; isHidden: boolean }>) {
        const { nodeId, isHidden } = event.detail;
        
        // Update visibility preference - note that isVisible is the opposite of isHidden
        if (typeof window !== 'undefined' && visibilityStore) {
            visibilityStore.setPreference(nodeId, !isHidden, 'user');
        }
        
        // Update node visibility in graph
        if (graphStore) {
            graphStore.updateNodeVisibility(nodeId, isHidden, 'user');
        }
    }

    // Get question data from store or initial data
    $: questionData = $openQuestionStore || initialQuestionData;
    
    // Update openQuestionViewStore whenever questionData changes
    $: if (questionData) {
        openQuestionViewStore.setQuestionData(questionData);
    }
    
    // Ensure question data has expected structure
    $: normalizedQuestionData = questionData ? {
        ...questionData,
        answers: questionData.answers || [],
        positiveVotes: questionData.positiveVotes || 0,
        negativeVotes: questionData.negativeVotes || 0
    } : null;
    
    // Create central question node
    $: centralQuestionNode = isReady && normalizedQuestionData ? {
        id: normalizedQuestionData.id,
        type: 'openquestion' as NodeType,
        data: normalizedQuestionData,
        group: 'central' as NodeGroup,
        mode: questionNodeMode
    } : null;

    // Get navigation options for question context
    $: navigationNodes = getNavigationOptions(NavigationContext.WORD) // Reuse word context for now
        .map(option => ({
            id: option.id,
            type: 'navigation' as const,
            data: option,
            group: 'navigation' as const
        }));

    // Create statement answer form node if needed
    $: statementAnswerFormNode = showStatementAnswerForm && $userStore ? {
        id: statementAnswerFormNodeId,
        type: 'statement-answer-form' as NodeType,
        data: $userStore,
        group: 'alternative-definition' as NodeGroup, // Position like alternative definition
        mode: 'detail' as NodeMode
    } : null;

    // Log form node state for debugging
    $: console.log('[OpenQuestion] Form node state:', {
        showStatementAnswerForm,
        hasUser: !!$userStore,
        formNodeCreated: !!statementAnswerFormNode,
        formNodeId: statementAnswerFormNode?.id
    });

    // Create graph data
    function createGraphData(): GraphData {
        console.log('[OpenQuestion] createGraphData called with:', {
            showStatementAnswerForm,
            statementAnswerFormNode: !!statementAnswerFormNode,
            formNodeId: statementAnswerFormNode?.id,
            isReady,
            normalizedQuestionData: !!normalizedQuestionData,
            answerCount: normalizedQuestionData?.answers?.length || 0
        });
        
        if (!centralQuestionNode || !normalizedQuestionData) {
            return { nodes: [], links: [] };
        }

        // CRITICAL FIX: Better handling of answers array
        const rawAnswers = normalizedQuestionData.answers || [];
        console.log('[OpenQuestion] Raw answers from backend:', rawAnswers);
        
        // Additional debug: Check the actual structure of answers
        if (rawAnswers.length > 0) {
            console.log('[OpenQuestion] First answer structure:', {
                answer: rawAnswers[0],
                keys: Object.keys(rawAnswers[0] || {}),
                hasId: !!rawAnswers[0]?.id,
                hasStatement: !!rawAnswers[0]?.statement,
                idType: typeof rawAnswers[0]?.id,
                statementType: typeof rawAnswers[0]?.statement
            });
        }
        
        // Filter out invalid answers and convert to proper format
        const validAnswers = rawAnswers.filter(answer => {
            const isValid = answer && 
                           answer.id && 
                           typeof answer.id === 'string' && 
                           answer.id.trim() !== '' &&
                           answer.statement &&
                           typeof answer.statement === 'string';
            
            if (!isValid) {
                console.warn('[OpenQuestion] Invalid answer filtered out:', {
                    answer,
                    hasAnswer: !!answer,
                    hasId: !!answer?.id,
                    idType: typeof answer?.id,
                    hasStatement: !!answer?.statement,
                    statementType: typeof answer?.statement
                });
            }
            return isValid;
        });
        
        console.log('[OpenQuestion] Valid answers after filtering:', validAnswers);
        
        // Sort answers by netVotes to establish rank order (highest first)
        const sortedAnswers = [...validAnswers].sort((a, b) => {
            const aVotes = typeof a.netVotes === 'number' ? a.netVotes : 0;
            const bVotes = typeof b.netVotes === 'number' ? b.netVotes : 0;
            return bVotes - aVotes;
        });

        console.log('[OpenQuestion] Sorted answers:', sortedAnswers.map(a => ({
            id: a.id,
            statement: a.statement.substring(0, 50) + '...',
            netVotes: a.netVotes
        })));

        // Create question node with mode
        const baseNodes = [
            {
                ...centralQuestionNode,
                mode: questionNodeMode  // Ensure mode is set correctly
            },
            ...navigationNodes
        ] as GraphNode[];

        // Add statement answer form node if it exists
        if (statementAnswerFormNode) {
            baseNodes.push(statementAnswerFormNode);
        }

        // Create statement nodes for answers - FIXED: Proper StatementNode structure
        const answerStatementNodes: GraphNode[] = sortedAnswers.map((answer, index) => {
            // CRITICAL: Convert netVotes to proper positive/negative vote counts
            const netVotes = typeof answer.netVotes === 'number' ? answer.netVotes : 0;
            const positiveVotes = Math.max(0, netVotes);
            const negativeVotes = Math.max(0, -netVotes);
            
            // Create a proper StatementNode data structure
            const statementData: StatementNodeType = {
                id: answer.id,
                statement: answer.statement,
                createdBy: answer.createdBy || 'unknown',
                publicCredit: answer.publicCredit !== undefined ? answer.publicCredit : true,
                createdAt: answer.createdAt || new Date().toISOString(),
                updatedAt: answer.createdAt || new Date().toISOString(), // Use createdAt as fallback
                positiveVotes: positiveVotes,
                negativeVotes: negativeVotes,
                keywords: [], // Will be populated by backend if needed
                relatedStatements: [] // Will be populated by backend if needed
            };

            const statementNode: GraphNode = {
                id: answer.id,
                type: 'statement' as NodeType,
                data: statementData,
                group: (index === 0 ? 'live-definition' : 'alternative-definition') as NodeGroup,
                mode: 'preview' as NodeMode
            };

            console.log('[OpenQuestion] Created statement node:', {
                id: statementNode.id,
                statement: statementData.statement.substring(0, 50) + '...',
                group: statementNode.group,
                positiveVotes: statementData.positiveVotes,
                negativeVotes: statementData.negativeVotes,
                originalNetVotes: answer.netVotes
            });

            return statementNode;
        });

        // Create links between question and answers - FIXED: Better link creation
        const answerLinks: GraphLink[] = sortedAnswers.map((answer, index) => {
            const linkId = `${centralQuestionNode.id}-answers-${answer.id}`;
            const linkType = index === 0 ? 'live' : 'alternative';
            
            const link: GraphLink = {
                id: linkId,
                source: centralQuestionNode.id,
                target: answer.id,
                type: linkType as LinkType,
                metadata: {
                    relationshipType: 'answers',
                    answerRank: index + 1
                }
            };

            console.log('[OpenQuestion] Created answer link:', {
                id: link.id,
                source: link.source,
                target: link.target,
                type: link.type,
                answerRank: index + 1
            });

            return link;
        });

        // ENHANCEMENT: Create link for statement answer form with dashed style metadata
        const formLinks: GraphLink[] = statementAnswerFormNode ? [{
            id: `${centralQuestionNode.id}-${statementAnswerFormNode.id}-form`,
            source: centralQuestionNode.id,
            target: statementAnswerFormNode.id,
            type: 'alternative' as LinkType,
            metadata: {
                isDashed: true,  // This will make the link render as dashed
                linkStyle: 'form' // Additional metadata for styling
            }
        }] : [];

        // Log final graph data before return
        console.log('[OpenQuestion] Final graph data before return:', {
            totalNodes: [...baseNodes, ...answerStatementNodes].length,
            baseNodesCount: baseNodes.length,
            hasFormNode: baseNodes.some(n => n.type === 'statement-answer-form'),
            formNodeInBaseNodes: baseNodes.find(n => n.type === 'statement-answer-form'),
            answerNodes: answerStatementNodes.length
        });

        return {
            nodes: [...baseNodes, ...answerStatementNodes],
            links: [...answerLinks, ...formLinks]
        };
    }

    // Initialize variables
    $: isReady = authInitialized && dataInitialized;
    
    // Reactive statement for graphData with logging
    $: {
        console.log('[OpenQuestion] graphData reactive triggered:', {
            isReady,
            hasQuestionData: !!normalizedQuestionData,
            showStatementAnswerForm
        });
        graphData = isReady && normalizedQuestionData ? createGraphData() : { nodes: [], links: [] };
    }
    
    // Force graphData to recalculate when showStatementAnswerForm changes
    $: showStatementAnswerForm, graphData = isReady && normalizedQuestionData ? createGraphData() : { nodes: [], links: [] };

    // Log when graphData changes to verify it includes the form node
    $: if (graphData.nodes.length > 0) {
        console.log('[OpenQuestion] Graph data nodes:', graphData.nodes.map((n: GraphNode) => ({
            id: n.id,
            type: n.type
        })));
        
        // Also log if we have the expected number of answer nodes
        const answerNodeCount = graphData.nodes.filter(n => n.type === 'statement').length;
        const expectedAnswerCount = normalizedQuestionData?.answers?.length || 0;
        
        if (answerNodeCount !== expectedAnswerCount) {
            console.warn('[OpenQuestion] Answer node count mismatch:', {
                expected: expectedAnswerCount,
                actual: answerNodeCount,
                rawAnswers: normalizedQuestionData?.answers
            });
        } else {
            console.log('[OpenQuestion] Answer node count matches expected:', answerNodeCount);
        }
    }

    // Initialize on mount
    onMount(() => {
        initializeData();
    });

    // Force update when openQuestionStore changes
    $: if ($openQuestionStore && isReady) {
        // Trigger reactivity by accessing the store value
        const currentQuestion = $openQuestionStore;
        // Force graph data recreation
        graphData = createGraphData();
    }
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
{:else if !questionData}
    <div class="loading-container">
        <div class="loading-text">Question data not found</div>
    </div>
{:else}
    <Graph 
        bind:this={graphComponent}
        data={graphData}
        viewType={viewType}
        on:modechange={handleNodeModeChange}
        on:visibilitychange={handleVisibilityChange}
        on:answerQuestion={handleAnswerQuestion}
    >
        <svelte:fragment slot="default" let:node let:handleModeChange>
            {#if isOpenQuestionNode(node)}
                <OpenQuestionNode 
                    {node}
                    questionText={normalizedQuestionData?.questionText || ''}
                    on:modeChange={handleModeChange}
                    on:answerQuestion={handleAnswerQuestion}
                />
            {:else if isStatementNode(node)}
                <StatementNode 
                    {node}
                    statementText={isStatementData(node.data) ? node.data.statement : ''}
                    on:modeChange={handleModeChange}
                    on:visibilityChange={(e) => handleVisibilityChange(new CustomEvent('visibilityChange', { detail: { nodeId: node.id, isHidden: e.detail.isHidden } }))}
                />
            {:else if isNavigationNode(node)}
                <NavigationNode 
                    {node}
                    on:hover={() => {}} 
                />
            {:else if node.type === 'statement-answer-form'}
                <StatementAnswerForm 
                    {node}
                    parentQuestionId={normalizedQuestionData?.id || undefined}
                    on:modeChange={handleModeChange}
                    on:success={handleStatementAnswerFormSuccess}
                    on:cancel={handleStatementAnswerFormCancel}
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