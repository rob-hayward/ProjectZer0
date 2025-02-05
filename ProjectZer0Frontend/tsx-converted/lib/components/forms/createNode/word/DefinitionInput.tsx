/**
 * NOTICE: This is a converted Svelte component file.
 * Original Svelte file: /Users/rob/vsCodeProjects/ProjectZer0/ProjectZer0Frontend/src/lib/components/forms/createNode/word/DefinitionInput.svelte
 * This conversion was created to share with Claude for development purposes.
 */


    import { createEventDispatcher } from 'svelte';
    import { FORM_STYLES } from '$lib/styles/forms';
    import { TEXT_LIMITS } from '$lib/constants/validation';
    import FormNavigation from '../shared/FormNavigation.svelte';
    import CharacterCount from '../shared/CharacterCount.svelte';
 
    export let definition = '';
    export let disabled = false;
 
    useEffect(() => { isOverLimit = definition.length > TEXT_LIMITS.MAX_DEFINITION_LENGTH; });
    
    const dispatch = createEventDispatcher<{
        back: void;
        proceed: void;
    }>();
 
    function handleInput(event: Event) {
        const textarea = event.target as HTMLTextAreaElement;
        if (textarea.value.length > TEXT_LIMITS.MAX_DEFINITION_LENGTH) {
            definition = textarea.value.slice(0, TEXT_LIMITS.MAX_DEFINITION_LENGTH);
        }
    }


// Original Svelte Template:
/*
<!-- src/lib/components/forms/createNode/word/DefinitionInput.svelte -->
*/

// Converted JSX:
export default function Component() {
  return (
    <!-- src/lib/components/forms/createNode/word/DefinitionInput.svelte -->
  );
}