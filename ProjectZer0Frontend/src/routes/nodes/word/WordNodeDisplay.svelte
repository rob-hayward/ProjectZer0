<!-- src/routes/nodes/word/WordNodeDisplay.svelte -->
<script lang="ts">
  import type { WordNode } from '$lib/types/nodes';
  import { onMount } from 'svelte';

  export let word: WordNode;

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }

  onMount(() => {
    console.log('WordNodeDisplay mounted. Word data:', word);
  });
</script>

<div class="word-node">
  <h1>{word.word}</h1>
  
  <section class="definitions">
    <h2>Definitions</h2>
    {#each word.definitions as definition}
      <div class="definition">
        <h3>{definition.createdBy === 'FreeDictionaryAPI' ? 'Free Dictionary Definition' : 'User-Provided Definition'}</h3>
        <p>{definition.text}</p>
        <p>Votes: {definition.votes}</p>
      </div>
    {/each}
  </section>

  {#if word.discussion}
    <section class="discussion">
      <h2>Discussion</h2>
      {#if word.discussion.comments}
        {#each word.discussion.comments as comment}
          <div class="comment">
            <p>{comment.commentText}</p>
            <p>By: {comment.createdBy}</p>
            <p>Posted: {formatDate(comment.createdAt)}</p>
          </div>
        {/each}
      {:else}
        <p>No comments yet.</p>
      {/if}
    </section>
  {/if}

  <section class="metadata">
    <p>Created by: {word.publicCredit ? word.createdBy : 'Anonymous'}</p>
    <p>Created at: {formatDate(word.createdAt)}</p>
    <p>Last updated: {formatDate(word.updatedAt)}</p>
  </section>
</div>

<style>
.word-node {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
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