<!-- ProjectZer0Frontend/src/routes/graph-test/[word]/+page.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { browser } from '$app/environment';
    import { getWordData } from '$lib/services/word';
    import type { WordNode, Definition } from '$lib/types/nodes';
    import type { GraphNode, GraphEdge } from '$lib/types/graph';
    import WordNodeComponent from '$lib/components/graph/nodes/word/WordNode.svelte';
    import DefinitionNodeComponent from '$lib/components/graph/nodes/definition/DefinitionNode.svelte';
    import MainGraph from '$lib/components/graph/MainGraph.svelte';
    import { BaseBackground } from '$lib/components/graph/backgrounds/BaseBackground';

    let wordData: WordNode | null = null;
    let error: string | null = null;
    let isLoading = true;
    let nodes: GraphNode[] = [];
    let edges: GraphEdge[] = [];
    let zoom = 100;

    // Canvas background
    let backgroundCanvas: HTMLCanvasElement;
    let background: BaseBackground | null = null;
    let canvasWidth = 0;
    let canvasHeight = 0;

    function updateBackground() {
        if (!backgroundCanvas || !background) return;
        const ctx = backgroundCanvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        background.update(canvasWidth, canvasHeight);
        background.draw(ctx);
        requestAnimationFrame(updateBackground);
    }

    function initializeCanvas() {
        if (!browser || !backgroundCanvas) return;
        canvasWidth = window.innerWidth;
        canvasHeight = window.innerHeight;
        backgroundCanvas.width = canvasWidth;
        backgroundCanvas.height = canvasHeight;
        
        background = new BaseBackground(35, canvasWidth, canvasHeight);
        updateBackground();
    }

    // Type guards
    function isWordNode(data: WordNode | Definition): data is WordNode {
        return 'word' in data;
    }

    function isDefinition(data: WordNode | Definition): data is Definition {
        return 'text' in data;
    }

    onMount(async () => {
        console.log('Graph test page mounted');
        try {
            const word = $page.params.word;
            if (!word) throw new Error('No word parameter provided');
            
            console.log('Fetching word data for:', word);
            const data = await getWordData(word);
            if (!data) throw new Error('No word data found');
            
            console.log('Word data loaded:', data);
            wordData = data;
            
            nodes = [
                {
                    id: data.id,
                    type: 'word' as const,
                    data: data,
                },
                ...data.definitions.map(def => ({
                    id: def.id,
                    type: 'definition' as const,
                    data: def,
                    parentId: data.id
                }))
            ];

            edges = data.definitions.map(def => ({
                source: data.id,
                target: def.id,
                type: 'wordDefinition'
            }));

            console.log('Created nodes:', nodes);
            console.log('Created edges:', edges);

            initializeCanvas();
        } catch (e) {
            console.error('Error loading word data:', e);
            error = e instanceof Error ? e.message : 'An error occurred loading the word';
        } finally {
            isLoading = false;
        }
    });
</script>

<div class="graph-test">
    <canvas 
        bind:this={backgroundCanvas}
        class="background-canvas"
    />

    <div class="status-overlay">
        <div class="status-text">
            {#if isLoading}
                Loading...
            {:else if wordData}
                Viewing "{wordData.word}" • Zoom: {zoom}% • Nodes: {nodes.length}
            {:else if error}
                Error: {error}
            {:else}
                No word data
            {/if}
        </div>
    </div>

    {#if !isLoading && !error && wordData && nodes.length > 0}
        <div class="graph-container">
            <MainGraph {nodes} {edges}>
                <svelte:fragment slot="node" let:node>
                    {#if node.type === 'word' && isWordNode(node.data)}
                        <WordNodeComponent 
                            data={node.data} 
                            mode="preview"
                        />
                    {:else if node.type === 'definition' && isDefinition(node.data)}
                        <DefinitionNodeComponent 
                            data={node.data}
                            word={wordData.word}
                            type={node.data.id === wordData.definitions[0].id ? 'live' : 'alternative'}
                            mode="preview"
                        />
                    {/if}
                </svelte:fragment>
            </MainGraph>
        </div>
    {/if}
</div>

<style>
    .graph-test {
        width: 100vw;
        height: 100vh;
        position: relative;
        overflow: hidden;
        background: black;
    }

    .background-canvas {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
    }

    .status-overlay {
        position: absolute;
        top: 1rem;
        left: 1rem;
        z-index: 10;
    }

    .status-text {
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        font-family: 'Orbitron', sans-serif;
        font-size: 0.9rem;
    }

    .graph-container {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 2;
    }
</style>