# Phase 4: Universal Graph Service Refactor - Complete Work Brief

**ProjectZer0 Backend - Universal Graph View System**  
**Version:** 3.0  
**Last Updated:** 2025  
**Status:** Ready for Refactoring

---

## 📊 **Current Architecture Status**

### **✅ Complete & Production Ready (Phases 1-3)**

**Phase 1-2: Schema & Service Layers** ✅ COMPLETE
- All 8 content node schemas refactored and tested
- All 8 content node services implemented
- 1,151 tests passing across all nodes
- Comprehensive `schema-layer.md` documentation
- Comprehensive `service-layer.md` documentation

**Phase 3: Controller Layer** ✅ COMPLETE
- All 10 controllers implemented (8 content + Comment + Discussion)
- HTTP layer fully documented (`controller-layer.md`)
- JWT authentication patterns standardized
- DTO validation patterns established

---

## 🎯 **Phase 4 Overview**

**Objective:** Refactor Universal Graph Service to align with the new architecture and support all 5 primary content node types.

**Scope:**
- Update Universal Graph Service to use refactored schemas
- Add Evidence node support
- Implement advanced filtering (ANY/ALL modes)
- Implement proper content vote fallback logic
- Add comprehensive user context enrichment
- Optimize performance (<500ms target)
- Create comprehensive tests

**Timeline:** 10-12 days

---

## 📋 **Current State Analysis**

### **What Exists**

**Location:** `src/nodes/universal/`

#### **universal-graph.service.ts** - Partially Implemented
**✅ Strengths:**
- Basic structure with Neo4jService, VoteSchema, VisibilityService
- Supports 5 node types (openquestion, statement, answer, quantity, category)
- Basic keyword filtering (include/exclude boolean)
- Basic category filtering (include/exclude boolean)
- Simple sorting (netVotes, chronological, participants)
- Relationship loading (shared_keyword, related_to, answers, shared_category, categorized_as)
- User context enrichment framework

**❌ Gaps:**
- NOT using refactored schemas (should inject StatementSchema, OpenQuestionSchema, etc.)
- Missing EvidenceSchema and Evidence node support
- Missing keyword filter ANY/ALL modes
- Missing category filter ANY/ALL modes
- Missing user interaction filtering (created/interacted modes)
- No content vote fallback logic (OpenQuestion/Quantity/Evidence should fall back to inclusion)
- No evidence_for relationship type
- Default dataset includes Category (should only be Statement/OpenQuestion/Answer/Quantity/Evidence)
- Placeholder methods (addSharedKeywordRelationships, etc.) not fully implemented

#### **universal-graph.controller.ts** - Partially Implemented
**✅ Strengths:**
- JWT authentication
- Basic query parameter parsing
- Supports all 5 node types in DTO

**❌ Gaps:**
- Missing proper parameter handling for ANY/ALL modes
- Missing evidence_for in relationship types
- No validation for incompatible filter combinations

#### **universal-graph.module.ts** - Basic Implementation
**✅ Strengths:**
- Imports Neo4jModule, VoteModule, VisibilityModule, CategoryModule
- Exports UniversalGraphService

**❌ Gaps:**
- Should import all content node modules (Statement, OpenQuestion, Answer, Quantity, Evidence)
- Should inject all content node schemas, not query Neo4j directly

---

## 🏗️ **Required Architecture Changes**

### **1. Dependency Injection (CRITICAL)**

**Current (Incorrect):**
```typescript
constructor(
  private readonly neo4jService: Neo4jService,
  private readonly voteSchema: VoteSchema,
  private readonly visibilityService: VisibilityService,
  private readonly categoryService: CategoryService,
) {}
```

**Required (Following Established Patterns):**
```typescript
constructor(
  private readonly neo4jService: Neo4jService,
  private readonly statementSchema: StatementSchema,      // ← NEW
  private readonly openQuestionSchema: OpenQuestionSchema, // ← NEW
  private readonly answerSchema: AnswerSchema,            // ← NEW
  private readonly quantitySchema: QuantitySchema,        // ← NEW
  private readonly evidenceSchema: EvidenceSchema,        // ← NEW
  private readonly voteSchema: VoteSchema,
  private readonly visibilityService: VisibilityService,
  private readonly categoryService: CategoryService,
) {}
```

**Rationale:** Universal Graph Service should use the same schemas other services use, not query Neo4j directly. This ensures consistency, leverages schema business logic, and maintains architectural patterns.

---

### **2. Module Configuration**

**Update universal-graph.module.ts:**
```typescript
@Module({
  imports: [
    Neo4jModule,
    VoteModule,
    VisibilityModule,
    CategoryModule,
    StatementModule,      // ← NEW
    OpenQuestionModule,   // ← NEW
    AnswerModule,         // ← NEW
    QuantityModule,       // ← NEW
    EvidenceModule,       // ← NEW
  ],
  controllers: [UniversalGraphController],
  providers: [
    UniversalGraphService,
    VoteSchema,
  ],
  exports: [UniversalGraphService],
})
export class UniversalGraphModule {}
```

---

## 🎯 **Requirements Specification**

### **1. DEFAULT DATASET**

**On Initial Load (No Filters):**
```typescript
{
  nodeTypes: ['statement', 'openquestion', 'answer', 'quantity', 'evidence'],
  sort: { by: 'netInclusionVotes', direction: 'desc' },
  limit: 200,
  offset: 0,
  includeRelationships: true,
  relationshipTypes: ['shared_keyword', 'shared_category', 'related_to', 'answers', 'evidence_for']
}
```

**WHY THESE NODES:**
- All extend CategorizedNodeSchema (support keywords + categories)
- All have inclusionNetVotes (unifying field for sorting)
- Primary "content" nodes users create and interact with
- Mixed quality systems acknowledged:
  - Statement, Answer: Dual voting (inclusion + content)
  - OpenQuestion, Quantity, Evidence: Inclusion + alternative systems

**EXCLUDED FROM DEFAULT:**
- Word - Load on-demand only
- Definition - Load on-demand only
- Category - Load on-demand only (unless filtered)
- Comment - Load on-demand only
- Discussion - Load on-demand only

---

### **2. FILTER REQUIREMENTS**

#### **2.1 Node Type Filter**

```typescript
interface NodeTypeFilter {
  types: Array<'statement' | 'openquestion' | 'answer' | 'quantity' | 'evidence'>;
  include: boolean;  // true = only these types, false = exclude these types
}
```

**CRITICAL: Answer-Question Coupling**

Answers CANNOT be fetched without their parent questions. When `answer` is selected, **automatically include** `openquestion` in the query.

**Implementation:**
```typescript
if (nodeTypeFilter.types.includes('answer')) {
  if (!nodeTypeFilter.types.includes('openquestion')) {
    nodeTypeFilter.types.push('openquestion');
  }
}
```

**UI:** Single checkbox labeled "Open Questions & Answers"

---

#### **2.2 Keyword Filter**

```typescript
interface KeywordFilter {
  words: string[];       // Array of keyword strings
  mode: 'any' | 'all';   // ANY = has at least one, ALL = has all keywords
  include: boolean;      // true = include matching, false = exclude matching
}
```

**Examples:**
- `{words: ['ai', 'ethics'], mode: 'any', include: true}` → Nodes with ai OR ethics
- `{words: ['ai', 'ethics'], mode: 'all', include: true}` → Nodes with ai AND ethics
- `{words: ['ai'], mode: 'any', include: false}` → Nodes WITHOUT ai

**Cypher Implementation:**
```cypher
// ANY mode (include)
EXISTS {
  MATCH (node)-[:TAGGED]->(w:WordNode)
  WHERE w.word IN $keywords
}

// ALL mode (include)
ALL(keyword IN $keywords WHERE EXISTS(
  (node)-[:TAGGED]->(:WordNode {word: keyword})
))

// Exclude: Wrap with NOT
```

---

#### **2.3 Category Filter**

```typescript
interface CategoryFilter {
  categoryIds: string[]; // Array of category IDs
  mode: 'any' | 'all';   // ANY = in at least one, ALL = in all categories
  include: boolean;      // true = include matching, false = exclude matching
}
```

**Examples:**
- `{categoryIds: ['tech', 'ethics'], mode: 'any', include: true}` → Nodes in tech OR ethics
- `{categoryIds: ['tech', 'ethics'], mode: 'all', include: true}` → Nodes in tech AND ethics
- `{categoryIds: ['tech'], mode: 'any', include: false}` → Nodes NOT in tech

**Cypher Implementation:**
```cypher
// ANY mode (include)
EXISTS {
  MATCH (node)-[:CATEGORIZED_AS]->(c:CategoryNode)
  WHERE c.id IN $categoryIds AND c.inclusionNetVotes > 0
}

// ALL mode (include)
ALL(catId IN $categoryIds WHERE EXISTS(
  (node)-[:CATEGORIZED_AS]->(:CategoryNode {id: catId, inclusionNetVotes > 0})
))

// Exclude: Wrap with NOT
```

---

#### **2.4 User Filter**

```typescript
interface UserFilter {
  userId: string;
  mode: 'all' | 'created' | 'interacted';
}
```

**Modes:**
- `'all'`: All nodes (no filtering) - default
- `'created'`: Only nodes created by this user (`node.createdBy = userId`)
- `'interacted'`: Nodes user has voted on or commented on

**Cypher for 'interacted':**
```cypher
WHERE EXISTS {
  MATCH (u:User {sub: $userId})-[r]->(node)
  WHERE type(r) IN ['VOTED_ON', 'COMMENTED']
}
```

---

### **3. SORT REQUIREMENTS**

#### **3.1 Available Sort Options**

| Sort Option | Works On | Fallback | Direction |
|-------------|----------|----------|-----------|
| **netInclusionVotes** | All | N/A | ASC/DESC |
| **totalInclusionVotes** | All | N/A | ASC/DESC |
| **dateCreated** | All | N/A | ASC/DESC |
| **netContentVotes** | Statement, Answer | inclusionNetVotes | ASC/DESC |
| **totalContentVotes** | Statement, Answer | totalInclusionVotes | ASC/DESC |
| **categoryOverlap** | All (requires category filter) | N/A | DESC only |
| **participantCount** | All | N/A | ASC/DESC |

#### **3.2 Content Vote Fallback Logic**

**WHY:** OpenQuestion, Quantity, and Evidence don't have content voting. They use alternative quality systems.

**Implementation:**
```typescript
// For netContentVotes sort
const sortValue = 
  (node.type === 'statement' || node.type === 'answer')
    ? node.contentNetVotes
    : node.inclusionNetVotes;  // ← Fallback

// For totalContentVotes sort
const sortValue = 
  (node.type === 'statement' || node.type === 'answer')
    ? (node.contentPositiveVotes + node.contentNegativeVotes)
    : (node.inclusionPositiveVotes + node.inclusionNegativeVotes);  // ← Fallback
```

**Cypher (using COALESCE):**
```cypher
ORDER BY COALESCE(n.contentNetVotes, n.inclusionNetVotes) DESC
```

---

### **4. RELATIONSHIP REQUIREMENTS**

#### **4.1 Available Relationship Types**

| Type | Source → Target | Purpose | Strength Calculation |
|------|----------------|---------|----------------------|
| **shared_keyword** | Any → Any | Topic similarity | Product of tag frequencies |
| **shared_category** | Any → Any | Organizational similarity | Count of shared categories |
| **related_to** | Statement → Statement | User-created threads | N/A (1.0) |
| **answers** | Answer → OpenQuestion | Q&A hierarchy | N/A (1.0) |
| **evidence_for** | Evidence → Stmt/Ans/Qty | Claim verification | N/A (1.0) |
| **categorized_as** | Any → Category | Category membership | N/A (1.0) |

#### **4.2 Relationship Consolidation**

**Problem:** Multiple TAGGED relationships between same two nodes (different keywords)

**Solution:** Consolidate into single relationship with metadata

**Before (Multiple):**
```
(A)-[TAGGED:keyword1, strength:0.8]->(B)
(A)-[TAGGED:keyword2, strength:0.6]->(B)
```

**After (Consolidated):**
```
{
  id: 'A-shared_keyword-B',
  source: 'A',
  target: 'B',
  type: 'shared_keyword',
  strength: 1.4,  // Sum of strengths
  metadata: {
    sharedWords: ['keyword1', 'keyword2'],
    strengthsByKeyword: { keyword1: 0.8, keyword2: 0.6 },
    averageStrength: 0.7
  }
}
```

#### **4.3 Cross-Node References**

**Problem:** Answer node's parent question may not be in result set

**Solution:** Always include parent info in metadata

```typescript
// For Answer nodes
metadata: {
  parentQuestion: {
    nodeId: 'question-123',
    questionText: 'What is AI?'  // ← Always include
  }
}

// For Evidence nodes
metadata: {
  parentNode: {
    nodeId: 'stmt-456',
    nodeType: 'statement',
    content: 'AI will transform society'  // ← Always include
  }
}
```

---

## 🔧 **Implementation Plan**

### **Phase 4.1: Schema Integration (Days 1-3)**

#### **Task 1.1: Update Constructor & Module**

**File:** `universal-graph.service.ts`

```typescript
// Add to constructor
constructor(
  private readonly neo4jService: Neo4jService,
  private readonly statementSchema: StatementSchema,
  private readonly openQuestionSchema: OpenQuestionSchema,
  private readonly answerSchema: AnswerSchema,
  private readonly quantitySchema: QuantitySchema,
  private readonly evidenceSchema: EvidenceSchema,
  private readonly voteSchema: VoteSchema,
  private readonly visibilityService: VisibilityService,
  private readonly categoryService: CategoryService,
) {}
```

**File:** `universal-graph.module.ts`

```typescript
imports: [
  Neo4jModule,
  VoteModule,
  VisibilityModule,
  CategoryModule,
  StatementModule,
  OpenQuestionModule,
  AnswerModule,
  QuantityModule,
  EvidenceModule,
]
```

#### **Task 1.2: Implement Schema-Based Node Fetching**

**Replace direct Neo4j queries with schema method calls:**

```typescript
private async fetchStatements(filters: FilterOptions): Promise<UniversalNode[]> {
  // Use StatementSchema methods instead of direct Neo4j queries
  const statements = await this.statementSchema.findAll({
    // ... build query options from filters
  });
  
  return statements.map(stmt => this.transformStatementToUniversalNode(stmt));
}

private async fetchOpenQuestions(filters: FilterOptions): Promise<UniversalNode[]> {
  const questions = await this.openQuestionSchema.findAll({
    // ... build query options from filters
  });
  
  return questions.map(q => this.transformOpenQuestionToUniversalNode(q));
}

// Repeat for Answer, Quantity, Evidence
```

#### **Task 1.3: Create Transformation Methods**

```typescript
private transformStatementToUniversalNode(stmt: StatementData): UniversalNode {
  return {
    id: stmt.id,
    type: 'statement',
    content: stmt.statement,
    createdAt: stmt.createdAt,
    updatedAt: stmt.updatedAt,
    createdBy: stmt.createdBy,
    publicCredit: stmt.publicCredit,
    metadata: {
      votes: {
        inclusion: {
          positive: stmt.inclusionPositiveVotes,
          negative: stmt.inclusionNegativeVotes,
          net: stmt.inclusionNetVotes
        },
        content: {
          positive: stmt.contentPositiveVotes,
          negative: stmt.contentNegativeVotes,
          net: stmt.contentNetVotes
        }
      },
      keywords: stmt.keywords || [],
      categories: stmt.categories || [],
      discussionId: stmt.discussionId
    }
  };
}

// Similar transformers for OpenQuestion, Answer, Quantity, Evidence
```

---

### **Phase 4.2: Advanced Filtering (Days 4-5)**

#### **Task 2.1: Implement ANY/ALL Keyword Filter**

```typescript
private buildKeywordFilter(
  keywordFilter: KeywordFilter,
  nodeAlias: string
): { condition: string; params: any } {
  if (!keywordFilter?.words || keywordFilter.words.length === 0) {
    return { condition: 'true', params: {} };
  }
  
  let condition: string;
  
  if (keywordFilter.mode === 'any') {
    condition = `EXISTS {
      MATCH (${nodeAlias})-[:TAGGED]->(w:WordNode)
      WHERE w.word IN $keywords
    }`;
  } else {  // mode === 'all'
    condition = `ALL(keyword IN $keywords WHERE EXISTS(
      (${nodeAlias})-[:TAGGED]->(:WordNode {word: keyword})
    ))`;
  }
  
  if (!keywordFilter.include) {
    condition = `NOT (${condition})`;
  }
  
  return {
    condition,
    params: { keywords: keywordFilter.words }
  };
}
```

#### **Task 2.2: Implement ANY/ALL Category Filter**

```typescript
private buildCategoryFilter(
  categoryFilter: CategoryFilter,
  nodeAlias: string
): { condition: string; params: any } {
  if (!categoryFilter?.categoryIds || categoryFilter.categoryIds.length === 0) {
    return { condition: 'true', params: {} };
  }
  
  let condition: string;
  
  if (categoryFilter.mode === 'any') {
    condition = `EXISTS {
      MATCH (${nodeAlias})-[:CATEGORIZED_AS]->(c:CategoryNode)
      WHERE c.id IN $categoryIds AND c.inclusionNetVotes > 0
    }`;
  } else {  // mode === 'all'
    condition = `ALL(catId IN $categoryIds WHERE EXISTS(
      (${nodeAlias})-[:CATEGORIZED_AS]->(:CategoryNode {id: catId})
    ))`;
  }
  
  if (!categoryFilter.include) {
    condition = `NOT (${condition})`;
  }
  
  return {
    condition,
    params: { categoryIds: categoryFilter.categoryIds }
  };
}
```

#### **Task 2.3: Implement User Interaction Filter**

```typescript
private buildUserFilter(
  userFilter: UserFilter,
  nodeAlias: string
): { condition: string; params: any } {
  if (!userFilter || userFilter.mode === 'all') {
    return { condition: 'true', params: {} };
  }
  
  if (userFilter.mode === 'created') {
    return {
      condition: `${nodeAlias}.createdBy = $userId`,
      params: { userId: userFilter.userId }
    };
  }
  
  // mode === 'interacted'
  return {
    condition: `EXISTS {
      MATCH (u:User {sub: $userId})-[r]->(${nodeAlias})
      WHERE type(r) IN ['VOTED_ON', 'COMMENTED']
    }`,
    params: { userId: userFilter.userId }
  };
}
```

---

### **Phase 4.3: Content Vote Fallback & Sorting (Day 6)**

#### **Task 3.1: Implement Sort with Fallback**

```typescript
private applySorting(nodes: UniversalNode[], sort: SortOptions): UniversalNode[] {
  nodes.sort((a, b) => {
    let aValue: number;
    let bValue: number;
    
    switch (sort.by) {
      case 'netInclusionVotes':
        aValue = a.metadata.votes.inclusion.net;
        bValue = b.metadata.votes.inclusion.net;
        break;
        
      case 'totalInclusionVotes':
        aValue = a.metadata.votes.inclusion.positive + a.metadata.votes.inclusion.negative;
        bValue = b.metadata.votes.inclusion.positive + b.metadata.votes.inclusion.negative;
        break;
        
      case 'dateCreated':
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
        break;
        
      case 'netContentVotes':
        // Fallback logic
        aValue = (a.type === 'statement' || a.type === 'answer')
          ? a.metadata.votes.content.net
          : a.metadata.votes.inclusion.net;
        bValue = (b.type === 'statement' || b.type === 'answer')
          ? b.metadata.votes.content.net
          : b.metadata.votes.inclusion.net;
        break;
        
      case 'totalContentVotes':
        // Fallback logic
        aValue = (a.type === 'statement' || a.type === 'answer')
          ? (a.metadata.votes.content.positive + a.metadata.votes.content.negative)
          : (a.metadata.votes.inclusion.positive + a.metadata.votes.inclusion.negative);
        bValue = (b.type === 'statement' || b.type === 'answer')
          ? (b.metadata.votes.content.positive + b.metadata.votes.content.negative)
          : (b.metadata.votes.inclusion.positive + b.metadata.votes.inclusion.negative);
        break;
        
      case 'participantCount':
        aValue = a.participantCount || 0;
        bValue = b.participantCount || 0;
        break;
        
      default:
        aValue = a.metadata.votes.inclusion.net;
        bValue = b.metadata.votes.inclusion.net;
    }
    
    const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    return sort.direction === 'asc' ? comparison : -comparison;
  });
  
  return nodes;
}
```

---

### **Phase 4.4: Evidence Support (Days 7-8)**

#### **Task 4.1: Implement fetchEvidence Method**

```typescript
private async fetchEvidence(filters: FilterOptions): Promise<UniversalNode[]> {
  const evidence = await this.evidenceSchema.findAll({
    // ... apply filters
  });
  
  return evidence.map(evid => this.transformEvidenceToUniversalNode(evid));
}

private transformEvidenceToUniversalNode(evid: EvidenceData): UniversalNode {
  return {
    id: evid.id,
    type: 'evidence',
    content: evid.title,  // Use title as primary content
    createdAt: evid.createdAt,
    updatedAt: evid.updatedAt,
    createdBy: evid.createdBy,
    publicCredit: evid.publicCredit,
    metadata: {
      votes: {
        inclusion: {
          positive: evid.inclusionPositiveVotes,
          negative: evid.inclusionNegativeVotes,
          net: evid.inclusionNetVotes
        },
        // No content voting for evidence
      },
      keywords: evid.keywords || [],
      categories: evid.categories || [],
      discussionId: evid.discussionId,
      // Evidence-specific metadata
      url: evid.url,
      evidenceType: evid.evidenceType,
      authors: evid.authors,
      publicationDate: evid.publicationDate,
      peerReview: {
        qualityAvg: evid.qualityScoreAvg,
        independenceAvg: evid.independenceScoreAvg,
        relevanceAvg: evid.relevanceScoreAvg,
        overallScore: evid.overallScore,
        reviewCount: evid.reviewCount
      },
      parentNode: {
        nodeId: evid.parentNodeId,
        nodeType: evid.parentNodeType,
        // Include parent content (fetch if needed)
      }
    }
  };
}
```

#### **Task 4.2: Implement evidence_for Relationships**

```typescript
private async fetchEvidenceForRelationships(
  nodeIds: string[]
): Promise<UniversalRelationship[]> {
  const query = `
    MATCH (e:EvidenceNode)-[:EVIDENCE_FOR]->(parent)
    WHERE e.id IN $nodeIds AND parent.id IN $nodeIds
    RETURN e.id as source, parent.id as target, 
           e.evidenceType as evidenceType, e.overallScore as score
  `;
  
  const result = await this.neo4jService.read(query, { nodeIds });
  
  return result.records.map(record => ({
    id: `${record.get('source')}-evidence_for-${record.get('target')}`,
    source: record.get('source'),
    target: record.get('target'),
    type: 'evidence_for',
    strength: this.toNumber(record.get('score')) / 5,  // Normalize 0-1
    metadata: {
      evidenceType: record.get('evidenceType')
    }
  }));
}
```

---

### **Phase 4.5: User Context Enrichment (Day 9)**

#### **Task 5.1: Batch Vote Status Enrichment**

```typescript
private async enrichWithUserVotes(
  nodes: UniversalNode[],
  userId: string
): Promise<UniversalNode[]> {
  // Batch fetch all vote statuses
  const votePromises = nodes.map(node =>
    this.voteSchema.getVoteStatus(node.id, userId)
  );
  
  const voteStatuses = await Promise.all(votePromises);
  
  // Enrich nodes
  nodes.forEach((node, index) => {
    node.metadata.userVoteStatus = voteStatuses[index] || null;
  });
  
  return nodes;
}
```

#### **Task 5.2: Batch Visibility Preference Enrichment**

```typescript
private async enrichWithVisibilityPreferences(
  nodes: UniversalNode[],
  userId: string
): Promise<UniversalNode[]> {
  // Batch fetch all visibility preferences
  const visibilityPromises = nodes.map(node =>
    this.visibilityService.getUserVisibilityPreference(userId, node.id)
  );
  
  const visibilityPrefs = await Promise.all(visibilityPromises);
  
  // Enrich nodes
  nodes.forEach((node, index) => {
    node.metadata.userVisibilityPreference = visibilityPrefs[index] || null;
  });
  
  return nodes;
}
```

---

### **Phase 4.6: Testing (Days 10-11) - Continued**

#### **Unit Tests (Continued)**

```typescript
  describe('Relationships', () => {
    it('should include evidence_for relationships', async () => {
      const result = await service.getUniversalNodes({
        relationshipTypes: ['evidence_for']
      });
      const evidenceRels = result.relationships.filter(r => r.type === 'evidence_for');
      expect(evidenceRels.length).toBeGreaterThan(0);
      evidenceRels.forEach(rel => {
        expect(rel.metadata.evidenceType).toBeDefined();
      });
    });
    
    it('should consolidate shared keyword relationships', async () => {
      const result = await service.getUniversalNodes({
        relationshipTypes: ['shared_keyword']
      });
      // Verify no duplicate relationships between same node pairs
      const pairKeys = new Set();
      result.relationships.forEach(rel => {
        const key = `${rel.source}-${rel.target}`;
        expect(pairKeys.has(key)).toBe(false);
        pairKeys.add(key);
      });
    });
    
    it('should only create relationships between nodes in result set', async () => {
      const result = await service.getUniversalNodes({
        nodeTypeFilter: { types: ['statement'], include: true }
      });
      const nodeIds = new Set(result.nodes.map(n => n.id));
      result.relationships.forEach(rel => {
        expect(nodeIds.has(rel.source)).toBe(true);
        expect(nodeIds.has(rel.target)).toBe(true);
      });
    });
  });
  
  describe('User Context Enrichment', () => {
    it('should add user vote status to all nodes', async () => {
      const result = await service.getUniversalNodes({
        requestingUserId: 'user-123'
      });
      result.nodes.forEach(node => {
        expect(node.metadata.userVoteStatus).toBeDefined();
      });
    });
    
    it('should add visibility preferences to all nodes', async () => {
      const result = await service.getUniversalNodes({
        requestingUserId: 'user-123'
      });
      result.nodes.forEach(node => {
        expect(node.metadata.userVisibilityPreference).toBeDefined();
      });
    });
  });
  
  describe('Cross-Node References', () => {
    it('should include parent question info in Answer metadata', async () => {
      const result = await service.getUniversalNodes({
        nodeTypeFilter: { types: ['answer'], include: true }
      });
      const answerNodes = result.nodes.filter(n => n.type === 'answer');
      answerNodes.forEach(ans => {
        expect(ans.metadata.parentQuestion).toBeDefined();
        expect(ans.metadata.parentQuestion.nodeId).toBeDefined();
        expect(ans.metadata.parentQuestion.questionText).toBeDefined();
      });
    });
    
    it('should include parent node info in Evidence metadata', async () => {
      const result = await service.getUniversalNodes({
        nodeTypeFilter: { types: ['evidence'], include: true }
      });
      const evidNodes = result.nodes.filter(n => n.type === 'evidence');
      evidNodes.forEach(evid => {
        expect(evid.metadata.parentNode).toBeDefined();
        expect(evid.metadata.parentNode.nodeId).toBeDefined();
        expect(evid.metadata.parentNode.nodeType).toBeDefined();
      });
    });
  });
});
```

#### **Integration Tests**

```typescript
describe('UniversalGraphService Integration', () => {
  beforeAll(async () => {
    // Seed test database with known data
    await seedTestData({
      statements: 20,
      openQuestions: 15,
      answers: 25,
      quantities: 10,
      evidence: 12
    });
  });
  
  afterAll(async () => {
    await cleanupTestData();
  });
  
  describe('Full Query Workflows', () => {
    it('should return default dataset correctly', async () => {
      const result = await service.getUniversalNodes({});
      
      expect(result.nodes.length).toBeLessThanOrEqual(200);
      expect(result.pagination.total).toBeGreaterThan(0);
      
      // Verify node types
      const nodeTypes = new Set(result.nodes.map(n => n.type));
      expect(nodeTypes.size).toBeGreaterThanOrEqual(1);
      
      // Verify sorted by inclusion votes DESC
      for (let i = 0; i < result.nodes.length - 1; i++) {
        expect(result.nodes[i].metadata.votes.inclusion.net)
          .toBeGreaterThanOrEqual(result.nodes[i + 1].metadata.votes.inclusion.net);
      }
    });
    
    it('should apply multiple filters correctly', async () => {
      const result = await service.getUniversalNodes({
        keywordFilter: { words: ['ai', 'ethics'], mode: 'all', include: true },
        categoryFilter: { categoryIds: ['tech'], mode: 'any', include: true },
        sort: { by: 'dateCreated', direction: 'desc' }
      });
      
      result.nodes.forEach(node => {
        // Verify keywords
        const keywords = node.metadata.keywords.map(k => k.word);
        expect(keywords).toContain('ai');
        expect(keywords).toContain('ethics');
        
        // Verify category
        const categories = node.metadata.categories.map(c => c.id);
        expect(categories).toContain('tech');
      });
      
      // Verify date sorting
      for (let i = 0; i < result.nodes.length - 1; i++) {
        expect(new Date(result.nodes[i].createdAt).getTime())
          .toBeGreaterThanOrEqual(new Date(result.nodes[i + 1].createdAt).getTime());
      }
    });
    
    it('should handle user interaction filter', async () => {
      const userId = 'test-user-123';
      
      const result = await service.getUniversalNodes({
        userFilter: { userId, mode: 'interacted' }
      });
      
      // Verify all nodes have user interaction
      // (This requires database state where user has voted/commented)
      expect(result.nodes.length).toBeGreaterThan(0);
    });
  });
  
  describe('Performance', () => {
    it('should complete typical query in <500ms', async () => {
      const start = Date.now();
      
      await service.getUniversalNodes({
        keywordFilter: { words: ['ai'], mode: 'any', include: true },
        sort: { by: 'netInclusionVotes', direction: 'desc' },
        pagination: { limit: 200, offset: 0 },
        includeRelationships: true
      });
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(500);
    });
    
    it('should handle large result sets efficiently', async () => {
      const start = Date.now();
      
      const result = await service.getUniversalNodes({
        pagination: { limit: 1000, offset: 0 }
      });
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2000);
      expect(result.nodes.length).toBeLessThanOrEqual(1000);
    });
  });
  
  describe('Evidence Integration', () => {
    it('should fetch evidence nodes with peer review data', async () => {
      const result = await service.getUniversalNodes({
        nodeTypeFilter: { types: ['evidence'], include: true }
      });
      
      const evidNodes = result.nodes.filter(n => n.type === 'evidence');
      expect(evidNodes.length).toBeGreaterThan(0);
      
      evidNodes.forEach(evid => {
        expect(evid.metadata.url).toBeDefined();
        expect(evid.metadata.evidenceType).toBeDefined();
        expect(evid.metadata.peerReview).toBeDefined();
        expect(evid.metadata.peerReview.overallScore).toBeGreaterThanOrEqual(0);
        expect(evid.metadata.peerReview.overallScore).toBeLessThanOrEqual(5);
      });
    });
    
    it('should create evidence_for relationships', async () => {
      const result = await service.getUniversalNodes({
        nodeTypeFilter: { types: ['evidence', 'statement'], include: true },
        relationshipTypes: ['evidence_for']
      });
      
      const evidenceRels = result.relationships.filter(r => r.type === 'evidence_for');
      expect(evidenceRels.length).toBeGreaterThan(0);
      
      evidenceRels.forEach(rel => {
        // Source should be evidence
        const sourceNode = result.nodes.find(n => n.id === rel.source);
        expect(sourceNode.type).toBe('evidence');
        
        // Target should be statement, answer, or quantity
        const targetNode = result.nodes.find(n => n.id === rel.target);
        expect(['statement', 'answer', 'quantity']).toContain(targetNode.type);
      });
    });
  });
});
```

#### **E2E Tests**

```typescript
describe('Universal Graph API E2E', () => {
  let app: INestApplication;
  let authToken: string;
  
  beforeAll(async () => {
    // Setup test app and get auth token
    app = await createTestApp();
    authToken = await getTestAuthToken();
  });
  
  afterAll(async () => {
    await app.close();
  });
  
  describe('GET /graph/universal/nodes', () => {
    it('should return default dataset', async () => {
      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.nodes).toBeDefined();
      expect(response.body.relationships).toBeDefined();
      expect(response.body.pagination).toBeDefined();
      expect(response.body.performance).toBeDefined();
      
      // Verify node types
      const nodeTypes = new Set(response.body.nodes.map(n => n.type));
      expect(nodeTypes.size).toBeGreaterThanOrEqual(1);
      ['statement', 'openquestion', 'answer', 'quantity', 'evidence'].forEach(type => {
        // At least one of these types should be present
      });
    });
    
    it('should filter by node types', async () => {
      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({
          'nodeTypes[]': ['statement', 'evidence'],
          nodeTypesInclude: 'true'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      response.body.nodes.forEach(node => {
        expect(['statement', 'evidence']).toContain(node.type);
      });
    });
    
    it('should filter by keywords with ANY mode', async () => {
      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({
          'keywords[]': ['ai', 'ethics'],
          keywordMode: 'any',
          keywordsInclude: 'true'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      response.body.nodes.forEach(node => {
        const keywords = node.metadata.keywords.map(k => k.word);
        expect(keywords.some(k => ['ai', 'ethics'].includes(k))).toBe(true);
      });
    });
    
    it('should filter by keywords with ALL mode', async () => {
      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({
          'keywords[]': ['ai', 'ethics'],
          keywordMode: 'all',
          keywordsInclude: 'true'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      response.body.nodes.forEach(node => {
        const keywords = node.metadata.keywords.map(k => k.word);
        expect(keywords).toContain('ai');
        expect(keywords).toContain('ethics');
      });
    });
    
    it('should sort by content votes with fallback', async () => {
      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({
          sortBy: 'netContentVotes',
          sortDirection: 'desc'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      // Verify descending order (with fallback logic)
      for (let i = 0; i < response.body.nodes.length - 1; i++) {
        const curr = response.body.nodes[i];
        const next = response.body.nodes[i + 1];
        
        const currValue = (curr.type === 'statement' || curr.type === 'answer')
          ? curr.metadata.votes.content.net
          : curr.metadata.votes.inclusion.net;
        
        const nextValue = (next.type === 'statement' || next.type === 'answer')
          ? next.metadata.votes.content.net
          : next.metadata.votes.inclusion.net;
        
        expect(currValue).toBeGreaterThanOrEqual(nextValue);
      }
    });
    
    it('should include evidence_for relationships', async () => {
      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({
          'nodeTypes[]': ['evidence', 'statement'],
          includeRelationships: 'true',
          'relationshipTypes[]': 'evidence_for'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      const evidenceRels = response.body.relationships.filter(r => r.type === 'evidence_for');
      expect(evidenceRels.length).toBeGreaterThan(0);
    });
    
    it('should enforce answer-question coupling', async () => {
      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({
          'nodeTypes[]': 'answer',
          nodeTypesInclude: 'true'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      // Should also include openquestion nodes
      const nodeTypes = new Set(response.body.nodes.map(n => n.type));
      expect(nodeTypes).toContain('openquestion');
    });
    
    it('should include user context when authenticated', async () => {
      const response = await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      // Should have userVoteStatus for nodes user has voted on
      const nodesWithVoteStatus = response.body.nodes.filter(n => 
        n.metadata.userVoteStatus !== null
      );
      // At least some nodes should have vote status if user has voted
    });
    
    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .expect(401);
    });
    
    it('should return 400 for invalid sort option', async () => {
      await request(app.getHttpServer())
        .get('/graph/universal/nodes')
        .query({ sortBy: 'invalid' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });
  
  describe('Helper Endpoints', () => {
    it('GET /graph/universal/filters/keywords should return keyword list', async () => {
      const response = await request(app.getHttpServer())
        .get('/graph/universal/filters/keywords')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(Array.isArray(response.body.keywords)).toBe(true);
      expect(response.body.keywords.length).toBeGreaterThan(0);
      
      response.body.keywords.forEach(kw => {
        expect(kw.word).toBeDefined();
        expect(kw.usageCount).toBeGreaterThan(0);
      });
    });
    
    it('GET /graph/universal/filters/categories should return category list', async () => {
      const response = await request(app.getHttpServer())
        .get('/graph/universal/filters/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(Array.isArray(response.body.categories)).toBe(true);
      expect(response.body.categories.length).toBeGreaterThan(0);
      
      response.body.categories.forEach(cat => {
        expect(cat.id).toBeDefined();
        expect(cat.name).toBeDefined();
        expect(cat.usageCount).toBeGreaterThan(0);
      });
    });
  });
});
```

---

### **Phase 4.7: Optimization & Documentation (Day 12)**

#### **Task 7.1: Performance Optimization**

**A. Neo4j Indexes**

Ensure these indexes exist:

```cypher
// Node indexes
CREATE INDEX statement_inclusion_votes IF NOT EXISTS FOR (s:StatementNode) ON (s.inclusionNetVotes);
CREATE INDEX openquestion_inclusion_votes IF NOT EXISTS FOR (q:OpenQuestionNode) ON (q.inclusionNetVotes);
CREATE INDEX answer_inclusion_votes IF NOT EXISTS FOR (a:AnswerNode) ON (a.inclusionNetVotes);
CREATE INDEX quantity_inclusion_votes IF NOT EXISTS FOR (q:QuantityNode) ON (q.inclusionNetVotes);
CREATE INDEX evidence_inclusion_votes IF NOT EXISTS FOR (e:EvidenceNode) ON (e.inclusionNetVotes);

// Content vote indexes
CREATE INDEX statement_content_votes IF NOT EXISTS FOR (s:StatementNode) ON (s.contentNetVotes);
CREATE INDEX answer_content_votes IF NOT EXISTS FOR (a:AnswerNode) ON (a.contentNetVotes);

// Date indexes
CREATE INDEX statement_created IF NOT EXISTS FOR (s:StatementNode) ON (s.createdAt);
CREATE INDEX openquestion_created IF NOT EXISTS FOR (q:OpenQuestionNode) ON (q.createdAt);
CREATE INDEX answer_created IF NOT EXISTS FOR (a:AnswerNode) ON (a.createdAt);
CREATE INDEX quantity_created IF NOT EXISTS FOR (q:QuantityNode) ON (q.createdAt);
CREATE INDEX evidence_created IF NOT EXISTS FOR (e:EvidenceNode) ON (e.createdAt);

// Creator indexes
CREATE INDEX statement_creator IF NOT EXISTS FOR (s:StatementNode) ON (s.createdBy);
CREATE INDEX openquestion_creator IF NOT EXISTS FOR (q:OpenQuestionNode) ON (q.createdBy);
CREATE INDEX answer_creator IF NOT EXISTS FOR (a:AnswerNode) ON (a.createdBy);
CREATE INDEX quantity_creator IF NOT EXISTS FOR (q:QuantityNode) ON (q.createdBy);
CREATE INDEX evidence_creator IF NOT EXISTS FOR (e:EvidenceNode) ON (e.createdBy);

// Relationship indexes
CREATE INDEX tagged_word IF NOT EXISTS FOR ()-[r:TAGGED]-() ON (r.word);
CREATE INDEX categorized_as IF NOT EXISTS FOR ()-[r:CATEGORIZED_AS]-() ON (r.categoryId);
CREATE INDEX evidence_for IF NOT EXISTS FOR ()-[r:EVIDENCE_FOR]-() ON (r.parentNodeId);
```

**B. Query Profiling**

```typescript
// Use Neo4j PROFILE to analyze queries
const profilingEnabled = process.env.NODE_ENV === 'development';

if (profilingEnabled) {
  const profiledQuery = `PROFILE ${query}`;
  const result = await this.neo4jService.read(profiledQuery, params);
  this.logger.debug(`Query profile: ${JSON.stringify(result.summary.profile)}`);
}
```

**C. Caching Strategy**

```typescript
// Cache keyword list (refreshes every 5 minutes)
private keywordListCache: { data: any; timestamp: number } | null = null;
private readonly CACHE_TTL = 5 * 60 * 1000;  // 5 minutes

async getAvailableKeywords(): Promise<KeywordInfo[]> {
  const now = Date.now();
  
  if (this.keywordListCache && now - this.keywordListCache.timestamp < this.CACHE_TTL) {
    return this.keywordListCache.data;
  }
  
  const keywords = await this.fetchKeywordsFromDatabase();
  this.keywordListCache = { data: keywords, timestamp: now };
  
  return keywords;
}

// Similar caching for categories
```

#### **Task 7.2: Update Controller**

**File:** `universal-graph.controller.ts`

```typescript
@Controller('graph/universal')
@UseGuards(JwtAuthGuard)
export class UniversalGraphController {
  private readonly logger = new Logger(UniversalGraphController.name);

  constructor(private readonly universalGraphService: UniversalGraphService) {}

  @Get('nodes')
  async getUniversalNodes(
    @Query() query: any,
    @Request() req: any,
  ): Promise<UniversalGraphResponse> {
    this.logger.log('Received request for universal nodes');
    
    // Parse query parameters
    const options: UniversalGraphOptions = {
      // Node type filter
      nodeTypeFilter: query.nodeTypes ? {
        types: Array.isArray(query.nodeTypes) ? query.nodeTypes : [query.nodeTypes],
        include: query.nodeTypesInclude === 'true'
      } : undefined,
      
      // Keyword filter
      keywordFilter: query.keywords ? {
        words: Array.isArray(query.keywords) ? query.keywords : [query.keywords],
        mode: query.keywordMode || 'any',
        include: query.keywordsInclude !== 'false'
      } : undefined,
      
      // Category filter
      categoryFilter: query.categories ? {
        categoryIds: Array.isArray(query.categories) ? query.categories : [query.categories],
        mode: query.categoryMode || 'any',
        include: query.categoriesInclude !== 'false'
      } : undefined,
      
      // User filter
      userFilter: query.userFilter ? {
        userId: req.user.sub,
        mode: query.userFilter
      } : undefined,
      
      // Sort
      sort: {
        by: query.sortBy || 'netInclusionVotes',
        direction: query.sortDirection || 'desc'
      },
      
      // Pagination
      pagination: {
        limit: parseInt(query.limit) || 200,
        offset: parseInt(query.offset) || 0
      },
      
      // Relationships
      includeRelationships: query.includeRelationships === 'true',
      relationshipTypes: query.relationshipTypes 
        ? (Array.isArray(query.relationshipTypes) ? query.relationshipTypes : [query.relationshipTypes])
        : undefined,
      
      // User context
      requestingUserId: req.user?.sub
    };
    
    // Validate
    this.validateOptions(options);
    
    // Call service
    return await this.universalGraphService.getUniversalNodes(options);
  }
  
  @Get('filters/keywords')
  async getAvailableKeywords(): Promise<{ keywords: KeywordInfo[] }> {
    const keywords = await this.universalGraphService.getAvailableKeywords();
    return { keywords };
  }
  
  @Get('filters/categories')
  async getAvailableCategories(): Promise<{ categories: CategoryInfo[] }> {
    const categories = await this.universalGraphService.getAvailableCategories();
    return { categories };
  }
  
  private validateOptions(options: UniversalGraphOptions): void {
    // Validate sort
    const validSorts = [
      'netInclusionVotes', 'totalInclusionVotes', 'dateCreated',
      'netContentVotes', 'totalContentVotes', 'categoryOverlap', 'participantCount'
    ];
    if (!validSorts.includes(options.sort.by)) {
      throw new BadRequestException(`Invalid sort option: ${options.sort.by}`);
    }
    
    // Validate pagination
    if (options.pagination.limit < 1 || options.pagination.limit > 1000) {
      throw new BadRequestException('Limit must be between 1 and 1000');
    }
    
    if (options.pagination.offset < 0) {
      throw new BadRequestException('Offset must be non-negative');
    }
    
    // Validate keyword mode
    if (options.keywordFilter && !['any', 'all'].includes(options.keywordFilter.mode)) {
      throw new BadRequestException('Keyword mode must be "any" or "all"');
    }
    
    // Validate category mode
    if (options.categoryFilter && !['any', 'all'].includes(options.categoryFilter.mode)) {
      throw new BadRequestException('Category mode must be "any" or "all"');
    }
  }
}
```

#### **Task 7.3: Documentation Updates**

**Update README or create UNIVERSAL_GRAPH.md:**

```markdown
# Universal Graph Service

## Overview

The Universal Graph Service provides a unified API for querying and visualizing all content nodes in the ProjectZer0 knowledge graph.

## Supported Node Types

- **Statement**: Claims and assertions with dual voting
- **OpenQuestion**: Questions seeking answers with inclusion voting
- **Answer**: Responses to questions with dual voting
- **Quantity**: Numeric measurement questions with response aggregation
- **Evidence**: Supporting materials with peer review system

## Filtering

### Node Type Filter
Include or exclude specific node types. Answer nodes automatically include their parent questions.

### Keyword Filter
- **ANY mode**: Nodes must have at least one of the specified keywords
- **ALL mode**: Nodes must have all specified keywords
- **Exclude mode**: Invert the filter (nodes without keywords)

### Category Filter
- **ANY mode**: Nodes must be in at least one of the specified categories
- **ALL mode**: Nodes must be in all specified categories
- **Exclude mode**: Invert the filter (nodes not in categories)

### User Filter
- **all**: No filtering (default)
- **created**: Only nodes created by the specified user
- **interacted**: Only nodes the user has voted on or commented on

## Sorting

- **netInclusionVotes**: Sort by inclusion vote balance (all nodes)
- **totalInclusionVotes**: Sort by total inclusion votes (all nodes)
- **dateCreated**: Sort by creation date (all nodes)
- **netContentVotes**: Sort by content vote balance (Statement/Answer use content, others fall back to inclusion)
- **totalContentVotes**: Sort by total content votes (Statement/Answer use content, others fall back to inclusion)
- **participantCount**: Sort by number of unique participants (all nodes)
- **categoryOverlap**: Sort by category overlap (requires category filter)

## Relationships

- **shared_keyword**: Nodes sharing keywords (topic similarity)
- **shared_category**: Nodes in same categories (organizational similarity)
- **related_to**: User-created statement relationships
- **answers**: Answer to question hierarchy
- **evidence_for**: Evidence supporting claims
- **categorized_as**: Node to category membership

## Performance

Target: <500ms for typical queries (200 nodes with relationships)

Optimizations:
- Parallel schema queries
- Batch user context enrichment
- Relationship consolidation
- Neo4j indexes on all sortable fields
- Caching for dropdown data (keywords, categories)

## Example Usage

```typescript
// Get default dataset
GET /graph/universal/nodes

// Filter by keywords (ANY mode)
GET /graph/universal/nodes?keywords[]=ai&keywords[]=ethics&keywordMode=any

// Filter by categories (ALL mode)
GET /graph/universal/nodes?categories[]=tech&categories[]=ethics&categoryMode=all

// Sort by content votes
GET /graph/universal/nodes?sortBy=netContentVotes&sortDirection=desc

// Include only specific node types
GET /graph/universal/nodes?nodeTypes[]=statement&nodeTypes[]=evidence

// Get all evidence with relationships
GET /graph/universal/nodes?nodeTypes[]=evidence&includeRelationships=true&relationshipTypes[]=evidence_for
```

---

## 📋 **Definition of Done**

### **Functional Requirements**

✅ **Node Fetching:**
- [ ] All 5 node types supported (Statement, OpenQuestion, Answer, Quantity, Evidence)
- [ ] Uses refactored schemas (not direct Neo4j queries)
- [ ] Default dataset returns correct node types
- [ ] Evidence nodes include peer review data
- [ ] Quantity nodes include statistics

✅ **Filtering:**
- [ ] Node type filtering works (include/exclude)
- [ ] Answer-question coupling enforced
- [ ] Keyword filtering works (any/all, include/exclude)
- [ ] Category filtering works (any/all, include/exclude)
- [ ] User filtering works (all/created/interacted)

✅ **Sorting:**
- [ ] All 7 sort options implemented
- [ ] Content vote sorts use fallback for OpenQuestion/Quantity/Evidence
- [ ] Sorting works correctly with all node type combinations

✅ **Relationships:**
- [ ] All 6 relationship types supported (including evidence_for)
- [ ] Relationship consolidation works
- [ ] Only relationships between nodes in result set
- [ ] Cross-node references included (parent question/node info)

✅ **User Context:**
- [ ] User vote status enrichment works
- [ ] Visibility preference enrichment works
- [ ] Batch enrichment is performant

### **Non-Functional Requirements**

✅ **Performance:**
- [ ] <500ms for typical queries (200 nodes)
- [ ] <2000ms for large queries (1000 nodes)
- [ ] Parallel schema queries implemented
- [ ] Batch user context enrichment
- [ ] Neo4j indexes verified

✅ **Code Quality:**
- [ ] All TypeScript types defined
- [ ] Error handling comprehensive
- [ ] Logging appropriate
- [ ] Code follows established patterns
- [ ] No direct Neo4j queries (use schemas)

✅ **Testing:**
- [ ] Unit tests passing (>80% coverage)
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Performance tests meet targets

✅ **Documentation:**
- [ ] API endpoints documented
- [ ] Filter/sort options explained
- [ ] Example usage provided
- [ ] Performance characteristics documented

---

## 🚀 **Deployment Checklist**

### **Pre-Deployment**

- [ ] All tests passing
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Neo4j indexes created/verified
- [ ] Performance profiling done
- [ ] Caching implemented
- [ ] Error handling tested

### **Deployment**

- [ ] Schema migrations (if any)
- [ ] Index creation scripts run
- [ ] Environment variables configured
- [ ] Monitoring alerts configured

### **Post-Deployment**

- [ ] Smoke tests passed
- [ ] Performance monitoring active
- [ ] Error rates normal
- [ ] User feedback collected

---

## 📚 **Reference Materials**

### **Related Documentation**
- `schema-layer.md` - Schema architecture
- `service-layer.md` - Service patterns
- `controller-layer.md` - HTTP layer patterns

### **Key Files**
- `src/nodes/universal/universal-graph.service.ts` - Main service implementation
- `src/nodes/universal/universal-graph.controller.ts` - HTTP endpoints
- `src/nodes/universal/universal-graph.module.ts` - Dependency injection
- `src/nodes/statement/statement.schema.ts` - Statement schema (example)
- `src/nodes/evidence/evidence.schema.ts` - Evidence schema
- `docs/schema-layer.md` - Schema architecture reference
- `docs/service-layer.md` - Service patterns reference
- `docs/controller-layer.md` - Controller patterns reference

### **Schema References**

All content node schemas extend `CategorizedNodeSchema`:
- StatementSchema
- OpenQuestionSchema
- AnswerSchema
- QuantitySchema
- EvidenceSchema

Common methods available:
```typescript
async findAll(options): Promise<NodeData[]>
async findById(id: string): Promise<NodeData | null>
async voteInclusion(nodeId: string, userId: string, isPositive: boolean): Promise<VoteResult>
async getVoteStatus(nodeId: string, userId: string): Promise<VoteStatus | null>
```

---

## 🎯 **Success Metrics**

### **Performance Targets**

| Metric | Target | Measurement |
|--------|--------|-------------|
| Typical query (<200 nodes) | <500ms | 95th percentile |
| Large query (<1000 nodes) | <2000ms | 95th percentile |
| Relationship consolidation | <100ms | Average |
| User context enrichment | <200ms | Average |
| Cache hit rate (keywords) | >80% | Average over 1 hour |
| Cache hit rate (categories) | >80% | Average over 1 hour |

### **Quality Targets**

| Metric | Target |
|--------|--------|
| Unit test coverage | >80% |
| Integration test coverage | >70% |
| E2E test coverage | >60% |
| Code complexity (cyclomatic) | <15 per method |
| Type safety | 100% (no `any` types) |

### **Functional Targets**

| Feature | Target |
|---------|--------|
| Node types supported | 5/5 (100%) |
| Filter types supported | 4/4 (100%) |
| Sort options supported | 7/7 (100%) |
| Relationship types supported | 6/6 (100%) |
| Answer-question coupling | 100% enforced |
| Content vote fallback | 100% correct |

---

## 📝 **Implementation Checklist**

### **Phase 4.1: Schema Integration** (Days 1-3)

- [ ] Update `universal-graph.module.ts` imports
- [ ] Add all 5 schemas to constructor
- [ ] Create `fetchStatements()` using StatementSchema
- [ ] Create `fetchOpenQuestions()` using OpenQuestionSchema
- [ ] Create `fetchAnswers()` using AnswerSchema
- [ ] Create `fetchQuantities()` using QuantitySchema
- [ ] Create `fetchEvidence()` using EvidenceSchema
- [ ] Create transformation methods for all 5 node types
- [ ] Test schema integration with unit tests

### **Phase 4.2: Advanced Filtering** (Days 4-5)

- [ ] Implement `buildKeywordFilter()` with ANY/ALL modes
- [ ] Implement `buildCategoryFilter()` with ANY/ALL modes
- [ ] Implement `buildUserFilter()` with all 3 modes
- [ ] Test keyword filtering (ANY, ALL, exclude)
- [ ] Test category filtering (ANY, ALL, exclude)
- [ ] Test user filtering (created, interacted)
- [ ] Test filter combinations

### **Phase 4.3: Sorting with Fallback** (Day 6)

- [ ] Implement `applySorting()` method
- [ ] Add content vote fallback logic
- [ ] Test all 7 sort options
- [ ] Test fallback for OpenQuestion
- [ ] Test fallback for Quantity
- [ ] Test fallback for Evidence
- [ ] Test sort with all node type combinations

### **Phase 4.4: Evidence Support** (Days 7-8)

- [ ] Implement `fetchEvidence()` method
- [ ] Add peer review data to Evidence nodes
- [ ] Add parent node info to Evidence metadata
- [ ] Implement `fetchEvidenceForRelationships()`
- [ ] Test Evidence node fetching
- [ ] Test evidence_for relationships
- [ ] Test Evidence filtering and sorting

### **Phase 4.5: User Context** (Day 9)

- [ ] Implement `enrichWithUserVotes()` batch method
- [ ] Implement `enrichWithVisibilityPreferences()` batch method
- [ ] Test user vote status enrichment
- [ ] Test visibility preference enrichment
- [ ] Measure enrichment performance
- [ ] Optimize if needed

### **Phase 4.6: Testing** (Days 10-11)

- [ ] Write unit tests for all service methods
- [ ] Write integration tests for full workflows
- [ ] Write E2E tests for all endpoints
- [ ] Write performance tests
- [ ] Verify >80% coverage
- [ ] All tests passing

### **Phase 4.7: Optimization** (Day 12)

- [ ] Create/verify all Neo4j indexes
- [ ] Profile slow queries
- [ ] Implement keyword/category caching
- [ ] Measure query performance
- [ ] Optimize if needed
- [ ] Update documentation

---

## 🚨 **Critical Implementation Notes**

### **1. Schema-First Approach**

**DO:**
```typescript
// ✅ Use schemas
const statements = await this.statementSchema.findAll(options);
const questions = await this.openQuestionSchema.findAll(options);
```

**DON'T:**
```typescript
// ❌ Direct Neo4j queries
const result = await this.neo4jService.read('MATCH (s:StatementNode)...');
```

**Rationale:** Using schemas ensures consistency, leverages business logic, and maintains architectural patterns established in Phases 1-3.

---

### **2. Answer-Question Coupling**

**ALWAYS enforce:**
```typescript
if (nodeTypeFilter.types.includes('answer')) {
  if (!nodeTypeFilter.types.includes('openquestion')) {
    nodeTypeFilter.types.push('openquestion');
    this.logger.debug('Auto-included openquestion due to answer selection');
  }
}
```

**Rationale:** Answers are meaningless without their parent questions. The UI should present this as a single checkbox.

---

### **3. Content Vote Fallback**

**ALWAYS use fallback:**
```typescript
const sortValue = (node.type === 'statement' || node.type === 'answer')
  ? node.contentNetVotes
  : node.inclusionNetVotes;  // ← Fallback for OpenQuestion/Quantity/Evidence
```

**Rationale:** OpenQuestion uses inclusion only. Quantity uses numeric responses. Evidence uses peer review. They don't have content voting, so fallback to inclusion votes for sorting.

---

### **4. Cross-Node References**

**ALWAYS include parent info:**
```typescript
// For Answer nodes
metadata: {
  parentQuestion: {
    nodeId: question.id,
    questionText: question.questionText  // ← ALWAYS include
  }
}

// For Evidence nodes
metadata: {
  parentNode: {
    nodeId: parent.id,
    nodeType: parent.type,
    content: parent.content  // ← ALWAYS include
  }
}
```

**Rationale:** Parent nodes may not be in the result set. Including parent info enables UI to display context without additional queries.

---

### **5. Batch Operations**

**DO:**
```typescript
// ✅ Batch all enrichment calls
const votePromises = nodes.map(n => this.voteSchema.getVoteStatus(n.id, userId));
const voteStatuses = await Promise.all(votePromises);
```

**DON'T:**
```typescript
// ❌ Sequential enrichment
for (const node of nodes) {
  node.userVoteStatus = await this.voteSchema.getVoteStatus(node.id, userId);
}
```

**Rationale:** Batching reduces total query time from O(n) sequential to O(1) parallel.

---

### **6. Relationship Consolidation**

**ALWAYS consolidate shared_keyword:**
```typescript
// Multiple TAGGED relationships → Single consolidated relationship
{
  id: 'A-shared_keyword-B',
  strength: 1.4,  // Sum of all keyword strengths
  metadata: {
    sharedWords: ['ai', 'ethics'],
    strengthsByKeyword: { ai: 0.8, ethics: 0.6 }
  }
}
```

**Rationale:** Reduces relationship count, improves UI clarity, maintains strength information.

---

## 📅 **Timeline Summary**

**Total Duration:** 12 days

| Phase | Days | Description |
|-------|------|-------------|
| **4.1** | 1-3 | Schema Integration |
| **4.2** | 4-5 | Advanced Filtering |
| **4.3** | 6 | Sorting with Fallback |
| **4.4** | 7-8 | Evidence Support |
| **4.5** | 9 | User Context Enrichment |
| **4.6** | 10-11 | Testing |
| **4.7** | 12 | Optimization & Documentation |

---

## 🎓 **Learning from Previous Phases**

### **Architectural Patterns (Phases 1-3)**

✅ **Established and Working:**
- Schema layer for database operations
- Service layer for business logic
- Controller layer for HTTP boundary
- DTO patterns for input validation
- JWT authentication at class level
- Proper error handling with exception preservation
- Comprehensive testing at all layers

✅ **Apply to Phase 4:**
- Universal Graph Service should follow same patterns
- Use schemas (not direct Neo4j queries)
- Batch operations for performance
- Proper TypeScript typing
- Comprehensive test coverage
- Clear separation of concerns

---

## 🔄 **Iteration Strategy**

### **Week 1: Core Implementation**
- Days 1-3: Get schema integration working
- Days 4-5: Get filtering working
- Day 6: Get sorting working

**Goal:** Can fetch and filter all 5 node types

### **Week 2: Advanced Features**
- Days 7-8: Add Evidence support
- Day 9: Add user context
- Days 10-11: Comprehensive testing
- Day 12: Optimization and polish

**Goal:** Production-ready with all features

---

## 📞 **Getting Started**

### **Step 1: Review Architecture**
Read the completed documentation:
- `docs/schema-layer.md`
- `docs/service-layer.md`
- `docs/controller-layer.md`

### **Step 2: Analyze Current Code**
Review existing Universal Graph implementation:
- `src/nodes/universal/universal-graph.service.ts`
- `src/nodes/universal/universal-graph.controller.ts`
- `src/nodes/universal/universal-graph.module.ts`

### **Step 3: Plan Refactor**
Identify what needs to change:
- Constructor dependencies
- Module imports
- Direct Neo4j queries → Schema method calls
- Missing features

### **Step 4: Implement Incrementally**
- Start with schema integration
- Add one feature at a time
- Test after each feature
- Maintain working state

### **Step 5: Test Thoroughly**
- Unit tests as you go
- Integration tests for workflows
- E2E tests for API
- Performance tests before completion

---

## ✅ **Final Checklist Before Starting**

- [ ] All Phases 1-3 documentation read
- [ ] Current Universal Graph code analyzed
- [ ] Test database available
- [ ] Development environment configured
- [ ] Neo4j indexes documented
- [ ] Timeline understood
- [ ] Success criteria clear
- [ ] Ready to begin Phase 4.1

---

**Document Version:** 3.0  
**Last Updated:** 2025  
**Status:** Ready for Implementation  
**Estimated Duration:** 12 days  
**Dependencies:** Phases 1-3 complete ✅

---

**This document contains everything needed to successfully refactor the Universal Graph Service to align with the established architecture and support all 5 primary content node types.**