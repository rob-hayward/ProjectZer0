<!-- src/routes/nodes/word/WordNodeDisplay.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { WordNode } from '$lib/types/nodes';
  import type { UserProfile } from '$lib/types/user';
  import BaseZoomedPage from '$lib/components/graphElements/layouts/base/BaseZoomedPage.svelte';
    import { BaseZoomedCanvas, CIRCLE_RADIUS, TEXT_STYLES } from '$lib/components/graphElements/layouts/base/baseZoomedCanvas';
  import { NavigationContext, getNavigationOptions, handleNavigation } from '$lib/services/navigation';
  import { getUserDetails } from '$lib/services/userLookup';

  // Props
  export let wordData: WordNode;

  // State
  let wordCreatorDetails: UserProfile | null = null;
  let liveDefinition = getLiveDefinition(wordData.definitions);
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

  function getVoteValue(votes: any): number {
      if (typeof votes === 'number') return votes;
      if (votes && typeof votes === 'object' && 'low' in votes) {
          return votes.low;
      }
      return 0;
  }

  function getLiveDefinition(definitions: WordNode['definitions']): WordNode['definitions'][0] | null {
      if (!definitions || definitions.length === 0) return null;
      return [...definitions]
          .sort((a, b) => getVoteValue(b.votes) - getVoteValue(a.votes))[0];
  }

  async function loadUserDetails() {
      if (wordData.createdBy && wordData.createdBy !== 'FreeDictionaryAPI') {
          wordCreatorDetails = await getUserDetails(wordData.createdBy);
      }
      
      if (liveDefinition?.createdBy && liveDefinition.createdBy !== 'FreeDictionaryAPI') {
          definitionCreatorDetails = await getUserDetails(liveDefinition.createdBy);
      }
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

  onMount(async () => {
      await loadUserDetails();
  });
</script>

<div class="word-node-display">
  <BaseZoomedPage
      navigationOptions={getNavigationOptions(NavigationContext.WORD)}
      onNavigate={handleNavigation}
      drawContent={drawWordNodeContent}
  />
</div>

<style>
  .word-node-display {
      width: 100vw;
      height: 100vh;
      position: relative;
  }
</style>