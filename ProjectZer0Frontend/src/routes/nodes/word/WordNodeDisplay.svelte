<script lang="ts">
  import { onMount } from 'svelte';
  import type { WordNode, Definition } from '$lib/types/nodes';
  import type { UserProfile } from '$lib/types/user';
  import BaseZoomedPage from '$lib/components/graphElements/layouts/BaseZoomedPage.svelte';
  import { BaseZoomedCanvas, TEXT_STYLES, CIRCLE_RADIUS } from '$lib/components/graphElements/layouts/baseZoomedCanvas';
  import { NavigationContext, getNavigationOptions, handleNavigation } from '$lib/services/navigation';
  import { getUserDetails } from '$lib/services/userLookup';

  export let wordData: WordNode;
  let time = 0;
  let displayDefinition: Definition | null = null;
  let wordCreatorDetails: UserProfile | null = null;
  let definitionCreatorDetails: UserProfile | null = null;

  // Constants
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
    
    if (displayDefinition?.createdBy && displayDefinition.createdBy !== 'FreeDictionaryAPI') {
      definitionCreatorDetails = await getUserDetails(displayDefinition.createdBy);
    }
  }

  onMount(async () => {
    if (wordData?.definitions) {
      displayDefinition = getDisplayDefinition(wordData.definitions);
      await loadUserDetails();
    }
  });

  function getVoteValue(votes: any): number {
    if (typeof votes === 'number') return votes;
    if (votes && typeof votes === 'object' && 'low' in votes) {
      return votes.low;
    }
    return 0;
  }

  function getDisplayDefinition(definitions: Definition[]): Definition | null {
    if (!definitions || definitions.length === 0) return null;

    const userDefinitions = definitions.filter(d => d.createdBy !== 'FreeDictionaryAPI');
    const sortedUserDefs = userDefinitions.sort((a, b) => 
      getVoteValue(b.votes) - getVoteValue(a.votes)
    );

    if (sortedUserDefs.length > 0 && getVoteValue(sortedUserDefs[0].votes) > 0) {
      return sortedUserDefs[0];
    }

    const apiDefinition = definitions.find(d => d.createdBy === 'FreeDictionaryAPI');
    if (apiDefinition) return apiDefinition;

    return sortedUserDefs[0] || null;
  }

  function getDisplayName(userId: string, userDetails: UserProfile | null, isAnonymous: boolean): string {
    if (isAnonymous) return 'Anonymous';
    if (userId === 'FreeDictionaryAPI') return 'Free Dictionary API';
    return userDetails?.preferred_username || userDetails?.name || 'User';
  }

  function drawWordNodeContent(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
    const startX = centerX - (CONTENT_WIDTH / 2);
    let y = centerY + CONTENT_START_Y;

    // Draw title
    BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.logo);
    ctx.fillText("Word Node", centerX, y);
    y += 40;

    // Draw word on same line
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

    // Draw definition section
    if (displayDefinition) {
      BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.label);
      ctx.fillText("definition:", startX, y);
      y += 20;

      BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.value);
      y = BaseZoomedCanvas.drawWrappedText(
        ctx,
        displayDefinition.text,
        startX,
        y,
        CONTENT_WIDTH,
        20
      );
      y += 35;

      if (displayDefinition.createdBy !== 'FreeDictionaryAPI') {
        // Draw votes on same line
        BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.label);
        ctx.fillText("definition approval votes:", startX, y);
        BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.value);
        const votesOffset = ctx.measureText("definition approval votes: ").width + 10;
        ctx.fillText(getVoteValue(displayDefinition.votes).toString(), startX + votesOffset, y);
        y += 35;
      }
    }

    // Move credits further down
    y = centerY + (CIRCLE_RADIUS - 110);

    const labelX = startX;
    const secondColumnX = startX + (CONTENT_WIDTH / 2) + 20;
    
    // Keep small text for credits
    BaseZoomedCanvas.setTextStyle(ctx, SMALL_TEXT_LABEL);
    ctx.fillText("Word Node created by:", labelX, y);
    ctx.fillText("Definition created by:", secondColumnX, y);
    y += 20;

    BaseZoomedCanvas.setTextStyle(ctx, SMALL_TEXT_VALUE);
    const wordCreator = getDisplayName(wordData.createdBy, wordCreatorDetails, !wordData.publicCredit);
    const defCreator = getDisplayName(
      displayDefinition?.createdBy || '', 
      definitionCreatorDetails,
      false
    );
    
    ctx.fillText(wordCreator, labelX, y);
    ctx.fillText(defCreator, secondColumnX, y);
  }
</script>

<div class="word-node-display">
  <BaseZoomedPage
    navigationOptions={getNavigationOptions(NavigationContext.WORD)}
    onNavigate={handleNavigation}
    drawContent={drawWordNodeContent}
  />
  
  {#if displayDefinition && displayDefinition.createdBy !== 'FreeDictionaryAPI'}
    <div class="button-overlay">
      <button class="primary">
        Approve Definition
      </button>
    </div>
  {/if}
</div>

<style>
  .word-node-display {
    width: 100vw;
    height: 100vh;
    position: relative;
  }

  .button-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, 100px);
  }

  button {
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-family: 'Orbitron', sans-serif;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
    color: white;
    min-width: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  button.primary {
    background: rgba(74, 144, 226, 0.3);
    border: 1px solid rgba(74, 144, 226, 0.4);
  }

  button:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  button:active:not(:disabled) {
    transform: translateY(0);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>