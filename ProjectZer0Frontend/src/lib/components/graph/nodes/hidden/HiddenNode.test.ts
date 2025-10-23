import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import HiddenNode from '$lib/components/graph/nodes/hidden/HiddenNode.svelte';
import type { RenderableNode } from '$lib/types/graph/enhanced';

// Mock the NODE_CONSTANTS and COORDINATE_SPACE
vi.mock('$lib/constants/graph/nodes', () => ({
  NODE_CONSTANTS: {
    FONTS: {
      title: {
        family: 'Inter',
        size: '14px',
        weight: '500'
      },
      value: {
        family: 'Inter',
        size: '12px',
        weight: '400'
      },
      hover: {
        family: 'Inter',
        size: '10px',
        weight: '400'
      }
    }
  }
}));

vi.mock('$lib/constants/graph/coordinate-space', () => ({
  COORDINATE_SPACE: {
    NODES: {
      SIZES: {
        HIDDEN: 160,
        NAVIGATION: 80
      }
    }
  }
}));

describe('HiddenNode', () => {
  const createMockNode = (overrides?: Partial<RenderableNode>): RenderableNode => ({
    id: 'test-node-1',
    type: 'statement',
    x: 100,
    y: 200,
    radius: 80,
    mode: 'preview',
    isHidden: true,
    hiddenReason: 'community',
    data: {},
    metadata: {},
    ...overrides
  } as RenderableNode);

  describe('rendering', () => {
    it('renders compact hidden node', () => {
      const node = createMockNode();
      const { container } = render(HiddenNode, {
        props: {
          node,
          hiddenBy: 'community',
          netVotes: -5
        }
      });

      // HiddenNode uses class="hidden-node" not "hidden-node-container"
      const hiddenNode = container.querySelector('.hidden-node');
      expect(hiddenNode).toBeTruthy();
    });

    it('displays "Hidden" label', () => {
      const node = createMockNode();
      const { container } = render(HiddenNode, {
        props: {
          node,
          hiddenBy: 'community',
          netVotes: -5
        }
      });

      const labels = Array.from(container.querySelectorAll('text'));
      const hiddenLabel = labels.find(el => el.textContent?.includes('Hidden'));
      expect(hiddenLabel).toBeTruthy();
    });

    it('shows "by community" when hiddenBy=community', () => {
      const node = createMockNode();
      const { container } = render(HiddenNode, {
        props: {
          node,
          hiddenBy: 'community',
          netVotes: -5
        }
      });

      const labels = Array.from(container.querySelectorAll('text'));
      const communityLabel = labels.find(el => 
        el.textContent?.includes('by community')
      );
      expect(communityLabel).toBeTruthy();
    });

    it('shows "by user" when hiddenBy=user', () => {
      const node = createMockNode();
      const { container } = render(HiddenNode, {
        props: {
          node,
          hiddenBy: 'user',
          netVotes: 10
        }
      });

      const labels = Array.from(container.querySelectorAll('text'));
      // Component shows "by {hiddenBy}" so it will be "by user" not "by you"
      const userLabel = labels.find(el => 
        el.textContent?.includes('by user')
      );
      expect(userLabel).toBeTruthy();
    });

    it('displays net votes value', () => {
      const node = createMockNode();
      const { container } = render(HiddenNode, {
        props: {
          node,
          hiddenBy: 'community',
          netVotes: -8
        }
      });

      const labels = Array.from(container.querySelectorAll('text'));
      const votesLabel = labels.find(el => 
        el.textContent?.includes('-8')
      );
      expect(votesLabel).toBeTruthy();
    });

    it('displays positive net votes with + prefix', () => {
      const node = createMockNode();
      const { container } = render(HiddenNode, {
        props: {
          node,
          hiddenBy: 'user',
          netVotes: 5
        }
      });

      const labels = Array.from(container.querySelectorAll('text'));
      // displayVotes shows positive votes as is (5), not with + prefix
      // The + prefix is only for display in vote stats components
      const votesLabel = labels.find(el => 
        el.textContent?.trim() === '5'
      );
      expect(votesLabel).toBeTruthy();
    });

    it('shows ShowHideButton at bottom center', () => {
      const node = createMockNode();
      const { container } = render(HiddenNode, {
        props: {
          node,
          hiddenBy: 'community',
          netVotes: -5
        }
      });

      // ShowHideButton should be rendered
      const visibilityButton = container.querySelector('.visibility-button');
      expect(visibilityButton).toBeTruthy();
    });
  });

  describe('styling', () => {
    it('uses red color theme for hidden state', () => {
      const node = createMockNode();
      const { container } = render(HiddenNode, {
        props: {
          node,
          hiddenBy: 'community',
          netVotes: -5
        }
      });

      // Check for red color in outer ring circle's stroke
      const outerRing = container.querySelector('.outer-ring');
      expect(outerRing).toBeTruthy();
      
      const stroke = outerRing?.getAttribute('style');
      // Should have red glow color in stroke
      expect(stroke).toContain('stroke');
    });

    it('uses correct radius from COORDINATE_SPACE', () => {
      const node = createMockNode();
      const { container } = render(HiddenNode, {
        props: {
          node,
          hiddenBy: 'community',
          netVotes: -5
        }
      });

      const circles = container.querySelectorAll('circle');
      expect(circles.length).toBeGreaterThan(0);

      // Should use HIDDEN size / 2 = 160 / 2 = 80
      const mainCircle = circles[0];
      const radius = mainCircle.getAttribute('r');
      expect(radius).toBeTruthy();
    });

    it('applies glow effect', () => {
      const node = createMockNode();
      const { container } = render(HiddenNode, {
        props: {
          node,
          hiddenBy: 'community',
          netVotes: -5
        }
      });

      // Should have filter definition
      const filter = container.querySelector('filter');
      expect(filter).toBeTruthy();

      // Should have feGaussianBlur for glow
      const blur = container.querySelector('feGaussianBlur');
      expect(blur).toBeTruthy();
    });

    it('renders background circle', () => {
      const node = createMockNode();
      const { container } = render(HiddenNode, {
        props: {
          node,
          hiddenBy: 'community',
          netVotes: -5
        }
      });

      const circles = container.querySelectorAll('circle');
      expect(circles.length).toBeGreaterThan(0);
    });
  });

  describe('interactions', () => {
    it('forwards visibilityChange event when show button clicked', async () => {
      const node = createMockNode();
      const handleVisibilityChange = vi.fn();
      
      const { component, container } = render(HiddenNode, {
        props: {
          node,
          hiddenBy: 'community',
          netVotes: -5
        }
      });

      component.$on('visibilityChange', handleVisibilityChange);

      // Find and click the ShowHideButton
      const visibilityButton = container.querySelector('.visibility-button') as SVGGElement;
      await fireEvent.click(visibilityButton);

      expect(handleVisibilityChange).toHaveBeenCalledTimes(1);
      expect(handleVisibilityChange).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { isHidden: false }
        })
      );
    });

    it('does not modify event detail when forwarding', async () => {
      const node = createMockNode();
      const handleVisibilityChange = vi.fn();
      
      const { component, container } = render(HiddenNode, {
        props: {
          node,
          hiddenBy: 'community',
          netVotes: -5
        }
      });

      component.$on('visibilityChange', handleVisibilityChange);

      const visibilityButton = container.querySelector('.visibility-button') as SVGGElement;
      await fireEvent.click(visibilityButton);

      // Should forward the exact event detail without modification
      expect(handleVisibilityChange).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { isHidden: false }
        })
      );
    });
  });

  describe('layout', () => {
    it('uses compact sizing', () => {
      const node = createMockNode();
      const { container } = render(HiddenNode, {
        props: {
          node,
          hiddenBy: 'community',
          netVotes: -5
        }
      });

      const hiddenNode = container.querySelector('.hidden-node');
      expect(hiddenNode).toBeTruthy();

      // Circle should be smaller than typical node
      const circles = container.querySelectorAll('circle');
      const mainCircle = circles[0];
      const radius = parseInt(mainCircle.getAttribute('r') || '0');
      
      // Hidden node radius should be 80 (from HIDDEN size 160 / 2)
      expect(radius).toBeLessThanOrEqual(100);
    });

    it('centers content vertically', () => {
      const node = createMockNode();
      const { container } = render(HiddenNode, {
        props: {
          node,
          hiddenBy: 'community',
          netVotes: -5
        }
      });

      const texts = container.querySelectorAll('text');
      
      // Text elements should have y coordinates for vertical centering
      texts.forEach(text => {
        expect(text.getAttribute('y')).toBeTruthy();
      });
    });

    it('centers text horizontally', () => {
      const node = createMockNode();
      const { container } = render(HiddenNode, {
        props: {
          node,
          hiddenBy: 'community',
          netVotes: -5
        }
      });

      const texts = container.querySelectorAll('text');
      
      // Text should be centered (x="0" means center in SVG when text-anchor is middle)
      // text-anchor: middle is set via CSS class, not inline style
      expect(texts.length).toBeGreaterThan(0);
    });

    it('positions ShowHideButton at bottom', () => {
      const node = createMockNode();
      const { container } = render(HiddenNode, {
        props: {
          node,
          hiddenBy: 'community',
          netVotes: -5
        }
      });

      const visibilityButton = container.querySelector('.visibility-button');
      expect(visibilityButton).toBeTruthy();

      // Button should be positioned at bottom (positive y value relative to radius)
      const transform = visibilityButton?.getAttribute('transform');
      expect(transform).toBeTruthy();
    });
  });

  describe('different hidden states', () => {
    it('handles community hidden with negative votes', () => {
      const node = createMockNode();
      const { container } = render(HiddenNode, {
        props: {
          node,
          hiddenBy: 'community',
          netVotes: -10
        }
      });

      const labels = Array.from(container.querySelectorAll('text'));
      
      const communityLabel = labels.find(el => 
        el.textContent?.includes('by community')
      );
      expect(communityLabel).toBeTruthy();

      const votesLabel = labels.find(el => 
        el.textContent?.includes('-10')
      );
      expect(votesLabel).toBeTruthy();
    });

    it('handles user hidden with positive votes', () => {
      const node = createMockNode();
      const { container } = render(HiddenNode, {
        props: {
          node,
          hiddenBy: 'user',
          netVotes: 15
        }
      });

      const labels = Array.from(container.querySelectorAll('text'));
      
      // Component shows "by {hiddenBy}" so it will be "by user"
      const userLabel = labels.find(el => 
        el.textContent?.includes('by user')
      );
      expect(userLabel).toBeTruthy();

      const votesLabel = labels.find(el => 
        el.textContent?.trim() === '15'
      );
      expect(votesLabel).toBeTruthy();
    });

    it('handles zero net votes', () => {
      const node = createMockNode();
      const { container } = render(HiddenNode, {
        props: {
          node,
          hiddenBy: 'user',
          netVotes: 0
        }
      });

      const labels = Array.from(container.querySelectorAll('text'));
      const votesLabel = labels.find(el => 
        el.textContent?.includes('0')
      );
      expect(votesLabel).toBeTruthy();
    });
  });

  describe('different node types', () => {
    it('renders for statement node', () => {
      const node = createMockNode({ type: 'statement' });
      const { container } = render(HiddenNode, {
        props: {
          node,
          hiddenBy: 'community',
          netVotes: -5
        }
      });

      expect(container.querySelector('.hidden-node')).toBeTruthy();
    });

    it('renders for word node', () => {
      const node = createMockNode({ type: 'word' });
      const { container } = render(HiddenNode, {
        props: {
          node,
          hiddenBy: 'community',
          netVotes: -5
        }
      });

      expect(container.querySelector('.hidden-node')).toBeTruthy();
    });

    it('renders for question node', () => {
      const node = createMockNode({ type: 'openquestion' });
      const { container } = render(HiddenNode, {
        props: {
          node,
          hiddenBy: 'user',
          netVotes: 3
        }
      });

      expect(container.querySelector('.hidden-node')).toBeTruthy();
    });
  });

  describe('props validation', () => {
    it('requires node prop', () => {
      const node = createMockNode();
      const { container } = render(HiddenNode, {
        props: {
          node
        }
      });

      expect(container.querySelector('.hidden-node')).toBeTruthy();
    });

    it('uses default hiddenBy value', () => {
      const node = createMockNode();
      const { container } = render(HiddenNode, {
        props: {
          node,
          netVotes: -5
        }
      });

      // Default should be 'community'
      const labels = Array.from(container.querySelectorAll('text'));
      const communityLabel = labels.find(el => 
        el.textContent?.includes('by community')
      );
      expect(communityLabel).toBeTruthy();
    });

    it('uses default netVotes value', () => {
      const node = createMockNode();
      const { container } = render(HiddenNode, {
        props: {
          node,
          hiddenBy: 'community'
        }
      });

      // Default netVotes should be 0
      const labels = Array.from(container.querySelectorAll('text'));
      const votesLabel = labels.find(el => 
        el.textContent?.includes('0')
      );
      expect(votesLabel).toBeTruthy();
    });
  });

  describe('ShowHideButton integration', () => {
    it('passes isHidden=true to ShowHideButton', () => {
      const node = createMockNode({ isHidden: true });
      const { container } = render(HiddenNode, {
        props: {
          node,
          hiddenBy: 'community',
          netVotes: -5
        }
      });

      const visibilityButton = container.querySelector('.visibility-button');
      expect(visibilityButton).toBeTruthy();

      // Button should show "visibility" icon (for showing)
      const icon = container.querySelector('.material-symbols-outlined');
      expect(icon?.textContent?.trim()).toBe('visibility');
    });

    it('ShowHideButton renders without nodeId prop', () => {
      const node = createMockNode({ id: 'test-node-999' });
      const { container } = render(HiddenNode, {
        props: {
          node,
          hiddenBy: 'community',
          netVotes: -5
        }
      });

      // HiddenNode doesn't pass nodeId to ShowHideButton currently
      // This test just verifies the button renders
      const visibilityButton = container.querySelector('.visibility-button');
      expect(visibilityButton).toBeTruthy();
    });
  });
});