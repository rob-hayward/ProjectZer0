/**
 * NOTICE: This is a converted Svelte component file.
 * Original Svelte file: /Users/rob/vsCodeProjects/ProjectZer0/ProjectZer0Frontend/src/lib/components/graph/nodes/navigation/NavigationNode.svelte
 * This conversion was created to share with Claude for development purposes.
 */


    import { createEventDispatcher } from 'svelte';
    import { handleNavigation } from '$lib/services/navigation';
    import type { NavigationOption } from '$lib/types/navigation';
    import type { NavigationOptionId } from '$lib/services/navigation';
    import { getNavigationColor } from './navigationColors';

    const dispatch = createEventDispatcher();

    export let option: NavigationOption;
    export let transform: string;
    export let isHovered = false;

    const color = getNavigationColor(option.id);
    const filterId = `nav-glow-${Math.random().toString(36).slice(2)}`;
    
    let transformValues: number[] = [];
    let translateX: number = 0;
    let translateY: number = 0;

    useEffect(() => { {
        const matches = transform.match(/translate\(([-\d.e+-]+),\s*([-\d.e+-]+)\)/); });
        if (matches) {
            transformValues = [parseFloat(matches[1]), parseFloat(matches[2])];
            [translateX, translateY] = transformValues;
        } else {
            transformValues = [0, 0];
            [translateX, translateY] = transformValues;
        }
    }

    function handleClick() {
        handleNavigation(option.id as NavigationOptionId);
    }

    function handleMouseEnter() {
        dispatch('hover', { isHovered: true });
        isHovered = true;
    }

    function handleMouseLeave() {
        dispatch('hover', { isHovered: false });
        isHovered = false;
    }


// Original Svelte Template:
/*
<!-- src/lib/components/graph/nodes/navigation/NavigationNode.svelte -->
<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
*/

// Converted JSX:
export default function Component() {
  return (
    <!-- src/lib/components/graph/nodes/navigation/NavigationNode.svelte -->
<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
  );
}