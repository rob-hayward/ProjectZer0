<script lang="ts">
    import { onMount } from 'svelte';
    import { apiClient } from '$lib/services/api';
    import type { WordNode } from '$lib/types/nodes';
  
    export let wordId: string;
  
    let wordNode: WordNode | null = null;
    let error: string | null = null;
    let isLoading = true;
  
    onMount(async () => {
      try {
        const response = await apiClient.get(`/api/nodes/word/${wordId}`);
        wordNode = response.data;
      } catch (e) {
        error = 'Failed to fetch word node data';
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
        {#if wordNode.freeDictionaryDefinition}
          <div class="definition">
            <h3>Free Dictionary Definition</h3>
            <p>{wordNode.freeDictionaryDefinition}</p>
            <p>Votes: {wordNode.freeDictionaryVotes}</p>
          </div>
        {/if}
        {#if wordNode.userDefinition}
          <div class="definition">
            <h3>User-Provided Definition</h3>
            <p>{wordNode.userDefinition}</p>
            <p>Votes: {wordNode.userDefinitionVotes}</p>
          </div>
        {/if}
      </section>
  
      {#if wordNode.discussion}
        <section class="discussion">
          <h2>Discussion</h2>
          <p>{wordNode.discussion}</p>
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
    .definition {
      background-color: #f0f0f0;
      padding: 10px;
      border-radius: 5px;
      margin-bottom: 10px;
    }
  </style>