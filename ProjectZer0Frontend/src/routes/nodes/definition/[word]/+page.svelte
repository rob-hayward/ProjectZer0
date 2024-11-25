<!-- src/routes/nodes/definition/[word]/+page.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { getWordData } from '$lib/services/word';
    import { wordStore } from '$lib/stores/wordStore';
    import WordNodeDisplay from '../../word/WordNodeDisplay.svelte';
    import AlternativeDefinitionNodeDisplay from '../AlternativeDefinitionNodeDisplay.svelte';
    import type { WordNode, Definition } from '$lib/types/nodes';
    
    let word: string | null = null;
    let wordData: WordNode | null = null;
    let alternativeDefinitions: Definition[] = [];
    let error: string | null = null;
    let isLoading = true;
    let sortMode: 'newest' | 'popular' = 'popular';
  
    function getVoteValue(votes: any): number {
      if (typeof votes === 'number') return votes;
      if (votes && typeof votes === 'object' && 'low' in votes) {
        return votes.low;
      }
      return 0;
    }
  
    function getLiveDefinition(definitions: Definition[]): Definition | null {
      if (!definitions || definitions.length === 0) return null;
  
      const userDefinitions = definitions.filter(d => d.createdBy !== 'FreeDictionaryAPI');
      return userDefinitions.sort((a, b) => 
        getVoteValue(b.votes) - getVoteValue(a.votes)
      )[0] || null;
    }
  
    function getAlternativeDefinitions(definitions: Definition[]): Definition[] {
      if (!definitions || definitions.length === 0) return [];
  
      const liveDefinition = getLiveDefinition(definitions);
      if (!liveDefinition) return definitions;
  
      return definitions.filter(d => d.id !== liveDefinition.id);
    }
  
    function sortDefinitions() {
      if (sortMode === 'newest') {
        alternativeDefinitions.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      } else {
        alternativeDefinitions.sort((a, b) => 
          getVoteValue(b.votes) - getVoteValue(a.votes)
        );
      }
      alternativeDefinitions = [...alternativeDefinitions]; // Trigger reactivity
    }
  
    onMount(async () => {
      try {
        word = $page.params.word;
        if (word) {
          console.log('Fetching word data for:', word);
          wordData = await getWordData(word);
          wordStore.set(wordData);
          
          if (wordData?.definitions) {
            alternativeDefinitions = getAlternativeDefinitions(wordData.definitions);
            sortDefinitions();
          }
          
          console.log('Word data loaded:', wordData);
          console.log('Alternative definitions:', alternativeDefinitions);
        } else {
          error = 'No word parameter provided';
        }
      } catch (e) {
        console.error('Error fetching word data:', e);
        error = e instanceof Error ? e.message : 'An error occurred while fetching word data';
      } finally {
        isLoading = false;
      }
    });
  </script>
  
  <div class="definitions-page">
    {#if isLoading}
      <p>Loading definitions...</p>
    {:else if error}
      <p class="error">{error}</p>
    {:else if wordData}
      <div class="sort-controls">
        <button 
          class:active={sortMode === 'popular'} 
          on:click={() => {
            sortMode = 'popular';
            sortDefinitions();
          }}
        >
          Most Popular
        </button>
        <button 
          class:active={sortMode === 'newest'} 
          on:click={() => {
            sortMode = 'newest';
            sortDefinitions();
          }}
        >
          Newest
        </button>
      </div>
  
      <!-- Center word node -->
      <div class="center-node">
        <WordNodeDisplay {wordData} />
      </div>
  
      <!-- Alternative definition nodes -->
      <div class="alternative-nodes">
        {#each alternativeDefinitions as definition (definition.id)}
          <div class="alt-node">
            <AlternativeDefinitionNodeDisplay 
              word={word || ''} 
              {definition} 
            />
          </div>
        {/each}
      </div>
    {:else}
      <p>No word data available</p>
    {/if}
  </div>
  
  <style>
    .definitions-page {
      width: 100vw;
      height: 100vh;
      position: relative;
      overflow: hidden;
    }
  
    .sort-controls {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10;
      display: flex;
      gap: 10px;
    }
  
    .sort-controls button {
      padding: 0.5rem 1rem;
      border-radius: 4px;
      font-family: 'Orbitron', sans-serif;
      font-size: 0.9rem;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: white;
      cursor: pointer;
      transition: all 0.2s;
    }
  
    .sort-controls button.active {
      background: rgba(74, 144, 226, 0.3);
      border: 1px solid rgba(74, 144, 226, 0.4);
    }
  
    .error {
      color: red;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }
  
    .center-node {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }
  
    .alternative-nodes {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
  
    .alt-node {
      position: absolute;
      pointer-events: auto;
    }
  </style>