/**
 * NOTICE: This is a converted Svelte component file.
 * Original Svelte file: /Users/rob/vsCodeProjects/ProjectZer0/ProjectZer0Frontend/src/lib/components/graph/nodes/word/WordNode.svelte
 * This conversion was created to share with Claude for development purposes.
 */


    import { createEventDispatcher } from 'svelte';
    import type { WordNode, NodeMode, NodeStyle } from '$lib/types/nodes';
    import BasePreviewNode from '../base/BasePreviewNode.svelte';
    import BaseNode from '../base/BaseNode.svelte';
    import ExpandContractButton from '../common/ExpandCollapseButton.svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { NODE_CONSTANTS } from '../../../../constants/graph/NodeConstants';
    
    export let data: WordNode;
    export let mode: NodeMode = 'preview';
    export let transform: string;
    export let style: NodeStyle;
 
    const dispatch = createEventDispatcher<{
        modeChange: { mode: NodeMode };
    }>();
 
    function handleModeChange() {
        if ($page.params.view === 'alternative-definitions') {
            const newMode = mode === 'preview' ? 'detail' : 'preview';
            dispatch('modeChange', { mode: newMode });
        } else {
            goto(`/graph/word?word=${data.word}`);
        }
    }


// Original Svelte Template:
/*
<!-- src/lib/components/graph/nodes/word/WordNode.svelte -->
*/

// Converted JSX:
export default function Component() {
  return (
    <!-- src/lib/components/graph/nodes/word/WordNode.svelte -->
  );
}