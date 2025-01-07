<!-- ProjectZer0Frontend/src/lib/components/graphElements/nodes/previews/WordNodePreview.svelte
<script lang="ts">
    import type { WordPreviewProps } from '$lib/types/graphLayout';
    import type { PreviewNodeStyle } from './styles/previewNodeStyles';
    import type { Definition } from '$lib/types/nodes';
    import type { UserProfile } from '$lib/types/user';
    import BasePreviewNode from './base/BasePreviewNode.svelte';
    import { drawText } from './base/previewDrawing';
    import { PreviewNodeCanvas, PREVIEW_TEXT_STYLES } from './base/previewNodeCanvas';
    import { createEventDispatcher, onMount } from 'svelte';
    import { BaseZoomedCanvas, CIRCLE_RADIUS, TEXT_STYLES } from '$lib/components/graphElements/layouts/base/baseZoomedCanvas';
    import { getUserDetails } from '$lib/services/userLookup';
    
    const dispatch = createEventDispatcher();
    
    export let wordData: WordPreviewProps['wordData'];
    export let isZoomed: WordPreviewProps['isZoomed'] = false;
    
    // State for zoomed view
    let wordCreatorDetails: UserProfile | null = null;
    let liveDefinition = getLiveDefinition(wordData.definitions);
    let definitionCreatorDetails: UserProfile | null = null;

    // Constants from WordNodeDisplay
    const CONTENT_WIDTH = 350;
    const CONTENT_START_Y = -180;
    const SMALL_TEXT_LABEL = {
        font: '10px "Orbitron", sans-serif',
        color: 'rgba(255, 255, 255, 0.7)',
        align: 'left' as const,
        baseline: 'middle' as const
    };

    const SMALL_TEXT_VALUE = {
        font: '10px "Orbitron", sans-serif',
        color: 'rgba(255, 255, 255, 1)',
        align: 'left' as const,
        baseline: 'middle' as const
    };

    async function loadUserDetails() {
        if (wordData.createdBy && wordData.createdBy !== 'FreeDictionaryAPI') {
            wordCreatorDetails = await getUserDetails(wordData.createdBy);
        }
        
        if (liveDefinition?.createdBy && liveDefinition.createdBy !== 'FreeDictionaryAPI') {
            definitionCreatorDetails = await getUserDetails(liveDefinition.createdBy);
        }
    }

    // Helper functions with proper typing
    interface VoteWithLow {
        low: number;
    }

    function getVoteValue(votes: number | VoteWithLow | unknown): number {
        if (typeof votes === 'number') return votes;
        if (votes && typeof votes === 'object' && isVoteWithLow(votes)) {
            return votes.low;
        }
        return 0;
    }

    function isVoteWithLow(vote: unknown): vote is VoteWithLow {
        return typeof vote === 'object' && vote !== null && 'low' in vote && typeof (vote as VoteWithLow).low === 'number';
    }

    function getLiveDefinition(definitions: Definition[]): Definition | null {
        if (!definitions?.length) return null;
        return [...definitions].sort((a, b) => getVoteValue(b.votes) - getVoteValue(a.votes))[0];
    }

    function getDisplayName(userId: string, userDetails: UserProfile | null, isAnonymous: boolean): string {
        if (isAnonymous) return 'Anonymous';
        if (userId === 'FreeDictionaryAPI') return 'Free Dictionary API';
        return userDetails?.preferred_username || userDetails?.name || 'User';
    }

    function handleZoom(event: CustomEvent) {
        console.log('WordNodePreview: Zoom event received', event.detail);
        dispatch('zoom', {
            bounds: event.detail.bounds
        });
    }
    
    // Preview content drawing
    function drawPreviewContent(
        ctx: CanvasRenderingContext2D, 
        centerX: number, 
        centerY: number, 
        style: PreviewNodeStyle,
        isHovered: boolean
    ) {
        const titleY = centerY - (style.size * 0.25);
        const wordY = centerY;

        drawText(ctx, "Word Node", centerX, titleY, PREVIEW_TEXT_STYLES.word.title);
        drawText(ctx, wordData.word, centerX, wordY, PREVIEW_TEXT_STYLES.word.value);
        
        if (isHovered) {
            drawText(
                ctx, 
                "click to expand", 
                centerX, 
                centerY + (style.size * 0.3),
                PREVIEW_TEXT_STYLES.word.hover
            );
        }
    }

    // Zoomed content drawing
    function drawZoomedContent(
        ctx: CanvasRenderingContext2D, 
        centerX: number, 
        centerY: number, 
        style: PreviewNodeStyle
    ) {
        const startX = centerX - (CONTENT_WIDTH / 2);
        let y = centerY + CONTENT_START_Y;

        // Draw title
        BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.logo);
        ctx.fillText("Word Node", centerX, y);
        y += 40;

        // Draw word
        BaseZoomedCanvas.setTextStyle(ctx, {
            ...TEXT_STYLES.label,
            font: '18px "Orbitron", sans-serif'
        });
        ctx.fillText("word:", startX, y);
        BaseZoomedCanvas.setTextStyle(ctx, {
            ...TEXT_STYLES.value,
            font: '18px "Orbitron", sans-serif'
        });
        const wordOffset = ctx.measureText("word: ").width + 10;
        ctx.fillText(wordData.word, startX + wordOffset, y);
        y += 35;

        // Draw definition section if available
        if (liveDefinition) {
            BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.label);
            ctx.fillText("live definition:", startX, y);
            y += 20;

            BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.value);
            y = BaseZoomedCanvas.drawWrappedText(
                ctx,
                liveDefinition.text,
                startX,
                y,
                CONTENT_WIDTH,
                20
            );
            y += 35;

            // Draw votes if not from API
            if (liveDefinition.createdBy !== 'FreeDictionaryAPI') {
                BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.label);
                ctx.fillText("definition approval votes:", startX, y);
                BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.value);
                const votesOffset = ctx.measureText("definition approval votes: ").width + 10;
                ctx.fillText(getVoteValue(liveDefinition.votes).toString(), startX + votesOffset, y);
                y += 35;
            }
        }

        // Credits section
        y = centerY + (CIRCLE_RADIUS - 110);

        const labelX = startX;
        const secondColumnX = startX + (CONTENT_WIDTH / 2) + 20;
        
        BaseZoomedCanvas.setTextStyle(ctx, SMALL_TEXT_LABEL);
        ctx.fillText("Word created by:", labelX, y);
        if (liveDefinition) {
            ctx.fillText("Definition created by:", secondColumnX, y);
        }
        y += 20;

        BaseZoomedCanvas.setTextStyle(ctx, SMALL_TEXT_VALUE);
        const wordCreator = getDisplayName(wordData.createdBy, wordCreatorDetails, !wordData.publicCredit);
        const defCreator = liveDefinition ? getDisplayName(
            liveDefinition.createdBy, 
            definitionCreatorDetails,
            false
        ) : '';
        
        ctx.fillText(wordCreator, labelX, y);
        if (liveDefinition) {
            ctx.fillText(defCreator, secondColumnX, y);
        }
    }

    $: if (isZoomed) {
        loadUserDetails();
    }
</script>

<BasePreviewNode 
    nodeType="word"
    {isZoomed}
    drawContent={isZoomed ? drawZoomedContent : drawPreviewContent}
    on:expand={handleZoom}
/> -->