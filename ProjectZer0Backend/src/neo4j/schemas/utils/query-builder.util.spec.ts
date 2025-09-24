// src/neo4j/schemas/utils/query-builder.util.spec.ts

import { Neo4jQueryBuilder } from './query-builder.util';

describe('Neo4jQueryBuilder', () => {
  describe('createNodeWithVoting', () => {
    it('should create node with inclusion voting only', () => {
      const query = Neo4jQueryBuilder.createNodeWithVoting(
        'TestNode',
        ['id', 'name', 'description'],
        false,
      );

      expect(query).toContain('CREATE (n:TestNode {');
      expect(query).toContain('id: $id');
      expect(query).toContain('name: $name');
      expect(query).toContain('description: $description');
      expect(query).toContain('inclusionPositiveVotes: 0');
      expect(query).toContain('inclusionNegativeVotes: 0');
      expect(query).toContain('inclusionNetVotes: 0');
      expect(query).not.toContain('contentPositiveVotes');
      expect(query).not.toContain('contentNegativeVotes');
      expect(query).not.toContain('contentNetVotes');
    });

    it('should create node with both inclusion and content voting', () => {
      const query = Neo4jQueryBuilder.createNodeWithVoting(
        'StatementNode',
        ['id', 'statement'],
        true,
      );

      expect(query).toContain('CREATE (n:StatementNode {');
      expect(query).toContain('inclusionPositiveVotes: 0');
      expect(query).toContain('inclusionNegativeVotes: 0');
      expect(query).toContain('inclusionNetVotes: 0');
      expect(query).toContain('contentPositiveVotes: 0');
      expect(query).toContain('contentNegativeVotes: 0');
      expect(query).toContain('contentNetVotes: 0');
    });

    it('should include datetime fields', () => {
      const query = Neo4jQueryBuilder.createNodeWithVoting(
        'TestNode',
        ['id'],
        false,
      );

      expect(query).toContain('createdAt: datetime()');
      expect(query).toContain('updatedAt: datetime()');
    });
  });

  describe('attachCategories', () => {
    it('should generate category attachment query with default max categories', () => {
      const query = Neo4jQueryBuilder.attachCategories();

      expect(query).toContain('WITH n, $categoryIds as categoryIds');
      expect(query).toContain('WHERE size(categoryIds) <= 3');
      expect(query).toContain('UNWIND categoryIds as categoryId');
      expect(query).toContain('MATCH (cat:CategoryNode {id: categoryId})');
      expect(query).toContain('WHERE cat.inclusionNetVotes > 0');
      expect(query).toContain('CREATE (n)-[:CATEGORIZED_AS]->(cat)');
      expect(query).toContain(
        'WHERE size(validCategories) = size(categoryIds) OR size(categoryIds) = 0',
      );
    });

    it('should generate category attachment query with custom max categories', () => {
      const query = Neo4jQueryBuilder.attachCategories(5);

      expect(query).toContain('WHERE size(categoryIds) <= 5');
    });
  });

  describe('attachKeywords', () => {
    it('should generate keyword attachment query with inclusion validation', () => {
      const query = Neo4jQueryBuilder.attachKeywords(true);

      expect(query).toContain('UNWIND $keywords as keyword');
      expect(query).toContain('MATCH (w:WordNode {word: keyword.word})');
      expect(query).toContain('WHERE w.inclusionNetVotes > 0');
      expect(query).toContain('CREATE (n)-[:TAGGED {');
      expect(query).toContain('frequency: keyword.frequency');
      expect(query).toContain('source: keyword.source');
      expect(query).toContain('createdAt: datetime()');
    });

    it('should generate keyword attachment query without inclusion validation', () => {
      const query = Neo4jQueryBuilder.attachKeywords(false);

      expect(query).toContain('MATCH (w:WordNode {word: keyword.word})');
      expect(query).not.toContain('WHERE w.inclusionNetVotes > 0');
    });
  });

  describe('createSharedTags', () => {
    it('should generate shared tag creation query for specific node label', () => {
      const query = Neo4jQueryBuilder.createSharedTags('StatementNode');

      expect(query).toContain('OPTIONAL MATCH (other)-[t:TAGGED]->(w)');
      expect(query).toContain('WHERE other.id <> n.id');
      expect(query).toContain("labels(other) = ['StatementNode']");
      expect(query).toContain(
        'MERGE (n)-[st:SHARED_TAG {word: w.word}]->(other)',
      );
      expect(query).toContain(
        'ON CREATE SET st.strength = keyword.frequency * t.frequency',
      );
      expect(query).toContain(
        'ON MATCH SET st.strength = st.strength + (keyword.frequency * t.frequency)',
      );
      expect(query).toContain('st.createdAt = datetime()');
      expect(query).toContain('st.updatedAt = datetime()');
    });

    it('should generate shared tag creation query for same-type nodes when no label specified', () => {
      const query = Neo4jQueryBuilder.createSharedTags();

      expect(query).toContain('labels(other) = labels(n)');
    });
  });

  describe('createSharedCategories', () => {
    it('should generate shared category creation query for specific node label', () => {
      const query =
        Neo4jQueryBuilder.createSharedCategories('OpenQuestionNode');

      expect(query).toContain(
        'OPTIONAL MATCH (other)-[:CATEGORIZED_AS]->(cat)',
      );
      expect(query).toContain('WHERE other.id <> n.id');
      expect(query).toContain("labels(other) = ['OpenQuestionNode']");
      expect(query).toContain('AND other.inclusionNetVotes > 0');
      expect(query).toContain(
        'MERGE (n)-[sc:SHARED_CATEGORY {categoryId: cat.id}]->(other)',
      );
      expect(query).toContain('ON CREATE SET sc.strength = 1');
      expect(query).toContain('sc.categoryName = cat.name');
      expect(query).toContain('ON MATCH SET sc.strength = sc.strength + 1');
    });

    it('should generate shared category creation query for same-type nodes when no label specified', () => {
      const query = Neo4jQueryBuilder.createSharedCategories();

      expect(query).toContain('labels(other) = labels(n)');
    });
  });

  describe('deleteRelationships', () => {
    it('should generate deletion query for single relationship type', () => {
      const query = Neo4jQueryBuilder.deleteRelationships(['TAGGED']);

      expect(query).toContain('WITH n');
      expect(query).toContain('OPTIONAL MATCH (n)-[rTAGGED:TAGGED]->()');
      expect(query).toContain('DELETE rTAGGED');
    });

    it('should generate deletion query for multiple relationship types', () => {
      const query = Neo4jQueryBuilder.deleteRelationships([
        'TAGGED',
        'SHARED_TAG',
        'CATEGORIZED_AS',
      ]);

      expect(query).toContain('OPTIONAL MATCH (n)-[rTAGGED:TAGGED]->()');
      expect(query).toContain('DELETE rTAGGED');
      expect(query).toContain(
        'OPTIONAL MATCH (n)-[rSHARED_TAG:SHARED_TAG]->()',
      );
      expect(query).toContain('DELETE rSHARED_TAG');
      expect(query).toContain(
        'OPTIONAL MATCH (n)-[rCATEGORIZED_AS:CATEGORIZED_AS]->()',
      );
      expect(query).toContain('DELETE rCATEGORIZED_AS');
    });
  });

  describe('getNodeWithRelations', () => {
    it('should generate basic node retrieval query', () => {
      const query = Neo4jQueryBuilder.getNodeWithRelations(
        'TestNode',
        'id',
        [],
      );

      expect(query).toContain('MATCH (n:TestNode {id: $id})');
      expect(query).toContain(
        'OPTIONAL MATCH (n)-[:HAS_DISCUSSION]->(d:DiscussionNode)',
      );
    });

    it('should generate query with outgoing relationships', () => {
      const query = Neo4jQueryBuilder.getNodeWithRelations(
        'StatementNode',
        'id',
        [{ type: 'TAGGED', target: 'WordNode', alias: 'w', direction: 'OUT' }],
      );

      expect(query).toContain('MATCH (n:StatementNode {id: $id})');
      expect(query).toContain('OPTIONAL MATCH (n)-[:TAGGED]->(w:WordNode)');
    });

    it('should generate query with incoming relationships', () => {
      const query = Neo4jQueryBuilder.getNodeWithRelations(
        'CategoryNode',
        'id',
        [{ type: 'CATEGORIZED_AS', alias: 'item', direction: 'IN' }],
      );

      expect(query).toContain('OPTIONAL MATCH (n)<-[:CATEGORIZED_AS]-(item)');
    });

    it('should generate query with bidirectional relationships', () => {
      const query = Neo4jQueryBuilder.getNodeWithRelations('TestNode', 'id', [
        { type: 'RELATED_TO', alias: 'related', direction: 'BOTH' },
      ]);

      expect(query).toContain('OPTIONAL MATCH (n)-[:RELATED_TO]-(related)');
    });

    it('should handle multiple relationships', () => {
      const query = Neo4jQueryBuilder.getNodeWithRelations(
        'StatementNode',
        'id',
        [
          { type: 'TAGGED', target: 'WordNode', alias: 'w', direction: 'OUT' },
          {
            type: 'CATEGORIZED_AS',
            target: 'CategoryNode',
            alias: 'cat',
            direction: 'OUT',
          },
          { type: 'COMMENT_ON', alias: 'comment', direction: 'IN' },
        ],
      );

      expect(query).toContain('OPTIONAL MATCH (n)-[:TAGGED]->(w:WordNode)');
      expect(query).toContain(
        'OPTIONAL MATCH (n)-[:CATEGORIZED_AS]->(cat:CategoryNode)',
      );
      expect(query).toContain('OPTIONAL MATCH (n)<-[:COMMENT_ON]-(comment)');
    });
  });

  describe('validateParentNode', () => {
    it('should generate parent validation query with inclusion requirement', () => {
      const query = Neo4jQueryBuilder.validateParentNode(
        'ParentNode',
        'id',
        true,
      );

      expect(query).toContain('MATCH (parent:ParentNode {id: $parentId})');
      expect(query).toContain('WHERE parent.inclusionNetVotes > 0');
    });

    it('should generate parent validation query without inclusion requirement', () => {
      const query = Neo4jQueryBuilder.validateParentNode(
        'ParentNode',
        'id',
        false,
      );

      expect(query).toContain('MATCH (parent:ParentNode {id: $parentId})');
      expect(query).not.toContain('WHERE parent.inclusionNetVotes > 0');
    });

    it('should use custom ID field', () => {
      const query = Neo4jQueryBuilder.validateParentNode(
        'WordNode',
        'word',
        true,
      );

      expect(query).toContain('MATCH (parent:WordNode {word: $parentId})');
    });
  });

  describe('createUserRelationship', () => {
    it('should generate user tracking relationship query', () => {
      const query = Neo4jQueryBuilder.createUserRelationship('statement');

      expect(query).toContain('WITH n, $createdBy as userId');
      expect(query).toContain(
        "WHERE userId <> 'FreeDictionaryAPI' AND userId <> 'ProjectZeroAI'",
      );
      expect(query).toContain('MATCH (u:User {sub: userId})');
      expect(query).toContain('CREATE (u)-[:CREATED {');
      expect(query).toContain('createdAt: datetime()');
      expect(query).toContain("type: 'statement'");
    });

    it('should lowercase the node type', () => {
      const query = Neo4jQueryBuilder.createUserRelationship('OpenQuestion');

      expect(query).toContain("type: 'openquestion'");
    });
  });

  describe('paginate', () => {
    it('should generate pagination with both offset and limit', () => {
      const query = Neo4jQueryBuilder.paginate(20, 10);

      expect(query).toBe(' SKIP $offset LIMIT $limit');
    });

    it('should generate pagination with only limit', () => {
      const query = Neo4jQueryBuilder.paginate(undefined, 25);

      expect(query).toBe(' LIMIT $limit');
    });

    it('should generate pagination with only offset', () => {
      const query = Neo4jQueryBuilder.paginate(10, undefined);

      expect(query).toBe(' SKIP $offset');
    });

    it('should return empty string when no pagination', () => {
      const query = Neo4jQueryBuilder.paginate(undefined, undefined);

      expect(query).toBe('');
    });

    it('should ignore zero offset', () => {
      const query = Neo4jQueryBuilder.paginate(0, 10);

      expect(query).toBe(' LIMIT $limit');
    });
  });

  describe('orderBy', () => {
    it('should generate simple ORDER BY clause', () => {
      const query = Neo4jQueryBuilder.orderBy('createdAt', 'DESC');

      expect(query).toBe('ORDER BY createdAt DESC');
    });

    it('should use default DESC direction', () => {
      const query = Neo4jQueryBuilder.orderBy('inclusionNetVotes');

      expect(query).toBe('ORDER BY inclusionNetVotes DESC');
    });

    it('should handle ASC direction', () => {
      const query = Neo4jQueryBuilder.orderBy('name', 'ASC');

      expect(query).toBe('ORDER BY name ASC');
    });

    it('should handle additional sort fields', () => {
      const query = Neo4jQueryBuilder.orderBy('inclusionNetVotes', 'DESC', [
        { field: 'createdAt', direction: 'DESC' },
        { field: 'id', direction: 'ASC' },
      ]);

      expect(query).toBe(
        'ORDER BY inclusionNetVotes DESC, createdAt DESC, id ASC',
      );
    });
  });

  describe('filterByVotes', () => {
    it('should generate basic vote filter', () => {
      const query = Neo4jQueryBuilder.filterByVotes('inclusionNetVotes', 5);

      expect(query).toBe('WHERE n.inclusionNetVotes > 5');
    });

    it('should use default threshold of 0', () => {
      const query = Neo4jQueryBuilder.filterByVotes('contentNetVotes');

      expect(query).toBe('WHERE n.contentNetVotes > 0');
    });

    it('should handle additional conditions', () => {
      const query = Neo4jQueryBuilder.filterByVotes('inclusionNetVotes', 10, [
        "n.createdAt > datetime('2024-01-01')",
        'n.public = true',
      ]);

      expect(query).toBe(
        "WHERE n.inclusionNetVotes > 10 AND n.createdAt > datetime('2024-01-01') AND n.public = true",
      );
    });
  });

  describe('collectAggregations', () => {
    it('should generate COUNT aggregation', () => {
      const query = Neo4jQueryBuilder.collectAggregations([
        {
          field: 'comment',
          type: 'COUNT',
          distinct: true,
          alias: 'commentCount',
        },
      ]);

      expect(query).toContain('WITH n,');
      expect(query).toContain('COUNT(DISTINCT comment) as commentCount');
    });

    it('should generate multiple aggregations', () => {
      const query = Neo4jQueryBuilder.collectAggregations([
        { field: 'vote.value', type: 'SUM', alias: 'totalVotes' },
        {
          field: 'category',
          type: 'COLLECT',
          distinct: true,
          alias: 'categories',
        },
        { field: 'score', type: 'AVG', alias: 'avgScore' },
        { field: 'createdAt', type: 'MAX', alias: 'latestDate' },
        { field: 'votes', type: 'MIN', alias: 'minVotes' },
      ]);

      expect(query).toContain('SUM(vote.value) as totalVotes');
      expect(query).toContain('COLLECT(DISTINCT category) as categories');
      expect(query).toContain('AVG(score) as avgScore');
      expect(query).toContain('MAX(createdAt) as latestDate');
      expect(query).toContain('MIN(votes) as minVotes');
    });

    it('should handle non-distinct aggregations', () => {
      const query = Neo4jQueryBuilder.collectAggregations([
        { field: 'tag', type: 'COLLECT', distinct: false, alias: 'allTags' },
      ]);

      expect(query).toContain('COLLECT(tag) as allTags');
      expect(query).not.toContain('DISTINCT');
    });
  });
});
