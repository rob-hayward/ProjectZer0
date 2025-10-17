<!-- src/lib/components/graph/nodes/ui/TextContent.svelte -->
<script lang="ts">
  export let text: string;
  export let mode: 'preview' | 'detail' = 'detail';

  // Mode-based font sizing (strict)
  $: fontSize = mode === 'detail' ? '16px' : '12px';
</script>

<div class="text-content" class:detail={mode === 'detail'} class:preview={mode === 'preview'}>
  {text}
</div>

<style>
  .text-content {
    font-family: Inter, sans-serif;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.9);
    text-align: center;
    line-height: 1.4;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 0;
    margin: 0;
    box-sizing: border-box;
    word-wrap: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
  }

  .text-content.detail {
    font-size: 16px;
  }

  .text-content.preview {
    font-size: 12px;
  }
</style>