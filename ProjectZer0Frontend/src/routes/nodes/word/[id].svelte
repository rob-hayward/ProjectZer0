<script lang="ts">
    import { page } from '$app/stores';
    import WordNodeDisplay from './WordNodeDisplay.svelte';
  
    $: wordId = $page.params.id;
  </script>
  
  <WordNodeDisplay {wordId} />