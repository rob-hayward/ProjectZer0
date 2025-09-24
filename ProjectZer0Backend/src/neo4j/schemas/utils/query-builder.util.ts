// src/neo4j/schemas/utils/query-builder.util.ts

/**
 * Utility class for building standardized Neo4j Cypher queries
 * Used across all schema implementations to ensure consistency
 */
export class Neo4jQueryBuilder {
  /**
   * Creates a node with standard voting fields
   * @param label The node label (e.g., 'StatementNode')
   * @param propNames Array of property names to include from parameters
   * @param hasContentVoting Whether to include content voting fields
   * @returns Cypher CREATE statement
   */
  static createNodeWithVoting(
    label: string,
    propNames: string[],
    hasContentVoting: boolean = false,
  ): string {
    const props = propNames
      .map((name) => `${name}: $${name}`)
      .join(',\n      ');

    const votingFields = `
      inclusionPositiveVotes: 0,
      inclusionNegativeVotes: 0,
      inclusionNetVotes: 0${
        hasContentVoting
          ? `,
      contentPositiveVotes: 0,
      contentNegativeVotes: 0,
      contentNetVotes: 0`
          : ''
      }`;

    return `
    CREATE (n:${label} {
      ${props},
      createdAt: datetime(),
      updatedAt: datetime(),${votingFields}
    })`;
  }

  /**
   * Generates query to attach categories to a node
   * Validates categories exist and have passed inclusion threshold
   * @param maxCategories Maximum number of categories allowed
   * @returns Cypher query fragment
   */
  static attachCategories(maxCategories: number = 3): string {
    return `
    // Validate and attach categories
    WITH n, $categoryIds as categoryIds
    WHERE size(categoryIds) <= ${maxCategories}
    UNWIND categoryIds as categoryId
    MATCH (cat:CategoryNode {id: categoryId})
    WHERE cat.inclusionNetVotes > 0
    CREATE (n)-[:CATEGORIZED_AS]->(cat)
    
    // Ensure all categories were found and valid
    WITH n, collect(cat) as validCategories, categoryIds
    WHERE size(validCategories) = size(categoryIds) OR size(categoryIds) = 0`;
  }

  /**
   * Generates query to attach keywords/tags to a node
   * @param validateInclusion Whether to check if words have passed inclusion threshold
   * @returns Cypher query fragment
   */
  static attachKeywords(validateInclusion: boolean = true): string {
    const whereClause = validateInclusion
      ? '\n    WHERE w.inclusionNetVotes > 0'
      : '';

    return `
    // Attach keywords with metadata
    WITH n
    UNWIND $keywords as keyword
    MATCH (w:WordNode {word: keyword.word})${whereClause}
    CREATE (n)-[:TAGGED {
      frequency: keyword.frequency,
      source: keyword.source,
      createdAt: datetime()
    }]->(w)`;
  }

  /**
   * Creates SHARED_TAG relationships for content discovery
   * Connects nodes that share the same tags with weighted edges
   * @param nodeLabel The label of nodes to connect (for same-type connections)
   * @returns Cypher query fragment
   */
  static createSharedTags(nodeLabel?: string): string {
    const labelFilter = nodeLabel
      ? `labels(other) = ['${nodeLabel}']`
      : 'labels(other) = labels(n)';

    return `
    // Create weighted shared tag relationships for discovery
    WITH n, w, keyword
    OPTIONAL MATCH (other)-[t:TAGGED]->(w)
    WHERE other.id <> n.id AND ${labelFilter}
    FOREACH (dummy IN CASE WHEN other IS NOT NULL THEN [1] ELSE [] END |
      MERGE (n)-[st:SHARED_TAG {word: w.word}]->(other)
      ON CREATE SET st.strength = keyword.frequency * t.frequency,
                    st.createdAt = datetime()
      ON MATCH SET st.strength = st.strength + (keyword.frequency * t.frequency),
                   st.updatedAt = datetime()
    )`;
  }

  /**
   * Creates SHARED_CATEGORY relationships for content discovery
   * Connects nodes that share the same categories with weighted edges
   * @param nodeLabel The label of nodes to connect (for same-type connections)
   * @returns Cypher query fragment
   */
  static createSharedCategories(nodeLabel?: string): string {
    const labelFilter = nodeLabel
      ? `labels(other) = ['${nodeLabel}']`
      : 'labels(other) = labels(n)';

    return `
    // Create weighted shared category relationships for discovery
    WITH n, cat
    OPTIONAL MATCH (other)-[:CATEGORIZED_AS]->(cat)
    WHERE other.id <> n.id AND ${labelFilter}
      AND other.inclusionNetVotes > 0
    FOREACH (dummy IN CASE WHEN other IS NOT NULL THEN [1] ELSE [] END |
      MERGE (n)-[sc:SHARED_CATEGORY {categoryId: cat.id}]->(other)
      ON CREATE SET sc.strength = 1,
                    sc.categoryName = cat.name,
                    sc.createdAt = datetime()
      ON MATCH SET sc.strength = sc.strength + 1,
                   sc.updatedAt = datetime()
    )`;
  }

  /**
   * Generates query to delete specified relationship types
   * Used during updates to clear old relationships before creating new ones
   * @param types Array of relationship type names
   * @returns Cypher query fragment
   */
  static deleteRelationships(types: string[]): string {
    return (
      `
    // Delete existing relationships of specified types
    WITH n` +
      types
        .map(
          (type) => `
    OPTIONAL MATCH (n)-[r${type}:${type}]->()
    DELETE r${type}`,
        )
        .join('')
    );
  }

  /**
   * Builds a standard node retrieval query with optional relationships
   * @param label Node label
   * @param idField Field to use for matching (e.g., 'id' or 'word')
   * @param relations Array of relationships to optionally match
   * @returns Cypher query fragment
   */
  static getNodeWithRelations(
    label: string,
    idField: string,
    relations: Array<{
      type: string;
      direction?: 'OUT' | 'IN' | 'BOTH';
      target?: string;
      alias: string;
      props?: string[];
    }> = [],
  ): string {
    const baseMatch = `MATCH (n:${label} {${idField}: $id})`;

    const optionalMatches = relations
      .map((r) => {
        const direction = r.direction || 'OUT';
        const targetLabel = r.target ? `:${r.target}` : '';
        const relationship = `[:${r.type}]`;

        // Fixed: Proper arrow syntax for all directions
        let pattern: string;
        if (direction === 'OUT') {
          pattern = `(n)-${relationship}->(${r.alias}${targetLabel})`;
        } else if (direction === 'IN') {
          pattern = `(n)<-${relationship}-(${r.alias}${targetLabel})`;
        } else {
          // BOTH direction
          pattern = `(n)-${relationship}-(${r.alias}${targetLabel})`;
        }

        return `OPTIONAL MATCH ${pattern}`;
      })
      .join('\n    ');

    // Always include discussion check
    const discussionMatch = `OPTIONAL MATCH (n)-[:HAS_DISCUSSION]->(d:DiscussionNode)`;

    return `
    ${baseMatch}
    ${optionalMatches}
    ${discussionMatch}`;
  }

  /**
   * Creates a query to validate a parent node exists and meets requirements
   * @param parentType Node type of the parent
   * @param parentIdField Field name for the parent ID
   * @param requiresInclusion Whether parent must have passed inclusion voting
   * @returns Cypher query fragment
   */
  static validateParentNode(
    parentType: string,
    parentIdField: string = 'id',
    requiresInclusion: boolean = true,
  ): string {
    const whereClause = requiresInclusion
      ? '\n    WHERE parent.inclusionNetVotes > 0'
      : '';

    return `
    // Validate parent node exists and meets requirements
    MATCH (parent:${parentType} {${parentIdField}: $parentId})${whereClause}`;
  }

  /**
   * Creates the standard User-CREATED relationship for tracking
   * @param nodeType Type string to store in the relationship (e.g., 'statement', 'answer')
   * @returns Cypher query fragment
   */
  static createUserRelationship(nodeType: string): string {
    return `
    // Create user tracking relationship
    WITH n, $createdBy as userId
    WHERE userId <> 'FreeDictionaryAPI' AND userId <> 'ProjectZeroAI'
    MATCH (u:User {sub: userId})
    CREATE (u)-[:CREATED {
      createdAt: datetime(),
      type: '${nodeType.toLowerCase()}'
    }]->(n)`;
  }

  /**
   * Builds a pagination clause
   * @param offset Number of records to skip
   * @param limit Maximum number of records to return
   * @returns Cypher query fragment
   */
  static paginate(offset?: number, limit?: number): string {
    let clause = '';
    if (offset !== undefined && offset > 0) {
      clause += ` SKIP $offset`;
    }
    if (limit !== undefined && limit > 0) {
      clause += ` LIMIT $limit`;
    }
    return clause;
  }

  /**
   * Builds an ORDER BY clause
   * @param field Field to sort by
   * @param direction Sort direction
   * @param additionalFields Additional sort fields as tiebreakers
   * @returns Cypher query fragment
   */
  static orderBy(
    field: string,
    direction: 'ASC' | 'DESC' = 'DESC',
    additionalFields?: Array<{ field: string; direction: 'ASC' | 'DESC' }>,
  ): string {
    let orderClause = `ORDER BY ${field} ${direction}`;

    if (additionalFields && additionalFields.length > 0) {
      const additional = additionalFields
        .map((f) => `${f.field} ${f.direction}`)
        .join(', ');
      orderClause += `, ${additional}`;
    }

    return orderClause;
  }

  /**
   * Builds a WHERE clause for filtering nodes by voting thresholds
   * @param voteField The vote field to check (e.g., 'inclusionNetVotes')
   * @param threshold Minimum threshold value
   * @param additionalConditions Additional WHERE conditions
   * @returns Cypher query fragment
   */
  static filterByVotes(
    voteField: string = 'inclusionNetVotes',
    threshold: number = 0,
    additionalConditions?: string[],
  ): string {
    const conditions = [`n.${voteField} > ${threshold}`];

    if (additionalConditions && additionalConditions.length > 0) {
      conditions.push(...additionalConditions);
    }

    return `WHERE ${conditions.join(' AND ')}`;
  }

  /**
   * Creates a query fragment for collecting aggregated data
   * @param aggregations Array of aggregation definitions
   * @returns Cypher query fragment
   */
  static collectAggregations(
    aggregations: Array<{
      field: string;
      type: 'COUNT' | 'COLLECT' | 'AVG' | 'SUM' | 'MAX' | 'MIN';
      distinct?: boolean;
      alias: string;
    }>,
  ): string {
    const aggs = aggregations
      .map((agg) => {
        const distinct = agg.distinct ? 'DISTINCT ' : '';
        return `${agg.type}(${distinct}${agg.field}) as ${agg.alias}`;
      })
      .join(',\n       ');

    return `WITH n,\n       ${aggs}`;
  }
}
