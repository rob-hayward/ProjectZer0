<!-- src/routes/nodes/word/[word]/+page.svelte -->
<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { fetchWithAuth } from '$lib/services/api';
  import WordNodeDisplay from '../WordNodeDisplay.svelte';
  import type { WordNode } from '$lib/types/nodes';

  export let data: { word: string };

  let wordData: WordNode | null = null;
  let error: string | null = null;
  let isLoading = true;

  async function fetchWordData() {
    isLoading = true;
    error = null;
    try {
      wordData = await fetchWithAuth(`/nodes/word/${encodeURIComponent(data.word.toLowerCase())}`);
      isLoading = false;
    } catch (e) {
      console.error('Error fetching word data:', e);
      error = e instanceof Error ? e.message : 'An error occurred while fetching word data';
      isLoading = false;
    }
  }

  $: if (data.word) {
    fetchWordData();
  }
</script>

{#if isLoading}
  <p>Loading word data...</p>
{:else if error}
  <p class="error">{error}</p>
{:else if wordData}
  <WordNodeDisplay word={wordData} />
{:else}
  <p>No word data available</p>
{/if}

<style>
  .error {
    color: red;
  }
</style>