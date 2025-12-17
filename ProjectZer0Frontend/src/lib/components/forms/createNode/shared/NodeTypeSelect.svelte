<!-- src/lib/components/forms/createNode/shared/NodeTypeSelect.svelte -->
<!--
POSITIONING ARCHITECTURE:
- This component is POSITIONALLY DUMB - all coordinates come from ContentBox
- Receives: positioning (fractions), width, height from parent via ContentBox
- Coordinate system: LEFT-EDGE X, CENTER Y
  • X origin: Left edge of contentText section (after padding)
  • Y origin: VERTICAL CENTER of contentText section
  • X: Standard left-to-right (0 = left edge, positive = right)
  • Y: Center-origin (0 = center, negative = UP, positive = DOWN)
- Calculate absolute Y positions as: y = height * positioning.element
- ContentBox is the SINGLE SOURCE OF TRUTH - adjust values there, not here

UPDATED: Added contextualConfig support for filtered node type selection
- When contextualConfig is provided WITHOUT nodeType pre-set, shows only 4 types:
  * Statement, Quantity, Evidence, OpenQuestion
- This enables "Link Node" functionality from Answer/Statement/Quantity parents
-->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    export let nodeType = '';
    export let disabled = false;
    export let contextualConfig: any = null;  // NEW: Context from parent node
    
    // POSITIONING: Received from ContentBox via CreateNodeNode
    export let positioning: Record<string, number> = {};
    export let width: number = 400;
    export let height: number = 400;

    const dispatch = createEventDispatcher<{
        proceed: void;
        typeChange: { type: string };
    }>();

    // Define all node types with their configurations
    const ALL_NODE_TYPES = [
        { value: 'word', label: 'Word', description: 'Define a key term or concept', standalone: true },
        { value: 'category', label: 'Category', description: 'Group related words together', standalone: true },
        { value: 'statement', label: 'Statement', description: 'Share a claim or assertion', standalone: true, linkedNode: true },
        { value: 'openquestion', label: 'Open Question', description: 'Ask an open-ended question', standalone: true, linkedNode: true },
        { value: 'quantity', label: 'Quantity Question', description: 'Ask a question with measurable answer', standalone: true, linkedNode: true },
        { value: 'evidence', label: 'Evidence', description: 'Provide supporting evidence', standalone: false, linkedNode: true }
    ];

    // Determine which types to show based on context
    $: displayTypes = (() => {
        // If contextualConfig exists but nodeType is NOT pre-set, this is "Link Node" flow
        // Show only the 4 types that can be created as linked nodes
        if (contextualConfig && !contextualConfig.nodeType) {
            console.log('[NodeTypeSelect] Contextual creation mode - showing 4 linked node types');
            return ALL_NODE_TYPES.filter(type => type.linkedNode);
        }
        
        // Default flow - show all standalone types (5 types)
        console.log('[NodeTypeSelect] Standalone creation mode - showing 5 standalone types');
        return ALL_NODE_TYPES.filter(type => type.standalone);
    })();

    $: maxSteps = getMaxSteps(nodeType);

    function getMaxSteps(type: string): number {
        if (!type) return 0;
        switch (type) {
            case 'word': return 5;
            case 'category': return 4;
            case 'definition': return 4;
            case 'statement': 
            case 'openquestion': 
            case 'answer':
            case 'evidence': return 6;
            case 'quantity': return 7;
            default: return 0;
        }
    }

    function handleTypeChange() {
        console.log('[NodeTypeSelect] Type changed to:', nodeType);
        dispatch('typeChange', { type: nodeType });
    }
    
    // ============================================================================
    // CALCULATE Y POSITIONS - CENTER-ORIGIN FOR VERTICAL ONLY
    // ============================================================================
    // Y positions calculated as: y = height * positioning.element
    // Where positioning values are relative to VERTICAL CENTER:
    //   -0.5 = top of section
    //    0.0 = center of section
    //   +0.5 = bottom of section
    // X positioning is standard left-to-right (unchanged)
    // ============================================================================
    $: labelY = height * (positioning.label || -0.12);
    $: dropdownY = height * (positioning.dropdown || -0.02);
    $: dropdownHeight = Math.max(40, height * (positioning.dropdownHeight || 0.10));
    $: infoTextY = height * (positioning.infoText || 0.10);
    
    // Dropdown width (centered, max 240px) - responsive to available width
    $: dropdownWidth = Math.min(240, width * 0.6);

    // Get description for selected type
    $: selectedTypeDescription = (() => {
        if (!nodeType) return '';
        const type = ALL_NODE_TYPES.find(t => t.value === nodeType);
        return type?.description || '';
    })();
</script>

<g>
    <!-- Label -->
    <text 
        x="0"
        y={labelY}
        class="form-label"
        text-anchor="middle"
    >
        {contextualConfig && !contextualConfig.nodeType ? 'Select Linked Node Type' : 'Select Node Type'}
    </text>

    <!-- Select Input - centered horizontally -->
    <foreignObject
        x={-dropdownWidth/2}
        y={dropdownY}
        width={dropdownWidth}
        height={dropdownHeight}
    >
        <select 
            class="form-dropdown"
            bind:value={nodeType}
            on:change={handleTypeChange}
            {disabled}
        >
            <option value="">Choose type...</option>
            {#each displayTypes as type}
                <option value={type.value}>{type.label}</option>
            {/each}
        </select>
    </foreignObject>

    <!-- Info Text -->
    {#if nodeType && selectedTypeDescription}
        <text 
            x="0"
            y={infoTextY}
            class="info-text"
            text-anchor="middle"
        >
            {selectedTypeDescription}
        </text>
    {/if}
</g>

<style>
    .form-label {
        font-size: 14px;
        fill: rgba(255, 255, 255, 0.7);
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }

    .info-text {
        font-size: 11px;
        fill: rgba(255, 255, 255, 0.5);
        font-family: 'Inter', sans-serif;
        font-weight: 400;
        font-style: italic;
    }

    /* Match ControlNode dropdown style */
    :global(select.form-dropdown) {
        width: 100%;
        padding: 5px 8px;
        font-size: 10px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        color: white;
        cursor: pointer;
        outline: none;
        transition: all 0.2s;
        box-sizing: border-box;
        font-family: 'Inter', sans-serif;
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
        background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3e%3cpath d='M7 10l5 5 5-5z'/%3e%3c/svg%3e");
        background-repeat: no-repeat;
        background-position: right 8px center;
        background-size: 20px;
        padding-right: 32px;
    }

    :global(select.form-dropdown:focus) {
        border-color: rgba(66, 153, 225, 0.6);
        background: rgba(255, 255, 255, 0.08);
    }

    :global(select.form-dropdown option) {
        background: rgba(20, 20, 30, 0.98);
        color: white;
        padding: 8px;
    }

    :global(select.form-dropdown:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>