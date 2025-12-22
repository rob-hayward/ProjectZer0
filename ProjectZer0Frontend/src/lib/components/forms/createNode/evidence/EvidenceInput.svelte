<!-- src/lib/components/forms/createNode/evidence/EvidenceInput.svelte -->
<!-- FIXED: Uses CSS classes like other working components, no inline height conflicts -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { TEXT_LIMITS } from '$lib/constants/validation';
    
    export let title = '';
    export let url = '';
    export let evidenceType = '';
    export let parentNodeText = '';
    export let parentNodeType = '';
    export let disabled = false;
    
    export let positioning: Record<string, number> = {};
    export let width: number = 400;
    export let height: number = 400;
    
    let showValidationErrors = false;
    
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
    
    // Calculate positions using ContentBox positioning (single source of truth)
    $: contextLabelY = height * (positioning.evidence_contextLabel ?? 0.02);
    $: contextBoxY = height * (positioning.evidence_contextBox ?? 0.04);
    $: contextBoxHeight = height * (positioning.evidence_contextBoxHeight ?? 0.55);
    
    $: titleLabelY = height * (positioning.evidence_titleLabel ?? 0.61);
    $: titleInputY = height * (positioning.evidence_titleInput ?? 0.63);
    $: titleInputHeight = height * (positioning.evidence_titleInputHeight ?? 0.18);
    $: titleCharCountY = titleInputY + titleInputHeight + 10;
    $: titleValidationY = titleInputY + titleInputHeight + 8;
    
    $: urlLabelY = height * (positioning.evidence_urlLabel ?? 0.83);
    $: urlInputY = height * (positioning.evidence_urlInput ?? 0.85);
    $: urlInputHeight = height * (positioning.evidence_urlInputHeight ?? 0.07);
    $: urlValidationY = urlInputY + urlInputHeight + 8;
    
    $: typeLabelY = height * (positioning.evidence_typeLabel ?? 0.93);
    $: typeInputY = height * (positioning.evidence_typeInput ?? 0.95);
    $: typeInputHeight = height * (positioning.evidence_typeInputHeight ?? 0.05);
    $: typeValidationY = typeInputY + typeInputHeight + 8;
    
    $: inputWidth = Math.min(340, width * 0.85);
</script>

<g>
    <text 
        x="0"
        y={contextLabelY}
        class="context-label"
        text-anchor="middle"
    >
        Adding Evidence to {parentNodeTypeDisplay}:
    </text>
    
    <!-- Parent Context Box - NO inline height style, uses CSS only -->
    <foreignObject
        x={-inputWidth/2}
        y={contextBoxY}
        width={inputWidth}
        height={contextBoxHeight}
    >
        <div class="parent-context">
            {parentNodeText || 'Loading parent context...'}
        </div>
    </foreignObject>
    
    <text 
        x="0"
        y={titleLabelY}
        class="form-label"
        text-anchor="middle"
    >
        Evidence Title
    </text>
    
    <!-- Title Input - NO inline height style, uses CSS only -->
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
    
    <text 
        x="0"
        y={urlLabelY}
        class="form-label"
        text-anchor="middle"
    >
        Evidence URL
    </text>
    
    <!-- URL Input - NO inline height style, uses CSS only -->
    <foreignObject
        x={-inputWidth/2}
        y={urlInputY}
        width={inputWidth}
        height={urlInputHeight}
    >
        <input
            type="url"
            class="form-input"
            class:error={showValidationErrors && (isUrlEmpty || !isUrlValid)}
            bind:value={url}
            placeholder="https://example.com/evidence"
            {disabled}
        />
    </foreignObject>
    
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
    
    <text 
        x="0"
        y={typeLabelY}
        class="form-label"
        text-anchor="middle"
    >
        Evidence Type
    </text>
    
    <!-- Type Select - NO inline height style, uses CSS only -->
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
    
    /* 🔑 KEY FIX: Use height: 100% like working components */
    :global(.parent-context) {
        width: 100%;
        height: 100%;
        min-height: 100%;
        background: rgba(103, 242, 142, 0.1);
        border: 1px solid rgba(103, 242, 142, 0.3);
        border-radius: 4px;
        padding: 8px;
        color: rgba(255, 255, 255, 0.8);
        font-family: 'Inter', sans-serif;
        font-size: 11px;
        font-weight: 400;
        line-height: 1.4;
        font-style: italic;
        overflow-y: auto;
        overflow-wrap: break-word;
        word-wrap: break-word;
        box-sizing: border-box;
        display: block;
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
    
    /* Standard form inputs - match DiscussionInput pattern */
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
        font-size: 0.85rem;
        font-weight: 400;
        transition: all 0.2s ease;
        box-sizing: border-box;
        display: block;
        margin: 0;
    }
    
    /* Textarea - match DiscussionInput pattern */
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
    
    :global(input.form-input:focus),
    :global(select.form-input:focus),
    :global(textarea.form-textarea:focus) {
        outline: none;
        border-color: rgba(66, 153, 225, 0.6);
        background: rgba(255, 255, 255, 0.08);
    }
    
    :global(input.form-input::placeholder),
    :global(textarea.form-textarea::placeholder) {
        color: rgba(255, 255, 255, 0.4);
    }
    
    :global(input.form-input.error),
    :global(select.form-input.error),
    :global(textarea.form-textarea.error) {
        border-color: #ff4444;
    }
    
    :global(input.form-input:disabled),
    :global(select.form-input:disabled),
    :global(textarea.form-textarea:disabled) {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
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