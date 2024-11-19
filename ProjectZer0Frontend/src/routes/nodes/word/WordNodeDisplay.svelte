<script lang="ts">
  import { onMount } from 'svelte';
  import type { WordNode, Definition } from '$lib/types/nodes';
  import type { UserProfile } from '$lib/types/user';
  import ZoomNodeCanvas from '$lib/components/graphElements/nodes/zoomNode/ZoomNodeCanvas.svelte';
  import { BaseZoomedCanvas, TEXT_STYLES, CIRCLE_RADIUS } from '$lib/components/graphElements/layouts/baseZoomedCanvas';
  import { drawGlow } from '$lib/utils/canvasAnimations';
  import { getUserDetails } from '$lib/services/userLookup';

  export let wordData: WordNode;
  let time = 0;
  let displayDefinition: Definition | null = null;
  let wordCreatorDetails: UserProfile | null = null;
  let definitionCreatorDetails: UserProfile | null = null;

  // Constants
  const CONTENT_WIDTH = 350;
  const CONTENT_START_Y = -180;

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

  function draw(ctx: CanvasRenderingContext2D, mouseX: number, mouseY: number) {
    time += 0.01;
    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;
    const startX = centerX - (CONTENT_WIDTH / 2);
    let y = centerY + CONTENT_START_Y;

    // Draw central circle with glow
    BaseZoomedCanvas.drawCentralCircle(ctx, centerX, centerY, time);

    // Draw title
    BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.logo);
    ctx.fillText("Word Node", centerX, y);
    y += 40;

    // Draw word
    BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.label);
    ctx.fillText("word:", startX, y);
    y += 20;
    
    BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.value);
    ctx.fillText(wordData.word, startX, y);
    y += 35;

    // Draw definition section
    if (displayDefinition) {
      BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.label);
      ctx.fillText("definition:", startX, y);
      y += 20;

      BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.value);
      const source = displayDefinition.createdBy === 'FreeDictionaryAPI' ? 'Dictionary: ' : 'User: ';
      y = BaseZoomedCanvas.drawWrappedText(
        ctx,
        source + displayDefinition.text,
        startX,
        y,
        CONTENT_WIDTH,
        20
      );
      y += 35;

      if (displayDefinition.createdBy !== 'FreeDictionaryAPI') {
        BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.label);
        ctx.fillText("definition approval votes:", startX, y);
        y += 20;
        BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.value);
        ctx.fillText(getVoteValue(displayDefinition.votes).toString(), startX, y);
        y += 35;
      }
    }

    // Draw creator info
    BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.label);
    ctx.fillText("Word Node created by:", startX, y);
    y += 20;
    BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.value);
    const wordCreator = getDisplayName(wordData.createdBy, wordCreatorDetails, !wordData.publicCredit);
    ctx.fillText(wordCreator, startX, y);

    if (displayDefinition) {
      y += 35;
      BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.label);
      ctx.fillText("Definition created by:", startX, y);
      y += 20;
      BaseZoomedCanvas.setTextStyle(ctx, TEXT_STYLES.value);
      const defCreator = getDisplayName(
        displayDefinition.createdBy, 
        definitionCreatorDetails,
        false
      );
      ctx.fillText(defCreator, startX, y);
    }
  }
</script>

<div class="word-node-display">
  <ZoomNodeCanvas
    {draw}
    backgroundColor="black"
  />
  
  {#if displayDefinition && displayDefinition.createdBy !== 'FreeDictionaryAPI'}
    <div class="button-overlay">
      <button class="approve-button">
        Approve Definition
      </button>
    </div>
  {/if}
  
  {#if wordData.discussion}
    <div class="discussion-overlay">
      <h2>Discussion</h2>
      {#if wordData.discussion.comments?.length}
        {#each wordData.discussion.comments as comment}
          <div class="comment">
            <p>{comment.commentText}</p>
            <div class="comment-meta">
              <span>{comment.createdBy}</span>
            </div>
          </div>
        {/each}
      {:else}
        <p>No comments yet.</p>
      {/if}
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
    transform: translate(-50%, 60px);
  }

  .approve-button {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    border-radius: 4px;
    padding: 0.5rem 1rem;
    font-family: 'Orbitron', sans-serif;
    font-size: 0.9rem;
    transition: all 0.2s;
    cursor: pointer;
  }

  .approve-button:hover {
    border-color: rgba(255, 255, 255, 0.4);
    background: rgba(0, 0, 0, 0.5);
  }

  .discussion-overlay {
    position: absolute;
    top: 20px;
    right: 20px;
    width: 300px;
    max-height: 80vh;
    overflow-y: auto;
    background: rgba(0, 0, 0, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 20px;
    color: white;
  }

  .comment {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 5px;
    padding: 15px;
    margin-bottom: 15px;
  }

  .comment-meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.8em;
    color: rgba(255, 255, 255, 0.7);
    margin-top: 10px;
  }

  h2 {
    font-family: "Orbitron", sans-serif;
    margin-bottom: 20px;
    color: white;
  }
</style>