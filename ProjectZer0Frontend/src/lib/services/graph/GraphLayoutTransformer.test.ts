import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphLayoutTransformer } from './GraphLayoutTransformer';
import { statementNetworkStore } from '$lib/stores/statementNetworkStore';
import type { UserProfile } from '$lib/types/domain/user';
import type { NavigationOption } from '$lib/types/domain/navigation';
import type { WordNode, StatementNode } from '$lib/types/domain/nodes';

// Mock the statement network store
vi.mock('$lib/stores/statementNetworkStore', () => ({
  statementNetworkStore: {
    getVoteData: vi.fn().mockImplementation((id) => ({
      positiveVotes: 5,
      negativeVotes: 2,
      netVotes: 3,
      shouldBeHidden: false
    }))
  }
}));

describe('GraphLayoutTransformer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('transformDashboardView', () => {
    it('should transform user and navigation options to layout data', () => {
      // Arrange
      const mockUser: UserProfile = {
        sub: 'user123',
        email: 'test@example.com',
        name: 'Test User'
      };
      
      const mockNavOptions: NavigationOption[] = [
        { id: 'dashboard', label: 'Dashboard', icon: 'home' },
        { id: 'explore', label: 'Explore', icon: 'explore' }
      ];

      // Act
      const result = GraphLayoutTransformer.transformDashboardView(mockUser, mockNavOptions);

      // Assert
      expect(result.nodes).toHaveLength(3); // 1 central node + 2 navigation nodes
      
      // Check central node
      const centralNode = result.nodes.find(n => n.id === mockUser.sub);
      expect(centralNode).toBeDefined();
      expect(centralNode?.type).toBe('central');
      expect(centralNode?.metadata?.fixed).toBe(true);
      
      // Check navigation nodes
      const navNodes = result.nodes.filter(n => n.type === 'navigation');
      expect(navNodes).toHaveLength(2);
      expect(navNodes[0].id).toBe('dashboard');
      expect(navNodes[1].id).toBe('explore');
      
      // Check links
      expect(result.links).toHaveLength(0); // Dashboard view has no links
    });
  });

  describe('transformWordView', () => {
    it('should transform word data to layout with live definition only when showAllDefinitions is false', () => {
      // Arrange
      const mockWord: WordNode = {
        id: 'word123',
        word: 'democracy',
        createdBy: 'user1',
        publicCredit: true,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        definitions: [
          {
            id: 'def1',
            definitionText: 'First definition',
            createdAt: '2023-01-01T00:00:00Z',
            createdBy: 'user1',
            positiveVotes: 10,
            negativeVotes: 2
          },
          {
            id: 'def2',
            definitionText: 'Second definition',
            createdAt: '2023-01-02T00:00:00Z',
            createdBy: 'user2',
            positiveVotes: 5,
            negativeVotes: 1
          }
        ],
        positiveVotes: 15,
        negativeVotes: 3
      };
      
      const mockNavOptions: NavigationOption[] = [
        { id: 'dashboard', label: 'Dashboard', icon: 'home' },
        { id: 'explore', label: 'Explore', icon: 'explore' }
      ];

      // Act
      const result = GraphLayoutTransformer.transformWordView(mockWord, mockNavOptions, false);

      // Assert
      expect(result.nodes).toHaveLength(4); // 1 word node + 2 navigation nodes + 1 definition node (live only)
      
      // Check central word node
      const wordNode = result.nodes.find(n => n.id === mockWord.id);
      expect(wordNode).toBeDefined();
      expect(wordNode?.type).toBe('word');
      expect(wordNode?.metadata?.fixed).toBe(true);
      
      // Check definition nodes (should only have the first/live one)
      const defNodes = result.nodes.filter(n => n.type === 'definition');
      expect(defNodes).toHaveLength(1);
      expect(defNodes[0].id).toBe('def1');
      expect(defNodes[0].subtype).toBe('live');
      
      // Check links
      expect(result.links).toHaveLength(1); // Just one link to the live definition
      expect(result.links[0].source).toBe(mockWord.id);
      expect(result.links[0].target).toBe('def1');
      expect(result.links[0].type).toBe('definition');
      expect(result.links[0].strength).toBe(0.7);
    });

    it('should transform word data to layout with all definitions when showAllDefinitions is true', () => {
      // Arrange
      const mockWord: WordNode = {
        id: 'word123',
        word: 'democracy',
        createdBy: 'user1',
        publicCredit: true,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        definitions: [
          {
            id: 'def1',
            definitionText: 'First definition',
            createdAt: '2023-01-01T00:00:00Z',
            createdBy: 'user1',
            positiveVotes: 10,
            negativeVotes: 2
          },
          {
            id: 'def2',
            definitionText: 'Second definition',
            createdAt: '2023-01-02T00:00:00Z',
            createdBy: 'user2',
            positiveVotes: 5,
            negativeVotes: 1
          }
        ],
        positiveVotes: 15,
        negativeVotes: 3
      };
      
      const mockNavOptions: NavigationOption[] = [
        { id: 'dashboard', label: 'Dashboard', icon: 'home' },
        { id: 'explore', label: 'Explore', icon: 'explore' }
      ];

      // Act
      const result = GraphLayoutTransformer.transformWordView(mockWord, mockNavOptions, true);

      // Assert
      expect(result.nodes).toHaveLength(5); // 1 word node + 2 navigation nodes + 2 definition nodes
      
      // Check central word node
      const wordNode = result.nodes.find(n => n.id === mockWord.id);
      expect(wordNode).toBeDefined();
      expect(wordNode?.type).toBe('word');
      expect(wordNode?.metadata?.fixed).toBe(true);
      
      // Check definition nodes (should have both)
      const defNodes = result.nodes.filter(n => n.type === 'definition');
      expect(defNodes).toHaveLength(2);
      
      // First one should be live
      expect(defNodes[0].id).toBe('def1');
      expect(defNodes[0].subtype).toBe('live');
      
      // Second one should be alternative
      expect(defNodes[1].id).toBe('def2');
      expect(defNodes[1].subtype).toBe('alternative');
      
      // Check links
      expect(result.links).toHaveLength(2); // Links to both definitions
      expect(result.links[0].source).toBe(mockWord.id);
      expect(result.links[0].target).toBe('def1');
      expect(result.links[1].source).toBe(mockWord.id);
      expect(result.links[1].target).toBe('def2');
    });
  });

  describe('transformStatementNetworkView', () => {
    it('should transform statement data to layout with proper nodes and links', () => {
      // Arrange
      const mockStatements: StatementNode[] = [
        {
          id: 'stmt1',
          statement: 'Democracy requires participation',
          createdBy: 'user1',
          publicCredit: true,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
          positiveVotes: 10,
          negativeVotes: 2,
          keywords: [
            { word: 'democracy', frequency: 2, source: 'user' },
            { word: 'participation', frequency: 1, source: 'user' }
          ],
          relatedStatements: [
            {
              nodeId: 'stmt2',
              statement: 'Participation is key to democracy',
              sharedWord: 'democracy',
              strength: 0.8
            }
          ]
        },
        {
          id: 'stmt2',
          statement: 'Participation is key to democracy',
          createdBy: 'user2',
          publicCredit: true,
          createdAt: '2023-01-02T00:00:00Z',
          updatedAt: '2023-01-02T00:00:00Z',
          positiveVotes: 8,
          negativeVotes: 3,
          keywords: [
            { word: 'democracy', frequency: 1, source: 'user' },
            { word: 'participation', frequency: 2, source: 'user' }
          ],
          relatedStatements: [
            {
              nodeId: 'stmt1',
              statement: 'Democracy requires participation',
              sharedWord: 'participation',
              strength: 0.7
            }
          ]
        }
      ];
      
      const mockControlNode = {
        id: 'control',
        sub: 'controls'
      };
      
      const mockNavOptions: NavigationOption[] = [
        { id: 'dashboard', label: 'Dashboard', icon: 'home' },
        { id: 'explore', label: 'Explore', icon: 'explore' }
      ];
      
      const mockVisibilityPrefs = {
        'stmt1': true,  // should be visible
        'stmt2': false  // should be hidden
      };

      // Act - call with visibility preferences
      const result = GraphLayoutTransformer.transformStatementNetworkView(
        mockStatements,
        mockControlNode,
        mockNavOptions,
        mockVisibilityPrefs
      );

      // Assert
      expect(result.nodes).toHaveLength(5); // 1 control node + 2 navigation nodes + 2 statement nodes
      
      // Check control node
      const controlNode = result.nodes.find(n => n.id === 'control');
      expect(controlNode).toBeDefined();
      expect(controlNode?.type).toBe('dashboard');
      expect(controlNode?.metadata?.group).toBe('central');
      expect(controlNode?.metadata?.fixed).toBe(true);
      
      // Check statement nodes and visibility
      const stmtNodes = result.nodes.filter(n => n.type === 'statement');
      expect(stmtNodes).toHaveLength(2);
      
      // Check that visibility preferences were applied
      const stmt1 = stmtNodes.find(n => n.id === 'stmt1');
      expect(stmt1?.metadata?.isHidden).toBe(false); // User preference says visible
      
      const stmt2 = stmtNodes.find(n => n.id === 'stmt2');
      expect(stmt2?.metadata?.isHidden).toBe(true); // User preference says hidden
      
      // Check links - should be one consolidated link between the statements
      expect(result.links).toHaveLength(1);
      const link = result.links[0];
      expect(link.source).toBe('stmt1');
      expect(link.target).toBe('stmt2');
      expect(link.type).toBe('related');
      
      // Check that consolidated link has metadata about shared words
      expect(link.metadata?.sharedWords).toContain('democracy');
      expect(link.metadata?.sharedWords).toContain('participation');
      expect(link.metadata?.relationCount).toBe(2);
      
      // The strength should be the max of the individual relationships
      expect(link.strength).toBe(0.8);
    });
    
    it('should apply community visibility rules when no user preferences exist', () => {
      // Arrange
      const mockStatements: StatementNode[] = [
        {
          id: 'stmt1',
          statement: 'Positive statement',
          createdBy: 'user1',
          publicCredit: true,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
          positiveVotes: 10,
          negativeVotes: 2, // Net positive
          keywords: [{ word: 'test', frequency: 1, source: 'user' }]
        },
        {
          id: 'stmt2',
          statement: 'Negative statement',
          createdBy: 'user2',
          publicCredit: true,
          createdAt: '2023-01-02T00:00:00Z',
          updatedAt: '2023-01-02T00:00:00Z',
          positiveVotes: 2,
          negativeVotes: 8, // Net negative
          keywords: [{ word: 'test', frequency: 1, source: 'user' }]
        }
      ];
      
      // Override the getVoteData mock to return different values based on statement ID
      vi.mocked(statementNetworkStore.getVoteData)
        .mockImplementation((id) => {
          if (id === 'stmt1') {
            return {
              positiveVotes: 10,
              negativeVotes: 2,
              netVotes: 8,
              shouldBeHidden: false
            };
          } else {
            return {
              positiveVotes: 2,
              negativeVotes: 8,
              netVotes: -6,
              shouldBeHidden: true
            };
          }
        });
      
      const mockControlNode = { id: 'control', sub: 'controls' };
      const mockNavOptions: NavigationOption[] = [];
      
      // No visibility preferences provided
      
      // Act
      const result = GraphLayoutTransformer.transformStatementNetworkView(
        mockStatements,
        mockControlNode,
        mockNavOptions
      );
      
      // Assert
      const stmtNodes = result.nodes.filter(n => n.type === 'statement');
      
      // Check that community rules were applied
      const stmt1 = stmtNodes.find(n => n.id === 'stmt1');
      expect(stmt1?.metadata?.isHidden).toBe(false); // Net positive, should be visible
      expect(stmt1?.metadata?.hiddenReason).toBe('community');
      
      const stmt2 = stmtNodes.find(n => n.id === 'stmt2');
      expect(stmt2?.metadata?.isHidden).toBe(true); // Net negative, should be hidden
      expect(stmt2?.metadata?.hiddenReason).toBe('community');
    });
  });
});