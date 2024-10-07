<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchWithAuth } from '$lib/services/api';
  import type { WordNode } from '$lib/types/nodes';

  export let wordId: string;

  let wordNode: WordNode | null = null;
  let error: string | null = null;
  let isLoading = true;

  onMount(async () => {
    try {
      const response = await fetchWithAuth(`/nodes/word/${wordId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch word node data');
      }
      wordNode = await response.json();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to fetch word node data';
    } finally {
      isLoading = false;
    }
  });

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }
</script>

{#if isLoading}
<p>Loading word node data...</p>
{:else if error}
<p class="error">{error}</p>
{:else if wordNode}
<div class="word-node">
  <h1>{wordNode.word}</h1>
  
  <section class="definitions">
    <h2>Definitions</h2>
    {#each wordNode.definitions as definition}
      <div class="definition">
        <h3>{definition.createdBy === 'FreeDictionaryAPI' ? 'Free Dictionary Definition' : 'User-Provided Definition'}</h3>
        <p>{definition.text}</p>
        <p>Votes: {definition.votes}</p>
      </div>
    {/each}
  </section>

  {#if wordNode.discussion}
    <section class="discussion">
      <h2>Discussion</h2>
      {#each wordNode.discussion.comments as comment}
        <div class="comment">
          <p>{comment.commentText}</p>
          <p>By: {comment.createdBy}</p>
          <p>Posted: {formatDate(comment.createdAt)}</p>
        </div>
      {/each}
    </section>
  {/if}

  <section class="metadata">
    <p>Created by: {wordNode.publicCredit ? wordNode.createdBy : 'Anonymous'}</p>
    <p>Created at: {formatDate(wordNode.createdAt)}</p>
    <p>Last updated: {formatDate(wordNode.updatedAt)}</p>
  </section>
</div>
{:else}
<p>No word node data available</p>
{/if}

<style>
.word-node {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}
.error {
  color: red;
}
section {
  margin-bottom: 20px;
}
.definition, .comment {
  background-color: #f0f0f0;
  padding: 10px;
  border-radius: 5px;
  margin-bottom: 10px;
}
</style>