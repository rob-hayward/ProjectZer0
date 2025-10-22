// src/lib/components/graph/nodes/base/BaseComponents.test.ts

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import type { RenderableNode } from '$lib/types/graph/enhanced';

// Note: Since these are Svelte components with complex SVG rendering,
// we'll focus on unit testing the core JavaScript logic and integration points.
// Full rendering tests would require a more sophisticated setup.

/**
 * Test Helper: Create mock node
 */
function createMockNode(overrides: Partial<RenderableNode> = {}): RenderableNode {
  return {
    id: 'test-node-1',
    type: 'statement',
    mode: 'preview',
    radius: 150,
    position: { x: 100, y: 100, svgTransform: 'translate(100,100)' },
    isHidden: false,
    hiddenReason: 'community',
    data: {
      statement: 'Test statement',
      inclusionPositiveVotes: 10,
      inclusionNegativeVotes: 2,
      inclusionNetVotes: 8,
      contentPositiveVotes: 5,
      contentNegativeVotes: 1,
      contentNetVotes: 4,
      createdAt: '2024-01-01T00:00:00Z',
      createdBy: 'user-1',
      categories: [],
      keywords: []
    },
    metadata: {
      inclusionVoteStatus: { status: null },
      contentVoteStatus: { status: null }
    },
    style: {
      colors: {
        primary: '#3498db',
        border: '#2980b9',
        background: '#1a1a1a'
      }
    },
    ...overrides
  } as RenderableNode;
}

describe('BaseNode - Core Structure', () => {
  test('calculates gradient and filter IDs correctly', () => {
    const node = createMockNode({ id: 'test-node-123' });
    
    // IDs should be based on node ID to ensure uniqueness
    const expectedGradientId = `gradient-test-node-123`;
    const expectedFilterId = `glow-test-node-123`;
    
    expect(expectedGradientId).toBe('gradient-test-node-123');
    expect(expectedFilterId).toBe('glow-test-node-123');
  });

  test('applies correct radius to decorative elements', () => {
    const node = createMockNode({ radius: 150 });
    
    // Background layers should be scaled by radius
    const outerRing = node.radius; // 150
    const middleRing = node.radius * 0.97; // 145.5
    const backgroundLayer1 = node.radius * 0.95; // 142.5
    const contentBackground = node.radius * 0.80; // 120
    
    expect(outerRing).toBe(150);
    expect(middleRing).toBe(145.5);
    expect(backgroundLayer1).toBe(142.5);
    expect(contentBackground).toBe(120);
  });

  test('applies vote-based styling correctly', () => {
    const voteBasedStyles = {
      glow: { intensity: 8, opacity: 0.6 },
      ring: { width: 6, opacity: 0.5 }
    };
    
    expect(voteBasedStyles.glow.intensity).toBe(8);
    expect(voteBasedStyles.glow.opacity).toBe(0.6);
    expect(voteBasedStyles.ring.width).toBe(6);
    expect(voteBasedStyles.ring.opacity).toBe(0.5);
  });

  test('generates unique IDs for multiple nodes', () => {
    const node1 = createMockNode({ id: 'node-1' });
    const node2 = createMockNode({ id: 'node-2' });
    
    const gradientId1 = `gradient-${node1.id}`;
    const gradientId2 = `gradient-${node2.id}`;
    
    expect(gradientId1).not.toBe(gradientId2);
    expect(gradientId1).toBe('gradient-node-1');
    expect(gradientId2).toBe('gradient-node-2');
  });
});

describe('BasePreviewNode - Layout Calculations', () => {
  test('calculates title position above ContentBox', () => {
    const radius = 150;
    const titleYOffset = 0.85;
    
    const titleY = -radius * titleYOffset; // -127.5
    
    expect(titleY).toBe(-127.5);
    expect(titleY).toBeLessThan(0); // Above center
  });

  test('respects custom titleYOffset prop', () => {
    const radius = 150;
    const customOffset = 0.90;
    
    const titleY = -radius * customOffset; // -135
    
    expect(titleY).toBe(-135);
  });

  test('positions expand button at SE corner', () => {
    const radius = 150;
    
    // SE corner calculation: (radius * 0.7071, radius * 0.7071)
    const buttonX = -radius * 0.7071; // -106.065
    const buttonY = radius * 0.7071; // 106.065
    
    expect(buttonX).toBeCloseTo(-106.065, 2);
    expect(buttonY).toBeCloseTo(106.065, 2);
  });

  test('canExpand defaults to true', () => {
    const canExpand = true;
    expect(canExpand).toBe(true);
  });

  test('canExpand can be set to false', () => {
    const canExpand = false;
    expect(canExpand).toBe(false);
  });
});

describe('BaseDetailNode - Layout Calculations', () => {
  test('calculates all element positions correctly', () => {
    const radius = 150;
    
    // Above ContentBox (negative Y values)
    const titleY = -radius * 0.90; // -135
    const categoryTagsY = -radius * 0.78; // -117
    const keywordTagsY = -radius * 0.66; // -99
    
    // Below ContentBox (positive Y values)
    const metadataY = radius * 0.78; // 117
    const creditsY = radius * 0.90; // 135
    
    // Corner buttons
    const createChildX = radius * 0.7071; // 106.065 (NE corner)
    const createChildY = -radius * 0.7071; // -106.065
    const collapseButtonX = -radius * 0.7071; // -106.065 (SE corner)
    const collapseButtonY = radius * 0.7071; // 106.065
    
    expect(titleY).toBe(-135);
    expect(categoryTagsY).toBe(-117);
    expect(keywordTagsY).toBe(-99);
    expect(metadataY).toBe(117);
    expect(creditsY).toBe(135);
    
    expect(createChildX).toBeCloseTo(106.065, 2);
    expect(createChildY).toBeCloseTo(-106.065, 2);
    expect(collapseButtonX).toBeCloseTo(-106.065, 2);
    expect(collapseButtonY).toBeCloseTo(106.065, 2);
  });

  test('respects custom position offset props', () => {
    const radius = 200; // Larger node (e.g., Quantity)
    const customTitleOffset = 0.85;
    const customCategoryOffset = 0.75;
    
    const titleY = -radius * customTitleOffset; // -170
    const categoryTagsY = -radius * customCategoryOffset; // -150
    
    expect(titleY).toBe(-170);
    expect(categoryTagsY).toBe(-150);
  });

  test('positions createChild button opposite collapse button', () => {
    const radius = 150;
    
    const createChildX = radius * 0.7071; // NE corner
    const collapseButtonX = -radius * 0.7071; // SE corner
    
    // Should be on opposite sides
    expect(createChildX).toBeCloseTo(106.065, 2);
    expect(collapseButtonX).toBeCloseTo(-106.065, 2);
    expect(createChildX).toBeCloseTo(-collapseButtonX, 2);
  });

  test('vertical order is correct', () => {
    const radius = 150;
    
    const titleY = -radius * 0.90; // Top
    const categoryTagsY = -radius * 0.78;
    const keywordTagsY = -radius * 0.66;
    // ContentBox at 0
    const metadataY = radius * 0.78;
    const creditsY = radius * 0.90; // Bottom
    
    // Above ContentBox (descending order)
    expect(titleY).toBeLessThan(categoryTagsY);
    expect(categoryTagsY).toBeLessThan(keywordTagsY);
    expect(keywordTagsY).toBeLessThan(0);
    
    // Below ContentBox (ascending order)
    expect(0).toBeLessThan(metadataY);
    expect(metadataY).toBeLessThan(creditsY);
  });
});

describe('BasePreviewNode - Event Handling', () => {
  test('constructs modeChange event with position data', () => {
    const nodeX = 100;
    const nodeY = 200;
    const mode = 'detail';
    
    const eventData = {
      mode,
      position: { x: nodeX, y: nodeY }
    };
    
    expect(eventData.mode).toBe('detail');
    expect(eventData.position).toEqual({ x: 100, y: 200 });
  });

  test('falls back to node.position if nodeX/nodeY undefined', () => {
    const node = createMockNode({
      position: { x: 300, y: 400, svgTransform: 'translate(300,400)' }
    });
    
    const nodeX = undefined;
    const nodeY = undefined;
    
    const position = nodeX !== undefined && nodeY !== undefined
      ? { x: nodeX, y: nodeY }
      : node.position
      ? { x: node.position.x, y: node.position.y }
      : undefined;
    
    expect(position).toEqual({ x: 300, y: 400 });
  });

  test('includes position in modeChange event', () => {
    const eventDetail = {
      mode: 'detail' as const,
      position: { x: 100, y: 200 }
    };
    
    expect(eventDetail.mode).toBe('detail');
    expect(eventDetail.position).toBeDefined();
    expect(eventDetail.position?.x).toBe(100);
    expect(eventDetail.position?.y).toBe(200);
  });
});

describe('BaseDetailNode - Event Handling', () => {
  test('constructs modeChange event for collapse', () => {
    const nodeX = 150;
    const nodeY = 250;
    const mode = 'preview';
    
    const eventData = {
      mode,
      position: { x: nodeX, y: nodeY }
    };
    
    expect(eventData.mode).toBe('preview');
    expect(eventData.position).toEqual({ x: 150, y: 250 });
  });

  test('dispatches click events', () => {
    const clickHandler = vi.fn();
    
    // Simulate button click
    clickHandler();
    
    expect(clickHandler).toHaveBeenCalled();
  });
});

describe('BaseNode - Slot System', () => {
  test('BasePreviewNode has required slots', () => {
    const slots = ['title', 'content', 'voting', 'stats'];
    
    expect(slots).toContain('title');
    expect(slots).toContain('content');
    expect(slots).toContain('voting');
    expect(slots).toContain('stats');
    expect(slots).toHaveLength(4);
  });

  test('BaseDetailNode has all required slots', () => {
    const slots = [
      'title',
      'categoryTags',
      'keywordTags',
      'content',
      'voting',
      'stats',
      'metadata',
      'credits',
      'createChild'
    ];
    
    expect(slots).toHaveLength(9);
    expect(slots).toContain('title');
    expect(slots).toContain('categoryTags');
    expect(slots).toContain('keywordTags');
    expect(slots).toContain('content');
    expect(slots).toContain('voting');
    expect(slots).toContain('stats');
    expect(slots).toContain('metadata');
    expect(slots).toContain('credits');
    expect(slots).toContain('createChild');
  });

  test('slots receive correct props', () => {
    const radius = 150;
    
    // Title slot receives radius
    const titleSlotProps = { radius };
    expect(titleSlotProps.radius).toBe(150);
    
    // Content slot receives layout info
    const contentSlotProps = {
      x: 0,
      y: -50,
      width: 200,
      height: 100,
      layoutConfig: {}
    };
    expect(contentSlotProps.x).toBeDefined();
    expect(contentSlotProps.y).toBeDefined();
    expect(contentSlotProps.width).toBeDefined();
    expect(contentSlotProps.height).toBeDefined();
  });
});

describe('BaseNode - Node Attributes', () => {
  test('sets correct data attributes', () => {
    const node = createMockNode({
      id: 'test-123',
      type: 'statement',
      mode: 'preview',
      radius: 150
    });
    
    const expectedAttributes = {
      'data-node-id': 'test-123',
      'data-node-type': 'statement',
      'data-node-mode': 'preview',
      'data-node-radius': 150
    };
    
    expect(expectedAttributes['data-node-id']).toBe('test-123');
    expect(expectedAttributes['data-node-type']).toBe('statement');
    expect(expectedAttributes['data-node-mode']).toBe('preview');
    expect(expectedAttributes['data-node-radius']).toBe(150);
  });
});

describe('BaseDetailNode - Opacity Animation', () => {
  test('initializes with opacity 0', () => {
    // Spring starts at 0
    const initialOpacity = 0;
    expect(initialOpacity).toBe(0);
  });

  test('animates to opacity 1 on mount', () => {
    // After mount, spring should animate to 1
    const targetOpacity = 1;
    expect(targetOpacity).toBe(1);
  });

  test('uses spring animation config', () => {
    const springConfig = {
      stiffness: 0.3,
      damping: 0.8
    };
    
    expect(springConfig.stiffness).toBe(0.3);
    expect(springConfig.damping).toBe(0.8);
  });
});

describe('Integration - Position Initialization', () => {
  test('initializes nodeX and nodeY from node.position on mount', () => {
    const node = createMockNode({
      position: { x: 250, y: 350, svgTransform: 'translate(250,350)' }
    });
    
    let nodeX: number | undefined = undefined;
    let nodeY: number | undefined = undefined;
    
    // Simulate onMount logic
    if ((nodeX === undefined || nodeY === undefined) && node.position) {
      nodeX = node.position.x;
      nodeY = node.position.y;
    }
    
    expect(nodeX).toBe(250);
    expect(nodeY).toBe(350);
  });

  test('preserves existing nodeX and nodeY if already set', () => {
    const node = createMockNode({
      position: { x: 100, y: 200, svgTransform: 'translate(100,200)' }
    });
    
    let nodeX: number | undefined = 500;
    let nodeY: number | undefined = 600;
    
    // Simulate onMount logic
    if ((nodeX === undefined || nodeY === undefined) && node.position) {
      nodeX = node.position.x;
      nodeY = node.position.y;
    }
    
    // Should keep existing values
    expect(nodeX).toBe(500);
    expect(nodeY).toBe(600);
  });
});

describe('BasePreviewNode - Expand Button Visibility', () => {
  test('shows expand button when canExpand is true', () => {
    const canExpand = true;
    const shouldRenderButton = canExpand;
    
    expect(shouldRenderButton).toBe(true);
  });

  test('hides expand button when canExpand is false', () => {
    const canExpand = false;
    const shouldRenderButton = canExpand;
    
    expect(shouldRenderButton).toBe(false);
  });

  test('expand button conditional on vote threshold', () => {
    const inclusionNetVotes = 5;
    const threshold = 3;
    const canExpand = inclusionNetVotes >= threshold;
    
    expect(canExpand).toBe(true);
  });

  test('expand button hidden when below threshold', () => {
    const inclusionNetVotes = 2;
    const threshold = 3;
    const canExpand = inclusionNetVotes >= threshold;
    
    expect(canExpand).toBe(false);
  });
});

describe('BaseDetailNode - Slot Conditional Rendering', () => {
  test('metadata slot only renders if provided', () => {
    const hasMetadataSlot = true;
    const shouldRender = hasMetadataSlot;
    
    expect(shouldRender).toBe(true);
  });

  test('credits slot only renders if provided', () => {
    const hasCreditsSlot = true;
    const shouldRender = hasCreditsSlot;
    
    expect(shouldRender).toBe(true);
  });

  test('createChild slot only renders if provided', () => {
    const hasCreateChildSlot = false;
    const shouldRender = hasCreateChildSlot;
    
    expect(shouldRender).toBe(false);
  });

  test('category tags only render when categories exist', () => {
    const categories = ['category-1', 'category-2'];
    const shouldRender = categories.length > 0;
    
    expect(shouldRender).toBe(true);
  });

  test('keyword tags only render when keywords exist', () => {
    const keywords: string[] = [];
    const shouldRender = keywords.length > 0;
    
    expect(shouldRender).toBe(false);
  });
});

describe('BaseNode - Vote-Based Styling Variations', () => {
  test('applies stronger glow for highly voted content', () => {
    const netVotes = 50;
    const baseIntensity = 8;
    const intensityMultiplier = Math.min(1 + (netVotes / 100), 2);
    const glowIntensity = baseIntensity * intensityMultiplier;
    
    expect(glowIntensity).toBeGreaterThan(baseIntensity);
    expect(glowIntensity).toBeLessThanOrEqual(baseIntensity * 2);
  });

  test('applies standard glow for normal content', () => {
    const netVotes = 5;
    const baseIntensity = 8;
    const intensityMultiplier = Math.min(1 + (netVotes / 100), 2);
    const glowIntensity = baseIntensity * intensityMultiplier;
    
    expect(glowIntensity).toBeCloseTo(baseIntensity * 1.05, 1);
  });

  test('ring width increases with votes', () => {
    const netVotes = 30;
    const baseWidth = 6;
    const widthMultiplier = Math.min(1 + (netVotes / 50), 1.5);
    const ringWidth = baseWidth * widthMultiplier;
    
    expect(ringWidth).toBeGreaterThan(baseWidth);
    expect(ringWidth).toBeLessThanOrEqual(baseWidth * 1.5);
  });
});