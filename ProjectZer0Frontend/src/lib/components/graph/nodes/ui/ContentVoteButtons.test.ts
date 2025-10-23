import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import ContentVoteButtons from '$lib/components/graph/nodes/ui/ContentVoteButtons.svelte';
import type { VoteStatus } from '$lib/types/domain/nodes';

describe('ContentVoteButtons', () => {
  describe('rendering', () => {
    it('renders with no vote', () => {
      const { container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 5,
          negativeVotes: 3,
          isVoting: false,
          lastVoteType: null,
          voteSuccess: false,
          availableWidth: 400,
          containerY: 0,
          mode: 'detail' as const
        }
      });

      const voteButtons = container.querySelector('.vote-buttons');
      expect(voteButtons).toBeTruthy();

      // Check both buttons exist
      const agreeButton = container.querySelector('.upvote-button');
      const disagreeButton = container.querySelector('.downvote-button');
      expect(agreeButton).toBeTruthy();
      expect(disagreeButton).toBeTruthy();

      // Check icons are rendered (thumb_up and thumb_down)
      const icons = container.querySelectorAll('.material-symbols-outlined.vote-icon');
      expect(icons.length).toBe(2);
      expect(icons[0].textContent?.trim()).toBe('thumb_up');
      expect(icons[1].textContent?.trim()).toBe('thumb_down');
    });

    it('renders with agree vote', () => {
      const { container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'agree' as VoteStatus,
          positiveVotes: 5,
          negativeVotes: 3,
          isVoting: false,
          lastVoteType: null,
          voteSuccess: false
        }
      });

      const agreeButton = container.querySelector('.upvote-button');
      expect(agreeButton?.classList.contains('voted')).toBe(true);
      expect(agreeButton?.getAttribute('aria-pressed')).toBe('true');
    });

    it('renders with disagree vote', () => {
      const { container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'disagree' as VoteStatus,
          positiveVotes: 5,
          negativeVotes: 3,
          isVoting: false,
          lastVoteType: null,
          voteSuccess: false
        }
      });

      const disagreeButton = container.querySelector('.downvote-button');
      expect(disagreeButton?.classList.contains('voted')).toBe(true);
      expect(disagreeButton?.getAttribute('aria-pressed')).toBe('true');
    });

    it('shows correct vote count', () => {
      const { container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 10,
          negativeVotes: 3,
          isVoting: false
        }
      });

      const voteCount = container.querySelector('.vote-count');
      expect(voteCount?.textContent?.trim()).toBe('+7');
    });

    it('displays +/- prefix on net votes correctly', () => {
      // Positive net votes
      const { container: positiveContainer } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 10,
          negativeVotes: 3
        }
      });
      expect(positiveContainer.querySelector('.vote-count')?.textContent?.trim()).toBe('+7');

      // Negative net votes
      const { container: negativeContainer } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 3,
          negativeVotes: 10
        }
      });
      expect(negativeContainer.querySelector('.vote-count')?.textContent?.trim()).toBe('-7');

      // Zero net votes
      const { container: zeroContainer } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 5,
          negativeVotes: 5
        }
      });
      expect(zeroContainer.querySelector('.vote-count')?.textContent?.trim()).toBe('0');
    });

    it('adjusts layout for preview mode', () => {
      const { container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 5,
          negativeVotes: 3,
          mode: 'preview' as const,
          availableWidth: 200
        }
      });

      // Icon size should be smaller in preview mode (checked via inline styles)
      const icons = container.querySelectorAll('.material-symbols-outlined.vote-icon');
      expect(icons[0].getAttribute('style')).toContain('font-size: 18px');
    });

    it('adjusts layout for detail mode', () => {
      const { container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 5,
          negativeVotes: 3,
          mode: 'detail' as const
        }
      });

      // Icon size should be larger in detail mode
      const icons = container.querySelectorAll('.material-symbols-outlined.vote-icon');
      expect(icons[0].getAttribute('style')).toContain('font-size: 22px');
    });
  });

  describe('interactions', () => {
    it('clicking agree dispatches vote event', async () => {
      const handleVote = vi.fn();
      const { component, container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 5,
          negativeVotes: 3,
          isVoting: false
        }
      });

      component.$on('vote', handleVote);

      const agreeButton = container.querySelector('.upvote-button') as SVGGElement;
      await fireEvent.click(agreeButton);

      expect(handleVote).toHaveBeenCalledTimes(1);
      expect(handleVote).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { voteType: 'agree' }
        })
      );
    });

    it('clicking disagree dispatches vote event', async () => {
      const handleVote = vi.fn();
      const { component, container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 5,
          negativeVotes: 3,
          isVoting: false
        }
      });

      component.$on('vote', handleVote);

      const disagreeButton = container.querySelector('.downvote-button') as SVGGElement;
      await fireEvent.click(disagreeButton);

      expect(handleVote).toHaveBeenCalledTimes(1);
      expect(handleVote).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { voteType: 'disagree' }
        })
      );
    });

    it('clicking voted button dispatches "none" to remove vote', async () => {
      const handleVote = vi.fn();
      const { component, container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'agree' as VoteStatus,
          positiveVotes: 6,
          negativeVotes: 3,
          isVoting: false
        }
      });

      component.$on('vote', handleVote);

      const agreeButton = container.querySelector('.upvote-button') as SVGGElement;
      await fireEvent.click(agreeButton);

      expect(handleVote).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { voteType: 'none' }
        })
      );
    });

    it('hover shows tooltip text "Agree"', async () => {
      const { container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 5,
          negativeVotes: 3,
          isVoting: false
        }
      });

      const agreeButton = container.querySelector('.upvote-button') as SVGGElement;
      await fireEvent.mouseEnter(agreeButton);

      await waitFor(() => {
        const hoverText = container.querySelector('.hover-text');
        expect(hoverText?.textContent?.trim()).toBe('Agree');
      });
    });

    it('hover shows tooltip text "Disagree"', async () => {
      const { container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 5,
          negativeVotes: 3,
          isVoting: false
        }
      });

      const disagreeButton = container.querySelector('.downvote-button') as SVGGElement;
      await fireEvent.mouseEnter(disagreeButton);

      await waitFor(() => {
        const hoverText = Array.from(container.querySelectorAll('.hover-text')).pop();
        expect(hoverText?.textContent?.trim()).toBe('Disagree');
      });
    });

    it('hover shows "Remove vote" when already voted', async () => {
      const { container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'agree' as VoteStatus,
          positiveVotes: 6,
          negativeVotes: 3,
          isVoting: false
        }
      });

      const agreeButton = container.querySelector('.upvote-button') as SVGGElement;
      await fireEvent.mouseEnter(agreeButton);

      await waitFor(() => {
        const hoverText = container.querySelector('.hover-text');
        expect(hoverText?.textContent?.trim()).toBe('Remove vote');
      });
    });

    it('disabled state prevents clicks', async () => {
      const handleVote = vi.fn();
      const { component, container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 5,
          negativeVotes: 3,
          isVoting: true // Component is in voting state
        }
      });

      component.$on('vote', handleVote);

      const agreeButton = container.querySelector('.upvote-button') as SVGGElement;
      await fireEvent.click(agreeButton);

      // Should not dispatch vote event when disabled
      expect(handleVote).not.toHaveBeenCalled();
    });

    it('keyboard Enter key triggers vote', async () => {
      const handleVote = vi.fn();
      const { component, container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 5,
          negativeVotes: 3,
          isVoting: false
        }
      });

      component.$on('vote', handleVote);

      const agreeButton = container.querySelector('.upvote-button') as SVGGElement;
      await fireEvent.keyDown(agreeButton, { key: 'Enter' });

      expect(handleVote).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { voteType: 'agree' }
        })
      );
    });

    it('keyboard Space key triggers vote', async () => {
      const handleVote = vi.fn();
      const { component, container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 5,
          negativeVotes: 3,
          isVoting: false
        }
      });

      component.$on('vote', handleVote);

      const disagreeButton = container.querySelector('.downvote-button') as SVGGElement;
      await fireEvent.keyDown(disagreeButton, { key: 'Space' });

      expect(handleVote).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { voteType: 'disagree' }
        })
      );
    });
  });

  describe('states', () => {
    it('loading state shows spinner for agree', () => {
      const { container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 5,
          negativeVotes: 3,
          isVoting: true,
          lastVoteType: 'agree' as VoteStatus
        }
      });

      const agreeButton = container.querySelector('.upvote-button');
      const spinner = agreeButton?.querySelector('.loading-spinner');
      expect(spinner).toBeTruthy();
      expect(spinner?.textContent?.trim()).toBe('⟳');
    });

    it('loading state shows spinner for disagree', () => {
      const { container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 5,
          negativeVotes: 3,
          isVoting: true,
          lastVoteType: 'disagree' as VoteStatus
        }
      });

      const disagreeButton = container.querySelector('.downvote-button');
      const spinner = disagreeButton?.querySelector('.loading-spinner');
      expect(spinner).toBeTruthy();
      expect(spinner?.textContent?.trim()).toBe('⟳');
    });

    it('loading state shows spinner when removing vote', () => {
      const { container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'agree' as VoteStatus,
          positiveVotes: 6,
          negativeVotes: 3,
          isVoting: true,
          lastVoteType: 'none' as VoteStatus
        }
      });

      const agreeButton = container.querySelector('.upvote-button');
      const spinner = agreeButton?.querySelector('.loading-spinner');
      expect(spinner).toBeTruthy();
    });

    it('success state shows animation on agree button', () => {
      const { container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'agree' as VoteStatus,
          positiveVotes: 6,
          negativeVotes: 3,
          isVoting: false,
          lastVoteType: 'agree' as VoteStatus,
          voteSuccess: true
        }
      });

      const agreeButton = container.querySelector('.upvote-button');
      expect(agreeButton?.classList.contains('pulse')).toBe(true);

      const icon = agreeButton?.querySelector('.vote-icon');
      expect(icon?.classList.contains('bounce')).toBe(true);
    });

    it('success state shows animation on disagree button', () => {
      const { container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'disagree' as VoteStatus,
          positiveVotes: 5,
          negativeVotes: 4,
          isVoting: false,
          lastVoteType: 'disagree' as VoteStatus,
          voteSuccess: true
        }
      });

      const disagreeButton = container.querySelector('.downvote-button');
      expect(disagreeButton?.classList.contains('pulse')).toBe(true);

      const icon = disagreeButton?.querySelector('.vote-icon');
      expect(icon?.classList.contains('bounce')).toBe(true);
    });

    it('voted state highlights agree button', () => {
      const { container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'agree' as VoteStatus,
          positiveVotes: 6,
          negativeVotes: 3,
          isVoting: false
        }
      });

      const agreeButton = container.querySelector('.upvote-button');
      expect(agreeButton?.classList.contains('voted')).toBe(true);

      const disagreeButton = container.querySelector('.downvote-button');
      expect(disagreeButton?.classList.contains('voted')).toBe(false);
    });

    it('voted state highlights disagree button', () => {
      const { container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'disagree' as VoteStatus,
          positiveVotes: 5,
          negativeVotes: 4,
          isVoting: false
        }
      });

      const disagreeButton = container.querySelector('.downvote-button');
      expect(disagreeButton?.classList.contains('voted')).toBe(true);

      const agreeButton = container.querySelector('.upvote-button');
      expect(agreeButton?.classList.contains('voted')).toBe(false);
    });

    it('vote count shows pulse animation on success', () => {
      const { container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'agree' as VoteStatus,
          positiveVotes: 6,
          negativeVotes: 3,
          voteSuccess: true
        }
      });

      const voteCount = container.querySelector('.vote-count');
      expect(voteCount?.classList.contains('pulse')).toBe(true);
    });
  });

  describe('colors', () => {
    it('agree button uses green when voted', () => {
      const { container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'agree' as VoteStatus,
          positiveVotes: 6,
          negativeVotes: 3
        }
      });

      const agreeButton = container.querySelector('.upvote-button');
      const icon = agreeButton?.querySelector('.vote-icon') as HTMLElement;
      
      // Color should be green (upvoteColor from COLORS.PRIMARY.GREEN)
      expect(icon.style.color).toBeTruthy();
      expect(icon.style.color).not.toBe('white');
    });

    it('disagree button uses red when voted', () => {
      const { container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'disagree' as VoteStatus,
          positiveVotes: 5,
          negativeVotes: 4
        }
      });

      const disagreeButton = container.querySelector('.downvote-button');
      const icon = disagreeButton?.querySelector('.vote-icon') as HTMLElement;
      
      // Color should be red (downvoteColor from COLORS.PRIMARY.RED)
      expect(icon.style.color).toBeTruthy();
      expect(icon.style.color).not.toBe('white');
    });

    it('neutral state uses white for unvoted buttons', () => {
      const { container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 5,
          negativeVotes: 3
        }
      });

      const icons = container.querySelectorAll('.vote-icon') as NodeListOf<HTMLElement>;
      
      // Both buttons should use white/neutral color when not voted
      icons.forEach(icon => {
        expect(icon.style.color).toBe('white');
      });
    });

    it('vote count uses green for positive net votes', () => {
      const { container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 10,
          negativeVotes: 3
        }
      });

      const voteCount = container.querySelector('.vote-count');
      expect(voteCount?.classList.contains('positive')).toBe(true);
      expect(voteCount?.classList.contains('negative')).toBe(false);
      expect(voteCount?.classList.contains('neutral')).toBe(false);
    });

    it('vote count uses red for negative net votes', () => {
      const { container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 3,
          negativeVotes: 10
        }
      });

      const voteCount = container.querySelector('.vote-count');
      expect(voteCount?.classList.contains('negative')).toBe(true);
      expect(voteCount?.classList.contains('positive')).toBe(false);
      expect(voteCount?.classList.contains('neutral')).toBe(false);
    });

    it('vote count uses neutral for zero net votes', () => {
      const { container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 5,
          negativeVotes: 5
        }
      });

      const voteCount = container.querySelector('.vote-count');
      expect(voteCount?.classList.contains('neutral')).toBe(true);
      expect(voteCount?.classList.contains('positive')).toBe(false);
      expect(voteCount?.classList.contains('negative')).toBe(false);
    });
  });

  describe('accessibility', () => {
    it('has proper ARIA labels for agree button', () => {
      const { container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 5,
          negativeVotes: 3
        }
      });

      const agreeButton = container.querySelector('.upvote-button');
      expect(agreeButton?.getAttribute('role')).toBe('button');
      expect(agreeButton?.getAttribute('aria-label')).toBe('Agree');
      expect(agreeButton?.getAttribute('aria-pressed')).toBe('false');
    });

    it('has proper ARIA labels for disagree button', () => {
      const { container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 5,
          negativeVotes: 3
        }
      });

      const disagreeButton = container.querySelector('.downvote-button');
      expect(disagreeButton?.getAttribute('role')).toBe('button');
      expect(disagreeButton?.getAttribute('aria-label')).toBe('Disagree');
      expect(disagreeButton?.getAttribute('aria-pressed')).toBe('false');
    });

    it('ARIA pressed state updates when voted', () => {
      const { container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'agree' as VoteStatus,
          positiveVotes: 6,
          negativeVotes: 3
        }
      });

      const agreeButton = container.querySelector('.upvote-button');
      expect(agreeButton?.getAttribute('aria-pressed')).toBe('true');
      expect(agreeButton?.getAttribute('aria-label')).toBe('Remove vote');
    });

    it('buttons are keyboard focusable with tabindex', () => {
      const { container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 5,
          negativeVotes: 3
        }
      });

      const agreeButton = container.querySelector('.upvote-button');
      const disagreeButton = container.querySelector('.downvote-button');
      
      expect(agreeButton?.getAttribute('tabindex')).toBe('0');
      expect(disagreeButton?.getAttribute('tabindex')).toBe('0');
    });

    it('disabled state updates ARIA attributes', () => {
      const { container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 5,
          negativeVotes: 3,
          isVoting: true
        }
      });

      const agreeButton = container.querySelector('.upvote-button');
      expect(agreeButton?.classList.contains('disabled')).toBe(true);
    });
  });

  describe('layout responsiveness', () => {
    it('adjusts button spacing based on availableWidth', () => {
      const { container: narrowContainer } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 5,
          negativeVotes: 3,
          availableWidth: 100
        }
      });

      const { container: wideContainer } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 5,
          negativeVotes: 3,
          availableWidth: 400
        }
      });

      // Both should render successfully with different widths
      expect(narrowContainer.querySelector('.vote-buttons')).toBeTruthy();
      expect(wideContainer.querySelector('.vote-buttons')).toBeTruthy();
    });

    it('respects containerY positioning', () => {
      const { container } = render(ContentVoteButtons, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 5,
          negativeVotes: 3,
          containerY: 50
        }
      });

      const voteButtons = container.querySelector('.vote-buttons');
      expect(voteButtons?.getAttribute('transform')).toContain('50');
    });
  });
});