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
    
    // NEW: Content box awareness props
    export let mode: 'preview' | 'detail' = 'detail';
    export let availableWidth: number = 400;
    export let availableHeight: number = 100;
    export let containerY: number = 0; // Y position within the container
  
    // Events
    const dispatch = createEventDispatcher<{
      vote: { voteType: VoteStatus };
    }>();
  
    // Derived values
    $: scoreDisplay = netVotes > 0 ? `+${netVotes}` : netVotes.toString();
    $: voteStatus = netVotes > 0 ? 'agreed' : netVotes < 0 ? 'disagreed' : 'undecided';
    $: totalVotes = positiveVotes + negativeVotes;
  
    // Layout calculations based on available space
    $: buttonSpacing = Math.min(65, availableWidth * 0.15); // Adaptive button spacing
    $: iconSize = compact ? '20px' : '22px';
    $: voteCountSize = compact ? '14px' : '16px';
  
    // Define colors for the vote buttons
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
      
      // Toggle logic: if user clicks the same vote type they already have, remove it
      let actualVoteType = voteType;
      if (userVoteStatus === voteType && voteType !== 'none') {
        actualVoteType = 'none'; // Remove the vote
      }
      
      console.log('[VoteControls] Vote clicked:', {
        clickedVote: voteType,
        currentStatus: userVoteStatus,
        actualVoteType,
        isToggling: actualVoteType === 'none'
      });
      
      dispatch('vote', { voteType: actualVoteType });
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
          handleVote('agree');
        } else if (target.classList.contains('downvote-button')) {
          handleVote('disagree');
        }
      }
    }
  
    // Calculate visual states for vote buttons
    $: upvoteButtonState = {
      isVoted: userVoteStatus === 'agree',
      isHovered: upvoteHovered,
      isLoading: isVoting && (lastVoteType === 'agree' || (userVoteStatus === 'agree' && lastVoteType === 'none')),
      color: userVoteStatus === 'agree' 
        ? (upvoteHovered ? neutralColor : upvoteColor)
        : (upvoteHovered ? upvoteColor : neutralColor),
      filter: getVoteButtonFilter('upvote', userVoteStatus, upvoteHovered, voteSuccess, lastVoteType, isVoting),
      hoverText: userVoteStatus === 'agree' ? 'Remove vote' : 'Agree'
    };

    $: downvoteButtonState = {
      isVoted: userVoteStatus === 'disagree',
      isHovered: downvoteHovered,
      isLoading: isVoting && (lastVoteType === 'disagree' || (userVoteStatus === 'disagree' && lastVoteType === 'none')),
      color: userVoteStatus === 'disagree' 
        ? (downvoteHovered ? neutralColor : downvoteColor)
        : (downvoteHovered ? downvoteColor : neutralColor),
      filter: getVoteButtonFilter('downvote', userVoteStatus, downvoteHovered, voteSuccess, lastVoteType, isVoting),
      hoverText: userVoteStatus === 'disagree' ? 'Remove vote' : 'Disagree'
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
      // Show success animation
      if (showSuccess && successType === (buttonType === 'upvote' ? 'agree' : 'disagree')) {
        return `url(#${buttonType === 'upvote' ? upvoteFilterId : downvoteFilterId})`;
      }
      
      // Enhanced hover states for voted buttons
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
      
      // Show colored glow for non-voted buttons on hover
      if (isHovered && !isVotingActive && voteStatus !== (buttonType === 'upvote' ? 'agree' : 'disagree')) {
        return `url(#${buttonType === 'upvote' ? upvoteFilterId : downvoteFilterId})`;
      }
      
      return 'none';
    }
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
  
  <!-- Vote Controls with adaptive positioning -->
  <g class="vote-controls" class:compact transform="translate(0, {containerY})">
    <!-- Upvote button -->
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <!-- svelte-ignore a11y-mouse-events-have-key-events -->
    <g 
      class="upvote-button"
      class:voted={upvoteButtonState.isVoted}
      class:disabled={isVoting}
      class:pulse={voteSuccess && lastVoteType === 'agree'}
      transform="translate(-{buttonSpacing}, 0)"
      on:click={() => handleVote('agree')}
      on:keydown={handleKeydown}
      on:mouseenter={() => handleUpvoteHover(true)}
      on:mouseleave={() => handleUpvoteHover(false)}
      tabindex="0"
      role="button"
      aria-label={upvoteButtonState.hoverText}
      aria-pressed={upvoteButtonState.isVoted}
      style:filter={upvoteButtonState.filter}
    >
      <foreignObject 
        x="-12" 
        y="-12" 
        width="24" 
        height="24" 
        class="icon-container"
      >
        <div class="icon-wrapper">
          {#if upvoteButtonState.isLoading}
            <div class="loading-spinner" style:color={upvoteButtonState.color}>
              ⟳
            </div>
          {:else}
            <span 
              class="material-symbols-outlined vote-icon"
              class:bounce={voteSuccess && lastVoteType === 'agree'}
              style:color={upvoteButtonState.color}
              style:font-size={iconSize}
            >
              thumb_up
            </span>
          {/if}
        </div>
      </foreignObject>
      
      <!-- Hover text -->
      {#if upvoteHovered && !isVoting && mode === 'detail'}
        <text
          y="30"
          class="hover-text"
          style:font-family="Inter"
          style:font-size="10px"
          style:font-weight="400"
          style:fill={upvoteButtonState.color}
        >
          {upvoteButtonState.hoverText}
        </text>
      {/if}
    </g>
    
    <!-- Vote count -->
    <text
      class="vote-count"
      class:pulse={voteSuccess}
      class:positive={netVotes > 0}
      class:negative={netVotes < 0}
      class:neutral={netVotes === 0}
      x="0"
      y="4"
      style:font-family="Inter"
      style:font-size={voteCountSize}
      style:font-weight="600"
    >
      {scoreDisplay}
    </text>
    
    <!-- Downvote button -->
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <!-- svelte-ignore a11y-mouse-events-have-key-events -->
    <g 
      class="downvote-button"
      class:voted={downvoteButtonState.isVoted}
      class:disabled={isVoting}
      class:pulse={voteSuccess && lastVoteType === 'disagree'}
      transform="translate({buttonSpacing}, 0)"
      on:click={() => handleVote('disagree')}
      on:keydown={handleKeydown}
      on:mouseenter={() => handleDownvoteHover(true)}
      on:mouseleave={() => handleDownvoteHover(false)}
      tabindex="0"
      role="button"
      aria-label={downvoteButtonState.hoverText}
      aria-pressed={downvoteButtonState.isVoted}
      style:filter={downvoteButtonState.filter}
    >
      <foreignObject 
        x="-12" 
        y="-12" 
        width="24" 
        height="24" 
        class="icon-container"
      >
        <div class="icon-wrapper">
          {#if downvoteButtonState.isLoading}
            <div class="loading-spinner" style:color={downvoteButtonState.color}>
              ⟳
            </div>
          {:else}
            <span 
              class="material-symbols-outlined vote-icon"
              class:bounce={voteSuccess && lastVoteType === 'disagree'}
              style:color={downvoteButtonState.color}
              style:font-size={iconSize}
            >
              thumb_down
            </span>
          {/if}
        </div>
      </foreignObject>
      
      <!-- Hover text -->
      {#if downvoteHovered && !isVoting && mode === 'detail'}
        <text
          y="30"
          class="hover-text"
          style:font-family="Inter"
          style:font-size="10px"
          style:font-weight="400"
          style:fill={downvoteButtonState.color}
        >
          {downvoteButtonState.hoverText}
        </text>
      {/if}
    </g>
  </g>
  
  <!-- Vote Statistics (content-box aware) -->
  {#if showStats && mode === 'detail'}
    <g class="vote-stats-container" transform="translate(0, 50)">
      <!-- Subtle background for statistics section -->
      <rect
        x={-availableWidth/2 + 10}
        y="-8"
        width={availableWidth - 20}
        height="75"
        rx="6"
        ry="6"
        fill="rgba(255, 255, 255, 0.02)"
        stroke="rgba(255, 255, 255, 0.05)"
        stroke-width="1"
      />
      
      <!-- Left-aligned header -->
      <text 
        class="stats-header"
        x={-availableWidth/2 + 25}
        y="4"
        style:font-family="Inter"
        style:font-size="12px"
        style:font-weight="400"
        style:fill="rgba(255, 255, 255, 0.6)"
        style:text-anchor="start"
      >
        Vote Data
      </text>
      
      <!-- Statistics in clean key-value layout with equals signs -->
      <g class="stats-content" transform="translate(0, 20)">
        <!-- Line 1: User status -->
        {#if showUserStatus}
          <g class="stat-row">
            <text 
              class="stat-key"
              x={-availableWidth/2 + 25}
              y="0"
              style:font-family="Inter"
              style:font-size="12px"
              style:font-weight="400"
              style:fill="rgba(255, 255, 255, 0.8)"
              style:text-anchor="start"
            >
              {userName}
            </text>
            <text 
              class="stat-equals"
              x="0"
              y="0"
              style:font-family="Inter"
              style:font-size="12px"
              style:font-weight="400"
              style:fill="rgba(255, 255, 255, 0.6)"
              style:text-anchor="middle"
            >
              =
            </text>
            <text 
              class="stat-value"
              x={availableWidth/2 - 25}
              y="0"
              style:font-family="Inter"
              style:font-size="12px"
              style:font-weight="500"
              style:fill="rgba(255, 255, 255, 0.9)"
              style:text-anchor="end"
            >
              {userVoteStatus}
            </text>
          </g>
        {/if}
        
        <!-- Line 2: Agree count -->
        <g class="stat-row" transform="translate(0, {showUserStatus ? 15 : 0})">
          <text 
            class="stat-key"
            x={-availableWidth/2 + 25}
            y="0"
            style:font-family="Inter"
            style:font-size="12px"
            style:font-weight="400"
            style:fill="rgba(255, 255, 255, 0.8)"
            style:text-anchor="start"
          >
            Total Agree
          </text>
          <text 
            class="stat-equals"
            x="0"
            y="0"
            style:font-family="Inter"
            style:font-size="12px"
            style:font-weight="400"
            style:fill="rgba(255, 255, 255, 0.6)"
            style:text-anchor="middle"
          >
            =
          </text>
          <text 
            class="stat-value"
            x={availableWidth/2 - 25}
            y="0"
            style:font-family="Inter"
            style:font-size="12px"
            style:font-weight="500"
            style:fill="rgba(46, 204, 113, 0.9)"
            style:text-anchor="end"
          >
            {positiveVotes}
          </text>
        </g>
        
        <!-- Line 3: Disagree count -->
        <g class="stat-row" transform="translate(0, {showUserStatus ? 30 : 15})">
          <text 
            class="stat-key"
            x={-availableWidth/2 + 25}
            y="0"
            style:font-family="Inter"
            style:font-size="12px"
            style:font-weight="400"
            style:fill="rgba(255, 255, 255, 0.8)"
            style:text-anchor="start"
          >
            Total Disagree
          </text>
          <text 
            class="stat-equals"
            x="0"
            y="0"
            style:font-family="Inter"
            style:font-size="12px"
            style:font-weight="400"
            style:fill="rgba(255, 255, 255, 0.6)"
            style:text-anchor="middle"
          >
            =
          </text>
          <text 
            class="stat-value"
            x={availableWidth/2 - 25}
            y="0"
            style:font-family="Inter"
            style:font-size="12px"
            style:font-weight="500"
            style:fill="rgba(231, 76, 60, 0.9)"
            style:text-anchor="end"
          >
            {negativeVotes}
          </text>
        </g>
        
        <!-- Line 4: Net votes -->
        <g class="stat-row" transform="translate(0, {showUserStatus ? 45 : 30})">
          <text 
            class="stat-key"
            x={-availableWidth/2 + 25}
            y="0"
            style:font-family="Inter"
            style:font-size="12px"
            style:font-weight="400"
            style:fill="rgba(255, 255, 255, 0.8)"
            style:text-anchor="start"
          >
            Net Votes
          </text>
          <text 
            class="stat-equals"
            x="0"
            y="0"
            style:font-family="Inter"
            style:font-size="12px"
            style:font-weight="400"
            style:fill="rgba(255, 255, 255, 0.6)"
            style:text-anchor="middle"
          >
            =
          </text>
          <text 
            class="stat-value"
            x={availableWidth/2 - 25}
            y="0"
            style:font-family="Inter"
            style:font-size="12px"
            style:font-weight="600"
            style:fill={netVotes > 0 ? 'rgba(46, 204, 113, 0.95)' : netVotes < 0 ? 'rgba(231, 76, 60, 0.95)' : 'rgba(255, 255, 255, 0.9)'}
            style:text-anchor="end"
          >
            {netVotes > 0 ? '+' : ''}{netVotes}
          </text>
        </g>
      </g>
    </g>
  {/if}
  
  <style>
    /* Base vote controls */
    .vote-controls {
      pointer-events: all;
    }
  
    .vote-controls.compact {
      transform: scale(0.9);
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
      transition: color 0.3s ease;
      font-variation-settings: 'FILL' 1;
    }
  
    /* Loading spinner styling */
    .loading-spinner {
      font-size: 18px;
      animation: spin 1s linear infinite;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
    }
  
    /* Vote count styling */
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
  
    /* Hover text styling */
    .hover-text {
      text-anchor: middle;
      dominant-baseline: middle;
      user-select: none;
      pointer-events: none;
    }
  
    /* Statistics styling - all Inter font now */
    .stats-header {
      text-anchor: middle;
      dominant-baseline: middle;
    }
  
    .stat-line {
      dominant-baseline: middle;
    }
    
    .stat-row {
      /* Row container for key-equals-value layout */
    }
    
    .stat-key {
      dominant-baseline: middle;
    }
    
    .stat-equals {
      dominant-baseline: middle;
    }
    
    .stat-value {
      dominant-baseline: middle;
    }
  
    .vote-stats-container {
      opacity: 0.95;
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
  </style>