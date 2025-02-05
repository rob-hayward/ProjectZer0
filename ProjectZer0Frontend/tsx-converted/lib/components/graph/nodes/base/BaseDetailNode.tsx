/**
 * NOTICE: This is a converted Svelte component file.
 * Original Svelte file: /Users/rob/vsCodeProjects/ProjectZer0/ProjectZer0Frontend/src/lib/components/graph/nodes/base/BaseDetailNode.svelte
 * This conversion was created to share with Claude for development purposes.
 */


    import { onMount } from 'svelte';
    import { spring } from 'svelte/motion';
    import type { NodeStyle } from '$lib/types/nodes';
    import BaseSvgNode from './BaseNode.svelte';
    import { CIRCLE_RADIUS } from '../../../../constants/graph/NodeConstants';
 
    export let style: NodeStyle;
 
    const baseOpacity = spring(0, { stiffness: 0.3, damping: 0.8 });
 
    onMount(() => {
        baseOpacity.set(1);
    });
 
    useEffect(() => { detailStyle = {
        ...style,
        previewSize: CIRCLE_RADIUS * 2
    }; });
 
    useEffect(() => { radius = CIRCLE_RADIUS; });


// Original Svelte Template:
/*
<!-- ProjectZer0Frontend/src/lib/components/graph/nodes/base/BaseDetailNode.svelte -->
*/

// Converted JSX:
export default function Component() {
  return (
    <!-- ProjectZer0Frontend/src/lib/components/graph/nodes/base/BaseDetailNode.svelte -->
  );
}