# Service Layer Architecture - Complete Reference

**ProjectZer0 Backend - Service & Business Logic Layer**  
**Version:** 1.0  
**Last Updated:** 07/10/2025  
**Status:** Production Ready

---

## Navigation Note

**This is a consolidated, corrected version combining all three parts.**

Due to length, this documentation is split into logical sections:
- **Sections 1-8:** Core architecture, patterns, and all 8 node service references
- **Sections 9-13:** Special systems, error handling, testing, comparisons, best practices  
- **Sections 14-20:** Patterns reference, quick reference, architectural decisions, glossary

**Reading Recommendation:**
- **For quick reference:** Jump to Section 15 (Quick Reference)
- **For new team members:** Read sections 1-3, then review specific node services in Section 4
- **For implementation:** Focus on Section 3 (Core Patterns) and Section 13 (Best Practices)
- **For AI context:** Provide sections 1-3 and the specific node service section (4.1-4.8) relevant to your task

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Philosophy](#2-architecture-philosophy)
3. [Core Patterns](#3-core-patterns)
4. [Node Service Reference](#4-node-service-reference)
   - 4.1 WordService
   - 4.2 DefinitionService
   - 4.3 CategoryService
   - 4.4 StatementService
   - 4.5 OpenQuestionService
   - 4.6 AnswerService
   - 4.7 QuantityService
   - 4.8 EvidenceService
5. [Voting Patterns](#5-voting-patterns)
6. [Keyword Extraction & Word Creation](#6-keyword-extraction--word-creation)
7. [Category Validation](#7-category-validation)
8. [Parent Node Validation](#8-parent-node-validation)
9. [Special Systems](#9-special-systems)
10. [Error Handling](#10-error-handling)
11. [Testing Patterns](#11-testing-patterns)
12. [Comparison Tables](#12-comparison-tables)
13. [Best Practices](#13-best-practices)
14. [Common Patterns Reference](#14-common-patterns-reference)
15. [Quick Reference](#15-quick-reference)
16. [Architectural Decisions](#16-architectural-decisions)
17. [Future Considerations](#17-future-considerations)
18. [Glossary](#18-glossary)
19. [Related Documentation](#19-related-documentation)
20. [Document Metadata](#20-document-metadata)

---

## 1. Overview

### 1.1 Purpose

The service layer sits between controllers (HTTP layer) and schemas (database layer), providing business logic, orchestration, and validation that goes beyond simple CRUD operations.

### 1.2 Responsibilities

**Services ARE responsible for:**
- ✅ Orchestrating multiple schema calls
- ✅ Business validation beyond schema enforcement
- ✅ Complex workflows (keyword extraction, word creation, discussion creation)
- ✅ Data transformation and aggregation
- ✅ Integration with external services
- ✅ Error handling and logging

**Services are NOT responsible for:**
- ❌ Writing Cypher queries (that's schemas)
- ❌ Direct database access (that's Neo4jService)
- ❌ HTTP concerns (that's controllers)
- ❌ Simple pass-through methods to schemas

### 1.3 Service Inventory

| Service | Node Type | Complexity | Voting Pattern | Special Features |
|---------|-----------|-----------|----------------|------------------|
| **WordService** | WordNode | Low | Inclusion-only | Dictionary API, self-tagging |
| **DefinitionService** | DefinitionNode | Low | Dual voting | Parent word validation |
| **CategoryService** | CategoryNode | Low-Medium | Inclusion-only | Self-categorization, 1-5 words |
| **StatementService** | StatementNode | Medium | Dual voting | Network relationships |
| **OpenQuestionService** | OpenQuestionNode | Medium | Inclusion-only | Simplest keyword pattern |
| **AnswerService** | AnswerNode | Medium | Dual voting | Parent question validation |
| **QuantityService** | QuantityNode | High | Inclusion-only | Numeric responses, statistics |
| **EvidenceService** | EvidenceNode | High | Inclusion-only | 3D peer review system |

---

## 2. Architecture Philosophy

### 2.1 Separation of Concerns

```
┌─────────────────────────────────────────────────┐
│                 Controller Layer                 │
│  (HTTP, DTOs, Authentication, Status Codes)     │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│                 Service Layer                    │
│  (Business Logic, Orchestration, Validation)    │
│                                                  │
│  ┌──────────────┐  ┌──────────────┐            │
│  │ Discussion   │  │   Keyword    │            │
│  │ Creation     │  │  Extraction  │            │
│  └──────────────┘  └──────────────┘            │
│                                                  │
│  ┌──────────────┐  ┌──────────────┐            │
│  │    Word      │  │  Category    │            │
│  │  Creation    │  │ Validation   │            │
│  └──────────────┘  └──────────────┘            │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│                 Schema Layer                     │
│  (Cypher Queries, Database Operations)          │
└─────────────────────────────────────────────────┘
```

### 2.2 Design Principles

1. **Single Responsibility** - Each service handles one node type
2. **Dependency Injection** - All dependencies injected via constructor
3. **Schema Delegation** - CRUD operations delegated to schemas
4. **Orchestration Focus** - Services coordinate multiple operations
5. **Fail Fast** - Validate early, provide clear error messages
6. **Logging Strategy** - Log at appropriate levels (debug, log, error)

---

## 3. Core Patterns

### 3.1 Constructor Pattern

**Standard Constructor (All 8 Services):**

```typescript
@Injectable()
export class NodeService {
  private readonly logger = new Logger(NodeService.name);

  constructor(
    private readonly nodeSchema: NodeSchema,
    private readonly discussionSchema: DiscussionSchema,  // ← DIRECT injection
    private readonly userSchema: UserSchema,              // ← REQUIRED
    // ... additional dependencies
  ) {}
}
```

**Key Points:**
- ✅ **DiscussionSchema injected directly** (not DiscussionService)
- ✅ **UserSchema always included** (critical for dependency injection)
- ✅ **Logger instantiated with service name** for clear logging
- ✅ **All schemas and services marked as `private readonly`**

**Dependency Variations by Service:**

```typescript
// Simple services (Word, Definition, Category)
constructor(
  private readonly nodeSchema: NodeSchema,
  private readonly discussionSchema: DiscussionSchema,
  private readonly userSchema: UserSchema,
) {}

// Keyword-enabled services (Statement, OpenQuestion, Answer, Quantity, Evidence)
constructor(
  private readonly nodeSchema: NodeSchema,
  private readonly discussionSchema: DiscussionSchema,
  private readonly userSchema: UserSchema,
  private readonly categoryService: CategoryService,
  private readonly keywordExtractionService: KeywordExtractionService,
  private readonly wordService: WordService,
  // + node-specific services (e.g., OpenQuestionService, UnitService)
) {}
```

---

### 3.2 Discussion Creation Pattern

**Universal Pattern (All 8 Services):**

```typescript
// After creating node
if (nodeData.initialComment) {
  await this.discussionSchema.createDiscussionForNode({
    nodeId: createdNode.id,        // or 'word' for WordNode
    nodeType: 'NodeTypeName',      // e.g., 'StatementNode'
    nodeIdField: 'id',             // 'word' for WordNode, 'id' for all others
    createdBy: nodeData.createdBy,
    initialComment: nodeData.initialComment,
  });
}
```

**Discussion Creation Matrix:**

| Service | nodeType | nodeIdField | initialComment |
|---------|----------|-------------|----------------|
| Word | 'WordNode' | 'word' | Optional |
| Definition | 'DefinitionNode' | 'id' | Optional |
| Category | 'CategoryNode' | 'id' | Optional |
| Statement | 'StatementNode' | 'id' | **Required** |
| OpenQuestion | 'OpenQuestionNode' | 'id' | **Required** |
| Answer | 'AnswerNode' | 'id' | Optional |
| Quantity | 'QuantityNode' | 'id' | Optional |
| Evidence | 'EvidenceNode' | 'id' | Optional |

**Key Points:**
- ✅ Only Word uses `'word'` as nodeIdField (unique ID pattern)
- ✅ Statement and OpenQuestion **require** initial comment
- ✅ Discussion created via DiscussionSchema, not DiscussionService
- ✅ Discussion created **after** node creation succeeds

---

### 3.3 Module Configuration Pattern

**Standard Module Structure (All 8 Services):**

```typescript
@Module({
  imports: [
    VoteModule,          // Provides VoteSchema
    DiscussionModule,    // Provides DiscussionSchema (CRITICAL)
    // ... additional modules based on service needs
  ],
  controllers: [NodeController],
  providers: [
    NodeService,
    NodeSchema,
    UserSchema,          // CRITICAL: Must be included
    VoteSchema,
    Logger,
  ],
  exports: [NodeService, NodeSchema],
})
export class NodeModule {}
```

**Critical Points:**
- ✅ **UserSchema must be in providers** (all 8 modules)
- ✅ **DiscussionModule must be imported** (all 8 modules)
- ✅ **VoteModule provides VoteSchema** (all 8 modules)
- ✅ **Export both service and schema** for use by other modules

---

## 4. Node Service Reference

**NOTE:** This section provides detailed reference for each of the 8 node services. Each subsection follows the same structure: Characteristics, Constructor Dependencies, Key Methods, and Unique Features.

### 4.1 WordService

**Characteristics:**
- Uses `'word'` as ID field (not `'id'`)
- Self-tagging pattern (word tags itself)
- Integration with external Dictionary API
- Inclusion voting only
- No keyword extraction (is a keyword itself)

**Constructor Dependencies:**
```typescript
constructor(
  private readonly wordSchema: WordSchema,
  private readonly discussionSchema: DiscussionSchema,
  private readonly userSchema: UserSchema,
  private readonly visibilityService: VisibilityService,
  private readonly dictionaryService: DictionaryService,
) {}
```

**Key Methods:**
```typescript
// Core CRUD
async createWord(wordData: CreateWordData): Promise<WordNodeData>
async getWord(word: string): Promise<WordNodeData | null>
async updateWord(word: string, updateData: UpdateWordData): Promise<WordNodeData>
async deleteWord(word: string): Promise<void>

// Voting (inclusion only)
async voteInclusion(word: string, userId: string, isPositive: boolean): Promise<VoteResult>
async getVoteStatus(word: string, userId: string): Promise<VoteStatus | null>
async removeVote(word: string, userId: string): Promise<VoteResult>
async getVotes(word: string): Promise<VoteResult | null>

// Utility methods
async checkWordExistence(word: string): Promise<boolean>
async getOrCreateWord(word: string, createdBy: string): Promise<WordNodeData>
```

**Unique Features:**

Word is the only service that uses the word string itself as the primary identifier instead of a UUID.

---

### 4.2 DefinitionService

**Characteristics:**
- Standard `'id'` field (UUID)
- Parent word validation required
- Dual voting (inclusion + content)
- Multiple definitions allowed per word
- No keyword extraction

**Constructor Dependencies:**
```typescript
constructor(
  private readonly definitionSchema: DefinitionSchema,
  private readonly discussionSchema: DiscussionSchema,
  private readonly userSchema: UserSchema,
) {}
```

**Key Methods:**
```typescript
// Core CRUD
async createDefinition(definitionData: CreateDefinitionData): Promise<DefinitionData>
async getDefinition(id: string): Promise<DefinitionData | null>
async updateDefinition(id: string, updateData: UpdateDefinitionData): Promise<DefinitionData>
async deleteDefinition(id: string): Promise<void>

// Voting (dual: inclusion + content)
async voteInclusion(id: string, userId: string, isPositive: boolean): Promise<VoteResult>
async voteContent(id: string, userId: string, isPositive: boolean): Promise<VoteResult>
async getVoteStatus(id: string, userId: string): Promise<VoteStatus | null>
async removeVote(id: string, userId: string, kind: 'INCLUSION' | 'CONTENT'): Promise<VoteResult>
async getVotes(id: string): Promise<VoteResult | null>

// Definition-specific queries
async getDefinitionsForWord(word: string): Promise<DefinitionData[]>
async getTopDefinitionForWord(word: string): Promise<DefinitionData | null>
```

**Parent Word Validation:**

Definition must validate that the parent word exists and has passed inclusion threshold before allowing definition creation.

---

### 4.3 CategoryService

**Characteristics:**
- Standard `'id'` field (UUID)
- Extends `BaseNodeSchema` (not `CategorizedNodeSchema`)
- Self-categorization pattern
- Composed of 1-5 approved words
- Hierarchical with parent/child relationships
- Inclusion voting only
- No keyword extraction

**Constructor Dependencies:**
```typescript
constructor(
  private readonly categorySchema: CategorySchema,
  private readonly discussionSchema: DiscussionSchema,
  private readonly userSchema: UserSchema,
) {}
```

**Key Methods:**
```typescript
// Core CRUD
async createCategory(categoryData: CreateCategoryData): Promise<CategoryData>
async getCategory(id: string): Promise<CategoryData | null>
async updateCategory(id: string, updateData: UpdateCategoryData): Promise<CategoryData>
async deleteCategory(id: string): Promise<void>

// Voting (inclusion only)
async voteInclusion(id: string, userId: string, isPositive: boolean): Promise<VoteResult>
async getVoteStatus(id: string, userId: string): Promise<VoteStatus | null>
async removeVote(id: string, userId: string): Promise<VoteResult>
async getVotes(id: string): Promise<VoteResult | null>

// Hierarchy management
async getCategoryHierarchy(rootId?: string): Promise<CategoryHierarchy[]>
async getChildCategories(parentId: string): Promise<CategoryData[]>
async getParentCategory(childId: string): Promise<CategoryData | null>

// Category queries
async getCategoriesForNode(nodeId: string): Promise<CategoryInfo[]>
async getTopCategories(limit?: number): Promise<CategoryData[]>
```

**Unique Feature - Self-Categorization:**

Category belongs to itself (similar to Word self-tagging), but content counts exclude the self-reference to maintain accurate statistics.

---

### 4.4 StatementService

**Characteristics:**
- Standard `'id'` field (UUID)
- Dual voting (inclusion + content)
- AI keyword extraction + word auto-creation
- 0-3 categories
- Network relationships (RELATED_TO)
- Required initial comment

**Constructor Dependencies:**
```typescript
constructor(
  private readonly statementSchema: StatementSchema,
  private readonly discussionSchema: DiscussionSchema,
  private readonly userSchema: UserSchema,
  private readonly categoryService: CategoryService,
  private readonly keywordExtractionService: KeywordExtractionService,
  private readonly wordService: WordService,
) {}
```

**Key Methods:**
```typescript
// Core CRUD
async createStatement(statementData: CreateStatementData): Promise<StatementData>
async getStatement(id: string): Promise<StatementData | null>
async updateStatement(id: string, updateData: UpdateStatementData): Promise<StatementData>
async deleteStatement(id: string): Promise<void>

// Voting (dual: inclusion + content)
async voteInclusion(id: string, userId: string, isPositive: boolean): Promise<VoteResult>
async voteContent(id: string, userId: string, isPositive: boolean): Promise<VoteResult>
async getVoteStatus(id: string, userId: string): Promise<VoteStatus | null>
async removeVote(id: string, userId: string, kind: 'INCLUSION' | 'CONTENT'): Promise<VoteResult>
async getVotes(id: string): Promise<VoteResult | null>

// Network relationships (UNIQUE TO STATEMENT)
async createRelatedStatement(parentId: string, data: CreateStatementData): Promise<StatementData>
async createDirectRelationship(id1: string, id2: string): Promise<{ success: boolean }>
async removeDirectRelationship(id1: string, id2: string): Promise<void>
async getDirectlyRelatedStatements(id: string): Promise<StatementData[]>
async getStatementNetwork(options: GetStatementNetworkOptions): Promise<StatementData[]>

// Utility
async isStatementApproved(id: string): Promise<boolean>
```

**Unique Feature - Network Relationships:**

Statement is the only service that supports creating explicit relationships between nodes of the same type, enabling knowledge graph construction.

---

### 4.5 OpenQuestionService

**Characteristics:**
- Standard `'id'` field (UUID)
- Inclusion voting only
- AI keyword extraction + word auto-creation
- 0-3 categories
- Required initial comment
- Parent to Answer nodes

**Constructor Dependencies:**
```typescript
constructor(
  private readonly openQuestionSchema: OpenQuestionSchema,
  private readonly discussionSchema: DiscussionSchema,
  private readonly userSchema: UserSchema,
  private readonly categoryService: CategoryService,
  private readonly keywordExtractionService: KeywordExtractionService,
  private readonly wordService: WordService,
) {}
```

**Key Methods:**
```typescript
// Core CRUD
async createOpenQuestion(questionData: CreateOpenQuestionData): Promise<OpenQuestionData>
async getOpenQuestion(id: string): Promise<OpenQuestionData | null>
async updateOpenQuestion(id: string, updateData: UpdateOpenQuestionData): Promise<OpenQuestionData>
async deleteOpenQuestion(id: string): Promise<void>

// Voting (inclusion only)
async voteInclusion(id: string, userId: string, isPositive: boolean): Promise<VoteResult>
async getVoteStatus(id: string, userId: string): Promise<VoteStatus | null>
async removeVote(id: string, userId: string): Promise<VoteResult>
async getVotes(id: string): Promise<VoteResult | null>

// Question queries
async getAllOpenQuestions(options?: QueryOptions): Promise<OpenQuestionData[]>
async searchOpenQuestions(searchTerm: string): Promise<OpenQuestionData[]>
```

**Note:** OpenQuestion demonstrates the cleanest, most straightforward implementation of the keyword extraction pattern.

---

### 4.6 AnswerService

**Characteristics:**
- Standard `'id'` field (UUID)
- Dual voting (inclusion + content)
- AI keyword extraction + word auto-creation
- 0-3 categories
- Parent question validation required
- Must validate OpenQuestion passed inclusion

**Constructor Dependencies:**
```typescript
constructor(
  private readonly answerSchema: AnswerSchema,
  private readonly discussionSchema: DiscussionSchema,
  private readonly userSchema: UserSchema,
  private readonly categoryService: CategoryService,
  private readonly keywordExtractionService: KeywordExtractionService,
  private readonly wordService: WordService,
  private readonly openQuestionService: OpenQuestionService,  // ← Parent validation
) {}
```

**Key Methods:**
```typescript
// Core CRUD
async createAnswer(answerData: CreateAnswerData): Promise<AnswerData>
async getAnswer(id: string): Promise<AnswerData | null>
async updateAnswer(id: string, updateData: UpdateAnswerData): Promise<AnswerData>
async deleteAnswer(id: string): Promise<void>

// Voting (dual: inclusion + content)
async voteInclusion(id: string, userId: string, isPositive: boolean): Promise<VoteResult>
async voteContent(id: string, userId: string, isPositive: boolean): Promise<VoteResult>
async getVoteStatus(id: string, userId: string): Promise<VoteStatus | null>
async removeVote(id: string, userId: string, kind: 'INCLUSION' | 'CONTENT'): Promise<VoteResult>
async getVotes(id: string): Promise<VoteResult | null>

// Answer-specific queries
async getAnswersForQuestion(questionId: string, options?: GetAnswersOptions): Promise<AnswerData[]>
async getTopAnswerForQuestion(questionId: string): Promise<AnswerData | null>

// Utility
async isAnswerApproved(id: string): Promise<boolean>
async isContentVotingAvailable(id: string): Promise<boolean>
```

**Special Dependency Note:**

AnswerService is the ONLY service that depends on another node service (OpenQuestionService) for parent validation.

---

### 4.7 QuantityService

**Characteristics:**
- Standard `'id'` field (UUID)
- Inclusion voting only (uses numeric responses instead of content voting)
- AI keyword extraction + word auto-creation
- 0-3 categories
- Unit category and default unit required
- Statistical aggregation system
- Value normalization to base units

**Constructor Dependencies:**
```typescript
constructor(
  private readonly quantitySchema: QuantitySchema,
  private readonly discussionSchema: DiscussionSchema,
  private readonly userSchema: UserSchema,
  private readonly categoryService: CategoryService,
  private readonly keywordExtractionService: KeywordExtractionService,
  private readonly wordService: WordService,
  private readonly unitService: UnitService,  // ← Unit validation
) {}
```

**Key Methods:**
```typescript
// Core CRUD
async createQuantityNode(quantityData: CreateQuantityNodeData): Promise<QuantityData>
async getQuantityNode(id: string): Promise<QuantityData | null>
async updateQuantityNode(id: string, updateData: UpdateQuantityNodeData): Promise<QuantityData>
async deleteQuantityNode(id: string): Promise<void>

// Voting (inclusion only)
async voteInclusion(id: string, userId: string, isPositive: boolean): Promise<VoteResult>
async getVoteStatus(id: string, userId: string): Promise<VoteStatus | null>
async removeVote(id: string, userId: string): Promise<VoteResult>
async getVotes(id: string): Promise<VoteResult | null>

// Numeric response system (UNIQUE TO QUANTITY)
async submitResponse(responseData: SubmitResponseData): Promise<QuantityNodeResponse>
async getUserResponse(userId: string, quantityNodeId: string): Promise<QuantityNodeResponse | null>
async deleteUserResponse(userId: string, quantityNodeId: string): Promise<{ success: boolean }>
async getStatistics(quantityNodeId: string): Promise<QuantityNodeStats>

// Utility
async isQuantityNodeApproved(id: string): Promise<boolean>
async isNumericResponseAllowed(id: string): Promise<boolean>
```

**Unique Feature - Numeric Response System:**

Replaces content voting with objective numeric measurements, including statistical aggregation (min, max, mean, median, standard deviation, percentiles).

---

### 4.8 EvidenceService

**Characteristics:**
- Standard `'id'` field (UUID)
- Inclusion voting only (uses 3D peer review instead of content voting)
- AI keyword extraction + word auto-creation
- 0-3 categories
- Parent node validation (Statement/Answer/Quantity)
- 3D peer review system (quality/independence/relevance)
- URL validation required
- Evidence type categorization

**Constructor Dependencies:**
```typescript
constructor(
  private readonly evidenceSchema: EvidenceSchema,
  private readonly discussionSchema: DiscussionSchema,
  private readonly userSchema: UserSchema,
  private readonly categoryService: CategoryService,
  private readonly keywordExtractionService: KeywordExtractionService,
  private readonly wordService: WordService,
) {}
```

**Key Methods:**
```typescript
// Core CRUD
async createEvidence(evidenceData: CreateEvidenceData): Promise<EvidenceData>
async getEvidence(id: string): Promise<EvidenceData | null>
async updateEvidence(id: string, updateData: UpdateEvidenceData): Promise<EvidenceData>
async deleteEvidence(id: string): Promise<void>

// Voting (inclusion only)
async voteInclusion(id: string, userId: string, isPositive: boolean): Promise<VoteResult>
async getVoteStatus(id: string, userId: string): Promise<VoteStatus | null>
async removeVote(id: string, userId: string): Promise<VoteResult>
async getVotes(id: string): Promise<VoteResult | null>

// Peer review system (UNIQUE TO EVIDENCE - 3D scoring)
async submitPeerReview(reviewData: SubmitPeerReviewData): Promise<EvidencePeerReview>
async getPeerReviewStats(evidenceId: string): Promise<PeerReviewStats>
async getUserPeerReview(evidenceId: string, userId: string): Promise<EvidencePeerReview | null>
async isPeerReviewAllowed(evidenceId: string): Promise<boolean>

// Evidence queries
async getEvidenceForNode(parentNodeId: string, parentNodeType: string): Promise<EvidenceData[]>
async getTopRatedEvidence(limit?: number, type?: EvidenceType): Promise<EvidenceData[]>

// Utility
async isEvidenceApproved(id: string): Promise<boolean>
```

**Unique Feature - 3D Peer Review:**

Replaces content voting with multi-dimensional quality assessment (quality score 1-5, independence score 1-5, relevance score 1-5).

---

## 5. Voting Patterns

### 5.1 Voting Pattern Overview

| Node Type | Inclusion | Content | Alternative System |
|-----------|-----------|---------|-------------------|
| **Word** | ✅ | ❌ | - |
| **Definition** | ✅ | ✅ | - |
| **Category** | ✅ | ❌ | - |
| **Statement** | ✅ | ✅ | - |
| **OpenQuestion** | ✅ | ❌ | - |
| **Answer** | ✅ | ✅ | - |
| **Quantity** | ✅ | ❌ | Numeric responses |
| **Evidence** | ✅ | ❌ | 3D peer review |

### 5.2 Inclusion-Only Voting Pattern

**Services:** Word, Category, OpenQuestion, Quantity, Evidence

**Standard Implementation:**
- Input validation (ID, userId required)
- Delegate to schema layer
- Standard error handling pattern
- Log operations at debug level

### 5.3 Dual Voting Pattern

**Services:** Definition, Statement, Answer

**Additional Requirements:**
- Content voting requires inclusion threshold passed
- Separate `removeVote` with `kind` parameter
- Schema validates threshold, service provides better error messages

### 5.4 VotingUtils Helper

```typescript
export class VotingUtils {
  static hasPassedInclusion(inclusionNetVotes: number): boolean {
    return inclusionNetVotes > 0;
  }
  
  static isContentVotingAvailable(inclusionNetVotes: number): boolean {
    return this.hasPassedInclusion(inclusionNetVotes);
  }
  
  static isVisible(contentNetVotes: number): boolean {
    return contentNetVotes >= -5;
  }
}
```

---

## 6. Keyword Extraction & Word Creation

### 6.1 Pattern Overview

**Services that implement:** Statement, OpenQuestion, Answer, Quantity, Evidence (5 services)

**Services that DON'T:** Word (is a keyword), Definition (inherits from parent), Category (uses words directly)

### 6.2 Three-Phase Pattern

**Phase 1: Keyword Extraction**
- Check for user-provided keywords first (takes precedence)
- Fall back to AI extraction if no user keywords
- Handle extraction failures gracefully

**Phase 2: Word Auto-Creation**
- Loop through extracted keywords
- Check existence before creating
- Mark as `isAICreated: true`
- Log warnings for failures, but continue

**Phase 3: Node Creation**
- Create node with keywords array
- Keywords include frequency and source ('user' or 'ai')

### 6.3 Update Pattern

When text changes during update:
- Re-extract keywords
- Create any new missing words
- Update node with new keyword relationships

---

## 7. Category Validation

### 7.1 Pattern Overview

**Services that implement:** Statement, OpenQuestion, Answer, Quantity, Evidence (5 services)

**Limits:**
- Minimum: 0 (categories optional)
- Maximum: 3 categories
- All must exist and have passed inclusion

### 7.2 Parallel Validation

**WHY:** Performance - validates all 3 categories simultaneously

```typescript
private async validateCategories(categoryIds: string[]): Promise<void> {
  if (!categoryIds || categoryIds.length === 0) return;
  
  const validationPromises = categoryIds.map(async (categoryId) => {
    const category = await this.categoryService.getCategory(categoryId);
    if (!category) {
      throw new BadRequestException(`Category ${categoryId} does not exist`);
    }
    if (category.inclusionNetVotes <= 0) {
      throw new BadRequestException(
        `Category ${categoryId} must have passed inclusion threshold`
      );
    }
  });
  
  await Promise.all(validationPromises);
}
```

---

## 8. Parent Node Validation

### 8.1 Services with Parent Validation

| Service | Parent Type | Validation Approach |
|---------|------------|---------------------|
| **Definition** | WordNode | Direct schema access |
| **Answer** | OpenQuestionNode | Via OpenQuestionService |
| **Evidence** | Statement/Answer/Quantity | Delegated to schema |

### 8.2 Validation Requirements

All parent validation follows same pattern:
1. Verify parent exists
2. Verify parent has passed inclusion threshold
3. Throw clear error messages if validation fails

---

## 9. Special Systems

### 9.1 Numeric Response System (Quantity)

**Purpose:** Replace subjective content voting with objective measurements

**Key Features:**
- Users submit numeric value + unit
- Values normalized to base unit for comparison
- Statistical aggregation across all responses
- Responses only allowed after inclusion passes

**Response Validation:**
1. Verify quantity node passed inclusion threshold
2. Validate unit is valid for quantity's unit category
3. Submit response (schema handles normalization)

**Statistics Provided:**
```typescript
interface QuantityNodeStats {
  responseCount: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  standardDeviation: number;
  percentiles: {
    10: number,
    25: number,
    50: number,  // same as median
    75: number,
    90: number,
    95: number,
    99: number,
  };
  distributionCurve: number[][];  // For visualization
  responses?: QuantityNodeResponse[];
}
```

**Example Flow:**
```typescript
// Question: "How tall are you?"
// Unit Category: "length"
// Default Unit: "meters"

// User submissions (automatically normalized):
{ value: 1.75, unitId: 'meters' }     // → 1.75
{ value: 5.9, unitId: 'feet' }        // → 1.798
{ value: 175, unitId: 'centimeters' } // → 1.75

// Statistics calculated on normalized values
```

---

### 9.2 Peer Review System (Evidence)

**Purpose:** Replace content voting with multi-dimensional quality assessment

**3D Scoring Dimensions:**
1. **Quality Score (1-5):** Methodological rigor, research quality
2. **Independence Score (1-5):** Source independence, potential bias
3. **Relevance Score (1-5):** Relevance to the claim

**Review Validation:**
1. Verify evidence passed inclusion threshold
2. Check user hasn't already reviewed (one per user)
3. Validate all three scores are 1-5
4. Submit review (schema calculates aggregate)

**Overall Score Calculation:**
```typescript
overallScore = (
  avgQualityScore * 0.333 +
  avgIndependenceScore * 0.333 +
  avgRelevanceScore * 0.334
)
```

**Business Rules:**
- ✅ Evidence must pass inclusion before review
- ✅ One review per user per evidence
- ✅ All three dimensions required
- ✅ Scores must be integers 1-5
- ✅ Comments optional
- ✅ Aggregate scores updated immediately

---

### 9.3 Network Relationships (Statement)

**Purpose:** Enable statement-to-statement connections for knowledge graphs

**Relationship Types:**
1. **Parent-Child (RELATED_TO):** Hierarchical relationships
2. **Direct Relationships:** Peer-to-peer connections

**Key Operations:**
```typescript
// Create child statement
async createRelatedStatement(parentId: string, data: CreateStatementData)

// Create bidirectional relationship
async createDirectRelationship(id1: string, id2: string)

// Remove relationship
async removeDirectRelationship(id1: string, id2: string)

// Query relationships
async getDirectlyRelatedStatements(id: string)
async getStatementNetwork(options: GetStatementNetworkOptions)
```

---

## 10. Error Handling

### 10.1 Standard Error Handling Pattern

**All services follow this pattern:**

```typescript
async operation(...): Promise<Result> {
  // 1. Input validation
  if (!param || param.trim() === '') {
    throw new BadRequestException('Parameter is required');
  }
  
  this.logger.debug(`Performing operation with: ${param}`);
  
  try {
    // 2. Business logic
    const result = await this.performOperation(param);
    
    this.logger.debug(`Operation successful: ${JSON.stringify(result)}`);
    return result;
    
  } catch (error) {
    // 3. Error handling
    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException
    ) {
      throw error;  // Preserve specific exceptions
    }
    
    // 4. Wrap unknown errors
    this.logger.error(
      `Error performing operation: ${error.message}`,
      error.stack
    );
    throw new InternalServerErrorException(
      `Failed to perform operation: ${error.message}`
    );
  }
}
```

### 10.2 Exception Types

**BadRequestException (400):**
- Invalid input data
- Validation failures
- Business rule violations
- Parent/category not approved

**NotFoundException (404):**
- Node not found
- Parent node not found
- Related entity not found

**InternalServerErrorException (500):**
- Database errors
- Unexpected errors
- External service failures

### 10.3 Error Preservation

**WHY:** Preserve specific exceptions for proper HTTP status codes

```typescript
catch (error) {
  // Preserve client errors (400, 404)
  if (
    error instanceof BadRequestException ||
    error instanceof NotFoundException
  ) {
    throw error;  // Re-throw without wrapping
  }
  
  // Wrap server errors (500)
  throw new InternalServerErrorException(`Operation failed: ${error.message}`);
}
```

### 10.4 Logging Strategy

```typescript
// DEBUG - Detailed operation info
this.logger.debug(`Creating statement: ${text.substring(0, 50)}...`);
this.logger.debug(`Extracted ${keywords.length} keywords via AI`);

// LOG - Significant events
this.logger.log(`Creating statement from user ${userId}`);
this.logger.log(`Successfully created statement: ${id}`);

// WARN - Non-fatal issues
this.logger.warn(`Failed to create word node for "${keyword}"`);

// ERROR - Fatal errors with stack traces
this.logger.error(`Error creating statement: ${error.message}`, error.stack);
```

---

## 11. Testing Patterns

### 11.1 Test Structure

**Standard organization:**
```typescript
describe('[NodeType]Service', () => {
  let service: NodeService;
  let mockSchema: jest.Mocked<NodeSchema>;
  // ... other mocks
  
  beforeEach(() => {
    // Setup mocks
  });
  
  describe('CRUD Operations', () => {
    describe('createNode', () => { /* tests */ });
    describe('getNode', () => { /* tests */ });
    describe('updateNode', () => { /* tests */ });
    describe('deleteNode', () => { /* tests */ });
  });
  
  describe('Voting Operations', () => {
    describe('voteInclusion', () => { /* tests */ });
    describe('voteContent', () => { /* tests */ });  // If dual voting
  });
  
  describe('Special Operations', () => {
    // Node-specific tests
  });
  
  describe('Validation', () => { /* tests */ });
  describe('Error Handling', () => { /* tests */ });
});
```

### 11.2 Mock Pattern

**✅ Good: Properly typed**
```typescript
const mockSchema = {
  createNode: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  voteInclusion: jest.fn(),
  voteContent: jest.fn(),
  getVoteStatus: jest.fn(),
  removeVote: jest.fn(),
  getVotes: jest.fn(),
} as unknown as jest.Mocked<NodeSchema>;
```

**❌ Bad: Untyped**
```typescript
const mockSchema = {
  createNode: jest.fn(),
  // TypeScript won't catch missing methods
};
```

### 11.3 Test Coverage Requirements

**Minimum per service:**
1. **CRUD Operations:** ~12 tests (4 operations × 3 scenarios)
2. **Voting Operations:** ~9-15 tests (varies by pattern)
3. **Special Operations:** ~0-15 tests (varies by node)
4. **Error Handling:** ~5 tests

**Total:** ~40-60 tests per service (service layer only)

---

## 12. Comparison Tables

### 12.1 Service Complexity

| Service | LOC | Methods | Dependencies | Test Count | Complexity |
|---------|-----|---------|--------------|------------|-----------|
| Word | ~280 | 12 | 5 | ~100 | Low |
| Definition | ~250 | 11 | 3 | ~110 | Low |
| Category | ~320 | 14 | 3 | ~105 | Low-Medium |
| Statement | ~480 | 18 | 6 | ~164 | Medium |
| OpenQuestion | ~380 | 13 | 6 | ~123 | Medium |
| Answer | ~450 | 15 | 7 | ~141 | Medium |
| Quantity | ~550 | 20 | 7 | ~153 | High |
| Evidence | ~580 | 22 | 6 | ~155 | High |

### 12.2 Feature Matrix

| Feature | Word | Def | Cat | Stmt | OQ | Ans | Qty | Evd |
|---------|------|-----|-----|------|----|-----|-----|-----|
| **Voting** |
| Inclusion | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Content | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Keywords** |
| Extraction | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Word creation | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Categories** |
| Support | ❌ | ❌ | Self | ✅ | ✅ | ✅ | ✅ | ✅ |
| Validation | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Parent** |
| Validation | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Discussion** |
| Optional | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Required | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Special** |
| System | - | - | - | Network | - | - | Numeric | Review |

### 12.3 Dependency Matrix

| Service | NodeSchema | DiscussionSchema | UserSchema | CategoryService | KeywordExtraction | WordService | Other |
|---------|-----------|-----------------|------------|-----------------|-------------------|-------------|-------|
| Word | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | Visibility, Dictionary |
| Definition | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | - |
| Category | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | - |
| Statement | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | - |
| OpenQuestion | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | - |
| Answer | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | OpenQuestionService |
| Quantity | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | UnitService |
| Evidence | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | - |

### 12.4 Validation Requirements

| Validation | Word | Def | Cat | Stmt | OQ | Ans | Qty | Evd |
|-----------|------|-----|-----|------|----|-----|-----|-----|
| Text length | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Creator ID | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Public credit | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Category count (≤3) | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Category approval | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Parent exists | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Parent approved | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| URL format | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Unit validity | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Word count (1-5) | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Initial comment | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 13. Best Practices

### 13.1 Service Design - DO

✅ Inject DiscussionSchema directly (not DiscussionService)  
✅ Always include UserSchema in module providers  
✅ Use UUID generation at service layer (not controller)  
✅ Validate input before calling schemas  
✅ Preserve BadRequestException and NotFoundException  
✅ Log at appropriate levels (debug, log, warn, error)  
✅ Use const assertions: `'user' as const`  
✅ Extract keywords before creating node  
✅ Validate categories in parallel  
✅ Create discussion after node creation succeeds  

### 13.2 Service Design - DON'T

❌ Inject DiscussionService (use DiscussionSchema)  
❌ Forget UserSchema in module providers  
❌ Pass UUID generation to controller  
❌ Skip input validation  
❌ Wrap specific exceptions unnecessarily  
❌ Use untyped `jest.fn()` mocks  
❌ Skip error logging  
❌ Create node before extracting keywords  
❌ Validate categories sequentially  
❌ Create discussion before node exists  

### 13.3 Validation Order

1. Required field presence
2. Field format (email, URL)
3. Text length limits
4. Type validation (boolean, number)
5. Business rules (category count)
6. Existence validation (parent, categories)
7. Approval validation (passed inclusion)

### 13.4 Error Messages

```typescript
// ❌ Vague
'Invalid data'

// ✅ Specific
'Statement text is required and cannot be empty'

// ✅ With context
'Statement text cannot exceed 1000 characters (current: 1523)'

// ✅ With business rule
'Parent question must pass inclusion threshold before answers can be added'

// ✅ With field identifier
'Category technology123 must have passed inclusion threshold'
```

### 13.5 Logging Guidelines

```typescript
// Entry point - LOG level
this.logger.log(`Creating statement from user ${userId}`);

// Detailed operations - DEBUG level
this.logger.debug(`Extracted ${keywords.length} keywords via AI`);

// Non-fatal issues - WARN level
this.logger.warn(`Failed to create word node for "${keyword}"`);

// Fatal errors - ERROR level with stack
this.logger.error(`Error creating statement: ${error.message}`, error.stack);
```

### 13.6 Common Pitfalls

❌ **Forgetting UserSchema in module providers**
- Causes: Runtime DI errors
- Fix: Add to providers array

❌ **Creating discussion before node**
- Causes: Foreign key violations
- Fix: Always create node first

❌ **Sequential category validation**
- Impact: Performance degradation
- Fix: Use Promise.all()

❌ **Wrapping BadRequestException**
- Impact: Wrong HTTP status codes
- Fix: Re-throw without wrapping

---

## 14. Common Patterns Reference

### 14.1 Create Operation Pattern

```typescript
async createNode(nodeData: CreateNodeData): Promise<NodeData> {
  // 1. Validate input
  this.validateCreateNodeData(nodeData);
  
  // 2. Generate ID
  const nodeId = uuidv4();
  
  // 3. Log entry
  this.logger.log(`Creating node from user ${nodeData.createdBy}`);
  
  try {
    // 4. Pre-processing
    // - Extract keywords (if applicable)
    // - Create missing words (if applicable)
    // - Validate categories (if applicable)
    // - Validate parent (if applicable)
    
    // 5. Create node via schema
    const node = await this.nodeSchema.createNode({
      id: nodeId,
      ...nodeData,
    });
    
    // 6. Post-processing (discussion)
    if (nodeData.initialComment) {
      await this.discussionSchema.createDiscussionForNode({
        nodeId: node.id,
        nodeType: 'NodeTypeName',
        nodeIdField: 'id',
        createdBy: nodeData.createdBy,
        initialComment: nodeData.initialComment,
      });
    }
    
    // 7. Log success
    this.logger.log(`Successfully created node: ${node.id}`);
    
    // 8. Return result
    return node;
    
  } catch (error) {
    // 9. Error handling
    if (error instanceof BadRequestException || error instanceof NotFoundException) {
      throw error;
    }
    
    this.logger.error(`Error creating node: ${error.message}`, error.stack);
    throw new InternalServerErrorException(`Failed to create node: ${error.message}`);
  }
}
```

### 14.2 Read Operation Pattern

```typescript
async getNode(id: string): Promise<NodeData | null> {
  if (!id || id.trim() === '') {
    throw new BadRequestException('Node ID is required');
  }
  
  this.logger.debug(`Getting node: ${id}`);
  
  try {
    const node = await this.nodeSchema.findById(id);
    this.logger.debug(`Node ${id}: ${node ? 'found' : 'not found'}`);
    return node;
  } catch (error) {
    this.logger.error(`Error getting node: ${error.message}`, error.stack);
    throw new InternalServerErrorException(`Failed to get node: ${error.message}`);
  }
}
```

### 14.3 Update Operation Pattern

```typescript
async updateNode(id: string, updateData: UpdateNodeData): Promise<NodeData> {
  this.validateUpdateNodeData(updateData);
  this.logger.log(`Updating node: ${id}`);
  
  try {
    // Check if text changed (for keyword re-extraction)
    const textChanged = updateData.text !== undefined && updateData.text !== '';
    
    if (textChanged) {
      const originalNode = await this.getNode(id);
      // Re-extract keywords and create missing words
    }
    
    // Validate new categories if provided
    if (updateData.categoryIds) {
      await this.validateCategories(updateData.categoryIds);
    }
    
    const updatedNode = await this.nodeSchema.updateNode(id, updateData);
    this.logger.log(`Successfully updated node: ${id}`);
    return updatedNode;
    
  } catch (error) {
    if (error instanceof BadRequestException || error instanceof NotFoundException) {
      throw error;
    }
    this.logger.error(`Error updating node: ${error.message}`, error.stack);
    throw new InternalServerErrorException(`Failed to update node: ${error.message}`);
  }
}
```

### 14.4 Delete Operation Pattern

```typescript
async deleteNode(id: string): Promise<void> {
  if (!id || id.trim() === '') {
    throw new BadRequestException('Node ID is required');
  }
  
  this.logger.log(`Deleting node: ${id}`);
  
  try {
    await this.nodeSchema.delete(id);
    this.logger.log(`Successfully deleted node: ${id}`);
  } catch (error) {
    if (error instanceof NotFoundException) {
      throw error;
    }
    this.logger.error(`Error deleting node: ${error.message}`, error.stack);
    throw new InternalServerErrorException(`Failed to delete node: ${error.message}`);
  }
}
```

### 14.5 Vote Operation Pattern

```typescript
async voteInclusion(id: string, userId: string, isPositive: boolean): Promise<VoteResult> {
  if (!id || id.trim() === '') {
    throw new BadRequestException('Node ID is required');
  }
  if (!userId || userId.trim() === '') {
    throw new BadRequestException('User ID is required');
  }
  
  this.logger.debug(`Voting on node: ${id} by user: ${userId}, isPositive: ${isPositive}`);
  
  try {
    const result = await this.nodeSchema.voteInclusion(id, userId, isPositive);
    this.logger.debug(`Vote result: ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    if (error instanceof BadRequestException || error instanceof NotFoundException) {
      throw error;
    }
    this.logger.error(`Error voting: ${error.message}`, error.stack);
    throw new InternalServerErrorException(`Failed to vote: ${error.message}`);
  }
}
```

---

## 15. Quick Reference

### 15.1 Universal Method Signatures

```typescript
// CRUD (all services)
async createNode(nodeData: CreateNodeData): Promise<NodeData>
async getNode(id: string): Promise<NodeData | null>
async updateNode(id: string, updateData: UpdateNodeData): Promise<NodeData>
async deleteNode(id: string): Promise<void>

// Inclusion Voting (all services)
async voteInclusion(id: string, userId: string, isPositive: boolean): Promise<VoteResult>
async getVoteStatus(id: string, userId: string): Promise<VoteStatus | null>
async removeVote(id: string, userId: string): Promise<VoteResult>
async getVotes(id: string): Promise<VoteResult | null>
```

### 15.2 Dual Voting Methods

```typescript
// Definition, Statement, Answer only
async voteContent(id: string, userId: string, isPositive: boolean): Promise<VoteResult>
async removeVote(id: string, userId: string, kind: 'INCLUSION' | 'CONTENT'): Promise<VoteResult>
```

### 15.3 Special System Methods

```typescript
// Statement - Network Relationships
async createRelatedStatement(parentId: string, data: CreateStatementData): Promise<StatementData>
async createDirectRelationship(id1: string, id2: string): Promise<{ success: boolean }>
async removeDirectRelationship(id1: string, id2: string): Promise<void>
async getDirectlyRelatedStatements(id: string): Promise<StatementData[]>

// Quantity - Numeric Responses
async submitResponse(responseData: SubmitResponseData): Promise<QuantityNodeResponse>
async getUserResponse(userId: string, quantityNodeId: string): Promise<QuantityNodeResponse | null>
async deleteUserResponse(userId: string, quantityNodeId: string): Promise<{ success: boolean }>
async getStatistics(quantityNodeId: string): Promise<QuantityNodeStats>

// Evidence - Peer Review
async submitPeerReview(reviewData: SubmitPeerReviewData): Promise<EvidencePeerReview>
async getPeerReviewStats(evidenceId: string): Promise<PeerReviewStats>
async getUserPeerReview(evidenceId: string, userId: string): Promise<EvidencePeerReview | null>
async isPeerReviewAllowed(evidenceId: string): Promise<boolean>
```

### 15.4 Standard Imports

```typescript
// Core NestJS
import { Injectable, Logger, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

// Schemas
import { NodeSchema } from '../../neo4j/schemas/node.schema';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';

// Types
import type { VoteResult, VoteStatus } from '../../neo4j/schemas/vote.schema';
import type { NodeData } from '../../neo4j/schemas/node.schema';

// Constants & Utils
import { TEXT_LIMITS } from '../../constants/validation';
import { VotingUtils } from '../../config/voting.config';

// Keyword services (Statement, OpenQuestion, Answer, Quantity, Evidence)
import { CategoryService } from '../category/category.service';
import { KeywordExtractionService } from '../../services/keyword-extraction/keyword-extraction.service';
import { WordService } from '../word/word.service';
import { KeywordWithFrequency } from '../../services/keyword-extraction/keyword-extraction.interface';
```

### 15.5 Validation Checklist

**Input Validation:**
- [ ] Required fields present
- [ ] Field types correct
- [ ] Text within length limits
- [ ] URLs valid format (if applicable)
- [ ] Category count ≤ 3 (if applicable)
- [ ] Score ranges valid (if applicable)

**Business Validation:**
- [ ] Parent node exists (if applicable)
- [ ] Parent passed inclusion (if applicable)
- [ ] Categories exist (if applicable)
- [ ] Categories passed inclusion (if applicable)
- [ ] Node passed inclusion before content voting (if applicable)
- [ ] Node passed inclusion before special system (if applicable)

**Orchestration:**
- [ ] Keywords extracted (if applicable)
- [ ] Words created (if applicable)
- [ ] Categories validated (if applicable)
- [ ] Node created via schema
- [ ] Discussion created (if initialComment)

**Post-Creation:**
- [ ] Node created successfully
- [ ] Discussion created (if initialComment)
- [ ] Relationships established (categories, keywords, parent)
- [ ] Success logged appropriately

### 15.6 Testing Checklist

**Per Service:**
- [ ] Create: success, validation failures, discussion creation
- [ ] Read: success, not found
- [ ] Update: success, keyword re-extraction (if applicable)
- [ ] Delete: success, not found
- [ ] Vote inclusion: success, validation failures
- [ ] Vote content: threshold check (if applicable)
- [ ] Special operations: all scenarios (if applicable)
- [ ] Error preservation: BadRequestException, NotFoundException

---

## 16. Architectural Decisions

### 16.1 DiscussionSchema Direct Injection

**Decision:** Inject DiscussionSchema, not DiscussionService

**Rationale:**
- Simple single operation
- No additional business logic needed
- Reduces layer nesting
- Better performance

**Impact:** All 8 services follow consistently

### 16.2 UserSchema in All Modules

**Decision:** Include UserSchema in providers

**Rationale:**
- Universal user tracking
- Required by NestJS DI
- Prevents runtime errors

**Impact:** All 8 modules include it

### 16.3 Different Voting Patterns

**Decision:** Vary voting by node type

**Rationale:**
- **Dual** (Def/Stmt/Ans): Subjective quality assessment
- **Numeric** (Qty): Objective measurements
- **Peer Review** (Evd): Multi-dimensional quality
- **Inclusion-only** (Word/Cat/OQ): Simple existence

**Impact:** Clear, intentional variation

### 16.4 Keyword Extraction in 5 Services

**Decision:** Only Stmt/OQ/Ans/Qty/Evd extract keywords

**Rationale:**
- Word: Is a keyword
- Definition: Inherits from parent
- Category: Uses words directly
- Others: Rich content needs tagging

**Impact:** Consistent across applicable services

### 16.5 Parallel Category Validation

**Decision:** Validate all categories simultaneously

**Rationale:**
- Performance: Simultaneous vs sequential
- Fast failure
- Network efficiency

**Impact:** All 5 category services use it

### 16.6 Answer's OpenQuestionService Dependency

**Decision:** AnswerService depends on OpenQuestionService

**Rationale:**
- Cleaner abstraction
- Business-level validation
- Tight coupling appropriate
- Future-proof

**Impact:** Only cross-service dependency

### 16.7 Evidence Delegates Parent Validation

**Decision:** Evidence delegates to schema

**Rationale:**
- Multiple parent types (3)
- Schema has validation logic
- Avoids cross-domain dependencies

**Impact:** Simpler service layer

---

## 17. Future Considerations

### 17.1 Potential Refactoring

**Shared Helpers:**

Could extract keyword extraction and category validation to shared helpers, but currently kept explicit for clarity and customizability.

**Trade-offs:**
- ✅ DRY principle
- ❌ Additional abstraction
- ❌ Less explicit
- ❌ Harder to customize

**Decision:** Keep explicit for now

### 17.2 Universal Graph Service

**Phase 4 Preparation:**

Current consistent patterns enable future cross-node operations:
- Unified discovery
- Cross-node search
- Graph analytics

### 17.3 Performance Optimization

**Future possibilities (not needed yet):**
- Caching layer (Redis)
- Batch operations
- Async job queue for heavy operations

**Decision:** No optimization until performance issues appear

---

## 18. Glossary

**Service Layer:** Business logic between HTTP and database  
**Schema Layer:** Database access (Cypher queries)  
**Controller Layer:** HTTP handling  
**Node:** Any content type (Word, Statement, etc.)  
**Inclusion Voting:** "Should this exist?"  
**Content Voting:** "Is this quality?"  
**Dual Voting:** Both inclusion and content  
**Keyword Extraction:** AI identifies important words  
**Word Auto-Creation:** Creating Word nodes for keywords  
**Category Validation:** Verifying categories exist and passed inclusion  
**Parent Validation:** Verifying parent exists and passed inclusion  
**Discussion:** Comment thread for a node  
**Initial Comment:** First comment in discussion  
**Orchestration:** Coordinating multiple operations  
**Direct Delegation:** Simple pass-through to schema  
**Business Validation:** Beyond data type checking  
**Special System:** Alternative to content voting  
**Numeric Response:** User measurement with units  
**Peer Review:** 3D quality assessment  
**Network Relationships:** Statement connections  
**UUID:** Universally Unique Identifier  
**nodeIdField:** Primary key field name  

---

## 19. Related Documentation

**Schema Layer:** `schema-layer.md` - Database patterns  
**Controller Layer:** `controller-layer.md` - HTTP patterns (to be created)  
**API Documentation:** OpenAPI/Swagger (when available)  
**Database:** Neo4j graph model, Cypher patterns  
**Testing:** Strategy, patterns, helpers  

---

20. Document Metadata
Version: 1.0 (Corrected & Consolidated)
Last Updated: 2025
Status: Production Ready
Maintainer: ProjectZer0 Team
Document Structure:

Part A: service-layer-CORRECTED.md - Sections 1-8 (Overview through Parent Validation)
Part B: service-layer-CORRECTED-part-B.md - Sections 9-20 (Special Systems through Metadata)

Why Split:

Artifact length limitations
Logical separation for easier navigation
Part A: Core architecture and patterns
Part B: Advanced topics and reference

Total Services Documented: 8
Total Tests Covered: 1,151
Total Lines of Documentation: ~3,500+
Architectural Consistency: 100%
Key Corrections in This Version:

✅ Removed incorrect StatementService content showing Quantity methods
✅ Properly ordered all sections (1-20 sequential)
✅ Fixed section 4.4 to show correct Statement network relationship methods
✅ Consolidated duplicate "Special Systems" sections
✅ Ensured consistent formatting throughout

Usage Notes:
For Development:

Reference Part A for implementation patterns
Use Part B for specific scenarios (testing, error handling, special systems)
Quick Reference (Section 15) provides method signatures

For AI Context:

Provide Part A (sections 1-8) for architectural understanding
Add specific node service section (4.1-4.8) relevant to task
Add Part B sections as needed for specific topics

For Onboarding:

Read sections 1-3 (Overview, Philosophy, Core Patterns)
Review comparison tables (section 12)
Study one node service in detail (section 4.x)
Review best practices (section 13)

For Reference:

Jump directly to Quick Reference (section 15)
Use Glossary (section 18) for terminology
Check Architectural Decisions (section 16) for rationale


Navigation Guide
Sections by Purpose:
Architecture & Patterns (Part A):

Section 1: Overview
Section 2: Architecture Philosophy
Section 3: Core Patterns
Section 4: All 8 Node Services (detailed reference)
Section 5: Voting Patterns
Section 6: Keyword Extraction
Section 7: Category Validation
Section 8: Parent Validation

Advanced Topics (Part B):

Section 9: Special Systems (Numeric, Peer Review, Network)
Section 10: Error Handling
Section 11: Testing Patterns
Section 12: Comparison Tables

Implementation Guide (Part B):

Section 13: Best Practices
Section 14: Common Patterns Reference
Section 15: Quick Reference (most useful for day-to-day)

Context & Rationale (Part B):

Section 16: Architectural Decisions
Section 17: Future Considerations
Section 18: Glossary
Section 19: Related Documentation
Section 20: Document Metadata (this section)


Document History
Version 1.0 (Current):

Corrected section ordering
Fixed StatementService content (section 4.4)
Consolidated from 3 parts to 2 logical parts
Added comprehensive navigation guide
Enhanced metadata section

Previous Versions:

0.9: Initial three-part documentation (had ordering issues)
0.8: Phase 2 completion documentation
0.7: Phase 2 in-progress documentation


Maintenance Notes
When to Update:

New node type added → Add to section 4, update all comparison tables
Pattern changes → Update section 3 and affected node services
New special system → Add to section 9
Architecture decisions → Add to section 16

Consistency Checks:

All 8 services follow patterns in section 3
Comparison tables (section 12) match individual service docs
Quick Reference (section 15) includes all current methods
Glossary (section 18) covers all technical terms used


End of Service Layer Documentation
For controller layer patterns and HTTP endpoint documentation, see controller-layer.md (to be created in next phase).
For schema layer patterns and database operations, see existing schema-layer.md.

Questions or Issues?
If you find any inconsistencies, outdated information, or areas needing clarification:

Check if the pattern exists in actual code (source of truth)
Verify against comparison tables for consistency
Review architectural decisions for context
Update documentation to match current implementation

This documentation is a reference guide, not a specification.
The actual code is the source of truth. This documentation explains patterns, rationale, and best practices observed in the production codebase.