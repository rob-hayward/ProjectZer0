# Schema Layer Documentation

**ProjectZer0 Backend - Neo4j Schema Architecture**

Version: 1.0  
Last Updated: 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Philosophy](#architecture-philosophy)
3. [Core Inheritance Hierarchy](#core-inheritance-hierarchy)
4. [Base Schema Classes](#base-schema-classes)
5. [Injected Services](#injected-services)
6. [Concrete Schema Implementations](#concrete-schema-implementations)
7. [Voting System](#voting-system)
8. [Relationship Types](#relationship-types)
9. [Discovery Mechanisms](#discovery-mechanisms)
10. [Query Builder Utilities](#query-builder-utilities)
11. [Validation System](#validation-system)
12. [Business Rules & Constraints](#business-rules--constraints)
13. [Self-Referential Patterns](#self-referential-patterns)
14. [Testing Strategy](#testing-strategy)

---

## Overview

The Neo4j schema layer in ProjectZer0Backend implements a sophisticated object-oriented architecture for managing graph database operations. It provides a standardized, type-safe interface for all node types while maintaining flexibility for node-specific requirements.

**Key Benefits:**
- Eliminates code duplication through inheritance
- Enforces consistent patterns across all schemas
- Provides type safety with full TypeScript support
- Separates concerns (voting, discussions, user tracking)
- Enables rich discovery through relationship networks

**Location:** `ProjectZer0Backend/src/neo4j/schemas/`

---

## Architecture Philosophy

The schema layer is built on five core principles:

### 1. Inheritance-Based Architecture
Common functionality is inherited through a clear hierarchy rather than duplicated across schemas. Base classes provide CRUD operations, voting, validation, and error handling.

### 2. Composition for Cross-Cutting Concerns
Services like voting, discussions, and user tracking are injected as dependencies rather than inherited. This allows any schema to use these services without being tied to a specific inheritance chain.

### 3. Type Safety
Full TypeScript support with proper interfaces ensures compile-time checking and excellent IDE support. Every node has a well-defined data structure.

### 4. Standardization
Consistent patterns across all node types make the codebase predictable and maintainable. New developers can understand any schema by understanding the base classes.

### 5. Separation of Concerns
Each schema handles only its domain logic. Cross-cutting concerns (voting, discussions) are delegated to specialized services.

---

## Core Inheritance Hierarchy

```
BaseNodeSchema (Foundation - CRUD, validation, voting interface)
    ├── TaggedNodeSchema (Adds keyword tagging functionality)
    │   ├── WordSchema (self-tagging - word tags itself)
    │   ├── DefinitionSchema (single-tag - the word being defined)
    │   └── CategorizedNodeSchema (Adds categorization on top of tagging)
    │       ├── StatementSchema (user perspectives)
    │       ├── OpenQuestionSchema (community questions)
    │       ├── AnswerSchema (responses to questions)
    │       ├── QuantitySchema (numerical data collection)
    │       └── EvidenceSchema (external sources)
    │
    └── Special Purpose Schemas (extend BaseNodeSchema directly)
        ├── CategorySchema (self-categorizing, composed of words)
        ├── CommentSchema (threaded discussions)
        ├── DiscussionSchema (discussion containers)
        ├── VoteSchema (voting operations)
        ├── InteractionSchema (user interactions)
        ├── VisibilitySchema (visibility preferences)
        └── UnitPreferenceSchema (unit preferences)
```

**Design Decision: Why CategorySchema extends BaseNodeSchema**

CategorySchema doesn't extend CategorizedNodeSchema because:
- Categories ARE the categorization system (self-referential)
- Categories have unique composition logic (COMPOSED_OF words)
- Categories use self-categorization pattern (like word self-tagging)
- Avoiding circular dependencies in the type system

---

## Base Schema Classes

### 1. BaseNodeSchema

**Location:** `src/neo4j/schemas/base/base-node.schema.ts`

**Purpose:** Foundation for all node schemas, providing core CRUD operations, voting interface, validation, and error handling.

**Key Features:**

```typescript
abstract class BaseNodeSchema<T extends BaseNodeData> {
  // CRUD Operations
  async findById(id: string): Promise<T | null>
  async update(id: string, data: Partial<T>): Promise<T | null>
  async delete(id: string): Promise<{ success: boolean }>
  
  // Voting Operations (delegates to VoteSchema)
  async voteInclusion(id: string, userId: string, isPositive: boolean): Promise<VoteResult>
  async voteContent(id: string, userId: string, isPositive: boolean): Promise<VoteResult>
  async getVoteStatus(id: string, userId: string): Promise<VoteStatus | null>
  async removeVote(id: string, userId: string, kind: VoteKind): Promise<VoteResult>
  async getVotes(id: string): Promise<VoteResult | null>
  
  // Validation Utilities
  protected validateId(id: string, fieldName?: string): void
  protected validateUserId(userId: string): void
  
  // Error Handling
  protected standardError(operation: string, error: Error): Error
  protected getNodeTypeName(): string
  
  // Type Conversion
  protected toNumber(value: any): number
  
  // Abstract Methods (must be implemented by subclasses)
  protected abstract mapNodeFromRecord(record: Record): T
  protected abstract buildUpdateQuery(id: string, data: Partial<T>): { cypher: string; params: any }
  protected abstract supportsContentVoting(): boolean
}
```

**Base Data Interface:**

```typescript
interface BaseNodeData {
  id: string;
  createdBy: string;
  publicCredit: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  
  // Inclusion Voting (all nodes)
  inclusionPositiveVotes?: number;
  inclusionNegativeVotes?: number;
  inclusionNetVotes?: number;
  
  // Content Voting (some nodes)
  contentPositiveVotes?: number;
  contentNegativeVotes?: number;
  contentNetVotes?: number;
  
  // Discussion (most nodes)
  discussionId?: string;
}
```

**Usage Example:**

```typescript
@Injectable()
export class CommentSchema extends BaseNodeSchema<CommentData> {
  protected readonly nodeLabel = 'CommentNode';
  protected readonly idField = 'id';
  
  protected supportsContentVoting(): boolean {
    return true; // Comments have content voting for quality
  }
  
  protected mapNodeFromRecord(record: Record): CommentData {
    const props = record.get('n').properties;
    return {
      id: props.id,
      createdBy: props.createdBy,
      commentText: props.commentText,
      // ... map other properties
      contentPositiveVotes: this.toNumber(props.contentPositiveVotes),
      contentNetVotes: this.toNumber(props.contentNetVotes),
    };
  }
  
  protected buildUpdateQuery(id: string, data: Partial<CommentData>) {
    // Build Cypher query for updating comment
  }
}
```

---

### 2. TaggedNodeSchema

**Location:** `src/neo4j/schemas/base/tagged.schema.ts`

**Purpose:** Adds keyword tagging functionality to nodes, enabling content discovery through shared keywords.

**Extends:** `BaseNodeSchema`

**Key Features:**

```typescript
abstract class TaggedNodeSchema<T extends TaggedNodeData> extends BaseNodeSchema<T> {
  // Configuration
  protected readonly validateKeywordInclusion: boolean = true; // Can be overridden
  
  // Keyword Management
  protected async attachKeywords(nodeId: string, keywords: KeywordWithFrequency[]): Promise<void>
  protected async createSharedTagRelationships(nodeId: string, nodeLabel?: string): Promise<void>
  async getKeywords(nodeId: string): Promise<KeywordWithFrequency[]>
  async updateKeywords(nodeId: string, keywords: KeywordWithFrequency[]): Promise<void>
  
  // Discovery
  async findRelatedByTags(nodeId: string, limit?: number): Promise<RelatedNode[]>
  
  // Query Building
  protected buildTaggedCreateQuery(data: TaggedCreateData): { cypher: string; params: any }
}
```

**Extended Data Interface:**

```typescript
interface TaggedNodeData extends BaseNodeData {
  keywords?: KeywordWithFrequency[];
  relatedNodes?: Array<{
    id: string;
    sharedWord?: string;
    strength?: number;
  }>;
}

interface KeywordWithFrequency {
  word: string;
  frequency: number;
  source: string; // 'ai', 'user', 'self'
}
```

**How It Works:**

1. **TAGGED Relationships:** Connect nodes to WordNodes
   ```cypher
   (Node)-[:TAGGED {frequency: 0.8, source: 'ai'}]->(WordNode)
   ```

2. **SHARED_TAG Relationships:** Connect nodes with common keywords
   ```cypher
   (Node1)-[:SHARED_TAG {word: 'technology', strength: 0.64}]->(Node2)
   ```
   - Strength = product of frequencies
   - Enables weighted similarity calculations

3. **Keyword Validation:** Ensures keywords have passed inclusion threshold (optional)

**Usage Example:**

```typescript
@Injectable()
export class DefinitionSchema extends TaggedNodeSchema<DefinitionData> {
  protected readonly validateKeywordInclusion = false; // Words might not be approved yet
  
  async createDefinition(data: CreateDefinitionData) {
    // Keywords array will have single keyword: the word being defined
    const keywords = [{ word: data.word, frequency: 1, source: 'definition' }];
    
    // Use inherited methods to attach keywords
    await this.attachKeywords(definitionId, keywords);
    await this.createSharedTagRelationships(definitionId);
  }
}
```

---

### 3. CategorizedNodeSchema

**Location:** `src/neo4j/schemas/base/categorized.schema.ts`

**Purpose:** Adds categorization functionality on top of tagging, enabling dual discovery mechanisms.

**Extends:** `TaggedNodeSchema` (inherits all tagging functionality)

**Key Features:**

```typescript
abstract class CategorizedNodeSchema<T extends CategorizedNodeData> extends TaggedNodeSchema<T> {
  // Configuration
  protected readonly maxCategories: number = 3; // Can be overridden
  
  // Category Management
  protected async attachCategories(nodeId: string, categoryIds: string[]): Promise<void>
  protected async createSharedCategoryRelationships(nodeId: string, nodeLabel?: string): Promise<void>
  async getCategories(nodeId: string): Promise<CategoryInfo[]>
  async updateCategories(nodeId: string, categoryIds: string[]): Promise<void>
  
  // Discovery (combining tags and categories)
  async findRelatedByCategories(nodeId: string, limit?: number): Promise<RelatedNode[]>
  async findRelatedByCombined(nodeId: string, limit?: number): Promise<RelatedNode[]>
  
  // Graph Visualization
  async getGraphData(filters: GraphFilters): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }>
  
  // Query Building
  protected buildCategorizedCreateQuery(data: CategorizedCreateData): { cypher: string; params: any }
}
```

**Extended Data Interface:**

```typescript
interface CategorizedNodeData extends TaggedNodeData {
  categories?: Array<{
    id: string;
    name: string;
    description?: string;
    inclusionNetVotes?: number;
  }>;
}
```

**How It Works:**

1. **CATEGORIZED_AS Relationships:** Connect nodes to CategoryNodes
   ```cypher
   (Node)-[:CATEGORIZED_AS]->(CategoryNode)
   ```

2. **SHARED_CATEGORY Relationships:** Connect nodes in same categories
   ```cypher
   (Node1)-[:SHARED_CATEGORY {categoryId: 'cat-123', categoryName: 'Technology', strength: 2}]->(Node2)
   ```
   - Strength = number of shared categories
   - Used for category-based discovery

3. **Combined Discovery:** Uses both SHARED_TAG and SHARED_CATEGORY
   ```typescript
   // Combined strength = tagStrength + (categoryStrength * 2)
   // Categories weighted 2x because they're more curated
   ```

**Usage Example:**

```typescript
@Injectable()
export class StatementSchema extends CategorizedNodeSchema<StatementData> {
  protected readonly maxCategories = 3;
  
  async createStatement(data: CreateStatementData) {
    // Has both keywords (from AI extraction) and categories (user selected)
    const keywords = await this.keywordService.extract(data.statement);
    
    // Use inherited methods
    await this.attachKeywords(statementId, keywords);
    await this.attachCategories(statementId, data.categoryIds);
    await this.createSharedTagRelationships(statementId);
    await this.createSharedCategoryRelationships(statementId);
  }
}
```

---

## Injected Services

These services are injected into schemas as dependencies, not inherited.

### 1. VoteSchema

**Location:** `src/neo4j/schemas/vote.schema.ts`

**Purpose:** Centralized voting logic for all node types.

**Voting Types:**

| Vote Type | Purpose | When Available |
|-----------|---------|----------------|
| **INCLUSION** | Community decides if content should exist | Always (for votable nodes) |
| **CONTENT** | Quality assessment of approved content | Only after inclusion passes |

**Node Voting Configuration:**

```typescript
// src/config/voting.config.ts
export const NODE_VOTING_RULES = {
  WordNode: { hasInclusion: true, hasContent: false },
  DefinitionNode: { hasInclusion: true, hasContent: true },
  StatementNode: { hasInclusion: true, hasContent: true },
  AnswerNode: { hasInclusion: true, hasContent: true },
  QuantityNode: { hasInclusion: true, hasContent: false }, // Uses numeric responses
  OpenQuestionNode: { hasInclusion: true, hasContent: false },
  CommentNode: { hasInclusion: false, hasContent: true }, // Only quality voting
  CategoryNode: { hasInclusion: true, hasContent: false },
  EvidenceNode: { hasInclusion: true, hasContent: false }, // Uses peer review
} as const;
```

**Voting Thresholds:**

```typescript
export const VotingUtils = {
  // Inclusion threshold
  hasPassedInclusion: (netVotes: number): boolean => netVotes > 0,
  
  // Definition creation allowed
  isDefinitionCreationAllowed: (wordInclusionNetVotes: number): boolean => 
    wordInclusionNetVotes > 0,
  
  // Content visibility thresholds
  isContentVisible: (contentNetVotes: number): boolean => contentNetVotes >= -5,
  isCommentVisible: (contentNetVotes: number): boolean => contentNetVotes >= -3,
  
  // Thresholds for UI
  getVotingThresholds: () => ({
    inclusion: { hide: -10, neutral: 0, promoted: 5 },
    content: { hide: -5, neutral: 0, quality: 3 },
    comment: { hide: -3, neutral: 0, helpful: 2 },
  }),
};
```

**Key Methods:**

```typescript
interface VoteSchema {
  async vote(
    nodeLabel: string,
    nodeIdentifier: { [key: string]: string },
    userId: string,
    isPositive: boolean,
    kind: 'INCLUSION' | 'CONTENT'
  ): Promise<VoteResult>
  
  async getVoteStatus(
    nodeLabel: string,
    nodeIdentifier: { [key: string]: string },
    userId: string
  ): Promise<VoteStatus | null>
  
  async removeVote(
    nodeLabel: string,
    nodeIdentifier: { [key: string]: string },
    userId: string,
    kind: 'INCLUSION' | 'CONTENT'
  ): Promise<VoteResult>
}
```

**How Voting Works:**

1. **User votes on a node** → Creates/updates VOTED_ON relationship
   ```cypher
   (User)-[:VOTED_ON {kind: 'INCLUSION', status: 'agree', createdAt: datetime()}]->(Node)
   ```

2. **Vote aggregates stored on node** → Properties updated
   ```cypher
   SET node.inclusionPositiveVotes = 8,
       node.inclusionNegativeVotes = 2,
       node.inclusionNetVotes = 6
   ```

3. **Business rules enforced** → Content voting requires inclusion pass
   ```typescript
   if (kind === 'CONTENT' && node.inclusionNetVotes <= 0) {
     throw new BadRequestException('Must pass inclusion threshold first');
   }
   ```

---

### 2. DiscussionSchema

**Location:** `src/neo4j/schemas/discussion.schema.ts`

**Purpose:** Centralized discussion creation and management for all discussable nodes.

**Key Methods:**

```typescript
interface DiscussionSchema {
  async createDiscussionForNode(options: {
    nodeId: string;
    nodeType: string;
    nodeIdField?: string; // 'id' or 'word'
    createdBy: string;
    initialComment?: string;
  }): Promise<{ discussionId: string; commentId?: string }>
  
  async getDiscussionIdForNode(
    nodeType: string,
    nodeId: string,
    idField?: string
  ): Promise<string | null>
  
  async hasDiscussion(
    nodeType: string,
    nodeId: string,
    idField?: string
  ): Promise<boolean>
  
  async getDiscussionComments(discussionId: string): Promise<Comment[]>
}
```

**How It Works:**

1. **Node creation** → Schema calls DiscussionSchema
   ```typescript
   const discussionResult = await this.discussionSchema.createDiscussionForNode({
     nodeId: statementId,
     nodeType: 'StatementNode',
     nodeIdField: 'id',
     createdBy: userId,
     initialComment: data.initialComment,
   });
   ```

2. **Discussion created** → Relationships established
   ```cypher
   (StatementNode)-[:HAS_DISCUSSION]->(DiscussionNode)
   (DiscussionNode)-[:HAS_COMMENT]->(CommentNode) // if initial comment
   ```

3. **Comments added** → Threaded structure
   ```cypher
   (ParentComment)-[:HAS_REPLY]->(ChildComment)
   ```

**Important:** Discussion creation is NO LONGER in BaseNodeSchema. All schemas must inject and use DiscussionSchema.

---

### 3. UserSchema

**Location:** `src/neo4j/schemas/user.schema.ts`

**Purpose:** Tracks user participation and content creation.

**Supported Node Types:**

```typescript
type UserCreatedNodeType =
  | 'word'
  | 'definition'
  | 'statement'
  | 'answer'
  | 'openquestion'
  | 'quantity'
  | 'category'
  | 'evidence';
```

**Key Methods:**

```typescript
interface UserSchema {
  async addCreatedNode(userId: string, nodeId: string, nodeType: UserCreatedNodeType): Promise<void>
  async getUserCreatedNodes(userId: string, nodeType?: UserCreatedNodeType): Promise<CreatedNode[]>
  async getUserActivityStats(userId: string): Promise<ActivityStats>
  async addParticipation(userId: string, nodeId: string, type: 'voted' | 'commented'): Promise<void>
}
```

**Usage Example:**

```typescript
// After creating a statement
await this.userSchema.addCreatedNode(userId, statementId, 'statement');

// Creates relationship
// (User)-[:CREATED {createdAt: datetime(), type: 'statement'}]->(StatementNode)
```

---

## Concrete Schema Implementations

### 1. WordSchema

**Extends:** `TaggedNodeSchema`

**Characteristics:**
- Uses `'word'` as ID field (not `'id'`)
- Self-tagging pattern: word tags itself
- Inclusion voting only (no content voting)
- Standardizes all words to lowercase
- Has discussions

**Special Behavior:**

```typescript
// Self-tagging during creation
CREATE (w:WordNode {word: 'technology', ...})
CREATE (w)-[:TAGGED {frequency: 1, source: 'self'}]->(w)
```

**Key Methods:**

```typescript
async createWord(data: {
  word: string;
  createdBy: string;
  initialDefinition?: string;
  isApiDefinition?: boolean;
})

async getWord(word: string): Promise<WordNodeData | null>
async getApprovedWords(options): Promise<WordNodeData[]>
async isWordAvailableForDefinitionCreation(word: string): Promise<boolean>
```

**Business Rules:**
- All words lowercase
- Cannot create definitions until word passes inclusion (netVotes > 0)
- Self-tagged for discovery (appears in own keyword searches)

---

### 2. DefinitionSchema

**Extends:** `TaggedNodeSchema`

**Characteristics:**
- Standard `'id'` field
- Single keyword: the word being defined
- Dual voting (inclusion + content)
- Parent word must pass inclusion first
- Has discussions

**Special Behavior:**

```typescript
// Links to parent word
CREATE (d:DefinitionNode {id: uuid(), word: 'technology', ...})
CREATE (d)-[:DEFINES]->(w:WordNode {word: 'technology'})
CREATE (d)-[:TAGGED {frequency: 1, source: 'definition'}]->(w)
```

**Key Methods:**

```typescript
async createDefinition(data: {
  word: string;
  definitionText: string;
  createdBy: string;
  publicCredit?: boolean;
})

async getDefinitionsByWord(word: string): Promise<DefinitionData[]>
async getTopDefinitionForWord(word: string): Promise<DefinitionData | null>
async canCreateDefinitionForWord(word: string): Promise<boolean>
```

**Business Rules:**
- Parent word must have `inclusionNetVotes > 0`
- Content voting only after inclusion passes
- Multiple definitions allowed per word
- Sorted by: inclusion votes DESC, content votes DESC

---

### 3. CategorySchema

**Extends:** `BaseNodeSchema` (special case)

**Characteristics:**
- Standard `'id'` field
- Self-categorizing: category belongs to itself
- Composed of 1-5 approved words
- Hierarchical (PARENT_OF relationships)
- Inclusion voting only
- Has discussions

**Special Behavior:**

```typescript
// Self-categorization during creation
CREATE (c:CategoryNode {id: uuid(), name: 'Technology', ...})
CREATE (c)-[:COMPOSED_OF]->(w1:WordNode)
CREATE (c)-[:COMPOSED_OF]->(w2:WordNode)
CREATE (c)-[:CATEGORIZED_AS]->(c) // Self-categorization
OPTIONAL: CREATE (parent:CategoryNode)-[:PARENT_OF]->(c)
```

**Key Methods:**

```typescript
async createCategory(data: {
  name: string;
  wordIds: string[]; // 1-5 words
  parentCategoryId?: string;
  createdBy: string;
})

async getCategory(id: string): Promise<CategoryData | null>
async getCategoryHierarchy(rootId?: string): Promise<CategoryHierarchy[]>
async getCategoriesForNode(nodeId: string): Promise<CategoryInfo[]>
```

**Business Rules:**
- Must be composed of 1-5 words
- All constituent words must have passed inclusion
- Self-categorization ensures category appears in own filtered datasets
- Content counts exclude self-reference
- Circular parent relationships prevented

**Self-Categorization Pattern:**
```cypher
// Category belongs to itself (like word self-tagging)
(Category)-[:CATEGORIZED_AS]->(Category) [same node]

// But content queries exclude self to maintain accurate counts
MATCH (content)-[:CATEGORIZED_AS]->(cat)
WHERE content.id <> cat.id // Exclude self
```

---

### 4. StatementSchema

**Extends:** `CategorizedNodeSchema`

**Characteristics:**
- Standard `'id'` field
- Multiple keywords (AI-extracted)
- Up to 3 categories
- Dual voting (inclusion + content)
- Can have parent statements (RELATED_TO)
- Has discussions

**Special Behavior:**

```typescript
// Rich discovery network
CREATE (s:StatementNode {id: uuid(), statement: '...', ...})
CREATE (s)-[:TAGGED {frequency: 0.8}]->(w1:WordNode)
CREATE (s)-[:TAGGED {frequency: 0.6}]->(w2:WordNode)
CREATE (s)-[:CATEGORIZED_AS]->(c1:CategoryNode)
CREATE (s)-[:CATEGORIZED_AS]->(c2:CategoryNode)
OPTIONAL: CREATE (s)-[:RELATED_TO {relationshipType: 'child'}]->(parent:StatementNode)
```

**Key Methods:**

```typescript
async createStatement(data: {
  statement: string;
  keywords: KeywordWithFrequency[];
  categoryIds?: string[];
  parentStatementId?: string;
  createdBy: string;
})

async getStatement(id: string): Promise<StatementData | null>
async getDirectlyRelatedStatements(id: string): Promise<StatementData[]>
async getStatementNetwork(options): Promise<GraphData>
```

**Business Rules:**
- Keywords validated (must have passed inclusion)
- Categories validated (must have passed inclusion, max 3)
- Content voting only after inclusion passes
- SHARED_TAG and SHARED_CATEGORY for discovery

---

### 5. OpenQuestionSchema

**Extends:** `CategorizedNodeSchema`

**Characteristics:**
- Standard `'id'` field
- Multiple keywords
- Up to 3 categories
- Inclusion voting only (no content voting)
- Auto-normalizes questions (adds '?')
- Has discussions

**Special Behavior:**

```typescript
// Normalizes question text
normalizeQuestionText(text: string): string {
  const trimmed = text.trim();
  return trimmed.endsWith('?') ? trimmed : trimmed + '?';
}
```

**Key Methods:**

```typescript
async createOpenQuestion(data: {
  questionText: string;
  keywords: KeywordWithFrequency[];
  categoryIds?: string[];
  createdBy: string;
})

async getOpenQuestion(id: string): Promise<OpenQuestionData | null>
async canReceiveAnswers(questionId: string): Promise<boolean>
```

**Business Rules:**
- Questions auto-formatted with '?'
- Answers only allowed after inclusion passes
- No content voting (inclusion determines if question is valid)

---

### 6. AnswerSchema

**Extends:** `CategorizedNodeSchema`

**Characteristics:**
- Standard `'id'` field
- Multiple keywords
- Up to 3 categories
- Dual voting (inclusion + content)
- Parent question must pass inclusion
- Has discussions

**Special Behavior:**

```typescript
// Links to parent question
CREATE (a:AnswerNode {id: uuid(), answerText: '...', ...})
CREATE (a)-[:ANSWERS]->(q:OpenQuestionNode)
```

**Key Methods:**

```typescript
async createAnswer(data: {
  answerText: string;
  parentQuestionId: string;
  keywords: KeywordWithFrequency[];
  categoryIds?: string[];
  createdBy: string;
})

async getAnswersByQuestion(questionId: string): Promise<AnswerData[]>
async getTopAnswerForQuestion(questionId: string): Promise<AnswerData | null>
```

**Business Rules:**
- Parent question must have `inclusionNetVotes > 0`
- Content voting only after inclusion passes
- Sorted by: content votes DESC (quality), then inclusion votes DESC

---

### 7. QuantitySchema

**Extends:** `CategorizedNodeSchema`

**Characteristics:**
- Standard `'id'` field
- Multiple keywords
- Up to 3 categories
- Inclusion voting only (uses numeric responses instead of content voting)
- Requires unit category and default unit
- Statistical aggregation
- Has discussions

**Special Behavior:**

```typescript
// Numeric responses instead of content voting
(User)-[:RESPONSE_TO {
  value: 42,
  unitId: 'kg',
  normalizedValue: 42000, // converted to base unit (grams)
  createdAt: datetime()
}]->(QuantityNode)
```

**Key Methods:**

```typescript
async createQuantityNode(data: {
  question: string;
  unitCategoryId: string;
  defaultUnitId: string;
  keywords: KeywordWithFrequency[];
  categoryIds?: string[];
  createdBy: string;
})

async submitResponse(data: {
  userId: string;
  quantityNodeId: string;
  value: number;
  unitId: string;
}): Promise<QuantityNodeResponse>

async getStatistics(quantityNodeId: string): Promise<QuantityNodeStats>
```

**Statistics Calculated:**

```typescript
interface QuantityNodeStats {
  responseCount: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  standardDeviation: number;
  percentiles: { [key: number]: number }; // 10, 25, 50, 75, 90, 95, 99
  distributionCurve: number[][]; // For visualization
  responses?: QuantityNodeResponse[];
}
```

**Business Rules:**
- Unit must be valid for specified category
- Responses only allowed after inclusion passes
- Values normalized to base unit for comparison
- Statistics recalculated on each response change

---

### 8. EvidenceSchema

**Extends:** `CategorizedNodeSchema`

**Characteristics:**
- Standard `'id'` field
- Multiple keywords
- Up to 3 categories
- Inclusion voting only (uses peer review instead of content voting)
- Links to parent node (Statement, Answer, or Quantity)
- 3-dimensional peer review system
- Has discussions

**Evidence Types:**

```typescript
type EvidenceType =
  | 'academic_paper'
  | 'news_article'
  | 'government_report'
  | 'dataset'
  | 'book'
  | 'website'
  | 'legal_document'
  | 'expert_testimony'
  | 'survey_study'
  | 'meta_analysis'
  | 'other';
```

**Special Behavior:**

```typescript
// Links to parent content
CREATE (e:EvidenceNode {
  id: uuid(),
  title: '...',
  url: '...',
  evidenceType: 'academic_paper',
  parentNodeId: 'statement-123',
  parentNodeType: 'StatementNode',
  ...
})
CREATE (e)-[:EVIDENCE_FOR]->(parent)

// Peer review (3-dimensional scoring)
(User)-[:PEER_REVIEWED]->(PeerReviewNode)-[:PEER_REVIEWED]->(EvidenceNode)
```

**Peer Review System:**

```typescript
interface EvidencePeerReview {
  qualityScore: number;        // 1-5: methodological rigor
  independenceScore: number;   // 1-5: source independence/bias
  relevanceScore: number;      // 1-5: relevance to claim
  comments?: string;
}

// Aggregate scores stored on node
interface EvidenceData {
  avgQualityScore: number;
  avgIndependenceScore: number;
  avgRelevanceScore: number;
  overallScore: number; // weighted average
  reviewCount: number;
}
```

**Key Methods:**

```typescript
async createEvidence(data: {
  title: string;
  url: string;
  evidenceType: EvidenceType;
  parentNodeId: string;
  parentNodeType: 'StatementNode' | 'AnswerNode' | 'QuantityNode';
  authors?: string[];
  keywords: KeywordWithFrequency[];
  categoryIds?: string[];
  createdBy: string;
})

```typescript
async submitPeerReview(data: {
  evidenceId: string;
  userId: string;
  qualityScore: number;      // 1-5
  independenceScore: number; // 1-5
  relevanceScore: number;    // 1-5
  comments?: string;
}): Promise<EvidencePeerReview>

async getPeerReviewStats(evidenceId: string): Promise<PeerReviewStats>
async getTopRatedEvidence(limit?: number, type?: EvidenceType): Promise<EvidenceData[]>
async getEvidenceForNode(nodeId: string, nodeType: string): Promise<EvidenceData[]>
```

**Business Rules:**
- Parent node must have `inclusionNetVotes > 0`
- Peer review only allowed after inclusion passes
- One review per user per evidence
- Overall score = (quality * 0.333 + independence * 0.333 + relevance * 0.334)
- Scores recalculated on each review submission

---

### 9. CommentSchema

**Extends:** `BaseNodeSchema`

**Characteristics:**
- Standard `'id'` field
- Content voting only (no inclusion voting - all comments included)
- Hierarchical structure (parent comments)
- Part of discussion system
- Time-limited editing (15 minutes)
- No tagging or categorization

**Special Behavior:**

```typescript
// Threaded comment structure
CREATE (c:CommentNode {id: uuid(), commentText: '...', discussionId: '...', parentCommentId: null})
CREATE (d:DiscussionNode)-[:HAS_COMMENT]->(c)
OPTIONAL: CREATE (parent:CommentNode)-[:HAS_REPLY]->(c)
```

**Key Methods:**

```typescript
async createComment(data: {
  id: string;
  createdBy: string;
  discussionId: string;
  commentText: string;
  parentCommentId?: string;
})

async getCommentsByDiscussionId(discussionId: string): Promise<CommentData[]>
async getCommentHierarchy(discussionId: string): Promise<CommentThread[]>
async canEditComment(commentId: string, userId: string): Promise<boolean>
```

**Business Rules:**
- All comments included by default (no inclusion voting)
- Content voting for quality assessment
- Visibility threshold: `contentNetVotes >= -3` (stricter than other content)
- Edit window: 15 minutes from creation
- Only original author can edit

---

### 10. DiscussionSchema

**Extends:** `BaseNodeSchema`

**Characteristics:**
- Standard `'id'` field
- No voting (discussions are containers)
- Links to associated node
- Contains comments
- No tagging or categorization

**Special Behavior:**

```typescript
// Links to parent node
CREATE (d:DiscussionNode {
  id: uuid(),
  associatedNodeId: 'statement-123',
  associatedNodeType: 'StatementNode',
  createdBy: 'user-123'
})
CREATE (parent:StatementNode)-[:HAS_DISCUSSION]->(d)
```

**Key Methods:**

```typescript
async createDiscussionForNode(options: {
  nodeId: string;
  nodeType: string;
  nodeIdField?: string;
  createdBy: string;
  initialComment?: string;
}): Promise<{ discussionId: string; commentId?: string }>

async getDiscussionComments(discussionId: string): Promise<Comment[]>
async getDiscussionCommentCount(discussionId: string): Promise<number>
```

---

## Voting System

### Voting Architecture

**Two-Dimensional Voting:**

1. **Inclusion Voting** - "Should this content exist?"
   - Determines if content is valid/appropriate
   - Required for most node types
   - Threshold: `netVotes > 0`

2. **Content Voting** - "Is this content high quality?"
   - Assesses quality of approved content
   - Only available after inclusion passes
   - Threshold for visibility: `netVotes >= -5`

**Vote Storage:**

```typescript
// On the node (aggregate)
interface VoteFields {
  inclusionPositiveVotes: number;
  inclusionNegativeVotes: number;
  inclusionNetVotes: number;
  contentPositiveVotes: number;
  contentNegativeVotes: number;
  contentNetVotes: number;
}

// On the relationship (individual)
(User)-[:VOTED_ON {
  kind: 'INCLUSION' | 'CONTENT',
  status: 'agree' | 'disagree',
  createdAt: datetime()
}]->(Node)
```

### Voting Rules by Node Type

| Node Type | Inclusion | Content | Alternative System |
|-----------|-----------|---------|-------------------|
| Word | ✓ | ✗ | - |
| Definition | ✓ | ✓ | - |
| Statement | ✓ | ✓ | - |
| Answer | ✓ | ✓ | - |
| OpenQuestion | ✓ | ✗ | - |
| Category | ✓ | ✗ | - |
| Quantity | ✓ | ✗ | Numeric responses |
| Evidence | ✓ | ✗ | Peer review (3D) |
| Comment | ✗ | ✓ | - |
| Discussion | ✗ | ✗ | - |

### Business Logic Examples

**Definition Creation:**
```typescript
// Parent word must pass inclusion
const word = await this.wordSchema.findById(wordId);
if (!VotingUtils.hasPassedInclusion(word.inclusionNetVotes)) {
  throw new BadRequestException('Word must pass inclusion threshold');
}
```

**Content Voting:**
```typescript
// Node must pass inclusion first
const node = await this.findById(nodeId);
if (!VotingUtils.hasPassedInclusion(node.inclusionNetVotes)) {
  throw new BadRequestException('Must pass inclusion threshold before content voting');
}
```

**Answer Creation:**
```typescript
// Parent question must pass inclusion
const question = await this.questionSchema.findById(questionId);
if (!VotingUtils.hasPassedInclusion(question.inclusionNetVotes)) {
  throw new BadRequestException('Question must pass inclusion threshold');
}
```

---

## Relationship Types

### Content Relationships

**Purpose:** Connect content nodes to create knowledge graph

```cypher
// Definition → Word
(DefinitionNode)-[:DEFINES]->(WordNode)

// Answer → Question
(AnswerNode)-[:ANSWERS]->(OpenQuestionNode)

// Statement → Statement (optional threading)
(StatementNode)-[:RELATED_TO {relationshipType: 'child'}]->(StatementNode)

// Evidence → Content
(EvidenceNode)-[:EVIDENCE_FOR]->(StatementNode | AnswerNode | QuantityNode)

// Category → Words (composition)
(CategoryNode)-[:COMPOSED_OF]->(WordNode)

// Category → Category (hierarchy)
(CategoryNode)-[:PARENT_OF]->(CategoryNode)
```

### Tagging Relationships

**Purpose:** Enable keyword-based discovery

```cypher
// Basic tagging (any tagged node → word)
(Node)-[:TAGGED {
  frequency: 0.8,        // 0.0-1.0: keyword relevance
  source: 'ai',          // 'ai', 'user', 'self', 'definition'
  createdAt: datetime()
}]->(WordNode)

// Discovery through shared tags
(Node1)-[:SHARED_TAG {
  word: 'technology',
  strength: 0.64,        // product of frequencies
  createdAt: datetime()
}]->(Node2)
```

**Strength Calculation:**
```typescript
// If Node1 has 'technology' with frequency 0.8
// And Node2 has 'technology' with frequency 0.8
// SHARED_TAG strength = 0.8 * 0.8 = 0.64
```

### Categorization Relationships

**Purpose:** Enable category-based organization and discovery

```cypher
// Basic categorization
(Node)-[:CATEGORIZED_AS {
  createdAt: datetime()
}]->(CategoryNode)

// Discovery through shared categories
(Node1)-[:SHARED_CATEGORY {
  categoryId: 'cat-123',
  categoryName: 'Technology',
  strength: 2,           // count of shared categories
  createdAt: datetime()
}]->(Node2)
```

**Strength Calculation:**
```typescript
// If Node1 is in categories: [Tech, Science, Innovation]
// And Node2 is in categories: [Tech, Science]
// SHARED_CATEGORY strength = 2 (number of shared categories)
```

### User Relationships

**Purpose:** Track user participation and contributions

```cypher
// Content creation
(User)-[:CREATED {
  createdAt: datetime(),
  type: 'statement' | 'word' | 'definition' | ...
}]->(Node)

// Voting
(User)-[:VOTED_ON {
  kind: 'INCLUSION' | 'CONTENT',
  status: 'agree' | 'disagree',
  createdAt: datetime()
}]->(Node)

// Commenting
(User)-[:COMMENTED {
  createdAt: datetime(),
  commentId: 'comment-123'
}]->(Node)

// Quantity responses
(User)-[:RESPONSE_TO {
  id: uuid(),
  value: 42,
  unitId: 'kg',
  normalizedValue: 42000,
  createdAt: datetime()
}]->(QuantityNode)

// Peer review
(User)-[:PEER_REVIEWED]->(PeerReviewNode)-[:PEER_REVIEWED]->(EvidenceNode)
```

### Discussion Relationships

**Purpose:** Enable threaded discussions on content

```cypher
// Node → Discussion
(Node)-[:HAS_DISCUSSION]->(DiscussionNode)

// Discussion → Comments
(DiscussionNode)-[:HAS_COMMENT]->(CommentNode)

// Comment → Reply (threading)
(CommentNode)-[:HAS_REPLY]->(CommentNode)
```

---

## Discovery Mechanisms

### Tag-Based Discovery

**How it works:**

1. **Nodes are tagged** with keywords
   ```cypher
   (Statement1)-[:TAGGED {frequency: 0.8}]->(WordNode:technology)
   (Statement2)-[:TAGGED {frequency: 0.6}]->(WordNode:technology)
   ```

2. **SHARED_TAG relationships created** automatically
   ```cypher
   (Statement1)-[:SHARED_TAG {word: 'technology', strength: 0.48}]->(Statement2)
   ```

3. **Discovery query:**
   ```cypher
   MATCH (s:StatementNode {id: $id})-[st:SHARED_TAG]->(related:StatementNode)
   WHERE related.inclusionNetVotes > 0
   WITH related, sum(st.strength) as totalStrength
   ORDER BY totalStrength DESC
   LIMIT 10
   RETURN related
   ```

**Usage in code:**
```typescript
const related = await this.statementSchema.findRelatedByTags(statementId, 10);
```

### Category-Based Discovery

**How it works:**

1. **Nodes are categorized**
   ```cypher
   (Statement1)-[:CATEGORIZED_AS]->(Category:Technology)
   (Statement2)-[:CATEGORIZED_AS]->(Category:Technology)
   (Statement2)-[:CATEGORIZED_AS]->(Category:Science)
   ```

2. **SHARED_CATEGORY relationships created** automatically
   ```cypher
   (Statement1)-[:SHARED_CATEGORY {
     categoryId: 'tech-123',
     categoryName: 'Technology',
     strength: 1
   }]->(Statement2)
   ```

3. **Discovery query:**
   ```cypher
   MATCH (s:StatementNode {id: $id})-[sc:SHARED_CATEGORY]->(related:StatementNode)
   WHERE related.inclusionNetVotes > 0
   WITH related, sum(sc.strength) as totalStrength
   ORDER BY totalStrength DESC
   LIMIT 10
   RETURN related
   ```

**Usage in code:**
```typescript
const related = await this.statementSchema.findRelatedByCategories(statementId, 10);
```

### Combined Discovery

**How it works:**

Combines both tag and category similarity with category weighted 2x (more curated):

```typescript
async findRelatedByCombined(nodeId: string, limit: number = 10) {
  const query = `
    MATCH (n:${this.nodeLabel} {${this.idField}: $nodeId})
    OPTIONAL MATCH (n)-[st:SHARED_TAG]->(related)
    OPTIONAL MATCH (n)-[sc:SHARED_CATEGORY]->(related)
    WHERE related.inclusionNetVotes > 0
    WITH related,
         COALESCE(sum(st.strength), 0) as tagStrength,
         COALESCE(sum(sc.strength), 0) as categoryStrength
    WHERE tagStrength > 0 OR categoryStrength > 0
    WITH related, tagStrength, categoryStrength,
         (tagStrength + categoryStrength * 2) as combinedStrength
    ORDER BY combinedStrength DESC
    LIMIT $limit
    RETURN related
  `;
}
```

**Usage in code:**
```typescript
const related = await this.statementSchema.findRelatedByCombined(statementId, 10);
```

---

## Query Builder Utilities

### Neo4jQueryBuilder

**Location:** `src/neo4j/schemas/utils/query-builder.util.ts`

**Purpose:** Standardized Cypher query construction

**Key Methods:**

```typescript
class Neo4jQueryBuilder {
  // Node creation with voting fields
  static createNodeWithVoting(
    label: string,
    propNames: string[],
    hasContentVoting: boolean
  ): string
  
  // Attach categories with validation
  static attachCategories(maxCategories: number): string
  
  // Attach keywords with optional validation
  static attachKeywords(validateInclusion: boolean): string
  
  // Create discovery relationships
  static createSharedTags(nodeLabel?: string): string
  static createSharedCategories(nodeLabel?: string): string
  
  // Delete relationships
  static deleteRelationships(types: string[]): string
  
  // Parent validation
  static validateParentNode(
    parentType: string,
    parentIdField: string,
    requiresInclusion: boolean
  ): string
  
  // User tracking
  static createUserRelationship(nodeType: string): string
  
  // Query building
  static paginate(offset?: number, limit?: number): string
  static orderBy(field: string, direction: 'ASC' | 'DESC'): string
  static filterByVotes(voteField: string, threshold: number): string
}
```

**Usage Example:**

```typescript
const query = `
  ${Neo4jQueryBuilder.validateParentNode('WordNode', 'word', true)}
  ${Neo4jQueryBuilder.createNodeWithVoting('DefinitionNode', ['id', 'definitionText'], true)}
  ${Neo4jQueryBuilder.attachKeywords(true)}
  ${Neo4jQueryBuilder.createSharedTags('DefinitionNode')}
  ${Neo4jQueryBuilder.createUserRelationship('definition')}
  RETURN n
`;
```

---

## Validation System

### NodeValidators

**Location:** `src/neo4j/schemas/utils/validators.util.ts`

**Purpose:** Centralized validation logic

**Key Methods:**

```typescript
class NodeValidators {
  // Text validation
  static validateText(text: string, fieldName: string, maxLength?: number): void
  
  // ID validation
  static validateId(id: string, fieldName?: string): void
  static validateUserId(userId: string): void
  
  // Voting threshold validation
  static validateInclusionThreshold(netVotes: number, action: string, nodeType?: string): void
  
  // Category validation
  static validateCategoryCount(categories: string[], max?: number): void
  
  // Format validation
  static validateEmail(email: string): void
  static validateUrl(url: string, fieldName?: string): void
  static validatePattern(value: string, pattern: RegExp, fieldName: string, description: string): void
  
  // Range validation
  static validateNumberRange(value: number, min: number, max: number, fieldName: string): void
  
  // Enum validation
  static validateEnum<T>(value: T, validValues: T[], fieldName: string): void
  
  // Composite validation
  static validateNodeCreation(data: NodeCreationData): void
  static validateUpdateData(updateData: Record<string, any>, fieldName?: string): void
  static validatePagination(offset?: number, limit?: number, maxLimit?: number): void
}
```

**Usage Example:**

```typescript
async createStatement(data: CreateStatementData) {
  // Validate inputs
  NodeValidators.validateText(data.statement, 'Statement text', TEXT_LIMITS.MAX_STATEMENT_LENGTH);
  NodeValidators.validateUserId(data.createdBy);
  NodeValidators.validateCategoryCount(data.categoryIds, 3);
  
  // Create statement...
}
```

---

## Business Rules & Constraints

### Global Constraints

**Text Limits:**
```typescript
export const TEXT_LIMITS = {
  MAX_WORD_LENGTH: 50,
  MAX_DEFINITION_LENGTH: 500,
  MAX_STATEMENT_LENGTH: 1000,
  MAX_ANSWER_LENGTH: 2000,
  MAX_QUESTION_LENGTH: 500,
  MAX_COMMENT_LENGTH: 1000,
  MAX_CATEGORY_NAME_LENGTH: 100,
  MAX_CATEGORY_DESCRIPTION_LENGTH: 500,
};
```

**Category Limits:**
- Minimum: 1 category
- Maximum: 3 categories (most nodes)
- Categories must have `inclusionNetVotes > 0`

**Word Composition (Categories):**
- Minimum: 1 word
- Maximum: 5 words
- All words must have `inclusionNetVotes > 0`

### Node-Specific Constraints

**DefinitionNode:**
- Parent word must exist
- Parent word must have `inclusionNetVotes > 0`
- Content voting only after own `inclusionNetVotes > 0`

**AnswerNode:**
- Parent question must exist
- Parent question must have `inclusionNetVotes > 0`
- Content voting only after own `inclusionNetVotes > 0`

**QuantityNode:**
- Must specify valid unit category
- Must specify valid default unit
- Unit must belong to specified category
- Responses only after `inclusionNetVotes > 0`

**EvidenceNode:**
- Parent node must exist (Statement, Answer, or Quantity)
- Parent node must have `inclusionNetVotes > 0`
- URL must be valid format
- Peer review only after `inclusionNetVotes > 0`
- One peer review per user per evidence

**CommentNode:**
- Edit window: 15 minutes from creation
- Only original author can edit
- Visibility threshold: `contentNetVotes >= -3`

**CategoryNode:**
- Circular parent relationships prevented
- Self-categorization automatic
- Content count excludes self

### Voting Thresholds

**Inclusion:**
- Pass threshold: `netVotes > 0`
- Hide threshold: `netVotes < -10`

**Content:**
- Visibility threshold: `netVotes >= -5`
- Quality threshold: `netVotes >= 3`

**Comments:**
- Visibility threshold: `netVotes >= -3` (stricter)
- Helpful threshold: `netVotes >= 2`

---

## Self-Referential Patterns

### WordNode Self-Tagging

**Pattern:**
```cypher
CREATE (w:WordNode {word: 'technology', ...})
CREATE (w)-[:TAGGED {frequency: 1, source: 'self'}]->(w)
```

**Purpose:**
- Ensures word appears in its own keyword-filtered datasets
- Consistent discovery mechanism
- Single self-reference (no circular issues)

**Implementation:**
```typescript
// WordSchema.createWord()
query += `
  CREATE (w)-[:TAGGED {
    frequency: 1,
    source: 'self',
    createdAt: datetime()
  }]->(w)
`;
```

### CategoryNode Self-Categorization

**Pattern:**
```cypher
CREATE (c:CategoryNode {id: uuid(), name: 'Technology', ...})
CREATE (c)-[:CATEGORIZED_AS]->(c)
```

**Purpose:**
- Ensures category appears in its own category-filtered datasets
- Parallel to word self-tagging
- Categories always have exactly one category: themselves

**Implementation:**
```typescript
// CategorySchema.createCategory()
query += `
  // Self-categorization: category belongs to itself
  WITH c, parent
  CREATE (c)-[:CATEGORIZED_AS]->(c)
`;
```

**Content Count Exclusion:**
```cypher
// Exclude self from content statistics
MATCH (content)-[:CATEGORIZED_AS]->(c)
WHERE content.id <> c.id  // Exclude self-categorization
RETURN count(content) as contentCount
```

**Safety Guarantees:**
- Only self-reference (no cross-category categorization)
- Content counts exclude self
- Discovery queries have `WHERE other.id <> n.id` protection
- No circular traversal risk (different from PARENT_OF hierarchy)

---

## Testing Strategy

### Unit Testing

**Test Coverage Requirements:**
- All abstract methods implemented
- Voting logic with business rules
- Input validation
- Error handling
- Neo4j Integer conversion

**Example Test Structure:**

```typescript
describe('StatementSchema', () => {
  describe('BaseNodeSchema Integration', () => {
    it('should support content voting');
    it('should map Neo4j records correctly');
    it('should build update queries');
  });
  
  describe('Inherited Methods', () => {
    it('should find by id');
    it('should update node');
    it('should delete node');
  });
  
  describe('Voting Integration', () => {
    it('should vote on inclusion');
    it('should vote on content after inclusion passes');
    it('should reject content voting before inclusion');
    it('should get vote status');
    it('should remove vote');
  });
  
  describe('Statement-Specific Methods', () => {
    it('should create statement with keywords');
    it('should create statement with categories');
    it('should validate parent statement');
    it('should get related statements');
  });
});
```

### Integration Testing

**Test Database Operations:**
- Real Neo4j transactions
- Relationship creation
- Discovery mechanisms
- Statistical aggregation (Quantity)
- Peer review scoring (Evidence)

### E2E Testing

**Test Complete Workflows:**
1. Create word → Vote inclusion → Create definition → Vote content
2. Create question → Vote inclusion → Create answer → Vote content
3. Create statement → Discover related → Vote → Update
4. Create quantity → Submit responses → View statistics
5. Create evidence → Submit peer reviews → View aggregated scores

---

## Additional Resources

**Related Documentation:**
- [API Documentation](api.md) - REST endpoint reference
- [Voting System](voting-system.md) - Detailed voting mechanics
- [Discovery Algorithms](discovery.md) - Tag and category similarity
- [Contributing Guide](../CONTRIBUTING.md) - How to add new schemas

**Code Locations:**
- Base schemas: `src/neo4j/schemas/base/`
- Concrete schemas: `src/neo4j/schemas/`
- Utilities: `src/neo4j/schemas/utils/`
- Tests: `src/neo4j/schemas/__tests__/`

---

**Document Version:** 1.0  
**Last Updated:** 2025  
**Maintainer:** ProjectZer0 Team