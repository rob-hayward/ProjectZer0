<script lang="ts">
    import NavGraph from './NavGraph.svelte';
  
    export let wordId: string;
  
    const wordOptions = [
      { id: `word/${wordId}`, label: 'Word', icon: '\uf02d' },
      { id: `word/${wordId}/definitions`, label: 'Definitions', icon: '\uf02e' },
      { id: `word/${wordId}/discussion`, label: 'Discussion', icon: '\uf086' },
      { id: `word/${wordId}/related`, label: 'Related', icon: '\uf0c1' }
    ];
  </script>
  
  <NavGraph options={wordOptions} currentView={`word/${wordId}`} />