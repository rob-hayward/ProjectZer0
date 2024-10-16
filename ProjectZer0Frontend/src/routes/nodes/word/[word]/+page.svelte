<!-- src/routes/nodes/word/[word]/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { getWordData } from '$lib/services/word';
  import { wordStore } from '$lib/stores/wordStore';
  import WordNodeDisplay from '../WordNodeDisplay.svelte';
  import type { WordNode } from '$lib/types/nodes';

  let word: string | null = null;
  let wordData: WordNode | null = null;
  let error: string | null = null;
  let isLoading = true;

  onMount(async () => {
    try {
      word = $page.params.word;
      if (word) {
        console.log('Fetching word data for:', word);
        wordData = await getWordData(word);
        wordStore.set(wordData);
        console.log('Received word data:', wordData);
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
  <WordNodeDisplay wordData={wordData} />
{:else}
  <p>No word data available</p>
{/if}

<style>
  .error {
    color: red;
  }
</style>