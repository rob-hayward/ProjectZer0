<!-- src/routes/graph/openquestion/+page.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import * as auth0 from '$lib/services/auth0';
    import { getOpenQuestionData } from '$lib/services/openQuestion';
    import Graph from '$lib/components/graph/Graph.svelte';
    import OpenQuestionNode from '$lib/components/graph/nodes/openquestion/OpenQuestionNode.svelte';
    import StatementNode from '$lib/components/graph/nodes/statement/StatementNode.svelte';
    import NavigationNode from '$lib/components/graph/nodes/navigation/NavigationNode.svelte';
    import { getNavigationOptions, NavigationContext } from '$lib/services/navigation';
    import { userStore } from '$lib/stores/userStore';
    import { openQuestionStore } from '$lib/stores/openQuestionStore';
    import { openQuestionViewStore } from '$lib/stores/openQuestionViewStore';
    import { graphStore } from '$lib/stores/graphStore';
    import { getNetVotes } from '$lib/components/graph/nodes/utils/nodeUtils';
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
        isNavigationNode 
    } from '$lib/types/graph/enhanced';

    export let data: GraphPageData;

    // Initialization states
    let authInitialized = false;
    let dataInitialized = false;
    
    // Get initial question data from the page data
    let initialQuestionData = data.openQuestionData;
    
    // Define view type
    const viewType: ViewType = 'openquestion';
    
    // Create a unique key for forcing re-renders
    let routeKey = `${viewType}-${Date.now()}`;
    
    // Node mode handling for question node (starts in detail mode)
    let questionNodeMode: NodeMode = 'detail'; 

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
                        // Add data to openQuestionViewStore for vote management
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
                // Add data to openQuestionViewStore for vote management
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
        console.log('Answer question event received:', event.detail.questionId);
        // TODO: Navigate to create statement form with this question as parent
        // For now, we'll just log it
        alert('Answer question functionality coming soon!');
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

    // Create graph data
    function createGraphData(): GraphData {
        if (!centralQuestionNode || !normalizedQuestionData) {
            return { nodes: [], links: [] };
        }

        // Get answers safely, filtering out any with null IDs
        const answers = (normalizedQuestionData.answers || []).filter(answer => 
            answer && answer.id !== null && answer.id !== undefined
        );
        
        console.log('[OpenQuestion] Filtered answers:', answers);
        
        // Sort answers by netVotes to establish rank order (highest first)
        const sortedAnswers = [...answers].sort((a, b) => 
            b.netVotes - a.netVotes
        );

        // Create question node with mode
        const baseNodes = [
            {
                ...centralQuestionNode,
                mode: questionNodeMode  // Ensure mode is set correctly
            },
            ...navigationNodes
        ] as GraphNode[];

        // Only create answer nodes if we have valid answers
        const answerNodes: GraphNode[] = sortedAnswers.map((answer, index) => ({
            id: answer.id,
            type: 'statement' as NodeType,
            data: {
                id: answer.id,
                statement: answer.statement || '',
                createdBy: answer.createdBy || '',
                createdAt: answer.createdAt || new Date().toISOString(),
                positiveVotes: answer.netVotes > 0 ? answer.netVotes : 0,
                negativeVotes: answer.netVotes < 0 ? Math.abs(answer.netVotes) : 0,
                publicCredit: true, // Default value
                keywords: [], // Will be populated by backend
                relatedStatements: []
            },
            group: (index === 0 ? 'live-definition' : 'alternative-definition') as NodeGroup, // Reuse definition groups
            mode: 'preview' as NodeMode
        }));

        // Only create links if we have valid answers
        const answerLinks: GraphLink[] = sortedAnswers.length > 0 
            ? sortedAnswers.map((answer, index) => ({
                id: `${centralQuestionNode.id}-${answer.id}-${Date.now()}-${index}`,
                source: centralQuestionNode.id,
                target: answer.id,
                type: (index === 0 ? 'live' : 'alternative') as LinkType
            }))
            : [];

        console.log('[OpenQuestion] Creating graph data:', {
            centralNode: centralQuestionNode.id,
            navigationCount: navigationNodes.length,
            answerCount: answerNodes.length,
            linkCount: answerLinks.length,
            validAnswers: answers,
            invalidAnswers: normalizedQuestionData.answers?.filter(a => !a || !a.id) || []
        });

        return {
            nodes: [...baseNodes, ...answerNodes],
            links: answerLinks
        };
    }

    // Initialize variables & create graph data
    $: isReady = authInitialized && dataInitialized;
    $: graphData = isReady && normalizedQuestionData ? createGraphData() : { nodes: [], links: [] };

    // Initialize on mount
    onMount(() => {
        initializeData();
    });

    // Force update when openQuestionStore changes
    $: if ($openQuestionStore && isReady) {
        routeKey = `${viewType}-${Date.now()}`;
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
{#key routeKey}
<Graph 
    data={graphData}
    viewType={viewType}
    on:modechange={handleNodeModeChange}
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
                statementText={node.data.statement}
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