<script lang="ts">
  import { page } from '$app/stores';
  import WordNodeDisplay from './WordNodeDisplay.svelte';

  $: word = $page.params.id;
</script>

<WordNodeDisplay wordId={word} />