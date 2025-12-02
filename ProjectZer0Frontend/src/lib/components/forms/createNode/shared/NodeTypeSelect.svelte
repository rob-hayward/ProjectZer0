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
-->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    export let nodeType = '';
    export let disabled = false;
    
    // POSITIONING: Received from ContentBox via CreateNodeNode
    export let positioning: Record<string, number> = {};
    export let width: number = 400;
    export let height: number = 400;

    const dispatch = createEventDispatcher<{
        proceed: void;
        typeChange: { type: string };
    }>();

    $: maxSteps = getMaxSteps(nodeType);

    function getMaxSteps(type: string): number {
        if (!type) return 0;
        switch (type) {
            case 'word': return 5;
            case 'category': return 4;
            case 'statement': 
            case 'openquestion': return 6;
            case 'quantity': return 7;
            default: return 0;
        }
    }

    function handleTypeChange() {
        dispatch('typeChange', { type: nodeType });
    }

    function handleProceed() {
        if (nodeType && !disabled) {
            dispatch('proceed');
        }
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
    $: buttonY = height * (positioning.button || 0.40);
    
    // Dropdown width (centered, max 240px) - responsive to available width
    $: dropdownWidth = Math.min(240, width * 0.6);
</script>

<g>
    <!-- Label -->
    <text 
        x="0"
        y={labelY}
        class="form-label"
        text-anchor="middle"
    >
        Select Node Type
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
            <!-- 
                STANDALONE NODE TYPES ONLY
                These 5 types can be created without requiring a parent node context.
                
                NOT included (require parent node - will be implemented via proximity-based creation):
                - Answer: Requires parent OpenQuestion context
                - Definition (alternative): Created automatically with Word (first definition is live)
                - Evidence: Requires parent Statement/Answer/Quantity context
            -->
            <option value="word">Word</option>
            <option value="category">Category</option>
            <option value="statement">Statement</option>
            <option value="openquestion">Open Question</option>
            <option value="quantity">Quantity Question</option>
        </select>
    </foreignObject>

    <!-- Info Text -->
    {#if nodeType}
        <text 
            x="0"
            y={infoTextY}
            class="info-text"
            text-anchor="middle"
        >
            {#if nodeType === 'word'}
                Define a key term or concept
            {:else if nodeType === 'category'}
                Group related words together
            {:else if nodeType === 'statement'}
                Share a claim or assertion
            {:else if nodeType === 'openquestion'}
                Ask an open-ended question
            {:else if nodeType === 'quantity'}
                Ask a question with measurable answer
            {/if}
        </text>
    {/if}

    <!-- Material Symbol Button -->
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <g 
        class="material-symbol-button"
        class:disabled={!nodeType || disabled}
        transform="translate(0, {buttonY})"
        on:click={handleProceed}
    >
        <text 
            class="material-symbols-outlined"
            text-anchor="middle"
            dominant-baseline="middle"
        >
            arrow_circle_right
        </text>
    </g>
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

    .material-symbol-button {
        cursor: pointer;
        transition: all 0.3s ease;
    }

    .material-symbol-button text {
        fill: rgba(255, 255, 255, 0.8);
        font-size: 48px;
        transition: all 0.3s ease;
    }

    .material-symbol-button:hover text {
        fill: rgba(255, 255, 255, 1);
        filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.6));
    }

    .material-symbol-button.disabled {
        cursor: not-allowed;
        opacity: 0.3;
    }

    .material-symbol-button.disabled:hover text {
        fill: rgba(255, 255, 255, 0.8);
        filter: none;
    }

    .material-symbols-outlined {
        font-family: 'Material Symbols Outlined';
        font-weight: normal;
        font-style: normal;
        font-size: 48px;
        line-height: 1;
        letter-spacing: normal;
        text-transform: none;
        display: inline-block;
        white-space: nowrap;
        word-wrap: normal;
        direction: ltr;
        font-feature-settings: 'liga';
        -webkit-font-feature-settings: 'liga';
        -webkit-font-smoothing: antialiased;
    }
</style>