<!-- ProjectZer0Frontend/src/routes/nodes/word/[word]/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { getWordData } from '$lib/services/word';
  import { wordStore } from '$lib/stores/wordStore';
  import { wordViewStore } from '$lib/stores/wordViewStore';
  import { fade, scale } from 'svelte/transition';
  import WordNodeDisplay from '../WordNodeDisplay.svelte';
  import ConcentricLayout from '$lib/components/graphElements/layouts/concentricLayouts/WordConcentricLayout.svelte';
  import type { WordNode } from '$lib/types/nodes';

  let word: string | null = null;
  let wordData: WordNode | null = null;
  let error: string | null = null;
  let isLoading = true;

  // Subscribe to view state
  $: isAlternativeView = $wordViewStore.currentView === 'alternative-definitions';

  onMount(async () => {
      try {
          word = $page.params.word;
          if (word) {
              wordData = await getWordData(word);
              wordStore.set(wordData);
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

{#if isLoading}
  <p>Loading word data...</p>
{:else if error}
  <p class="error">{error}</p>
{:else if wordData}
  <div class="word-view">
      {#if isAlternativeView}
          <div 
              class="alternative-view"
              in:fade={{ duration: 300 }}
              out:fade={{ duration: 300 }}
          >
              <ConcentricLayout
                  {wordData}
                  sortMode={$wordViewStore.sortMode}
              />
          </div>
      {:else}
          <div 
              class="full-view"
              in:scale={{ duration: 300, start: 0.5 }}
              out:scale={{ duration: 300, start: 1 }}
          >
              <WordNodeDisplay {wordData} />
          </div>
      {/if}
  </div>
{:else}
  <p>No word data available</p>
{/if}

<style>
  .word-view {
      width: 100vw;
      height: 100vh;
      position: relative;
      overflow: hidden;
  }

  .alternative-view,
  .full-view {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
  }

  .error {
      color: red;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
  }
</style>