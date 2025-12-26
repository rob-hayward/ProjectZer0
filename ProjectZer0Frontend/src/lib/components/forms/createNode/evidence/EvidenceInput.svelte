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
    
    // Evidence type options - MUST match backend exactly
    const EVIDENCE_TYPES = [
        { value: 'academic_paper', label: 'Academic Paper / Peer-Reviewed Study' },
        { value: 'government_report', label: 'Government Report' },
        { value: 'news_article', label: 'News Article' },
        { value: 'expert_testimony', label: 'Expert Testimony' },
        { value: 'dataset', label: 'Dataset' },
        { value: 'book', label: 'Book' },
        { value: 'website', label: 'Website' },
        { value: 'legal_document', label: 'Legal Document' },
        { value: 'survey_study', label: 'Survey Study' },
        { value: 'meta_analysis', label: 'Meta-Analysis' },
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
        const trimmed = urlString.trim();
        
        // Auto-add https:// if missing protocol
        let testUrl = trimmed;
        if (!testUrl.startsWith('http://') && !testUrl.startsWith('https://')) {
            testUrl = 'https://' + testUrl;
        }
        
        try {
            const urlObj = new URL(testUrl);
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
    
    // Calculate Y positions using positioning config
    // LAYOUT: Bottom-up with tighter gaps (2% instead of 4%), more room for context
    
    // Context section (top) - expanded from 18% to 26% using saved space
    $: contextLabelY = height * (positioning.evidence_contextLabel || 0.02);
    $: contextBoxY = height * (positioning.evidence_contextBox || 0.04);
    $: contextBoxHeight = Math.max(70, height * (positioning.evidence_contextBoxHeight || 0.26));
    
    // Title section (middle-top) - tighter gap (2% instead of 4%)
    $: titleLabelY = height * (positioning.evidence_titleLabel || 0.32);
    $: titleInputY = height * (positioning.evidence_titleInput || 0.34);
    $: titleInputHeight = Math.max(80, height * (positioning.evidence_titleInputHeight || 0.28));
    $: titleCharCountY = titleInputY + titleInputHeight + 8;
    $: titleValidationY = titleInputY + titleInputHeight + 8;
    
    // URL section (middle-bottom) - tighter gap (2% instead of 4%)
    $: urlLabelY = height * (positioning.evidence_urlLabel || 0.64);
    $: urlInputY = height * (positioning.evidence_urlInput || 0.66);
    $: urlInputHeight = Math.max(36, height * (positioning.evidence_urlInputHeight || 0.08));
    $: urlValidationY = urlInputY + urlInputHeight + 8;
    
    // Evidence type section (bottom) - tighter gap (2% instead of 4%)
    $: typeLabelY = height * (positioning.evidence_typeLabel || 0.76);
    $: typeInputY = height * (positioning.evidence_typeInput || 0.78);
    $: typeInputHeight = Math.max(36, height * (positioning.evidence_typeInputHeight || 0.08));
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
    
    <!-- Title Input -->
    <foreignObject
        x={-inputWidth/2}
        y={titleInputY}
        width={inputWidth}
        height={titleInputHeight}
    >
        <textarea
            class="form-textarea"
            class:error={showValidationErrors && isTitleEmpty}
            bind:value={title}
            on:input={handleTitleInput}
            placeholder="Brief title describing this evidence"
            {disabled}
        />
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
        Evidence URL (https:// will be added if missing)
    </text>
    
    <!-- URL Input -->
    <foreignObject
        x={-inputWidth/2}
        y={urlInputY}
        width={inputWidth}
        height={urlInputHeight}
    >
        <input
            type="text"
            class="form-input"
            class:error={showValidationErrors && (isUrlEmpty || !isUrlValid)}
            bind:value={url}
            placeholder="example.com/article or https://example.com/article"
            {disabled}
        />
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
            Please enter a valid URL
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
    
    <!-- Evidence Type Select -->
    <foreignObject
        x={-inputWidth/2}
        y={typeInputY}
        width={inputWidth}
        height={typeInputHeight}
    >
        <select 
            class="form-input select-input"
            class:error={showValidationErrors && isTypeEmpty}
            bind:value={evidenceType}
            {disabled}
        >
            <option value="">Select evidence type...</option>
            {#each EVIDENCE_TYPES as type}
                <option value={type.value}>{type.label}</option>
            {/each}
        </select>
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
        font-size: 10px;
        fill: rgba(255, 255, 255, 0.5);
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    :global(.parent-context) {
        width: 100%;
        height: 100%;
        min-height: 100%;
        background: rgba(103, 242, 142, 0.1);
        border: 1px solid rgba(103, 242, 142, 0.3);
        border-radius: 4px;
        padding: 6px 8px;
        color: rgba(255, 255, 255, 0.8);
        font-family: 'Inter', sans-serif;
        font-size: 11px;
        font-weight: 400;
        line-height: 1.4;
        font-style: italic;
        max-height: 100%;
        overflow-y: auto;
        box-sizing: border-box;
    }
    
    .form-label {
        font-size: 12px;
        fill: rgba(255, 255, 255, 0.7);
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    .validation-message {
        font-size: 10px;
        fill: #ff4444;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    .character-count {
        font-size: 10px;
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
    
    /* Standard form input styles (for single-line inputs) */
    :global(input.form-input),
    :global(select.form-input) {
        width: 100%;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        color: white;
        padding: 8px;
        font-family: 'Inter', sans-serif;
        font-size: 0.85rem;
        font-weight: 400;
        transition: all 0.2s ease;
        box-sizing: border-box;
        display: block;
        margin: 0;
    }
    
    /* Textarea styles (for multiline inputs like title) */
    :global(textarea.form-textarea) {
        width: 100%;
        height: 100%;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        color: white;
        padding: 8px;
        font-family: 'Inter', sans-serif;
        font-size: 0.85rem;
        font-weight: 400;
        line-height: 1.4;
        transition: all 0.2s ease;
        box-sizing: border-box;
        display: block;
        margin: 0;
        resize: none;
    }
    
    /* Input and textarea focus states */
    :global(input.form-input:focus),
    :global(select.form-input:focus),
    :global(textarea.form-textarea:focus) {
        outline: none;
        border-color: rgba(66, 153, 225, 0.6);
        background: rgba(255, 255, 255, 0.08);
    }
    
    /* Placeholder styling */
    :global(input.form-input::placeholder),
    :global(textarea.form-textarea::placeholder) {
        color: rgba(255, 255, 255, 0.4);
    }
    
    /* Error states */
    :global(input.form-input.error),
    :global(select.form-input.error),
    :global(textarea.form-textarea.error) {
        border-color: #ff4444;
    }
    
    /* Disabled states */
    :global(input.form-input:disabled),
    :global(select.form-input:disabled),
    :global(textarea.form-textarea:disabled) {
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
        padding-right: 32px;
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