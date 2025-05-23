<!-- src/lib/components/graph/nodes/ui/VoteControls.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { VoteStatus } from '$lib/types/domain/nodes';
    import { NODE_CONSTANTS } from '$lib/constants/graph/nodes';
    import { COLORS } from '$lib/constants/colors';
  
    // Props
    export let userVoteStatus: VoteStatus = 'none';
    export let positiveVotes: number = 0;
    export let negativeVotes: number = 0;
    export let netVotes: number = 0;
    export let isVoting: boolean = false;
    export let userName: string = 'Anonymous';
    export let showStats: boolean = true;
    export let showUserStatus: boolean = true;
    export let compact: boolean = false;
    export let lastVoteType: VoteStatus | null = null;
    export let voteSuccess: boolean = false;
  
    // Events
    const dispatch = createEventDispatcher<{
      vote: { voteType: VoteStatus };
    }>();
  
    // Derived values
    $: scoreDisplay = netVotes > 0 ? `+${netVotes}` : netVotes.toString();
    $: voteStatus = netVotes > 0 ? 'agreed' : netVotes < 0 ? 'disagreed' : 'undecided';
    $: totalVotes = positiveVotes + negativeVotes;
  
    // Layout constants
    const METRICS_SPACING = {
      labelX: -200,
      equalsX: 0,
      valueX: 30
    };
  
    // Define colors for the vote buttons from color constants
    const upvoteColor = COLORS.PRIMARY.GREEN;
    const downvoteColor = COLORS.PRIMARY.RED;
    const neutralColor = 'white';
  
    // Track hover state for each vote button
    let upvoteHovered = false;
    let downvoteHovered = false;
  
    // Create unique filter IDs for the glow effects
    const upvoteFilterId = `upvote-glow-${Math.random().toString(36).slice(2)}`;
    const downvoteFilterId = `downvote-glow-${Math.random().toString(36).slice(2)}`;
    const neutralFilterId = `neutral-glow-${Math.random().toString(36).slice(2)}`;
  
    function handleVote(voteType: VoteStatus) {
      if (isVoting) return;
      dispatch('vote', { voteType });
    }
  
    function handleUpvoteHover(isEnter: boolean) {
      upvoteHovered = isEnter;
    }
  
    function handleDownvoteHover(isEnter: boolean) {
      downvoteHovered = isEnter;
    }
  
    // Add keyboard event handler for accessibility
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Enter' || event.key === 'Space') {
        event.preventDefault();
        const target = event.currentTarget as HTMLElement;
        if (target.classList.contains('upvote-button')) {
          if (userVoteStatus === 'agree') {
            handleVote('none');
          } else {
            handleVote('agree');
          }
        } else if (target.classList.contains('downvote-button')) {
          if (userVoteStatus === 'disagree') {
            handleVote('none');
          } else {
            handleVote('disagree');
          }
        }
      }
    }
  
    // Calculate visual states for vote buttons
    $: upvoteButtonState = {
      isVoted: userVoteStatus === 'agree',
      isHovered: upvoteHovered,
      isLoading: isVoting,
      color: userVoteStatus === 'agree' ? upvoteColor : (upvoteHovered ? upvoteColor : neutralColor),
      filter: getVoteButtonFilter('upvote', userVoteStatus, upvoteHovered, voteSuccess, lastVoteType, isVoting)
    };
  
    $: downvoteButtonState = {
      isVoted: userVoteStatus === 'disagree',
      isHovered: downvoteHovered,
      isLoading: isVoting,
      color: userVoteStatus === 'disagree' ? downvoteColor : (downvoteHovered ? downvoteColor : neutralColor),
      filter: getVoteButtonFilter('downvote', userVoteStatus, downvoteHovered, voteSuccess, lastVoteType, isVoting)
    };
  
    // Helper function to determine which filter to apply
    function getVoteButtonFilter(
      buttonType: 'upvote' | 'downvote', 
      voteStatus: VoteStatus,
      isHovered: boolean,
      showSuccess: boolean,
      successType: VoteStatus | null,
      isVotingActive: boolean
    ): string {
      if (showSuccess && successType === (buttonType === 'upvote' ? 'agree' : 'disagree')) {
        return `url(#${buttonType === 'upvote' ? upvoteFilterId : downvoteFilterId})`;
      }
  
      if (voteStatus === 'agree' && buttonType === 'upvote') {
        return isHovered && !isVotingActive 
          ? `url(#${neutralFilterId})` 
          : `url(#${upvoteFilterId})`;
      }
      if (voteStatus === 'disagree' && buttonType === 'downvote') {
        return isHovered && !isVotingActive 
          ? `url(#${neutralFilterId})` 
          : `url(#${downvoteFilterId})`;
      }
  
      if (isHovered && !isVotingActive) {
        return `url(#${buttonType === 'upvote' ? upvoteFilterId : downvoteFilterId})`;
      }
  
      return 'none';
    }
  
    // Get hover text for buttons
    $: upvoteHoverText = userVoteStatus === 'agree' ? 'Remove vote' : 'Agree';
    $: downvoteHoverText = userVoteStatus === 'disagree' ? 'Remove vote' : 'Disagree';
  </script>
  
  <!-- Filter defs for glow effects -->
  <defs>
    <!-- Upvote glow filter -->
    <filter id={upvoteFilterId} x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="blur1"/>
      <feFlood flood-color={upvoteColor} flood-opacity="0.6" result="color1"/>
      <feComposite in="color1" in2="blur1" operator="in" result="shadow1"/>
      
      <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="blur2"/>
      <feFlood flood-color={upvoteColor} flood-opacity="0.8" result="color2"/>
      <feComposite in="color2" in2="blur2" operator="in" result="shadow2"/>
      
      <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur3"/>
      <feFlood flood-color={upvoteColor} flood-opacity="1" result="color3"/>
      <feComposite in="color3" in2="blur3" operator="in" result="shadow3"/>
      
      <feMerge>
        <feMergeNode in="shadow1"/>
        <feMergeNode in="shadow2"/>
        <feMergeNode in="shadow3"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    
    <!-- Downvote glow filter -->
    <filter id={downvoteFilterId} x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="blur1"/>
      <feFlood flood-color={downvoteColor} flood-opacity="0.6" result="color1"/>
      <feComposite in="color1" in2="blur1" operator="in" result="shadow1"/>
      
      <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="blur2"/>
      <feFlood flood-color={downvoteColor} flood-opacity="0.8" result="color2"/>
      <feComposite in="color2" in2="blur2" operator="in" result="shadow2"/>
      
      <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur3"/>
      <feFlood flood-color={downvoteColor} flood-opacity="1" result="color3"/>
      <feComposite in="color3" in2="blur3" operator="in" result="shadow3"/>
      
      <feMerge>
        <feMergeNode in="shadow1"/>
        <feMergeNode in="shadow2"/>
        <feMergeNode in="shadow3"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    
    <!-- Neutral glow filter for hover over voted buttons -->
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
  
  <!-- Vote Controls with proper positioning -->
  <g class="vote-controls" class:compact transform="translate(0, 0)">
    <!-- Upvote button positioned to the left -->
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <!-- svelte-ignore a11y-mouse-events-have-key-events -->
    <g 
      class="upvote-button"
      class:voted={upvoteButtonState.isVoted}
      class:disabled={isVoting}
      class:pulse={voteSuccess && lastVoteType === 'agree'}
      transform="translate(-25, 0)"
      on:click={() => {
        if (!isVoting) {
          if (userVoteStatus === 'agree') {
            handleVote('none');
          } else {
            handleVote('agree');
          }
        }
      }}
      on:keydown={handleKeydown}
      on:mouseenter={() => handleUpvoteHover(true)}
      on:mouseleave={() => handleUpvoteHover(false)}
      tabindex="0"
      role="button"
      aria-label={upvoteHoverText}
      aria-pressed={userVoteStatus === 'agree'}
      style:filter={upvoteButtonState.filter}
    >
      <foreignObject 
        x="-12" 
        y="-12" 
        width="24" 
        height="24" 
        class="icon-container"
      >
        <div 
          class="icon-wrapper"
        >
          {#if isVoting && (lastVoteType === 'agree' || (userVoteStatus === 'agree' && lastVoteType === 'none'))}
            <div class="loading-spinner" style:color={upvoteButtonState.color}>
              ⟳
            </div>
          {:else}
            <span 
              class="material-symbols-outlined vote-icon"
              class:bounce={voteSuccess && lastVoteType === 'agree'}
              style:color={upvoteButtonState.color}
            >
              thumb_up
            </span>
          {/if}
        </div>
      </foreignObject>
      
      <!-- Hover text -->
      {#if upvoteHovered && !isVoting}
        <text
          y="30"
          class="hover-text"
          style:font-family={NODE_CONSTANTS.FONTS.hover.family}
          style:font-size={NODE_CONSTANTS.FONTS.hover.size}
          style:font-weight={NODE_CONSTANTS.FONTS.hover.weight}
          style:fill={upvoteButtonState.color}
        >
          {upvoteHoverText}
        </text>
      {/if}
    </g>
    
    <!-- Vote count with explicit position -->
    <text
      class="vote-count"
      class:pulse={voteSuccess}
      class:positive={netVotes > 0}
      class:negative={netVotes < 0}
      class:neutral={netVotes === 0}
      x="0"
      y="4"
      style:font-family={NODE_CONSTANTS.FONTS.value.family}
      style:font-size="16px"
      style:font-weight="600"
    >
      {scoreDisplay}
    </text>
    
    <!-- Downvote button positioned to the right -->
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <!-- svelte-ignore a11y-mouse-events-have-key-events -->
    <g 
      class="downvote-button"
      class:voted={downvoteButtonState.isVoted}
      class:disabled={isVoting}
      class:pulse={voteSuccess && lastVoteType === 'disagree'}
      transform="translate(25, 0)"
      on:click={() => {
        if (!isVoting) {
          if (userVoteStatus === 'disagree') {
            handleVote('none');
          } else {
            handleVote('disagree');
          }
        }
      }}
      on:keydown={handleKeydown}
      on:mouseenter={() => handleDownvoteHover(true)}
      on:mouseleave={() => handleDownvoteHover(false)}
      tabindex="0"
      role="button"
      aria-label={downvoteHoverText}
      aria-pressed={userVoteStatus === 'disagree'}
      style:filter={downvoteButtonState.filter}
    >
      <foreignObject 
        x="-12" 
        y="-12" 
        width="24" 
        height="24" 
        class="icon-container"
      >
        <div 
          class="icon-wrapper"
        >
          {#if isVoting && (lastVoteType === 'disagree' || (userVoteStatus === 'disagree' && lastVoteType === 'none'))}
            <div class="loading-spinner" style:color={downvoteButtonState.color}>
              ⟳
            </div>
          {:else}
            <span 
              class="material-symbols-outlined vote-icon"
              class:bounce={voteSuccess && lastVoteType === 'disagree'}
              style:color={downvoteButtonState.color}
            >
              thumb_down
            </span>
          {/if}
        </div>
      </foreignObject>
      
      <!-- Hover text -->
      {#if downvoteHovered && !isVoting}
        <text
          y="30"
          class="hover-text"
          style:font-family={NODE_CONSTANTS.FONTS.hover.family}
          style:font-size={NODE_CONSTANTS.FONTS.hover.size}
          style:font-weight={NODE_CONSTANTS.FONTS.hover.weight}
          style:fill={downvoteButtonState.color}
        >
          {downvoteHoverText}
        </text>
      {/if}
    </g>
  </g>
  
  <!-- Vote Statistics (if enabled) -->
  {#if showStats}
    <g class="vote-stats" transform="translate(0, 70)">
      <text x={METRICS_SPACING.labelX} class="stats-label left-align">
        Vote Data:
      </text>
      
      <!-- User's current vote (if enabled) -->
      {#if showUserStatus}
        <g transform="translate(0, 30)">
          <text x={METRICS_SPACING.labelX} class="stats-text left-align">
            {userName}
          </text>
          <text x={METRICS_SPACING.equalsX} class="stats-text">
            =
          </text>
          <text x={METRICS_SPACING.valueX} class="stats-value left-align">
            {userVoteStatus}
          </text>
        </g>
      {/if}
  
      <!-- Total agree votes -->
      <g transform="translate(0, {showUserStatus ? 55 : 30})">
        <text x={METRICS_SPACING.labelX} class="stats-text left-align">
          Total Agree
        </text>
        <text x={METRICS_SPACING.equalsX} class="stats-text">
          =
        </text>
        <text x={METRICS_SPACING.valueX} class="stats-value left-align">
          {positiveVotes}
        </text>
      </g>
  
      <!-- Total disagree votes -->
      <g transform="translate(0, {showUserStatus ? 80 : 55})">
        <text x={METRICS_SPACING.labelX} class="stats-text left-align">
          Total Disagree
        </text>
        <text x={METRICS_SPACING.equalsX} class="stats-text">
          =
        </text>
        <text x={METRICS_SPACING.valueX} class="stats-value left-align">
          {negativeVotes}
        </text>
      </g>
  
      <!-- Net votes -->
      <g transform="translate(0, {showUserStatus ? 105 : 80})">
        <text x={METRICS_SPACING.labelX} class="stats-text left-align">
          Net 
        </text>
        <text x={METRICS_SPACING.equalsX} class="stats-text">
          =
        </text>
        <text x={METRICS_SPACING.valueX} class="stats-value left-align">
          {netVotes}
        </text>
      </g>
  
      <!-- Vote status -->
      <g transform="translate(0, {showUserStatus ? 130 : 105})">
        <text x={METRICS_SPACING.labelX} class="stats-text left-align">
          Status
        </text>
        <text x={METRICS_SPACING.equalsX} class="stats-text">
          =
        </text>
        <text x={METRICS_SPACING.valueX} class="stats-value left-align">
          {voteStatus}
        </text>
      </g>
    </g>
  {/if}
  
  <style>
    /* Base vote controls */
    .vote-controls {
      pointer-events: all;
    }
  
    .vote-controls.compact {
      transform: scale(0.8);
      transform-origin: center;
    }
  
    /* Vote buttons */
    .upvote-button, .downvote-button {
      cursor: pointer;
      transform-box: fill-box;
      transform-origin: center;
      outline: none;
      border: none;
      background: none;
    }
  
    .upvote-button.disabled, .downvote-button.disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
  
    .upvote-button.voted, 
    .downvote-button.voted {
      transform: none;
    }
  
    .upvote-button:focus, .downvote-button:focus {
      outline: 2px solid rgba(255, 255, 255, 0.3);
      outline-offset: 4px;
      border-radius: 50%;
    }
  
    /* Icon containers */
    .icon-container {
      overflow: visible;
      outline: none;
    }
  
    .vote-controls *, .vote-controls *:focus {
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
  
    /* Material Icons styling */
    :global(.vote-controls .material-symbols-outlined.vote-icon) {
      font-size: 20px;
      transition: color 0.3s ease;
      font-variation-settings: 'FILL' 1;
    }
  
    /* Loading spinner styling */
    .loading-spinner {
      font-size: 20px;
      animation: spin 1s linear infinite;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
    }
  
    /* Vote count styling */
    .vote-count {
      fill: rgba(255, 255, 255, 0.9);
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
  
    /* Hover text styling */
    .hover-text {
      text-anchor: middle;
      dominant-baseline: middle;
      user-select: none;
      pointer-events: none;
    }
  
    /* Statistics text styling */
    .stats-label {
      font-size: 14px;
      fill: white;
      font-family: 'Orbitron', sans-serif;
      font-weight: 500;
    }
  
    .stats-text {
      font-size: 14px;
      fill: rgba(255, 255, 255, 0.7);
      font-family: 'Orbitron', sans-serif;
    }
  
    .stats-value {
      font-size: 14px;
      fill: white;
      font-family: 'Orbitron', sans-serif;
      font-weight: 500;
    }
  
    .left-align {
      text-anchor: start;
    }
  
    /* Animations */
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
  
    /* Compact mode adjustments */
    .vote-controls.compact .vote-count {
      font-size: 14px;
    }
  
    .vote-controls.compact :global(.material-symbols-outlined.vote-icon) {
      font-size: 18px;
    }
  </style>