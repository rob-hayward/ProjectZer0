/**
 * NOTICE: This is a converted Svelte component file.
 * Original Svelte file: /Users/rob/vsCodeProjects/ProjectZer0/ProjectZer0Frontend/src/lib/components/graph/nodes/definition/DefinitionNode.svelte
 * This conversion was created to share with Claude for development purposes.
 */


    import { createEventDispatcher } from 'svelte';
    import type { Definition } from '$lib/types/nodes';
    import type { UserProfile } from '$lib/types/user';
    import { getUserDetails } from '$lib/services/userLookup';
    import { getDisplayName } from '../utils/nodeUtils';
    import { NODE_CONSTANTS } from '../../../../constants/graph/NodeConstants';
    import BaseSvgNode from '../base/BaseNode.svelte';

    export let data: Definition;
    export let word: string;
    export let transform: string;
    export let type: 'live' | 'alternative' = 'alternative';
    
    const dispatch = createEventDispatcher<{
        click: { data: Definition };
        hover: { data: Definition; isHovered: boolean };
    }>();

    let creatorDetails: UserProfile | null = null;

    useEffect(() => { style = {
        previewSize: type === 'live' 
            ? NODE_CONSTANTS.SIZES.DEFINITION.live.preview 
            : NODE_CONSTANTS.SIZES.DEFINITION.alternative.preview,
        detailSize: NODE_CONSTANTS.SIZES.DEFINITION.live.detail,
        colors: NODE_CONSTANTS.COLORS.DEFINITION[type],
        padding: NODE_CONSTANTS.PADDING,
        lineHeight: NODE_CONSTANTS.LINE_HEIGHT,
        stroke: NODE_CONSTANTS.STROKE
    }; });

    useEffect(() => { fontSize = type === 'live' 
        ? NODE_CONSTANTS.FONTS.title.size
        : NODE_CONSTANTS.FONTS.value.size; });

    async function loadUserDetails() {
        if (data.createdBy && data.createdBy !== 'FreeDictionaryAPI') {
            creatorDetails = await getUserDetails(data.createdBy);
        }
    }

    function handleClick() {
        dispatch('click', { data });
    }

    function handleHover(event: CustomEvent<{ isHovered: boolean }>) {
        dispatch('hover', { data, isHovered: event.detail.isHovered });
    }

    useEffect(() => { {
        loadUserDetails(); });
    }


// Original Svelte Template:
/*
<!-- src/lib/components/graph/nodes/definition/DefinitionNode.svelte -->
*/

// Converted JSX:
export default function Component() {
  return (
    <!-- src/lib/components/graph/nodes/definition/DefinitionNode.svelte -->
  );
}