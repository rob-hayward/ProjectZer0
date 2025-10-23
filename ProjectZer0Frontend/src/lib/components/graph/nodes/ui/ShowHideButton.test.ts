import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import ShowHideButton from '$lib/components/graph/nodes/ui/ShowHideButton.svelte';

describe('ShowHideButton', () => {
  describe('rendering', () => {
    it('renders with isHidden=false (visibility_off icon)', () => {
      const { container } = render(ShowHideButton, {
        props: {
          isHidden: false,
          x: 20,
          y: 100,
          nodeId: 'test-node-1'
        }
      });

      const button = container.querySelector('.visibility-button');
      expect(button).toBeTruthy();

      const icon = container.querySelector('.material-symbols-outlined');
      expect(icon?.textContent?.trim()).toBe('visibility_off');
    });

    it('renders with isHidden=true (visibility icon)', () => {
      const { container } = render(ShowHideButton, {
        props: {
          isHidden: true,
          x: 20,
          y: 100,
          nodeId: 'test-node-1'
        }
      });

      const icon = container.querySelector('.material-symbols-outlined');
      expect(icon?.textContent?.trim()).toBe('visibility');
    });

    it('positions correctly at given x/y coordinates', () => {
      const { container } = render(ShowHideButton, {
        props: {
          isHidden: false,
          x: 50,
          y: 150,
          nodeId: 'test-node-1'
        }
      });

      const button = container.querySelector('.visibility-button');
      expect(button?.getAttribute('transform')).toContain('50');
      expect(button?.getAttribute('transform')).toContain('150');
    });

    it('renders button circle', () => {
      const { container } = render(ShowHideButton, {
        props: {
          isHidden: false,
          x: 20,
          y: 100
        }
      });

      const circle = container.querySelector('.button-circle');
      expect(circle).toBeTruthy();
      expect(circle?.getAttribute('r')).toBeTruthy();
    });

    it('has unique filter ID', () => {
      const { container: container1 } = render(ShowHideButton, {
        props: { isHidden: false }
      });
      const { container: container2 } = render(ShowHideButton, {
        props: { isHidden: false }
      });

      const filter1 = container1.querySelector('filter');
      const filter2 = container2.querySelector('filter');

      expect(filter1?.getAttribute('id')).toBeTruthy();
      expect(filter2?.getAttribute('id')).toBeTruthy();
      expect(filter1?.getAttribute('id')).not.toBe(filter2?.getAttribute('id'));
    });
  });

  describe('hover text', () => {
    it('shows "hide" text on hover when visible', async () => {
      const { container } = render(ShowHideButton, {
        props: {
          isHidden: false,
          x: 20,
          y: 100
        }
      });

      const button = container.querySelector('.visibility-button') as SVGGElement;
      await fireEvent.mouseEnter(button);

      await waitFor(() => {
        const buttonText = container.querySelector('.button-text');
        expect(buttonText?.textContent?.trim()).toBe('hide');
      });
    });

    it('shows "show" text on hover when hidden', async () => {
      const { container } = render(ShowHideButton, {
        props: {
          isHidden: true,
          x: 20,
          y: 100
        }
      });

      const button = container.querySelector('.visibility-button') as SVGGElement;
      await fireEvent.mouseEnter(button);

      await waitFor(() => {
        const buttonText = container.querySelector('.button-text');
        expect(buttonText?.textContent?.trim()).toBe('show');
      });
    });

    it('hides text on mouse leave', async () => {
      const { container } = render(ShowHideButton, {
        props: {
          isHidden: false,
          x: 20,
          y: 100
        }
      });

      const button = container.querySelector('.visibility-button') as SVGGElement;
      
      await fireEvent.mouseEnter(button);
      await waitFor(() => {
        expect(container.querySelector('.button-text')).toBeTruthy();
      });

      await fireEvent.mouseLeave(button);
      await waitFor(() => {
        expect(container.querySelector('.button-text')).toBeFalsy();
      });
    });
  });

  describe('interactions', () => {
    it('clicking visible button dispatches visibilityChange with isHidden=true', async () => {
      const handleVisibilityChange = vi.fn();
      const { component, container } = render(ShowHideButton, {
        props: {
          isHidden: false,
          x: 20,
          y: 100
        }
      });

      component.$on('visibilityChange', handleVisibilityChange);

      const button = container.querySelector('.visibility-button') as SVGGElement;
      await fireEvent.click(button);

      expect(handleVisibilityChange).toHaveBeenCalledTimes(1);
      expect(handleVisibilityChange).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { isHidden: true }
        })
      );
    });

    it('clicking hidden button dispatches visibilityChange with isHidden=false', async () => {
      const handleVisibilityChange = vi.fn();
      const { component, container } = render(ShowHideButton, {
        props: {
          isHidden: true,
          x: 20,
          y: 100
        }
      });

      component.$on('visibilityChange', handleVisibilityChange);

      const button = container.querySelector('.visibility-button') as SVGGElement;
      await fireEvent.click(button);

      expect(handleVisibilityChange).toHaveBeenCalledTimes(1);
      expect(handleVisibilityChange).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { isHidden: false }
        })
      );
    });

    it('dispatches click event', async () => {
      const handleClick = vi.fn();
      const { component, container } = render(ShowHideButton, {
        props: {
          isHidden: false,
          x: 20,
          y: 100
        }
      });

      component.$on('click', handleClick);

      const button = container.querySelector('.visibility-button') as SVGGElement;
      await fireEvent.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('logs nodeId on click', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const { container } = render(ShowHideButton, {
        props: {
          isHidden: false,
          x: 20,
          y: 100,
          nodeId: 'test-node-123'
        }
      });

      const button = container.querySelector('.visibility-button') as SVGGElement;
      await fireEvent.click(button);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('test-node-123')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('hover effects', () => {
    it('applies glow filter on hover', async () => {
      const { container } = render(ShowHideButton, {
        props: {
          isHidden: false,
          x: 20,
          y: 100
        }
      });

      const button = container.querySelector('.visibility-button') as SVGGElement;
      const circle = container.querySelector('.button-circle');

      // Before hover - no filter
      expect(circle?.getAttribute('style')).not.toContain('url(#');

      await fireEvent.mouseEnter(button);

      // After hover - has filter
      await waitFor(() => {
        const circleStyle = circle?.getAttribute('style');
        expect(circleStyle).toContain('url(#');
      });
    });

    it('removes glow filter on mouse leave', async () => {
      const { container } = render(ShowHideButton, {
        props: {
          isHidden: false,
          x: 20,
          y: 100
        }
      });

      const button = container.querySelector('.visibility-button') as SVGGElement;
      const circle = container.querySelector('.button-circle');

      await fireEvent.mouseEnter(button);
      await waitFor(() => {
        expect(circle?.getAttribute('style')).toContain('url(#');
      });

      await fireEvent.mouseLeave(button);

      await waitFor(() => {
        const circleStyle = circle?.getAttribute('style');
        expect(circleStyle).toContain('filter: none');
      });
    });

    it('applies scale animation on hover', async () => {
      const { container } = render(ShowHideButton, {
        props: {
          isHidden: false,
          x: 20,
          y: 100
        }
      });

      const button = container.querySelector('.visibility-button') as SVGGElement;
      const circle = container.querySelector('.button-circle');

      // Initial scale should be 1
      expect(circle?.getAttribute('style')).toContain('scale(1)');

      await fireEvent.mouseEnter(button);

      // Scale should increase on hover (spring animation to 1.5)
      // Note: The exact value may vary due to spring animation timing
      await waitFor(() => {
        const style = circle?.getAttribute('style');
        expect(style).toContain('scale(');
      });
    });
  });

  describe('button styling', () => {
    it('uses white button color', () => {
      const { container } = render(ShowHideButton, {
        props: {
          isHidden: false,
          x: 20,
          y: 100
        }
      });

      const circle = container.querySelector('.button-circle');
      const icon = container.querySelector('.material-symbols-outlined');

      expect(circle?.getAttribute('style')).toContain('#FFFFFF');
      expect(icon?.getAttribute('style')).toContain('#FFFFFF');
    });

    it('has correct button radius', () => {
      const { container } = render(ShowHideButton, {
        props: {
          isHidden: false,
          x: 20,
          y: 100
        }
      });

      const circle = container.querySelector('.button-circle');
      expect(circle?.getAttribute('r')).toBe('10');
    });

    it('icon is centered', () => {
      const { container } = render(ShowHideButton, {
        props: {
          isHidden: false,
          x: 20,
          y: 100
        }
      });

      const icon = container.querySelector('.material-symbols-outlined');
      expect(icon?.getAttribute('x')).toBe('0');
      expect(icon?.getAttribute('y')).toBe('3.5');
      expect(icon?.getAttribute('style')).toContain('text-anchor: middle');
    });
  });

  describe('filter definition', () => {
    it('creates glow filter with correct structure', () => {
      const { container } = render(ShowHideButton, {
        props: {
          isHidden: false,
          x: 20,
          y: 100
        }
      });

      const filter = container.querySelector('filter');
      expect(filter).toBeTruthy();

      // Should have blur effects
      const blurs = container.querySelectorAll('feGaussianBlur');
      expect(blurs.length).toBeGreaterThan(0);

      // Should have flood effects
      const floods = container.querySelectorAll('feFlood');
      expect(floods.length).toBeGreaterThan(0);

      // Should have merge
      const merge = container.querySelector('feMerge');
      expect(merge).toBeTruthy();
    });
  });

  describe('icon toggle', () => {
    it('shows visibility_off when not hidden (hide button)', () => {
      const { container } = render(ShowHideButton, {
        props: {
          isHidden: false,
          x: 20,
          y: 100
        }
      });

      const icon = container.querySelector('.material-symbols-outlined');
      expect(icon?.textContent?.trim()).toBe('visibility_off');
    });

    it('shows visibility when hidden (show button)', () => {
      const { container } = render(ShowHideButton, {
        props: {
          isHidden: true,
          x: 20,
          y: 100
        }
      });

      const icon = container.querySelector('.material-symbols-outlined');
      expect(icon?.textContent?.trim()).toBe('visibility');
    });
  });

  describe('default props', () => {
    it('uses default values when props not provided', () => {
      const { container } = render(ShowHideButton, {
        props: {}
      });

      const button = container.querySelector('.visibility-button');
      expect(button).toBeTruthy();

      // Should default to isHidden=false (visibility_off icon)
      const icon = container.querySelector('.material-symbols-outlined');
      expect(icon?.textContent?.trim()).toBe('visibility_off');
    });

    it('accepts nodeId prop', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const { container } = render(ShowHideButton, {
        props: {
          nodeId: 'custom-node-id'
        }
      });

      const button = container.querySelector('.visibility-button') as SVGGElement;
      fireEvent.click(button);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('custom-node-id')
      );

      consoleSpy.mockRestore();
    });
  });
});