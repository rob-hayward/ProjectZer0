<!-- src/routes/graph-test/[word]/+page.svelte
<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { getWordData } from '$lib/services/word';
    import type { WordNode, Definition } from '$lib/types/nodes';
    import type { GraphNode, GraphEdge } from '$lib/types/graph';
    import SvgWordNode from '$lib/components/graph/nodes/word/WordNode.svelte';
    import SvgDefinitionNode from '$lib/components/graph/nodes/definition/SvgDefinitionNode.svelte';
    import MainGraph from '$lib/components/graph/MainGraph.svelte';

    let wordData: WordNode | null = null;
    let error: string | null = null;
    let isLoading = true;
    let nodes: GraphNode[] = [];
    let edges: GraphEdge[] = [];
    let zoom = 100;

    function isWordNode(data: WordNode | Definition): data is WordNode {
        return 'word' in data;
    }

    function isDefinition(data: WordNode | Definition): data is Definition {
        return 'text' in data;
    }

    onMount(async () => {
        try {
            const word = $page.params.word;
            if (!word) throw new Error('No word parameter provided');
            
            console.log('Fetching word data for:', word);
            const data = await getWordData(word);
            if (!data) throw new Error('No word data found');
            
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

        } catch (e) {
            console.error('Error loading word data:', e);
            error = e instanceof Error ? e.message : 'An error occurred loading the word';
        } finally {
            isLoading = false;
        }
    });

    function handleZoomChange(event: CustomEvent<{scale: number}>) {
        zoom = event.detail.scale;
    }
</script>

<div class="graph-test">
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
            <MainGraph 
                {nodes} 
                {edges}
                on:zoomChange={handleZoomChange}
            >
                <svelte:fragment slot="node" let:node let:position>
                    {#if node.type === 'word' && isWordNode(node.data)}
                        <SvgWordNode 
                            data={node.data} 
                            transform={position.svgTransform}
                            mode="preview"
                        />
                    {:else if node.type === 'definition' && isDefinition(node.data)}
                        <SvgDefinitionNode 
                            data={node.data}
                            word={wordData.word}
                            transform={position.svgTransform}
                            type={node.data.id === wordData.definitions[0].id ? 'live' : 'alternative'}
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
</style> -->