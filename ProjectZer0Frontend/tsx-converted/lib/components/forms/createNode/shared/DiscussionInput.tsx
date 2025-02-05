/**
 * NOTICE: This is a converted Svelte component file.
 * Original Svelte file: /Users/rob/vsCodeProjects/ProjectZer0/ProjectZer0Frontend/src/lib/components/forms/createNode/shared/DiscussionInput.svelte
 * This conversion was created to share with Claude for development purposes.
 */


    import { createEventDispatcher } from 'svelte';
    import { FORM_STYLES } from '$lib/styles/forms';
    import { TEXT_LIMITS } from '$lib/constants/validation';
    import FormNavigation from './FormNavigation.svelte';
    
    export let discussion = '';
    export let disabled = false;
    export let placeholder = 'Start a discussion around this word and its definition.';

    const dispatch = createEventDispatcher<{
        back: void;
        proceed: void;
    }>();

    useEffect(() => { isOverLimit = discussion.length > TEXT_LIMITS.MAX_COMMENT_LENGTH; });

    function handleInput(event: Event) {
        const textarea = event.target as HTMLTextAreaElement;
        if (textarea.value.length > TEXT_LIMITS.MAX_COMMENT_LENGTH) {
            discussion = textarea.value.slice(0, TEXT_LIMITS.MAX_COMMENT_LENGTH);
        }
    }


// Original Svelte Template:
/*
<!-- src/lib/components/forms/createNode/shared/DiscussionInput.svelte -->
*/

// Converted JSX:
export default function Component() {
  return (
    <!-- src/lib/components/forms/createNode/shared/DiscussionInput.svelte -->
  );
}