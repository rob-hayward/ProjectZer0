<!-- ProjectZer0Frontend/src/routes/nodes/definition/AlternativeDefinitionNodeDisplay.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';
    import type { Definition } from '$lib/types/nodes';
    import type { UserProfile } from '$lib/types/user';
    import BaseZoomedPage from '$lib/components/graphElements/layouts/base/BaseZoomedPage.svelte';
    import { BaseZoomedCanvas, CIRCLE_RADIUS, TEXT_STYLES } from '$lib/components/graphElements/layouts/base/baseZoomedCanvas';
    import { NavigationContext, getNavigationOptions, handleNavigation } from '$lib/services/navigation';
    import { getUserDetails } from '$lib/services/userLookup';
  
    export let word: string;
    export let definition: Definition;
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
      if (definition.createdBy && definition.createdBy !== 'FreeDictionaryAPI') {
        definitionCreatorDetails = await getUserDetails(definition.createdBy);
      }
    }
  
    onMount(async () => {
      await loadUserDetails();
    });
  
    function getVoteValue(votes: any): number {
      if (typeof votes === 'number') return votes;
      if (votes && typeof votes === 'object' && 'low' in votes) {
        return votes.low;
      }
      return 0;
    }
  
    function getDisplayName(userId: string, userDetails: UserProfile | null): string {
      if (userId === 'FreeDictionaryAPI') return 'Free Dictionary API';
      return userDetails?.preferred_username || userDetails?.name || 'User';
    }
  
    function drawAltDefinitionNodeContent(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
      const startX = centerX - (CONTENT_WIDTH / 2);
      let y = centerY + CONTENT_START_Y;
  
      // Draw title
      BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.logo);
      ctx.fillText("Alternative Definition Node", centerX, y);
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
      ctx.fillText(word, startX + wordOffset, y);
      y += 35;
  
      // Draw alternative definition
      BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.label);
      ctx.fillText("alternative definition:", startX, y);
      y += 20;
  
      BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.value);
      y = BaseZoomedCanvas.drawWrappedText(
        ctx,
        definition.text,
        startX,
        y,
        CONTENT_WIDTH,
        20
      );
      y += 35;
  
      // Draw votes on same line
      BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.label);
      ctx.fillText("alternative definition approval votes:", startX, y);
      BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.value);
      const votesOffset = ctx.measureText("alternative definition approval votes: ").width + 10;
      ctx.fillText(getVoteValue(definition.votes).toString(), startX + votesOffset, y);
      y += 35;
  
      // Move credits further down
      y = centerY + (CIRCLE_RADIUS - 110);
      
      // Credits
      BaseZoomedCanvas.setTextStyle(ctx, SMALL_TEXT_LABEL);
      ctx.fillText("Alternative definition created by:", startX, y);
      y += 20;
  
      BaseZoomedCanvas.setTextStyle(ctx, SMALL_TEXT_VALUE);
      const creator = getDisplayName(definition.createdBy, definitionCreatorDetails);
      ctx.fillText(creator, startX, y);
    }
  </script>
  
  <div class="alt-definition-node-display">
    <BaseZoomedPage
      navigationOptions={getNavigationOptions(NavigationContext.WORD)}
      onNavigate={handleNavigation}
      drawContent={drawAltDefinitionNodeContent}
    />
    
    <div class="button-overlay">
      <button class="primary">
        Approve Definition
      </button>
    </div>
  </div>
  
  <style>
    .alt-definition-node-display {
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