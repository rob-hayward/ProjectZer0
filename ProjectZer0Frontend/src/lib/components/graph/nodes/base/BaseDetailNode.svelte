<!-- src/lib/components/graph/nodes/base/BaseDetailNode.svelte -->
<!-- REORGANIZED: Updated to use new semantic slot structure -->
<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { spring } from 'svelte/motion';
	import type { RenderableNode, NodeMode } from '$lib/types/graph/enhanced';
	import BaseNode from './BaseNode.svelte';
	import ExpandCollapseButton from '../ui/ExpandCollapseButton.svelte';
	import ContentBox from '../ui/ContentBox.svelte';
	import { NODE_CONSTANTS } from '../../../../constants/graph/nodes';

	// Node data and positioning
	export let node: RenderableNode;
	export let style = node.style;
	export let nodeX: number | undefined = undefined;
	export let nodeY: number | undefined = undefined;

	// ContentBox debugging
	export let showContentBoxBorder: boolean = false;

	// Vote-based styling for enhanced visuals
	export let voteBasedStyles = {
		glow: {
			intensity: 8,
			opacity: 0.6
		},
		ring: {
			width: 6,
			opacity: 0.5
		}
	};

	// FIXED: Position override props for proper vertical stacking
	// These are multipliers of radius for vertical positioning
	// Negative values = above center (above ContentBox)
	// Positive values = below center (below ContentBox)
	export let titleYOffset: number = 0; // Distance above ContentBox for title
	export let categoryTagsYOffset: number = 0.80; // RAISED: Was 0.68 - now higher above ContentBox
	export let keywordTagsYOffset: number = 0.70; // POSITIONED: Was 0.50 - positioned below categories
	export let metadataYOffset: number = 0.75; // Distance below ContentBox for metadata (was 0.78)
	export let creditsYOffset: number = 0.85; // Distance below ContentBox for credits (was 0.90)

	const baseOpacity = spring(0, {
		stiffness: 0.3,
		damping: 0.8
	});

	const dispatch = createEventDispatcher<{
		modeChange: {
			mode: NodeMode;
			position?: { x: number; y: number };
		};
		click: void;
		visibilityChange: { isHidden: boolean };
	}>();

	function handleVisibilityChange(event: CustomEvent<{ isHidden: boolean }>) {
		dispatch('visibilityChange', event.detail);
	}

	onMount(() => {
		baseOpacity.set(1);

		if ((nodeX === undefined || nodeY === undefined) && node.position) {
			nodeX = node.position.x;
			nodeY = node.position.y;
		}
	});

	function handleButtonClick() {
		dispatch('click');
	}

	function handleModeChange(event: CustomEvent<{
		mode: NodeMode;
		position?: { x: number; y: number };
		nodeId?: string;
	}>) {
		const eventData = {
			mode: event.detail.mode,
			position:
				event.detail.position ??
				(nodeX !== undefined && nodeY !== undefined
					? { x: nodeX, y: nodeY }
					: node.position
					? { x: node.position.x, y: node.position.y }
					: undefined)
		};

		dispatch('modeChange', eventData);
	}

	// Calculate positions for all elements
	$: radius = node.radius;
	$: titleY = -radius * titleYOffset;
	$: categoryTagsY = -radius * categoryTagsYOffset;
	$: keywordTagsY = -radius * keywordTagsYOffset;
	$: metadataY = radius * metadataYOffset;
	$: creditsY = radius * creditsYOffset;
	$: createChildX = radius * 0.7071; // NE corner (opposite collapse button)
	$: createChildY = -radius * 0.7071;

	// UPDATED: Slot interface with new semantic structure
	interface $Slots {
		title: { radius: number }; // Positioned above ContentBox
		categoryTags: { radius: number }; // Positioned above ContentBox, below title
		keywordTags: { radius: number }; // Positioned above ContentBox, below categoryTags
		contentText: { x: number; y: number; width: number; height: number; layoutConfig: any; positioning: Record<string, number> };
		inclusionVoting: { x: number; y: number; width: number; height: number; layoutConfig: any; positioning: Record<string, number> };
		contentVoting: { x: number; y: number; width: number; height: number; layoutConfig: any; positioning: Record<string, number> };
		metadata: { radius: number }; // Positioned below ContentBox
		credits: { radius: number }; // Positioned below ContentBox, below metadata
		createChild: { radius: number }; // Positioned at NE corner (opposite collapse)
	}
</script>

<g
	class="detail-node"
	style:opacity={$baseOpacity}
	style:transform-origin="center"
	data-node-id={node.id}
	data-node-type={node.type}
	data-node-mode={node.mode}
	data-node-radius={node.radius}
>
	<BaseNode {node} {style} {voteBasedStyles}>
		<svelte:fragment slot="default" let:radius let:filterId let:gradientId>
			<!-- SECTION 1: ELEMENTS ABOVE CONTENTBOX -->
			<!-- These are positioned in the space between the circle edge and ContentBox top -->

			<!-- Title - positioned highest -->
			{#if $$slots.title}
				<g transform="translate(0, {titleY})">
					<slot name="title" {radius} />
				</g>
			{/if}

			<!-- Category Tags - positioned below title -->
			{#if $$slots.categoryTags}
				<g transform="translate(0, {categoryTagsY})">
					<slot name="categoryTags" {radius} />
				</g>
			{/if}

			<!-- Keyword Tags - positioned below category tags -->
			{#if $$slots.keywordTags}
				<g transform="translate(0, {keywordTagsY})">
					<slot name="keywordTags" {radius} />
				</g>
			{/if}

			<!-- SECTION 2: CONTENTBOX AT CENTER -->
			<!-- ContentBox positioned at (0, 0) - the largest square that fits in the circle -->
			<!-- UPDATED: ContentBox with new semantic sections -->
			<ContentBox nodeType={node.type} mode="detail" showBorder={showContentBoxBorder}>
				<svelte:fragment slot="contentText" let:x let:y let:width let:height let:layoutConfig let:positioning>
					{#if $$slots.contentText}
						<slot name="contentText" {x} {y} {width} {height} {layoutConfig} {positioning} />
					{/if}
				</svelte:fragment>

				<svelte:fragment slot="inclusionVoting" let:x let:y let:width let:height let:layoutConfig let:positioning>
					{#if $$slots.inclusionVoting}
						<slot name="inclusionVoting" {x} {y} {width} {height} {layoutConfig} {positioning} />
					{/if}
				</svelte:fragment>

				<svelte:fragment slot="contentVoting" let:x let:y let:width let:height let:layoutConfig let:positioning>
					{#if $$slots.contentVoting}
						<slot name="contentVoting" {x} {y} {width} {height} {layoutConfig} {positioning} />
					{/if}
				</svelte:fragment>
			</ContentBox>

			<!-- SECTION 3: ELEMENTS BELOW CONTENTBOX -->
			<!-- These are positioned in the space between ContentBox bottom and circle edge -->

			<!-- Metadata - positioned below ContentBox -->
			{#if $$slots.metadata}
				<g transform="translate(0, {metadataY})">
					<slot name="metadata" {radius} />
				</g>
			{/if}

			<!-- Creator Credits - positioned below metadata -->
			{#if $$slots.credits}
				<g transform="translate(0, {creditsY})">
					<slot name="credits" {radius} />
				</g>
			{/if}

			<!-- SECTION 4: CORNER BUTTONS -->

			<!-- Create Child Button - NE corner (opposite collapse button) -->
			<!-- Only shown if node type provides this slot -->
			{#if $$slots.createChild}
				<g transform="translate({createChildX}, {createChildY})">
					<slot name="createChild" {radius} />
				</g>
			{/if}

			<!-- Collapse Button - SE corner (always present) -->
			<ExpandCollapseButton
				mode="collapse"
				y={radius * 0.7071}
				x={-radius * 0.7071}
				nodeX={nodeX}
				nodeY={nodeY}
				nodeId={node.id}
				on:click={handleButtonClick}
				on:modeChange={handleModeChange}
			/>
		</svelte:fragment>
	</BaseNode>
</g>

<style>
	.detail-node {
		will-change: transform, opacity;
		transition: all 0.3s ease-out;
	}

	:global(.detail-node text) {
		fill: white;
		font-family: 'Orbitron', sans-serif;
		text-anchor: middle;
	}
</style>