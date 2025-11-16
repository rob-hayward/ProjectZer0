<!-- src/lib/components/graph/nodes/ui/VoteStats.svelte -->
<!-- Enhanced with configurable labels for both inclusion and content voting -->
<!-- 
  NOTE: This component renders at (0, 0). 
  Parent should wrap in <g transform="translate(0, {y})"> for positioning.
  The containerY prop is deprecated and should always be 0.
-->
<script lang="ts">
  import type { VoteStatus } from '$lib/types/domain/nodes';

  export let userVoteStatus: VoteStatus = 'none';
  export let positiveVotes: number = 0;
  export let negativeVotes: number = 0;
  export let userName: string = 'Anonymous';
  export let showUserStatus: boolean = true;
  export let availableWidth: number = 400;
  export let showBackground: boolean = true;
  
  // NEW: Configurable labels for different voting contexts
  export let positiveLabel: string = 'Total Agree';
  export let negativeLabel: string = 'Total Disagree';
  export let netLabel: string = 'Net Votes';
  
  $: netVotes = positiveVotes - negativeVotes;
  
  function getUserVoteStatusColor(status: VoteStatus): string {
    switch (status) {
      case 'agree':
        return 'rgba(46, 204, 113, 0.9)';
      case 'disagree':
        return 'rgba(231, 76, 60, 0.9)';
      case 'none':
      default:
        return 'rgba(255, 255, 255, 0.9)';
    }
  }
</script>

<g class="vote-stats-container">
  {#if showBackground}
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
  {/if}
  
  <text 
    class="stats-header"
    x={-availableWidth/2 + 25}
    y="80"
    style:font-family="Inter"
    style:font-size="12px"
    style:font-weight="400"
    style:fill="rgba(255, 255, 255, 0.6)"
    style:text-anchor="start"
  >
    Vote Data
  </text>
  
  <g class="stats-content" transform="translate(0, 100)">
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
          style:fill={getUserVoteStatusColor(userVoteStatus)}
          style:text-anchor="end"
        >
          {userVoteStatus}
        </text>
      </g>
    {/if}
    
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
        {positiveLabel}
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
        {negativeLabel}
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
        {netLabel}
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

<style>
  .stats-header {
    text-anchor: middle;
    dominant-baseline: middle;
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
</style>