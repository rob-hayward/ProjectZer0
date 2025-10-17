<!-- src/lib/components/graph/nodes/ui/InclusionVoteButtons.svelte -->
<!-- Inclusion voting buttons using add/remove icons to distinguish from content voting -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { VoteStatus } from '$lib/types/domain/nodes';
  import { COLORS } from '$lib/constants/colors';

  export let userVoteStatus: VoteStatus = 'none';
  export let positiveVotes: number = 0;
  export let negativeVotes: number = 0;
  export let isVoting: boolean = false;
  export let lastVoteType: VoteStatus | null = null;
  export let voteSuccess: boolean = false;
  
  // Layout props
  export let availableWidth: number = 400;
  export let containerY: number = 0;
  export let mode: 'preview' | 'detail' = 'detail';
  
  const dispatch = createEventDispatcher<{
    vote: { voteType: VoteStatus };
  }>();

  $: netVotes = positiveVotes - negativeVotes;
  $: scoreDisplay = netVotes > 0 ? `+${netVotes}` : netVotes.toString();

  $: buttonSpacing = Math.min(65, availableWidth * 0.5);
  $: iconSize = mode === 'preview' ? '18px' : '22px';
  $: voteCountSize = mode === 'preview' ? '14px' : '16px';
  $: hoverTextY = mode === 'preview' ? '6' : '15';

  const includeColor = COLORS.PRIMARY.GREEN;
  const excludeColor = COLORS.PRIMARY.RED;
  const neutralColor = 'white';

  let includeHovered = false;
  let excludeHovered = false;

  const includeFilterId = `include-glow-${Math.random().toString(36).slice(2)}`;
  const excludeFilterId = `exclude-glow-${Math.random().toString(36).slice(2)}`;
  const neutralFilterId = `neutral-glow-${Math.random().toString(36).slice(2)}`;
  
  function handleVote(voteType: VoteStatus) {
    if (isVoting) return;
    
    let actualVoteType = voteType;
    if (userVoteStatus === voteType && voteType !== 'none') {
      actualVoteType = 'none';
    }
    
    console.log('[InclusionVoteButtons] Vote clicked:', {
      clickedVote: voteType,
      currentStatus: userVoteStatus,
      actualVoteType,
      isToggling: actualVoteType === 'none'
    });
    
    dispatch('vote', { voteType: actualVoteType });
  }

  function handleIncludeHover(isEnter: boolean) {
    includeHovered = isEnter;
  }

  function handleExcludeHover(isEnter: boolean) {
    excludeHovered = isEnter;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const target = event.currentTarget as HTMLElement;
      if (target.classList.contains('include-button')) {
        handleVote('agree');
      } else if (target.classList.contains('exclude-button')) {
        handleVote('disagree');
      }
    }
  }

  $: includeButtonState = {
    isVoted: userVoteStatus === 'agree',
    isHovered: includeHovered,
    isLoading: isVoting && (lastVoteType === 'agree' || (userVoteStatus === 'agree' && lastVoteType === 'none')),
    color: userVoteStatus === 'agree' 
      ? (includeHovered ? 'rgba(46, 204, 113, 1)' : 'rgba(46, 204, 113, 0.9)')
      : (includeHovered ? 'rgba(46, 204, 113, 0.8)' : 'rgba(255, 255, 255, 0.7)'),
    hoverText: userVoteStatus === 'agree' ? 'Remove vote' : 'Include',
    filter: userVoteStatus === 'agree' 
      ? `url(#${includeFilterId})`
      : (includeHovered ? `url(#${includeFilterId})` : 'none')
  };

  $: excludeButtonState = {
    isVoted: userVoteStatus === 'disagree',
    isHovered: excludeHovered,
    isLoading: isVoting && (lastVoteType === 'disagree' || (userVoteStatus === 'disagree' && lastVoteType === 'none')),
    color: userVoteStatus === 'disagree'
      ? (excludeHovered ? 'rgba(231, 76, 60, 1)' : 'rgba(231, 76, 60, 0.9)')
      : (excludeHovered ? 'rgba(231, 76, 60, 0.8)' : 'rgba(255, 255, 255, 0.7)'),
    hoverText: userVoteStatus === 'disagree' ? 'Remove vote' : 'Exclude',
    filter: userVoteStatus === 'disagree'
      ? `url(#${excludeFilterId})`
      : (excludeHovered ? `url(#${excludeFilterId})` : 'none')
  };
</script>

<defs>
  <filter id={includeFilterId} x="-100%" y="-100%" width="300%" height="300%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="blur1"/>
    <feFlood flood-color={includeColor} flood-opacity="0.6" result="color1"/>
    <feComposite in="color1" in2="blur1" operator="in" result="shadow1"/>
    
    <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="blur2"/>
    <feFlood flood-color={includeColor} flood-opacity="0.8" result="color2"/>
    <feComposite in="color2" in2="blur2" operator="in" result="shadow2"/>
    
    <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur3"/>
    <feFlood flood-color={includeColor} flood-opacity="1" result="color3"/>
    <feComposite in="color3" in2="blur3" operator="in" result="shadow3"/>
    
    <feMerge>
      <feMergeNode in="shadow1"/>
      <feMergeNode in="shadow2"/>
      <feMergeNode in="shadow3"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
  
  <filter id={excludeFilterId} x="-100%" y="-100%" width="300%" height="300%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="blur1"/>
    <feFlood flood-color={excludeColor} flood-opacity="0.6" result="color1"/>
    <feComposite in="color1" in2="blur1" operator="in" result="shadow1"/>
    
    <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="blur2"/>
    <feFlood flood-color={excludeColor} flood-opacity="0.8" result="color2"/>
    <feComposite in="color2" in2="blur2" operator="in" result="shadow2"/>
    
    <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur3"/>
    <feFlood flood-color={excludeColor} flood-opacity="1" result="color3"/>
    <feComposite in="color3" in2="blur3" operator="in" result="shadow3"/>
    
    <feMerge>
      <feMergeNode in="shadow1"/>
      <feMergeNode in="shadow2"/>
      <feMergeNode in="shadow3"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
  
  <filter id={neutralFilterId} x="-100%" y="-100%" width="300%" height="300%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="blur1"/>
    <feFlood flood-color={neutralColor} flood-opacity="0.6" result="color1"/>
    <feComposite in="color1" in2="blur1" operator="in" result="shadow1"/>
    
    <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="blur2"/>
    <feFlood flood-color={neutralColor} flood-opacity="0.8" result="color2"/>
    <feComposite in="color2" in2="blur2" operator="in" result="shadow2"/>
    
    <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur3"/>
    <feFlood flood-color={neutralColor} flood-opacity="1" result="color3"/>
    <feComposite in="color3" in2="blur3" operator="in" result="shadow3"/>
    
    <feMerge>
      <feMergeNode in="shadow1"/>
      <feMergeNode in="shadow2"/>
      <feMergeNode in="shadow3"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
</defs>

<g class="inclusion-vote-buttons" transform="translate(0, {containerY})">
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <!-- svelte-ignore a11y-mouse-events-have-key-events -->
  <g 
    class="include-button"
    class:voted={includeButtonState.isVoted}
    class:disabled={isVoting}
    class:pulse={voteSuccess && lastVoteType === 'agree'}
    transform="translate(-{buttonSpacing}, 0)"
    on:click={() => handleVote('agree')}
    on:keydown={handleKeydown}
    on:mouseenter={() => handleIncludeHover(true)}
    on:mouseleave={() => handleIncludeHover(false)}
    tabindex="0"
    role="button"
    aria-label={includeButtonState.hoverText}
    aria-pressed={includeButtonState.isVoted}
    style:filter={includeButtonState.filter}
  >
    <foreignObject 
      x="-12" 
      y="-22" 
      width="24" 
      height="24" 
      class="icon-container"
    >
      <div class="icon-wrapper">
        {#if includeButtonState.isLoading}
          <div class="loading-spinner" style:color={includeButtonState.color}>
            ⟳
          </div>
        {:else}
          <span 
            class="material-symbols-outlined vote-icon"
            class:bounce={voteSuccess && lastVoteType === 'agree'}
            style:color={includeButtonState.color}
            style:font-size={iconSize}
          >
            add
          </span>
        {/if}
      </div>
    </foreignObject>
    
    {#if includeHovered && !isVoting}
      <text
        y={hoverTextY}
        class="hover-text"
        style:font-family="Inter"
        style:font-size="10px"
        style:font-weight="400"
        style:fill={includeButtonState.color}
      >
        {includeButtonState.hoverText}
      </text>
    {/if}
  </g>
  
  <text
    class="vote-count"
    class:pulse={voteSuccess}
    class:positive={netVotes > 0}
    class:negative={netVotes < 0}
    class:neutral={netVotes === 0}
    x="0"
    y="-8"
    style:font-family="Inter"
    style:font-size={voteCountSize}
    style:font-weight="600"
  >
    {scoreDisplay}
  </text>
  
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <!-- svelte-ignore a11y-mouse-events-have-key-events -->
  <g 
    class="exclude-button"
    class:voted={excludeButtonState.isVoted}
    class:disabled={isVoting}
    class:pulse={voteSuccess && lastVoteType === 'disagree'}
    transform="translate({buttonSpacing}, 0)"
    on:click={() => handleVote('disagree')}
    on:keydown={handleKeydown}
    on:mouseenter={() => handleExcludeHover(true)}
    on:mouseleave={() => handleExcludeHover(false)}
    tabindex="0"
    role="button"
    aria-label={excludeButtonState.hoverText}
    aria-pressed={excludeButtonState.isVoted}
    style:filter={excludeButtonState.filter}
  >
    <foreignObject 
      x="-12" 
      y="-22" 
      width="24" 
      height="24" 
      class="icon-container"
    >
      <div class="icon-wrapper">
        {#if excludeButtonState.isLoading}
          <div class="loading-spinner" style:color={excludeButtonState.color}>
            ⟳
          </div>
        {:else}
          <span 
            class="material-symbols-outlined vote-icon"
            class:bounce={voteSuccess && lastVoteType === 'disagree'}
            style:color={excludeButtonState.color}
            style:font-size={iconSize}
          >
            remove
          </span>
        {/if}
      </div>
    </foreignObject>
    
    {#if excludeHovered && !isVoting}
      <text
        y={hoverTextY}
        class="hover-text"
        style:font-family="Inter"
        style:font-size="10px"
        style:font-weight="400"
        style:fill={excludeButtonState.color}
      >
        {excludeButtonState.hoverText}
      </text>
    {/if}
  </g>
</g>

<style>
  .inclusion-vote-buttons {
    pointer-events: all;
  }

  .include-button, .exclude-button {
    cursor: pointer;
    transform-box: fill-box;
    transform-origin: center;
    outline: none;
    border: none;
    background: none;
  }

  .include-button.disabled, .exclude-button.disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .include-button:focus, .exclude-button:focus {
    outline: 2px solid rgba(255, 255, 255, 0.3);
    outline-offset: 4px;
    border-radius: 50%;
  }

  .icon-container {
    overflow: visible;
    outline: none;
  }

  .inclusion-vote-buttons *, .inclusion-vote-buttons *:focus {
    outline: none !important;
    border: none !important;
  }

  .icon-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  :global(.inclusion-vote-buttons .material-symbols-outlined.vote-icon) {
    transition: color 0.3s ease;
    font-variation-settings: 'FILL' 1;
  }

  .loading-spinner {
    font-size: 18px;
    animation: spin 1s linear infinite;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  .vote-count {
    transition: fill 0.3s ease, font-size 0.2s ease;
    text-anchor: middle;
    dominant-baseline: middle;
  }

  .vote-count.positive {
    fill: rgba(46, 204, 113, 0.9);
  }

  .vote-count.negative {
    fill: rgba(231, 76, 60, 0.9);
  }

  .vote-count.neutral {
    fill: rgba(255, 255, 255, 0.9);
  }

  .hover-text {
    text-anchor: middle;
    dominant-baseline: middle;
    user-select: none;
    pointer-events: none;
  }

  :global(.material-symbols-outlined.bounce) {
    animation: bounce 0.5s ease-in-out;
  }

  .pulse {
    animation: pulse 0.5s ease-in-out;
  }

  @keyframes bounce {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.5); }
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>