<!-- src/lib/components/forms/createNode/evidence/EvidenceInput.svelte -->
<!--
POSITIONING ARCHITECTURE:
- This component is POSITIONALLY DUMB - all coordinates come from ContentBox
- Receives: positioning (fractions), width, height from parent via ContentBox
- Coordinate system: LEFT-EDGE X, TOP Y
  • X origin: Left edge of contentText section (after padding)
  • Y origin: TOP of contentText section
  • X: Standard left-to-right (0 = left edge, positive = right)
  • Y: Top-origin (0 = top, 0.5 = middle, 1.0 = bottom)
- Calculate absolute Y positions as: y = height * positioning.element
- ContentBox is the SINGLE SOURCE OF TRUTH - adjust values there, not here
-->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { TEXT_LIMITS } from '$lib/constants/validation';
    
    export let title = '';
    export let url = '';
    export let evidenceType = '';
    export let parentNodeText = '';
    export let parentNodeType = '';
    export let disabled = false;
    
    // POSITIONING: Received from ContentBox via CreateNodeNode
    export let positioning: Record<string, number> = {};
    export let width: number = 400;
    export let height: number = 400;
    
    let showValidationErrors = false;
    
    // Evidence type options
    const EVIDENCE_TYPES = [
        { value: 'peer_reviewed_study', label: 'Peer-Reviewed Study' },
        { value: 'government_report', label: 'Government Report' },
        { value: 'news_article', label: 'News Article' },
        { value: 'expert_opinion', label: 'Expert Opinion' },
        { value: 'dataset', label: 'Dataset' },
        { value: 'video', label: 'Video' },
        { value: 'image', label: 'Image' },
        { value: 'other', label: 'Other' }
    ];
    
    $: isTitleOverLimit = title.length > TEXT_LIMITS.MAX_STATEMENT_LENGTH;
    $: isTitleEmpty = title.trim().length === 0;
    $: isUrlEmpty = url.trim().length === 0;
    $: isUrlValid = url.trim() === '' || isValidUrl(url);
    $: isTypeEmpty = evidenceType === '';
    $: isValid = !isTitleOverLimit && !isTitleEmpty && !isUrlEmpty && isUrlValid && !isTypeEmpty;
    
    const dispatch = createEventDispatcher<{
        back: void;
        proceed: void;
    }>();
    
    function isValidUrl(urlString: string): boolean {
        try {
            const urlObj = new URL(urlString);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    }
    
    function handleTitleInput(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.value.length > TEXT_LIMITS.MAX_STATEMENT_LENGTH) {
            title = input.value.slice(0, TEXT_LIMITS.MAX_STATEMENT_LENGTH);
        }
    }
    
    $: parentNodeTypeDisplay = parentNodeType === 'statement' ? 'Statement' :
                               parentNodeType === 'answer' ? 'Answer' :
                               parentNodeType === 'quantity' ? 'Quantity' :
                               'Node';
    
    // Calculate Y positions using positioning config (user's updated values)
    $: contextLabelY = height * (positioning.contextLabel || 0.02);
    $: contextBoxY = height * (positioning.contextBox || 0.06);
    $: contextBoxHeight = Math.max(40, height * (positioning.contextBoxHeight || 0.10));
    
    $: titleLabelY = height * (positioning.titleLabel || 0.18);
    $: titleInputY = height * (positioning.titleInput || 0.22);
    $: titleInputHeight = Math.max(40, height * (positioning.titleInputHeight || 0.22));
    $: titleCharCountY = titleInputY + titleInputHeight + 12;
    $: titleValidationY = titleInputY + titleInputHeight + 8;
    
    $: urlLabelY = height * (positioning.urlLabel || 0.55);
    $: urlInputY = height * (positioning.urlInput || 0.59);
    $: urlInputHeight = Math.max(40, height * (positioning.urlInputHeight || 0.08));
    $: urlValidationY = urlInputY + urlInputHeight + 8;
    
    $: typeLabelY = height * (positioning.typeLabel || 0.77);
    $: typeInputY = height * (positioning.typeInput || 0.81);
    $: typeInputHeight = Math.max(40, height * (positioning.typeInputHeight || 0.08));
    $: typeValidationY = typeInputY + typeInputHeight + 8;
    
    // Input width (centered, responsive)
    $: inputWidth = Math.min(340, width * 0.85);
</script>

<g>
    <!-- Parent Node Context Label -->
    <text 
        x="0"
        y={contextLabelY}
        class="context-label"
        text-anchor="middle"
    >
        Adding Evidence to {parentNodeTypeDisplay}:
    </text>
    
    <!-- Parent Context Box -->
    <foreignObject
        x={-inputWidth/2}
        y={contextBoxY}
        width={inputWidth}
        height={contextBoxHeight}
    >
        <div class="parent-context">
            {parentNodeText}
        </div>
    </foreignObject>
    
    <!-- Title Label (traditional) -->
    <text 
        x="0"
        y={titleLabelY}
        class="form-label"
        text-anchor="middle"
    >
        Evidence Title
    </text>
    
    <!-- Title Input with Floating Label -->
    <foreignObject
        x={-inputWidth/2}
        y={titleInputY}
        width={inputWidth}
        height={titleInputHeight}
    >
        <div class="input-wrapper">
            <input
                id="evidence-title-input"
                type="text"
                class="form-input floating-input"
                class:error={showValidationErrors && isTitleEmpty}
                class:has-value={title.length > 0}
                bind:value={title}
                on:input={handleTitleInput}
                placeholder=" "
                {disabled}
            />
            <label for="evidence-title-input" class="floating-label">Brief title describing this evidence</label>
        </div>
    </foreignObject>
    
    <!-- Title Validation / Character Count -->
    {#if showValidationErrors && isTitleEmpty}
        <text 
            x="0"
            y={titleValidationY}
            class="validation-message"
            text-anchor="middle"
        >
            Title is required
        </text>
    {:else}
        <text 
            x="0"
            y={titleCharCountY}
            class="character-count"
            class:near-limit={title.length > TEXT_LIMITS.MAX_STATEMENT_LENGTH - 20}
            class:over-limit={isTitleOverLimit}
            text-anchor="middle"
        >
            {TEXT_LIMITS.MAX_STATEMENT_LENGTH - title.length} characters remaining
        </text>
    {/if}
    
    <!-- URL Label (traditional) -->
    <text 
        x="0"
        y={urlLabelY}
        class="form-label"
        text-anchor="middle"
    >
        Evidence URL
    </text>
    
    <!-- URL Input with Floating Label -->
    <foreignObject
        x={-inputWidth/2}
        y={urlInputY}
        width={inputWidth}
        height={urlInputHeight}
    >
        <div class="input-wrapper">
            <input
                id="evidence-url-input"
                type="url"
                class="form-input floating-input"
                class:error={showValidationErrors && (isUrlEmpty || !isUrlValid)}
                class:has-value={url.length > 0}
                bind:value={url}
                placeholder=" "
                {disabled}
            />
            <label for="evidence-url-input" class="floating-label">https://example.com/evidence</label>
        </div>
    </foreignObject>
    
    <!-- URL Validation -->
    {#if showValidationErrors && isUrlEmpty}
        <text 
            x="0"
            y={urlValidationY}
            class="validation-message"
            text-anchor="middle"
        >
            URL is required
        </text>
    {:else if showValidationErrors && !isUrlValid}
        <text 
            x="0"
            y={urlValidationY}
            class="validation-message"
            text-anchor="middle"
        >
            Please enter a valid URL (must start with http:// or https://)
        </text>
    {/if}
    
    <!-- Evidence Type Label (traditional) -->
    <text 
        x="0"
        y={typeLabelY}
        class="form-label"
        text-anchor="middle"
    >
        Evidence Type
    </text>
    
    <!-- Evidence Type Select with Floating Label -->
    <foreignObject
        x={-inputWidth/2}
        y={typeInputY}
        width={inputWidth}
        height={typeInputHeight}
    >
        <div class="input-wrapper">
            <select 
                id="evidence-type-select"
                class="form-input select-input floating-input"
                class:error={showValidationErrors && isTypeEmpty}
                class:has-value={evidenceType !== ''}
                bind:value={evidenceType}
                {disabled}
            >
                <option value=""></option>
                {#each EVIDENCE_TYPES as type}
                    <option value={type.value}>{type.label}</option>
                {/each}
            </select>
            <label for="evidence-type-select" class="floating-label select-floating-label">Select evidence type</label>
        </div>
    </foreignObject>
    
    <!-- Evidence Type Validation -->
    {#if showValidationErrors && isTypeEmpty}
        <text 
            x="0"
            y={typeValidationY}
            class="validation-message"
            text-anchor="middle"
        >
            Evidence type is required
        </text>
    {/if}
</g>

<style>
    .context-label {
        font-size: 11px;
        fill: rgba(255, 255, 255, 0.5);
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    :global(.parent-context) {
        background: rgba(103, 242, 142, 0.1);
        border: 1px solid rgba(103, 242, 142, 0.3);
        border-radius: 4px;
        padding: 6px 8px;
        color: rgba(255, 255, 255, 0.8);
        font-family: 'Inter', sans-serif;
        font-size: 10px;
        font-weight: 400;
        line-height: 1.3;
        font-style: italic;
        max-height: 100%;
        overflow-y: auto;
        box-sizing: border-box;
    }
    
    .form-label {
        font-size: 14px;
        fill: rgba(255, 255, 255, 0.7);
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    .validation-message {
        font-size: 11px;
        fill: #ff4444;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    .character-count {
        font-size: 11px;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
        fill: rgba(255, 255, 255, 0.6);
    }
    
    .character-count.near-limit {
        fill: #ffd700;
    }
    
    .character-count.over-limit {
        fill: #ff4444;
    }
    
    /* Input wrapper for floating labels */
    :global(.input-wrapper) {
        position: relative;
        width: 100%;
        height: 100%;
    }
    
    /* Base input styles */
    :global(input.form-input),
    :global(select.form-input) {
        width: 100%;
        height: 100%;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        color: white;
        padding: 8px;
        font-family: 'Inter', sans-serif;
        font-size: 0.9rem;
        font-weight: 400;
        transition: all 0.2s ease;
        box-sizing: border-box;
        display: block;
        margin: 0;
    }
    
    /* Floating input adjustments */
    :global(.floating-input) {
        padding: 18px 8px 6px 8px !important; /* Extra top padding for label */
    }
    
    /* Floating label */
    :global(.floating-label) {
        position: absolute;
        left: 8px;
        top: 6px; /* Position at top of input */
        font-size: 10px;
        color: rgba(255, 255, 255, 0.5);
        font-family: 'Inter', sans-serif;
        font-weight: 400;
        pointer-events: none;
        transition: all 0.2s ease;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: calc(100% - 16px);
    }
    
    /* When input is focused or has value, label stays at top with color change */
    :global(.floating-input:focus ~ .floating-label),
    :global(.floating-input.has-value ~ .floating-label) {
        color: rgba(66, 153, 225, 0.8);
    }
    
    /* Placeholder hidden by default */
    :global(.floating-input::placeholder) {
        opacity: 0;
    }
    
    /* Show placeholder only when focused (optional - can remove if not wanted) */
    :global(.floating-input:focus::placeholder) {
        opacity: 0.4;
        color: rgba(255, 255, 255, 0.4);
    }
    
    /* Input focus states */
    :global(input.form-input:focus),
    :global(select.form-input:focus) {
        outline: none;
        border-color: rgba(66, 153, 225, 0.6);
        background: rgba(255, 255, 255, 0.08);
    }
    
    /* Error states */
    :global(input.form-input.error),
    :global(select.form-input.error) {
        border-color: #ff4444;
    }
    
    /* Disabled states */
    :global(input.form-input:disabled),
    :global(select.form-input:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    /* Select-specific styles */
    :global(.select-input) {
        cursor: pointer;
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
        background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3e%3cpath d='M7 10l5 5 5-5z'/%3e%3c/svg%3e");
        background-repeat: no-repeat;
        background-position: right 8px center;
        background-size: 20px;
        padding-right: 32px !important;
    }
    
    /* Select floating label adjustment (hide when empty/default option) */
    :global(select.floating-input:not(.has-value) ~ .floating-label.select-floating-label) {
        opacity: 1;
    }
    
    :global(select.floating-input.has-value ~ .floating-label.select-floating-label) {
        opacity: 1;
        color: rgba(66, 153, 225, 0.8);
    }
    
    :global(.select-input option) {
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 8px;
    }
    
    /* Scrollbar for parent context */
    :global(.parent-context::-webkit-scrollbar) {
        width: 4px;
    }
    
    :global(.parent-context::-webkit-scrollbar-track) {
        background: rgba(255, 255, 255, 0.05);
    }
    
    :global(.parent-context::-webkit-scrollbar-thumb) {
        background: rgba(103, 242, 142, 0.3);
        border-radius: 2px;
    }
</style>