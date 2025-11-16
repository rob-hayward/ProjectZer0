<!-- src/lib/components/graph/nodes/ui/ContentVoteButtons.svelte -->
<!-- Content voting buttons using thumbs up/down icons -->
<!-- 
  NOTE: This component renders at (0, 0). 
  Parent should wrap in <g transform="translate(0, {y})"> for positioning.
  The containerY prop is deprecated and should always be 0.
-->
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
  
    const upvoteColor = COLORS.PRIMARY.GREEN;
    const downvoteColor = COLORS.PRIMARY.RED;
    const neutralColor = 'white';
  
    let upvoteHovered = false;
    let downvoteHovered = false;
  
    const upvoteFilterId = `upvote-glow-${Math.random().toString(36).slice(2)}`;
    const downvoteFilterId = `downvote-glow-${Math.random().toString(36).slice(2)}`;
    const neutralFilterId = `neutral-glow-${Math.random().toString(36).slice(2)}`;
    
    function handleVote(voteType: VoteStatus) {
      if (isVoting) return;
      
      let actualVoteType = voteType;
      if (userVoteStatus === voteType && voteType !== 'none') {
        actualVoteType = 'none';
      }
      
      console.log('[VoteButtons] Vote clicked:', {
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
      
      if (isHovered && !isVotingActive && voteStatus !== (buttonType === 'upvote' ? 'agree' : 'disagree')) {
        return `url(#${buttonType === 'upvote' ? upvoteFilterId : downvoteFilterId})`;
      }
      
      return 'none';
    }
  </script>
  
  <defs>
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
  
  <g class="vote-buttons">
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
        y="-22" 
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
      
      {#if upvoteHovered && !isVoting}
        <text
          y={hoverTextY}
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
        y="-22" 
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
      
      {#if downvoteHovered && !isVoting}
        <text
          y={hoverTextY}
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
  
  <style>
    .vote-buttons {
      pointer-events: all;
    }
  
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
  
    .icon-container {
      overflow: visible;
      outline: none;
    }
  
    .vote-buttons *, .vote-buttons *:focus {
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
  
    :global(.vote-buttons .material-symbols-outlined.vote-icon) {
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