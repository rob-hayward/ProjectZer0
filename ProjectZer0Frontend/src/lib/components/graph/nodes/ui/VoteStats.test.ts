import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import VoteStats from '$lib/components/graph/nodes/ui/VoteStats.svelte';
import type { VoteStatus } from '$lib/types/domain/nodes';

describe('VoteStats', () => {
  describe('rendering', () => {
    it('renders vote stats container', () => {
      const { container } = render(VoteStats, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 10,
          negativeVotes: 3,
          userName: 'TestUser',
          showUserStatus: true,
          availableWidth: 400,
          containerY: 0,
          showBackground: true
        }
      });

      const statsContainer = container.querySelector('.vote-stats-container');
      expect(statsContainer).toBeTruthy();
    });

    it('displays user vote status', () => {
      const { container } = render(VoteStats, {
        props: {
          userVoteStatus: 'agree' as VoteStatus,
          positiveVotes: 10,
          negativeVotes: 3,
          userName: 'JohnDoe',
          showUserStatus: true,
          availableWidth: 400
        }
      });

      // Find the stat key that shows userName
      const statKeys = container.querySelectorAll('.stat-key');
      const userNameText = Array.from(statKeys).find(el => 
        el.textContent?.trim() === 'JohnDoe'
      );
      expect(userNameText).toBeTruthy();

      // Find the corresponding stat value
      const statValues = container.querySelectorAll('.stat-value');
      const userVoteValue = Array.from(statValues).find(el => 
        el.textContent?.trim() === 'agree'
      );
      expect(userVoteValue).toBeTruthy();
    });

    it('displays total positive votes', () => {
      const { container } = render(VoteStats, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 15,
          negativeVotes: 5,
          showUserStatus: false,
          availableWidth: 400
        }
      });

      const statKeys = container.querySelectorAll('.stat-key');
      const positiveLabel = Array.from(statKeys).find(el => 
        el.textContent?.trim() === 'Total Agree'
      );
      expect(positiveLabel).toBeTruthy();

      const statValues = container.querySelectorAll('.stat-value');
      const positiveValue = Array.from(statValues).find(el => 
        el.textContent?.trim() === '15'
      );
      expect(positiveValue).toBeTruthy();
    });

    it('displays total negative votes', () => {
      const { container } = render(VoteStats, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 15,
          negativeVotes: 8,
          showUserStatus: false,
          availableWidth: 400
        }
      });

      const statKeys = container.querySelectorAll('.stat-key');
      const negativeLabel = Array.from(statKeys).find(el => 
        el.textContent?.trim() === 'Total Disagree'
      );
      expect(negativeLabel).toBeTruthy();

      const statValues = container.querySelectorAll('.stat-value');
      const negativeValue = Array.from(statValues).find(el => 
        el.textContent?.trim() === '8'
      );
      expect(negativeValue).toBeTruthy();
    });

    it('displays net votes', () => {
      const { container } = render(VoteStats, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 15,
          negativeVotes: 8,
          showUserStatus: false,
          availableWidth: 400
        }
      });

      const statKeys = container.querySelectorAll('.stat-key');
      const netLabel = Array.from(statKeys).find(el => 
        el.textContent?.trim() === 'Net Votes'
      );
      expect(netLabel).toBeTruthy();

      // Net votes: 15 - 8 = +7
      const statValues = container.querySelectorAll('.stat-value');
      const netValue = Array.from(statValues).find(el => 
        el.textContent?.trim() === '+7'
      );
      expect(netValue).toBeTruthy();
    });

    it('shows correct colors for positive net votes', () => {
      const { container } = render(VoteStats, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 15,
          negativeVotes: 5,
          showUserStatus: false,
          availableWidth: 400
        }
      });

      // Find net votes value
      const statValues = container.querySelectorAll('.stat-value');
      const netValue = Array.from(statValues).find(el => 
        el.textContent?.trim().startsWith('+')
      ) as SVGTextElement;
      
      expect(netValue).toBeTruthy();
      // Should use green color for positive
      const color = netValue.getAttribute('style');
      expect(color).toContain('46, 204, 113'); // Green RGB
    });

    it('shows correct colors for negative net votes', () => {
      const { container } = render(VoteStats, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 5,
          negativeVotes: 15,
          showUserStatus: false,
          availableWidth: 400
        }
      });

      // Find net votes value
      const statValues = container.querySelectorAll('.stat-value');
      const netValue = Array.from(statValues).find(el => 
        el.textContent?.trim().startsWith('-')
      ) as SVGTextElement;
      
      expect(netValue).toBeTruthy();
      // Should use red color for negative
      const color = netValue.getAttribute('style');
      expect(color).toContain('231, 76, 60'); // Red RGB
    });

    it('shows correct colors for zero net votes', () => {
      const { container } = render(VoteStats, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 10,
          negativeVotes: 10,
          showUserStatus: false,
          availableWidth: 400
        }
      });

      // Find net votes value
      const statValues = container.querySelectorAll('.stat-value');
      const netValue = Array.from(statValues).find(el => 
        el.textContent?.trim() === '0'
      ) as SVGTextElement;
      
      expect(netValue).toBeTruthy();
      // Should use white/neutral color for zero
      const color = netValue.getAttribute('style');
      expect(color).toContain('255, 255, 255'); // White RGB
    });

    it('displays vote data header', () => {
      const { container } = render(VoteStats, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 10,
          negativeVotes: 3,
          availableWidth: 400
        }
      });

      const header = container.querySelector('.stats-header');
      expect(header?.textContent?.trim()).toBe('Vote Data');
    });
  });

  describe('configurable labels', () => {
    it('uses custom positiveLabel', () => {
      const { container } = render(VoteStats, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 10,
          negativeVotes: 3,
          positiveLabel: 'Total Include',
          showUserStatus: false,
          availableWidth: 400
        }
      });

      const statKeys = container.querySelectorAll('.stat-key');
      const customLabel = Array.from(statKeys).find(el => 
        el.textContent?.trim() === 'Total Include'
      );
      expect(customLabel).toBeTruthy();
    });

    it('uses custom negativeLabel', () => {
      const { container } = render(VoteStats, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 10,
          negativeVotes: 3,
          negativeLabel: 'Total Exclude',
          showUserStatus: false,
          availableWidth: 400
        }
      });

      const statKeys = container.querySelectorAll('.stat-key');
      const customLabel = Array.from(statKeys).find(el => 
        el.textContent?.trim() === 'Total Exclude'
      );
      expect(customLabel).toBeTruthy();
    });

    it('uses custom netLabel', () => {
      const { container } = render(VoteStats, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 10,
          negativeVotes: 3,
          netLabel: 'Net Inclusion',
          showUserStatus: false,
          availableWidth: 400
        }
      });

      const statKeys = container.querySelectorAll('.stat-key');
      const customLabel = Array.from(statKeys).find(el => 
        el.textContent?.trim() === 'Net Inclusion'
      );
      expect(customLabel).toBeTruthy();
    });

    it('defaults work correctly for content voting', () => {
      const { container } = render(VoteStats, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 10,
          negativeVotes: 3,
          showUserStatus: false,
          availableWidth: 400
          // No custom labels - should use defaults
        }
      });

      const statKeys = container.querySelectorAll('.stat-key');
      
      const agreeLabel = Array.from(statKeys).find(el => 
        el.textContent?.trim() === 'Total Agree'
      );
      expect(agreeLabel).toBeTruthy();

      const disagreeLabel = Array.from(statKeys).find(el => 
        el.textContent?.trim() === 'Total Disagree'
      );
      expect(disagreeLabel).toBeTruthy();

      const netLabel = Array.from(statKeys).find(el => 
        el.textContent?.trim() === 'Net Votes'
      );
      expect(netLabel).toBeTruthy();
    });

    it('supports inclusion voting labels', () => {
      const { container } = render(VoteStats, {
        props: {
          userVoteStatus: 'agree' as VoteStatus,
          positiveVotes: 12,
          negativeVotes: 4,
          positiveLabel: 'Total Include',
          negativeLabel: 'Total Exclude',
          netLabel: 'Net Inclusion',
          showUserStatus: false,
          availableWidth: 400
        }
      });

      const statKeys = container.querySelectorAll('.stat-key');
      
      expect(Array.from(statKeys).find(el => 
        el.textContent?.trim() === 'Total Include'
      )).toBeTruthy();

      expect(Array.from(statKeys).find(el => 
        el.textContent?.trim() === 'Total Exclude'
      )).toBeTruthy();

      expect(Array.from(statKeys).find(el => 
        el.textContent?.trim() === 'Net Inclusion'
      )).toBeTruthy();
    });
  });

  describe('layout', () => {
    it('background renders when showBackground=true', () => {
      const { container } = render(VoteStats, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 10,
          negativeVotes: 3,
          showBackground: true,
          availableWidth: 400
        }
      });

      const statsContainer = container.querySelector('.vote-stats-container');
      const background = statsContainer?.querySelector('rect');
      expect(background).toBeTruthy();
      expect(background?.getAttribute('fill')).toBeTruthy();
    });

    it('no background renders when showBackground=false', () => {
      const { container } = render(VoteStats, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 10,
          negativeVotes: 3,
          showBackground: false,
          availableWidth: 400
        }
      });

      const statsContainer = container.querySelector('.vote-stats-container');
      const background = statsContainer?.querySelector('rect');
      expect(background).toBeFalsy();
    });

    it('user status hidden when showUserStatus=false', () => {
      const { container } = render(VoteStats, {
        props: {
          userVoteStatus: 'agree' as VoteStatus,
          positiveVotes: 10,
          negativeVotes: 3,
          userName: 'TestUser',
          showUserStatus: false,
          availableWidth: 400
        }
      });

      const statKeys = container.querySelectorAll('.stat-key');
      const userNameText = Array.from(statKeys).find(el => 
        el.textContent?.trim() === 'TestUser'
      );
      expect(userNameText).toBeFalsy();
    });

    it('user status shown when showUserStatus=true', () => {
      const { container } = render(VoteStats, {
        props: {
          userVoteStatus: 'agree' as VoteStatus,
          positiveVotes: 10,
          negativeVotes: 3,
          userName: 'TestUser',
          showUserStatus: true,
          availableWidth: 400
        }
      });

      const statKeys = container.querySelectorAll('.stat-key');
      const userNameText = Array.from(statKeys).find(el => 
        el.textContent?.trim() === 'TestUser'
      );
      expect(userNameText).toBeTruthy();
    });

    it('sections have correct spacing with user status', () => {
      const { container } = render(VoteStats, {
        props: {
          userVoteStatus: 'agree' as VoteStatus,
          positiveVotes: 10,
          negativeVotes: 3,
          userName: 'TestUser',
          showUserStatus: true,
          availableWidth: 400
        }
      });

      const statRows = container.querySelectorAll('.stat-row');
      
      // Should have 4 rows: user status, positive, negative, net
      expect(statRows.length).toBe(4);
    });

    it('sections have correct spacing without user status', () => {
      const { container } = render(VoteStats, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 10,
          negativeVotes: 3,
          showUserStatus: false,
          availableWidth: 400
        }
      });

      const statRows = container.querySelectorAll('.stat-row');
      
      // Should have 3 rows: positive, negative, net (no user status)
      expect(statRows.length).toBe(3);
    });

    it('respects availableWidth for layout', () => {
      const { container: narrowContainer } = render(VoteStats, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 10,
          negativeVotes: 3,
          availableWidth: 200,
          showUserStatus: false
        }
      });

      const { container: wideContainer } = render(VoteStats, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 10,
          negativeVotes: 3,
          availableWidth: 600,
          showUserStatus: false
        }
      });

      // Both should render successfully
      expect(narrowContainer.querySelector('.vote-stats-container')).toBeTruthy();
      expect(wideContainer.querySelector('.vote-stats-container')).toBeTruthy();
    });

    it('respects containerY positioning', () => {
      const { container } = render(VoteStats, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 10,
          negativeVotes: 3,
          containerY: 150,
          showUserStatus: false,
          availableWidth: 400
        }
      });

      const statsContainer = container.querySelector('.vote-stats-container');
      expect(statsContainer?.getAttribute('transform')).toContain('150');
    });

    it('equals signs are centered', () => {
      const { container } = render(VoteStats, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 10,
          negativeVotes: 3,
          showUserStatus: false,
          availableWidth: 400
        }
      });

      const equalsElements = container.querySelectorAll('.stat-equals');
      
      equalsElements.forEach(element => {
        expect(element.getAttribute('style')).toContain('text-anchor: middle');
        expect(element.textContent?.trim()).toBe('=');
      });
    });
  });

  describe('user vote status colors', () => {
    it('shows green for agree vote', () => {
      const { container } = render(VoteStats, {
        props: {
          userVoteStatus: 'agree' as VoteStatus,
          positiveVotes: 10,
          negativeVotes: 3,
          userName: 'TestUser',
          showUserStatus: true,
          availableWidth: 400
        }
      });

      const statValues = container.querySelectorAll('.stat-value');
      const userVoteValue = Array.from(statValues).find(el => 
        el.textContent?.trim() === 'agree'
      ) as SVGTextElement;
      
      expect(userVoteValue).toBeTruthy();
      const color = userVoteValue.getAttribute('style');
      expect(color).toContain('46, 204, 113'); // Green
    });

    it('shows red for disagree vote', () => {
      const { container } = render(VoteStats, {
        props: {
          userVoteStatus: 'disagree' as VoteStatus,
          positiveVotes: 10,
          negativeVotes: 3,
          userName: 'TestUser',
          showUserStatus: true,
          availableWidth: 400
        }
      });

      const statValues = container.querySelectorAll('.stat-value');
      const userVoteValue = Array.from(statValues).find(el => 
        el.textContent?.trim() === 'disagree'
      ) as SVGTextElement;
      
      expect(userVoteValue).toBeTruthy();
      const color = userVoteValue.getAttribute('style');
      expect(color).toContain('231, 76, 60'); // Red
    });

    it('shows white for no vote', () => {
      const { container } = render(VoteStats, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 10,
          negativeVotes: 3,
          userName: 'TestUser',
          showUserStatus: true,
          availableWidth: 400
        }
      });

      const statValues = container.querySelectorAll('.stat-value');
      const userVoteValue = Array.from(statValues).find(el => 
        el.textContent?.trim() === 'none'
      ) as SVGTextElement;
      
      expect(userVoteValue).toBeTruthy();
      const color = userVoteValue.getAttribute('style');
      expect(color).toContain('255, 255, 255'); // White
    });
  });

  describe('net votes formatting', () => {
    it('shows + prefix for positive net votes', () => {
      const { container } = render(VoteStats, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 20,
          negativeVotes: 5,
          showUserStatus: false,
          availableWidth: 400
        }
      });

      const statValues = container.querySelectorAll('.stat-value');
      const netValue = Array.from(statValues).find(el => 
        el.textContent?.trim().startsWith('+')
      );
      expect(netValue?.textContent?.trim()).toBe('+15');
    });

    it('shows - prefix for negative net votes', () => {
      const { container } = render(VoteStats, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 5,
          negativeVotes: 20,
          showUserStatus: false,
          availableWidth: 400
        }
      });

      const statValues = container.querySelectorAll('.stat-value');
      const netValue = Array.from(statValues).find(el => 
        el.textContent?.trim().startsWith('-')
      );
      expect(netValue?.textContent?.trim()).toBe('-15');
    });

    it('shows 0 for zero net votes', () => {
      const { container } = render(VoteStats, {
        props: {
          userVoteStatus: 'none' as VoteStatus,
          positiveVotes: 10,
          negativeVotes: 10,
          showUserStatus: false,
          availableWidth: 400
        }
      });

      const statValues = container.querySelectorAll('.stat-value');
      const netValue = Array.from(statValues).find(el => 
        el.textContent?.trim() === '0'
      );
      expect(netValue).toBeTruthy();
    });
  });

  describe('complete data display', () => {
    it('renders all vote data correctly for inclusion voting', () => {
      const { container } = render(VoteStats, {
        props: {
          userVoteStatus: 'agree' as VoteStatus,
          positiveVotes: 25,
          negativeVotes: 8,
          userName: 'AliceUser',
          showUserStatus: true,
          positiveLabel: 'Total Include',
          negativeLabel: 'Total Exclude',
          netLabel: 'Net Inclusion',
          availableWidth: 400,
          showBackground: true
        }
      });

      // Check all components are present
      expect(container.querySelector('.vote-stats-container')).toBeTruthy();
      expect(container.querySelector('.stats-header')).toBeTruthy();
      expect(container.querySelector('.stats-content')).toBeTruthy();
      expect(container.querySelectorAll('.stat-row').length).toBe(4);
    });

    it('renders all vote data correctly for content voting', () => {
      const { container } = render(VoteStats, {
        props: {
          userVoteStatus: 'disagree' as VoteStatus,
          positiveVotes: 18,
          negativeVotes: 12,
          userName: 'BobUser',
          showUserStatus: true,
          availableWidth: 400,
          showBackground: false
          // Using default labels for content voting
        }
      });

      const statKeys = container.querySelectorAll('.stat-key');
      
      // Check default labels
      expect(Array.from(statKeys).find(el => 
        el.textContent?.trim() === 'Total Agree'
      )).toBeTruthy();
      
      expect(Array.from(statKeys).find(el => 
        el.textContent?.trim() === 'Total Disagree'
      )).toBeTruthy();
      
      expect(Array.from(statKeys).find(el => 
        el.textContent?.trim() === 'Net Votes'
      )).toBeTruthy();
    });
  });
});