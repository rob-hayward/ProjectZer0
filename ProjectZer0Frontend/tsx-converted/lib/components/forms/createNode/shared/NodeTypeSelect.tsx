/**
 * NOTICE: This is a converted Svelte component file.
 * Original Svelte file: /Users/rob/vsCodeProjects/ProjectZer0/ProjectZer0Frontend/src/lib/components/forms/createNode/shared/NodeTypeSelect.svelte
 * This conversion was created to share with Claude for development purposes.
 */


    import { createEventDispatcher } from 'svelte';
    import { FORM_STYLES } from '$lib/styles/forms';
    import FormNavigation from './FormNavigation.svelte';

    export let nodeType = '';
    export let disabled = false;

    const dispatch = createEventDispatcher<{
        proceed: void;
        typeChange: { type: string };
    }>();

    const noop = () => {};

    function handleTypeChange() {
        dispatch('typeChange', { type: nodeType });
    }


// Original Svelte Template:
/*
<!-- src/lib/components/forms/createNode/shared/NodeTypeSelect.svelte -->
*/

// Converted JSX:
export default function Component() {
  return (
    <!-- src/lib/components/forms/createNode/shared/NodeTypeSelect.svelte -->
  );
}