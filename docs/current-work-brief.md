<invoke name="artifacts">
<parameter name="command">update</parameter>
<parameter name="type">text/markdown</parameter>
<parameter name="id">phase3-complete-brief</parameter>
<parameter name="old_str">- [ ] Can discover</parameter>
<parameter name="new_str">- [ ] Can discover evidence for nodes
- [ ] Documentation complete

---

# PHASE 3: UNIVERSAL GRAPH SERVICE

## 📊 **Current State Assessment**

### **What Exists (Partial Implementation)**

**Location:** `src/nodes/universal/`

**UniversalGraphService** - Partially implemented:
- ✅ Supports 5 node types (statement, openquestion, answer, quantity, category)
- ✅ Basic keyword filtering (include/exclude)
- ✅ Basic category filtering (include/exclude)
- ✅ Simple sorting (netVotes, chronological, participants)
- ✅ Relationship loading (shared_keyword, related_to, answers)
- ✅ User context enrichment (vote status, visibility prefs)
- ❌ Missing keyword/category ANY/ALL modes
- ❌ Missing proper content vote sorting with fallbacks
- ❌ Missing total votes sorting
- ❌ Missing user interaction filtering
- ❌ Missing Evidence node support
- ❌ Missing proper default dataset (includes wrong node types)

**UniversalGraphController** - Partially implemented:
- ✅ Basic query parameter parsing
- ✅ Query validation
- ❌ Missing proper parameter handling for new features

---

## 🎯 **Requirements Specification**

### **1. DEFAULT DATASET**

**Initial Load (No Filters Applied):**
```typescript
{
  nodes: [Statement, OpenQuestion, Answer, Quantity, Evidence]
  
  // WHY THESE NODES:
  // - All have inclusionNetVotes (unifying field for default sort)
  // - All support keywords AND categories (via CategorizedNodeSchema)
  // - Primary "content" nodes users interact with
  // - Mixed content voting patterns acknowledged:
  //   * Statement, Answer: Standard content voting
  //   * OpenQuestion, Quantity, Evidence: Alternative quality systems
  
  // EXCLUDED NODES (load on-demand only):
  // ❌ Word - Load on-demand only
  // ❌ Definition - Load on-demand only
  // ❌ Category - Load on-demand only (unless specifically filtered)
  // ❌ Comment - Load on-demand only
  // ❌ Discussion - Load on-demand only
  
  sort: inclusionNetVotes DESC
  limit: 200
  offset: 0
}
```

---

### **2. FILTER REQUIREMENTS**

#### **2.1 Node Type Filter**

**Available Types (checkboxes in UI):**
```typescript
type FilterableNodeType = 
  | 'statement'
  | 'openquestion'  // Note: Coupled with 'answer'
  | 'answer'        // Note: Coupled with 'openquestion'
  | 'quantity'
  | 'evidence';

interface NodeTypeFilter {
  types: FilterableNodeType[];
  include: boolean;  // true = include only these, false = exclude these
}
```

**CRITICAL: Answer-Question Coupling**

Answers **cannot** be fetched independently of their parent questions.

**UI Implementation:**
- Checkbox label: **"Open Questions & Answers"** (single checkbox)
- Selecting this checkbox includes BOTH openquestion AND answer types
- User cannot select answers without questions

**Backend Implementation:**

```typescript
// When answer is selected, auto-include openquestion
if (nodeTypeFilter.includes('answer')) {
  if (!nodeTypeFilter.includes('openquestion')) {
    nodeTypeFilter.push('openquestion');
  }
}

// Query pattern:
// 1. Fetch questions that have qualifying answers
// 2. Include those questions in results
// 3. Include their answers in results
// 4. Create ANSWERS relationships between them
```

**Query Pattern:**

```cypher
// Fetch questions with qualifying answers
MATCH (q:OpenQuestionNode)<-[:ANSWERS]-(a:AnswerNode)
WHERE [filters apply to answer]
AND [filters apply to question]
WITH q, collect(a) as answers
RETURN q, answers
```

**Examples:**
```typescript
// Show only statements and evidence
{ types: ['statement', 'evidence'], include: true }

// Show everything except quantities
{ types: ['quantity'], include: false }

// Show questions and answers (both required)
{ types: ['openquestion', 'answer'], include: true }
```

**Default:**
```typescript
{ 
  types: ['statement', 'openquestion', 'answer', 'quantity', 'evidence'], 
  include: true 
}
```

---

#### **2.2 Keyword Filter**

**UI Pattern:** Searchable dropdown with multi-select

**Data Structure:**
```typescript
interface KeywordFilter {
  mode: 'any' | 'all';  // Matching logic
  include: boolean;     // true = include, false = exclude
  values: string[];     // Selected keywords
}
```

**Matching Logic:**

**MODE: "ANY"**
```cypher
// Show nodes with ANY of the specified keywords
WHERE EXISTS {
  MATCH (node)-[:TAGGED]->(w:WordNode)
  WHERE w.word IN $keywords
}
```

**MODE: "ALL"**
```cypher
// Show nodes with ALL of the specified keywords
WHERE ALL(keyword IN $keywords WHERE EXISTS(
  (node)-[:TAGGED]->(:WordNode {word: keyword})
))
```

**Include vs Exclude:**
```typescript
// Include mode (show nodes WITH these keywords)
include: true

// Exclude mode (hide nodes WITH these keywords)
include: false
```

**Examples:**
```typescript
// Show nodes about AI OR ethics
{ mode: 'any', include: true, values: ['ai', 'ethics'] }

// Show nodes about BOTH AI AND ethics
{ mode: 'all', include: true, values: ['ai', 'ethics'] }

// Hide nodes about politics
{ mode: 'any', include: false, values: ['politics'] }
```

**Default:** No filter (empty array)

---

#### **2.3 Category Filter**

**UI Pattern:** Searchable dropdown with multi-select

**Data Structure:**
```typescript
interface CategoryFilter {
  mode: 'any' | 'all';  // Matching logic
  include: boolean;     // true = include, false = exclude
  values: string[];     // Category IDs
}
```

**Matching Logic:**

**MODE: "ANY"**
```cypher
// Show nodes in ANY of the specified categories
WHERE EXISTS {
  MATCH (node)-[:CATEGORIZED_AS]->(c:CategoryNode)
  WHERE c.id IN $categoryIds AND c.inclusionNetVotes > 0
}
```

**MODE: "ALL"**
```cypher
// Show nodes in ALL of the specified categories
WHERE ALL(catId IN $categoryIds WHERE EXISTS(
  (node)-[:CATEGORIZED_AS]->(:CategoryNode {id: catId})
))
```

**Include vs Exclude:**
```typescript
// Include mode (show nodes IN these categories)
include: true

// Exclude mode (hide nodes IN these categories)
include: false
```

**Examples:**
```typescript
// Show nodes in Technology OR Science
{ mode: 'any', include: true, values: ['cat-tech', 'cat-science'] }

// Show nodes in BOTH Technology AND Science
{ mode: 'all', include: true, values: ['cat-tech', 'cat-science'] }

// Hide nodes in Politics category
{ mode: 'any', include: false, values: ['cat-politics'] }
```

**Default:** No filter (empty array)

---

#### **2.4 User Filter**

**UI Pattern:** Radio buttons (exclusive selection)

**Data Structure:**
```typescript
type UserFilterMode = 'all' | 'created' | 'interacted';

interface UserFilter {
  mode: UserFilterMode;
  userId: string;  // From auth context
}
```

**Filter Modes:**

**MODE: "all"** (Default)
```cypher
// No user filtering - show all nodes
```

**MODE: "created"**
```cypher
// Show only nodes created by this user
WHERE node.createdBy = $userId
```

**MODE: "interacted"**
```cypher
// Show nodes user has interacted with (voted OR commented)
WHERE EXISTS {
  MATCH (u:User {sub: $userId})-[r]->(node)
  WHERE type(r) IN ['VOTED_ON', 'COMMENTED']
}
```

**Note:** 
- "interacted" includes: VOTED_ON, COMMENTED
- Future enhancement could add: RESPONSE_TO (quantity), PEER_REVIEWED (evidence)
- User who created a node has inherently "interacted" with it

**Default:** `{ mode: 'all', userId: currentUser.sub }`

---

### **3. SORT REQUIREMENTS**

All sorts support both ascending and descending order.

#### **3.1 Net Inclusion Votes**

**Field:** `inclusionNetVotes = inclusionPositiveVotes - inclusionNegativeVotes`

**Purpose:** Show consensus - how much the community supports this content's existence

**Use Cases:**
- DESC: Show most community-approved content first
- ASC: Show least approved (or most rejected) content first

**Cypher:**
```cypher
ORDER BY node.inclusionNetVotes DESC
```

**Applies to:** All nodes with inclusion voting (all CategorizedNodeSchema nodes)

**Default:** This is the DEFAULT sort (DESC)

---

#### **3.2 Total Inclusion Votes**

**Field:** `totalInclusionVotes = inclusionPositiveVotes + inclusionNegativeVotes`

**Purpose:** Show engagement - how much debate/discussion the content has generated

**Use Cases:**
- DESC: Show most debated content (high controversy OR high agreement)
- ASC: Show least noticed content

**Cypher:**
```cypher
ORDER BY (node.inclusionPositiveVotes + node.inclusionNegativeVotes) DESC
```

**Example Scenarios:**
```
Node A: +100, -5   = 105 total (very popular)
Node B: +52, -48   = 100 total (highly controversial)
Node C: +3, -2     = 5 total (little engagement)

Total sort DESC: A, B, C
```

**Applies to:** All nodes with inclusion voting

---

#### **3.3 Date Created**

**Field:** `createdAt`

**Purpose:** Show chronological order

**Use Cases:**
- DESC: Show newest content first (recent discussions)
- ASC: Show oldest content first (foundational/original content)

**Cypher:**
```cypher
ORDER BY node.createdAt DESC
```

**Applies to:** All nodes

---

#### **3.4 Net Content Votes**

**Field:** `contentNetVotes = contentPositiveVotes - contentNegativeVotes`

**Purpose:** Show quality consensus - how good the community thinks this content is

**CRITICAL FEATURE - Fallback Logic:**
```typescript
// For nodes WITH content voting (Statement, Answer)
sortValue = node.contentNetVotes

// For nodes WITHOUT content voting (OpenQuestion, Quantity, Evidence)
sortValue = node.inclusionNetVotes  // FALLBACK
```

**Use Cases:**
- DESC: Show highest quality content first
- ASC: Show lowest quality content first

**Cypher:**
```cypher
ORDER BY COALESCE(node.contentNetVotes, node.inclusionNetVotes) DESC
```

**Applies to:**
- Direct: Statement, Answer
- Fallback: OpenQuestion, Quantity, Evidence

**Why Fallback is Important:**
When graph shows mixed node types, we need consistent sorting. OpenQuestions don't have content voting, but we can't just exclude them - instead, use their inclusion votes as a proxy for "quality".

---

#### **3.5 Total Content Votes**

**Field:** `totalContentVotes = contentPositiveVotes + contentNegativeVotes`

**Purpose:** Show quality debate - how much the quality of this content is being discussed

**CRITICAL FEATURE - Fallback Logic:**
```typescript
// For nodes WITH content voting (Statement, Answer)
sortValue = contentPositiveVotes + contentNegativeVotes

// For nodes WITHOUT content voting (fallback)
sortValue = inclusionPositiveVotes + inclusionNegativeVotes
```

**Use Cases:**
- DESC: Show most quality-debated content (could be controversial quality or universally praised)
- ASC: Show content with little quality assessment

**Cypher:**
```cypher
ORDER BY COALESCE(
  (node.contentPositiveVotes + node.contentNegativeVotes),
  (node.inclusionPositiveVotes + node.inclusionNegativeVotes)
) DESC
```

**Example Scenarios:**
```
Statement A: content: +50, -2  = 52 total (high quality agreement)
Statement B: content: +30, -28 = 58 total (controversial quality)
OpenQuestion C: inclusion: +40, -5 = 45 total (using fallback)

Total content sort DESC: B (58), A (52), C (45 fallback)
```

**Applies to:**
- Direct: Statement, Answer
- Fallback: OpenQuestion, Quantity, Evidence

---

#### **3.6 Category Overlap**

**Field:** Calculated - number of shared categories with filter

**Purpose:** Show content most similar to selected categories

**CRITICAL:** Only available when category filter is active

**Logic:**
```typescript
// Count how many of the filtered categories each node has
categoryOverlapScore = COUNT(
  node.categories ∩ filter.categories
)

// Sort by this score
ORDER BY categoryOverlapScore DESC
```

**Cypher:**
```cypher
// After filtering by categories
WITH node, 
     size([cat IN node.categories WHERE cat.id IN $filteredCategoryIds]) as overlapScore
ORDER BY overlapScore DESC
```

**Use Cases:**
- User filters by ['Technology', 'Ethics', 'AI']
- Nodes with all 3 categories appear first
- Nodes with 2 categories appear next
- Nodes with 1 category appear last

**Direction:** DESC only (most overlap first)

**Applies to:** All CategorizedNodeSchema nodes, only when categories filter is active

**Validation:** Controller must reject this sort if no categories are filtered

---

#### **3.7 Participant Count**

**Field:** Calculated - unique users who interacted with this node

**Purpose:** Show community engagement

**Logic:**
```cypher
// Count distinct users who voted OR commented
WITH node,
     size([(u:User)-[:VOTED_ON|COMMENTED]->(node) | u]) as participantCount
ORDER BY participantCount DESC
```

**Use Cases:**
- DESC: Show most actively discussed content
- ASC: Show content with little community engagement

**Difference from Total Votes:**
- Total votes: One user can cast multiple votes (inclusion + content)
- Participant count: Counts each user only once

**Example:**
```
Node A: 
  - 10 users voted inclusion
  - 8 users voted content
  - 3 users commented
  → Participant count = 15 unique users (some overlap)
  → Total votes = 18 (10 + 8)

Node B:
  - 50 users voted inclusion
  - 0 users voted content
  - 0 users commented
  → Participant count = 50
  → Total votes = 50
```

**Applies to:** All nodes

---

### **4. RELATIONSHIP REQUIREMENTS**

**Control which relationship types are included in the response.**

```typescript
interface RelationshipOptions {
  include: boolean;  // Master toggle
  types: RelationshipType[];
}

type RelationshipType =
  | 'shared_keyword'
  | 'shared_category'
  | 'related_to'
  | 'answers'
  | 'evidence_for'
  | 'categorized_as';
```

**Relationship Descriptions:**

#### **4.1 shared_keyword**
```cypher
(Node1)-[:SHARED_TAG {word: 'ai', strength: 0.64}]->(Node2)
```
- Nodes that share the same keyword
- Strength = product of tag frequencies
- Used for topic-based discovery

#### **4.2 shared_category**
```cypher
(Node1)-[:SHARED_CATEGORY {categoryId: 'cat-1', strength: 2}]->(Node2)
```
- Nodes in the same category
- Strength = number of shared categories
- Used for organizational discovery

#### **4.3 related_to**
```cypher
(Statement1)-[:RELATED_TO {relationshipType: 'child'}]->(Statement2)
```
- Direct user-created relationships between statements
- Used for threading and conversation flow

#### **4.4 answers**
```cypher
(Answer)-[:ANSWERS]->(OpenQuestion)
```
- Links answers to their parent questions
- Hierarchical relationship

#### **4.5 evidence_for**
```cypher
(Evidence)-[:EVIDENCE_FOR]->(Statement | Answer | Quantity)
```
- Links evidence to claims they support
- Directional (evidence → claim)
- Used for claim verification and evidence discovery

#### **4.6 categorized_as**
```cypher
(Node)-[:CATEGORIZED_AS]->(Category)
```
- Links nodes to their categories
- NOTE: Only included if Category nodes are in the dataset (advanced use case)

**Default:** 
```typescript
{ 
  include: true, 
  types: ['shared_keyword', 'shared_category', 'related_to', 'answers', 'evidence_for'] 
}
```

---

### **5. PAGINATION REQUIREMENTS**

```typescript
interface PaginationOptions {
  limit: number;    // How many nodes to return
  offset: number;   // Skip this many nodes
}
```

**Constraints:**
- `limit`: Min 1, Max 1000, Default 200
- `offset`: Min 0, Default 0

**Response includes:**
```typescript
{
  nodes: [...],
  relationships: [...],
  pagination: {
    total: 1547,      // Total nodes matching filters
    offset: 0,
    limit: 200,
    hasMore: true     // true if offset + limit < total
  }
}
```

---

### **6. USER CONTEXT ENRICHMENT**

**Automatic Enhancement:** When `requesting_user_id` is provided, enhance each node with user-specific data.

```typescript
// For each node in response
node.metadata.userVoteStatus = {
  inclusionVote: 'agree' | 'disagree' | null,
  contentVote: 'agree' | 'disagree' | null
}

node.metadata.userVisibilityPreference = {
  isVisible: boolean,
  source: 'user' | 'community',
  timestamp: number
}
```

**Data Sources:**
- VoteSchema: `getVoteStatus(nodeLabel, nodeId, userId)`
- VisibilityService: `getVisibilityStatus(nodeId, userId)`

**Performance Note:** Batch these queries - don't make individual calls per node

---

### **7. CROSS-NODE REFERENCES**

**Handling Parent Info When Parent Not in Result Set:**

For some node types, we need to include parent/related node info even if that parent isn't in the result set.

**For Answer Nodes:**
```typescript
typeSpecific: {
  parentQuestion: {
    id: string;
    questionText: string;  // Always include, even if parent not in results
  }
}
```

**For Evidence Nodes:**
```typescript
typeSpecific: {
  parentNode: {
    id: string;
    type: 'statement' | 'answer' | 'quantity';
    // Could optionally include title/text
  }
}
```

**Relationship Creation Rule:**
Only create relationships between nodes that are BOTH in the result set.

```typescript
// Example: If answer's parent question is not in results
if (!nodeIds.includes(answer.parentQuestionId)) {
  // Don't create the ANSWERS relationship
  // But still keep parentQuestion metadata on the answer node
}
```

---

## 📐 **Data Structure Specifications**

### **Request Interface**

```typescript
interface UniversalGraphRequest {
  // Node Type Filter
  nodeTypes?: {
    types: Array<'statement' | 'openquestion' | 'answer' | 'quantity' | 'evidence'>;
    include: boolean;
  };
  
  // Keyword Filter
  keywords?: {
    mode: 'any' | 'all';
    include: boolean;
    values: string[];
  };
  
  // Category Filter
  categories?: {
    mode: 'any' | 'all';
    include: boolean;
    values: string[];
  };
  
  // User Filter
  user?: {
    mode: 'all' | 'created' | 'interacted';
    userId: string;
  };
  
  // Sort Options
  sort: {
    by: 'netInclusionVotes' | 'totalInclusionVotes' | 'dateCreated' | 
        'netContentVotes' | 'totalContentVotes' | 'categoryOverlap' | 'participantCount';
    direction: 'asc' | 'desc';
  };
  
  // Pagination
  pagination: {
    limit: number;
    offset: number;
  };
  
  // Relationships
  relationships: {
    include: boolean;
    types: Array<'shared_keyword' | 'shared_category' | 'related_to' | 
                 'answers' | 'evidence_for' | 'categorized_as'>;
  };
  
  // User Context (from auth)
  requestingUserId?: string;
}
```

---

### **Response Interface (D3-Ready)**

```typescript
interface UniversalGraphResponse {
  // Nodes array - ready for D3
  nodes: UniversalNode[];
  
  // Relationships array - ready for D3
  relationships: UniversalRelationship[];
  
  // Pagination info
  pagination: {
    total: number;
    offset: number;
    limit: number;
    hasMore: boolean;
  };
  
  // Performance metrics
  performance: {
    nodeCount: number;
    relationshipCount: number;
    relationshipDensity: number;
    queryTimeMs: number;
  };
}
```

#### **UniversalNode Structure**

```typescript
interface UniversalNode {
  // Core identification
  id: string;
  type: 'statement' | 'openquestion' | 'answer' | 'quantity' | 'evidence';
  
  // Display content
  content: string;  // The main text to display
  
  // Timestamps
  createdAt: string;  // ISO 8601
  updatedAt?: string; // ISO 8601
  
  // Creator
  createdBy: string;
  publicCredit: boolean;
  
  // Metadata for visualization and interaction
  metadata: {
    // Voting data
    votes: {
      inclusion: {
        positive: number;
        negative: number;
        net: number;
      };
      content?: {  // Only present for nodes with content voting
        positive: number;
        negative: number;
        net: number;
      };
    };
    
    // Keywords (tags)
    keywords: Array<{
      word: string;
      frequency: number;
    }>;
    
    // Categories
    categories: Array<{
      id: string;
      name: string;
      description?: string;
    }>;
    
    // Discussion reference
    discussionId?: string;
    
    // User-specific data (if requesting_user_id provided)
    userVoteStatus?: {
      inclusionVote: 'agree' | 'disagree' | null;
      contentVote: 'agree' | 'disagree' | null;
    };
    
    userVisibilityPreference?: {
      isVisible: boolean;
      source: 'user' | 'community';
      timestamp: number;
    };
    
    // Type-specific metadata
    typeSpecific?: {
      // For OpenQuestion
      answerCount?: number;
      
      // For Answer
      parentQuestion?: {
        id: string;
        questionText: string;
      };
      
      // For Quantity
      unitCategory?: {
        id: string;
        name: string;
      };
      defaultUnit?: {
        id: string;
        name: string;
      };
      responseCount?: number;
      statistics?: {
        min: number;
        max: number;
        mean: number;
        median: number;
        standardDeviation: number;
        percentiles: { [key: number]: number };
      };
      
      // For Evidence
      evidenceType?: 'academic_paper' | 'news_article' | 'government_report' | 
                     'dataset' | 'book' | 'website' | 'legal_document' | 
                     'expert_testimony' | 'survey_study' | 'meta_analysis' | 'other';
      url?: string;
      authors?: string[];
      publicationDate?: string;
      avgQualityScore?: number;
      avgIndependenceScore?: number;
      avgRelevanceScore?: number;
      overallScore?: number;
      reviewCount?: number;
      parentNode?: {
        id: string;
        type: 'statement' | 'answer' | 'quantity';
      };
    };
  };
}
```

#### **UniversalRelationship Structure**

```typescript
interface UniversalRelationship {
  // Unique identifier
  id: string;  // Generated: `${source}-${type}-${target}`
  
  // D3 requires these exact field names
  source: string;  // Node ID
  target: string;  // Node ID
  
  // Relationship type
  type: 'shared_keyword' | 'shared_category' | 'related_to' | 
        'answers' | 'evidence_for' | 'categorized_as';
  
  // Strength/weight for visualization
  strength: number;
  
  // Type-specific metadata
  metadata?: {
    // For shared_keyword
    keyword?: string;
    
    // For shared_category
    categoryId?: string;
    categoryName?: string;
    
    // For related_to
    relationshipType?: 'child' | 'parent';
    
    // For evidence_for
    evidenceType?: string;
    
    // General
    createdAt?: string;
  };
}
```

---

## 🏗️ **Implementation Architecture**

### **File Structure**

```
src/nodes/universal/
├── universal-graph.controller.ts      # HTTP layer
├── universal-graph.service.ts         # Business logic
├── universal-graph.module.ts          # DI configuration
├── dto/
│   ├── universal-graph-request.dto.ts # Request validation
│   └── universal-graph-response.dto.ts# Response types
├── interfaces/
│   ├── filters.interface.ts           # Filter types
│   ├── sorts.interface.ts             # Sort types
│   └── node-data.interface.ts         # Node/Relationship types
└── utils/
    ├── query-builder.util.ts          # Build complex queries
    ├── sort-handler.util.ts           # Sorting logic
    └── filter-handler.util.ts         # Filter logic
```

---

### **Controller Layer**

**Responsibilities:**
1. Parse HTTP query parameters
2. Validate inputs
3. Transform to service DTOs
4. Call service
5. Return HTTP response
6. Handle errors

**Key Methods:**

```typescript
@Controller('graph/universal')
@UseGuards(JwtAuthGuard)
export class UniversalGraphController {
  
  @Get('nodes')
  async getUniversalNodes(
    @Query() query: UniversalNodesQueryDto,
    @Request() req: AuthenticatedRequest
  ): Promise<UniversalGraphResponse> {
    // 1. Parse query parameters
    const filters = this.parseFilters(query);
    const sort = this.parseSort(query);
    const pagination = this.parsePagination(query);
    const relationships = this.parseRelationships(query);
    
    // 2. Validate
    this.validateRequest(filters, sort, pagination, relationships);
    
    // 3. Add user context
    const requestingUserId = req.user.sub;
    
    // 4. Call service
    return await this.universalGraphService.getUniversalNodes({
      filters,
      sort,
      pagination,
      relationships,
      requestingUserId
    });
  }
  
  // Helper endpoints
  
  @Get('filters/keywords')
  async getAvailableKeywords(): Promise<string[]> {
    // Return list of all keywords for dropdown
  }
  
  @Get('filters/categories')
  async getAvailableCategories(): Promise<CategoryInfo[]> {
    // Return list of all categories for dropdown
  }
}
```

**Query Parameter Format:**

Use flat style for HTTP query strings (simpler than nested objects):

```
// Node types
?nodeTypes[]=statement&nodeTypes[]=answer&nodeTypesInclude=true

// Keywords
?keywords[]=ai&keywords[]=ethics&keywordMode=all&keywordsInclude=true

// Categories
?categories[]=cat-1&categories[]=cat-2&categoryMode=any&categoriesInclude=true

// User filter
?userFilter=created

// Sort
?sortBy=netInclusionVotes&sortDirection=desc

// Pagination
?limit=200&offset=0

// Relationships
?includeRelationships=true&relationshipTypes[]=shared_keyword&relationshipTypes[]=answers
```

---

### **Service Layer**

**Core Method Signature:**

```typescript
@Injectable()
export class UniversalGraphService {
  constructor(
    private readonly neo4jService: Neo4jService,
    private readonly statementSchema: StatementSchema,
    private readonly openQuestionSchema: OpenQuestionSchema,
    private readonly answerSchema: AnswerSchema,
    private readonly quantitySchema: QuantitySchema,
    private readonly evidenceSchema: EvidenceSchema,
    private readonly voteSchema: VoteSchema,
    private readonly visibilityService: VisibilityService,
    private readonly categoryService: CategoryService
  ) {}
  
  async getUniversalNodes(options: UniversalGraphOptions): Promise<UniversalGraphResponse> {
    const startTime = Date.now();
    
    // 1. Fetch nodes from each schema based on filters
    const nodes = await this.fetchFilteredNodes(options.filters, options.sort, options.pagination);
    
    // 2. Apply cross-schema sorting if needed
    const sortedNodes = this.applySorting(nodes, options.sort);
    
    // 3. Apply pagination
    const paginatedNodes = this.applyPagination(sortedNodes, options.pagination);
    
    // 4. Enrich with user context if provided
    const enrichedNodes = options.requestingUserId 
      ? await this.enrichWithUserContext(paginatedNodes, options.requestingUserId)
      : paginatedNodes;
    
    // 5. Fetch relationships if requested
    const relationships = options.relationships.include
      ? await this.fetchRelationships(enrichedNodes, options.relationships.types)
      : [];
    
    // 6. Format response
    return {
      nodes: enrichedNodes,
      relationships,
      pagination: {
        total: sortedNodes.length,
        offset: options.pagination.offset,
        limit: options.pagination.limit,
        hasMore: options.pagination.offset + options.pagination.limit < sortedNodes.length
      },
      performance: {
        nodeCount: enrichedNodes.length,
        relationshipCount: relationships.length,
        relationshipDensity: this.calculateDensity(enrichedNodes, relationships),
        queryTimeMs: Date.now() - startTime
      }
    };
  }
}
```

---

### **Key Service Methods**

#### **1. fetchFilteredNodes**

```typescript
private async fetchFilteredNodes(
  filters: FilterOptions,
  sort: SortOptions,
  pagination: PaginationOptions
): Promise<UniversalNode[]> {
  const allNodes: UniversalNode[] = [];
  
  // Determine which node types to query
  const nodeTypesToFetch = this.determineNodeTypes(filters.nodeTypes);
  
  // IMPORTANT: Handle answer-question coupling
  if (nodeTypesToFetch.includes('answer') && !nodeTypesToFetch.includes('openquestion')) {
    nodeTypesToFetch.push('openquestion');
  }
  
  // Query each node type in parallel
  const nodePromises = nodeTypesToFetch.map(type =>

  <invoke name="artifacts">
<parameter name="command">update</parameter>
<parameter name="type">text/markdown</parameter>
<parameter name="id">phase3-complete-brief</parameter>
<parameter name="old_str">  // Query each node type in parallel
  const nodePromises = nodeTypesToFetch.map(type =></parameter>
<parameter name="new_str">  // Query each node type in parallel
  const nodePromises = nodeTypesToFetch.map(type => {
    switch (type) {
      case 'statement':
        return this.fetchStatements(filters);
      case 'openquestion':
        return this.fetchOpenQuestions(filters);
      case 'answer':
        return this.fetchAnswers(filters);
      case 'quantity':
        return this.fetchQuantities(filters);
      case 'evidence':
        return this.fetchEvidence(filters);
    }
  });
  
  const nodeArrays = await Promise.all(nodePromises);
  
  // Flatten and combine
  nodeArrays.forEach(nodes => allNodes.push(...nodes));
  
  return allNodes;
}
```

#### **2. fetchStatements (example pattern)**

```typescript
private async fetchStatements(filters: FilterOptions): Promise<UniversalNode[]> {
  // Build Cypher query based on filters
  let query = `
    MATCH (s:StatementNode)
    WHERE s.visibilityStatus <> false OR s.visibilityStatus IS NULL
  `;
  
  const params: any = {};
  
  // Apply keyword filter
  if (filters.keywords?.values.length > 0) {
    const keywordCondition = this.buildKeywordCondition(
      filters.keywords.mode,
      filters.keywords.include,
      's'
    );
    query += ` AND ${keywordCondition}`;
    params.keywords = filters.keywords.values;
  }
  
  // Apply category filter
  if (filters.categories?.values.length > 0) {
    const categoryCondition = this.buildCategoryCondition(
      filters.categories.mode,
      filters.categories.include,
      's'
    );
    query += ` AND ${categoryCondition}`;
    params.categories = filters.categories.values;
  }
  
  // Apply user filter
  if (filters.user?.mode === 'created') {
    query += ` AND s.createdBy = $userId`;
    params.userId = filters.user.userId;
  } else if (filters.user?.mode === 'interacted') {
    query += ` AND EXISTS {
      MATCH (u:User {sub: $userId})-[r]->(s)
      WHERE type(r) IN ['VOTED_ON', 'COMMENTED']
    }`;
    params.userId = filters.user.userId;
  }
  
  // Fetch node data with metadata
  query += `
    // Get keywords
    OPTIONAL MATCH (s)-[t:TAGGED]->(w:WordNode)
    WITH s, collect({word: w.word, frequency: t.frequency}) as keywords
    
    // Get categories
    OPTIONAL MATCH (s)-[:CATEGORIZED_AS]->(c:CategoryNode)
    WITH s, keywords, collect({id: c.id, name: c.name, description: c.description}) as categories
    
    // Get vote counts
    OPTIONAL MATCH (s)<-[iv:VOTED_ON {kind: 'INCLUSION'}]-()
    WITH s, keywords, categories,
         sum(CASE WHEN iv.status = 'agree' THEN 1 ELSE 0 END) as inclusionPos,
         sum(CASE WHEN iv.status = 'disagree' THEN 1 ELSE 0 END) as inclusionNeg
    
    OPTIONAL MATCH (s)<-[cv:VOTED_ON {kind: 'CONTENT'}]-()
    WITH s, keywords, categories, inclusionPos, inclusionNeg,
         sum(CASE WHEN cv.status = 'agree' THEN 1 ELSE 0 END) as contentPos,
         sum(CASE WHEN cv.status = 'disagree' THEN 1 ELSE 0 END) as contentNeg
    
    // Get discussion ID
    OPTIONAL MATCH (s)-[:HAS_DISCUSSION]->(d:DiscussionNode)
    
    RETURN {
      id: s.id,
      type: 'statement',
      content: s.statement,
      createdAt: toString(s.createdAt),
      updatedAt: toString(s.updatedAt),
      createdBy: s.createdBy,
      publicCredit: s.publicCredit,
      keywords: keywords,
      categories: categories,
      inclusionPositive: inclusionPos,
      inclusionNegative: inclusionNeg,
      contentPositive: contentPos,
      contentNegative: contentNeg,
      discussionId: d.id
    } as nodeData
  `;
  
  const result = await this.neo4jService.read(query, params);
  return result.records.map(record => this.transformToUniversalNode(record.get('nodeData')));
}
```

**Note:** Follow this same pattern for fetchOpenQuestions, fetchAnswers, fetchQuantities, and fetchEvidence. Each method queries its specific schema and returns UniversalNode objects.

#### **3. buildKeywordCondition**

```typescript
private buildKeywordCondition(
  mode: 'any' | 'all',
  include: boolean,
  nodeAlias: string
): string {
  let condition: string;
  
  if (mode === 'any') {
    condition = `EXISTS {
      MATCH (${nodeAlias})-[:TAGGED]->(w:WordNode)
      WHERE w.word IN $keywords
    }`;
  } else { // mode === 'all'
    condition = `ALL(keyword IN $keywords WHERE EXISTS(
      (${nodeAlias})-[:TAGGED]->(:WordNode {word: keyword})
    ))`;
  }
  
  return include ? condition : `NOT ${condition}`;
}
```

#### **4. buildCategoryCondition**

```typescript
private buildCategoryCondition(
  mode: 'any' | 'all',
  include: boolean,
  nodeAlias: string
): string {
  let condition: string;
  
  if (mode === 'any') {
    condition = `EXISTS {
      MATCH (${nodeAlias})-[:CATEGORIZED_AS]->(c:CategoryNode)
      WHERE c.id IN $categories AND c.inclusionNetVotes > 0
    }`;
  } else { // mode === 'all'
    condition = `ALL(catId IN $categories WHERE EXISTS(
      (${nodeAlias})-[:CATEGORIZED_AS]->(:CategoryNode {id: catId})
    ))`;
  }
  
  return include ? condition : `NOT ${condition}`;
}
```

#### **5. applySorting**

```typescript
private applySorting(nodes: UniversalNode[], sort: SortOptions): UniversalNode[] {
  const direction = sort.direction === 'asc' ? 1 : -1;
  
  switch (sort.by) {
    case 'netInclusionVotes':
      return nodes.sort((a, b) => 
        (b.metadata.votes.inclusion.net - a.metadata.votes.inclusion.net) * direction
      );
      
    case 'totalInclusionVotes':
      return nodes.sort((a, b) => {
        const aTotal = a.metadata.votes.inclusion.positive + a.metadata.votes.inclusion.negative;
        const bTotal = b.metadata.votes.inclusion.positive + b.metadata.votes.inclusion.negative;
        return (bTotal - aTotal) * direction;
      });
      
    case 'dateCreated':
      return nodes.sort((a, b) => {
        const aDate = new Date(a.createdAt).getTime();
        const bDate = new Date(b.createdAt).getTime();
        return (bDate - aDate) * direction;
      });
      
    case 'netContentVotes':
      return nodes.sort((a, b) => {
        // Use content votes if available, fallback to inclusion votes
        const aVotes = a.metadata.votes.content?.net ?? a.metadata.votes.inclusion.net;
        const bVotes = b.metadata.votes.content?.net ?? b.metadata.votes.inclusion.net;
        return (bVotes - aVotes) * direction;
      });
      
    case 'totalContentVotes':
      return nodes.sort((a, b) => {
        const aTotal = a.metadata.votes.content 
          ? (a.metadata.votes.content.positive + a.metadata.votes.content.negative)
          : (a.metadata.votes.inclusion.positive + a.metadata.votes.inclusion.negative);
        const bTotal = b.metadata.votes.content
          ? (b.metadata.votes.content.positive + b.metadata.votes.content.negative)
          : (b.metadata.votes.inclusion.positive + b.metadata.votes.inclusion.negative);
        return (bTotal - aTotal) * direction;
      });
      
    case 'categoryOverlap':
      // This requires special handling - calculated during filtering
      throw new BadRequestException('Category overlap sort requires category filter');
      
    case 'participantCount':
      // This requires counting unique users - should be done in query
      return nodes.sort((a, b) => {
        const aCount = this.calculateParticipantCount(a);
        const bCount = this.calculateParticipantCount(b);
        return (bCount - aCount) * direction;
      });
      
    default:
      return nodes;
  }
}
```

#### **6. enrichWithUserContext**

```typescript
private async enrichWithUserContext(
  nodes: UniversalNode[],
  userId: string
): Promise<UniversalNode[]> {
  // Batch fetch vote statuses
  const votePromises = nodes.map(node => 
    this.voteSchema.getVoteStatus(
      this.getNodeLabel(node.type),
      { id: node.id },
      userId
    )
  );
  
  // Batch fetch visibility preferences
  const visibilityPromises = nodes.map(node =>
    this.visibilityService.getVisibilityStatus(node.id, userId)
  );
  
  const [voteStatuses, visibilityPrefs] = await Promise.all([
    Promise.all(votePromises),
    Promise.all(visibilityPromises)
  ]);
  
  // Enrich nodes
  return nodes.map((node, index) => ({
    ...node,
    metadata: {
      ...node.metadata,
      userVoteStatus: {
        inclusionVote: voteStatuses[index]?.inclusionVote || null,
        contentVote: voteStatuses[index]?.contentVote || null
      },
      userVisibilityPreference: visibilityPrefs[index] || {
        isVisible: true,
        source: 'community',
        timestamp: Date.now()
      }
    }
  }));
}
```

#### **7. fetchRelationships**

```typescript
private async fetchRelationships(
  nodes: UniversalNode[],
  relationshipTypes: RelationshipType[]
): Promise<UniversalRelationship[]> {
  const relationships: UniversalRelationship[] = [];
  const nodeIds = nodes.map(n => n.id);
  
  if (nodeIds.length === 0) return relationships;
  
  // Fetch each relationship type in parallel
  const relationshipPromises = relationshipTypes.map(type => {
    switch (type) {
      case 'shared_keyword':
        return this.fetchSharedKeywordRelationships(nodeIds);
      case 'shared_category':
        return this.fetchSharedCategoryRelationships(nodeIds);
      case 'related_to':
        return this.fetchRelatedToRelationships(nodeIds);
      case 'answers':
        return this.fetchAnswersRelationships(nodeIds);
      case 'evidence_for':
        return this.fetchEvidenceForRelationships(nodeIds);
      case 'categorized_as':
        return this.fetchCategorizedAsRelationships(nodeIds);
    }
  });
  
  const relationshipArrays = await Promise.all(relationshipPromises);
  
  // Flatten and combine
  relationshipArrays.forEach(rels => relationships.push(...rels));
  
  return relationships;
}
```

#### **8. fetchSharedKeywordRelationships**

```typescript
private async fetchSharedKeywordRelationships(
  nodeIds: string[]
): Promise<UniversalRelationship[]> {
  const query = `
    MATCH (n1)-[st:SHARED_TAG]->(n2)
    WHERE n1.id IN $nodeIds AND n2.id IN $nodeIds
    AND n1.id < n2.id  // Avoid duplicates
    RETURN n1.id as source, n2.id as target, st.word as keyword, st.strength as strength
  `;
  
  const result = await this.neo4jService.read(query, { nodeIds });
  
  return result.records.map(record => ({
    id: `${record.get('source')}-shared_keyword-${record.get('target')}`,
    source: record.get('source'),
    target: record.get('target'),
    type: 'shared_keyword',
    strength: this.toNumber(record.get('strength')),
    metadata: {
      keyword: record.get('keyword')
    }
  }));
}
```

#### **9. fetchEvidenceForRelationships**

```typescript
private async fetchEvidenceForRelationships(
  nodeIds: string[]
): Promise<UniversalRelationship[]> {
  const query = `
    MATCH (e:EvidenceNode)-[:EVIDENCE_FOR]->(parent)
    WHERE e.id IN $nodeIds AND parent.id IN $nodeIds
    RETURN e.id as source, parent.id as target, e.evidenceType as evidenceType
  `;
  
  const result = await this.neo4jService.read(query, { nodeIds });
  
  return result.records.map(record => ({
    id: `${record.get('source')}-evidence_for-${record.get('target')}`,
    source: record.get('source'),
    target: record.get('target'),
    type: 'evidence_for',
    strength: 1,
    metadata: {
      evidenceType: record.get('evidenceType')
    }
  }));
}
```

---

## 🎯 **Performance Optimization Requirements**

### **1. Query Performance**

**Target:** < 500ms for typical queries (200 nodes, with relationships)

**Strategies:**

**A. Parallel Schema Queries**
```typescript
// Query all node types in parallel
const [statements, questions, answers, quantities, evidence] = await Promise.all([
  this.fetchStatements(filters),
  this.fetchOpenQuestions(filters),
  this.fetchAnswers(filters),
  this.fetchQuantities(filters),
  this.fetchEvidence(filters)
]);
```

**B. Efficient Cypher Queries**
- Use `WITH` clauses to pipeline operations
- Aggregate data in Neo4j rather than in application code
- Use `OPTIONAL MATCH` for optional relationships
- Filter early in the query (push WHERE clauses up)

**C. Batch User Context Enrichment**
```typescript
// BAD: Individual calls per node
for (const node of nodes) {
  node.userVoteStatus = await this.voteSchema.getVoteStatus(...);
}

// GOOD: Batch all calls
const votePromises = nodes.map(node => this.voteSchema.getVoteStatus(...));
const voteStatuses = await Promise.all(votePromises);
```

**D. Relationship Consolidation**
- Consolidate duplicate SHARED_TAG relationships
- Use `n1.id < n2.id` to avoid duplicate relationships
- Only fetch relationships for nodes in the result set

---

### **2. Caching Strategy**

**What to Cache:**

**A. Available Keywords/Categories (High Priority)**
```typescript
// Cache for dropdown lists - rarely changes
@Cacheable('available-keywords', { ttl: 3600 }) // 1 hour
async getAvailableKeywords(): Promise<string[]> {
  // Fetch all unique keywords from database
}

@Cacheable('available-categories', { ttl: 3600 }) // 1 hour
async getAvailableCategories(): Promise<CategoryInfo[]> {
  // Fetch all categories from database
}
```

**B. Common Filter Combinations (Medium Priority)**
```typescript
// Cache frequently used filter combinations
// Key: hash of filter options
// TTL: 300 seconds (5 minutes)
const cacheKey = this.generateFilterHash(filters);
const cached = await this.cacheManager.get(cacheKey);
if (cached) return cached;
```

**C. User Context Data (Low Priority)**
```typescript
// Cache user-specific data briefly
// Key: userId + nodeId
// TTL: 60 seconds
// Invalidate on vote/visibility change
```

---

### **3. Database Optimization**

**Neo4j Indexes Required:**
```cypher
// Node lookups
CREATE INDEX node_id FOR (n:StatementNode) ON (n.id);
CREATE INDEX node_id FOR (n:OpenQuestionNode) ON (n.id);
CREATE INDEX node_id FOR (n:AnswerNode) ON (n.id);
CREATE INDEX node_id FOR (n:QuantityNode) ON (n.id);
CREATE INDEX node_id FOR (n:EvidenceNode) ON (n.id);

// User lookups
CREATE INDEX node_creator FOR (n:StatementNode) ON (n.createdBy);
CREATE INDEX node_creator FOR (n:OpenQuestionNode) ON (n.createdBy);
CREATE INDEX node_creator FOR (n:AnswerNode) ON (n.createdBy);
CREATE INDEX node_creator FOR (n:QuantityNode) ON (n.createdBy);
CREATE INDEX node_creator FOR (n:EvidenceNode) ON (n.createdBy);

// Vote lookups
CREATE INDEX vote_kind FOR ()-[r:VOTED_ON]-() ON (r.kind);
CREATE INDEX vote_status FOR ()-[r:VOTED_ON]-() ON (r.status);

// Keyword lookups
CREATE INDEX word_value FOR (w:WordNode) ON (w.word);

// Category lookups
CREATE INDEX category_id FOR (c:CategoryNode) ON (c.id);

// Visibility lookups
CREATE INDEX node_visibility FOR (n:StatementNode) ON (n.visibilityStatus);
CREATE INDEX node_visibility FOR (n:OpenQuestionNode) ON (n.visibilityStatus);
CREATE INDEX node_visibility FOR (n:AnswerNode) ON (n.visibilityStatus);
CREATE INDEX node_visibility FOR (n:QuantityNode) ON (n.visibilityStatus);
CREATE INDEX node_visibility FOR (n:EvidenceNode) ON (n.visibilityStatus);

// Evidence-specific indexes
CREATE INDEX evidence_type FOR (n:EvidenceNode) ON (n.evidenceType);
CREATE INDEX evidence_parent FOR (n:EvidenceNode) ON (n.parentNodeId);
```

---

## 🧪 **Testing Requirements**

### **1. Unit Tests**

**Service Layer:**
```typescript
describe('UniversalGraphService', () => {
  describe('fetchFilteredNodes', () => {
    it('should fetch only specified node types');
    it('should apply keyword filter with ANY mode');
    it('should apply keyword filter with ALL mode');
    it('should apply keyword filter with exclude mode');
    it('should apply category filter with ANY mode');
    it('should apply category filter with ALL mode');
    it('should apply user filter - created mode');
    it('should apply user filter - interacted mode');
    it('should combine multiple filters correctly');
    it('should enforce answer-question coupling');
  });
  
  describe('applySorting', () => {
    it('should sort by net inclusion votes DESC');
    it('should sort by net inclusion votes ASC');
    it('should sort by total inclusion votes');
    it('should sort by date created');
    it('should sort by net content votes with fallback');
    it('should sort by total content votes with fallback');
    it('should sort by participant count');
    it('should reject category overlap without category filter');
  });
  
  describe('enrichWithUserContext', () => {
    it('should add user vote status to nodes');
    it('should add user visibility preferences to nodes');
    it('should handle missing user context gracefully');
  });
  
  describe('fetchRelationships', () => {
    it('should fetch shared keyword relationships');
    it('should fetch shared category relationships');
    it('should fetch related_to relationships');
    it('should fetch answers relationships');
    it('should fetch evidence_for relationships');
    it('should consolidate duplicate relationships');
    it('should only create relationships between nodes in result set');
  });
});
```

**Controller Layer:**
```typescript
describe('UniversalGraphController', () => {
  describe('GET /graph/universal/nodes', () => {
    it('should return default dataset when no filters');
    it('should parse node type filter correctly');
    it('should parse keyword filter correctly');
    it('should parse category filter correctly');
    it('should parse sort options correctly');
    it('should validate invalid sort option');
    it('should validate invalid filter values');
    it('should add requesting user ID from auth context');
    it('should return 400 for invalid pagination');
    it('should auto-include openquestion when answer selected');
  });
});
```

---

### **2. Integration Tests**

**Database Integration:**
```typescript
describe('UniversalGraphService Integration', () => {
  beforeAll(async () => {
    // Set up test database with known data
    await seedTestData();
  });
  
  it('should return correct nodes for keyword filter', async () => {
    const result = await service.getUniversalNodes({
      filters: {
        keywords: { mode: 'any', include: true, values: ['test-keyword'] }
      },
      // ... other options
    });
    
    expect(result.nodes.length).toBeGreaterThan(0);
    result.nodes.forEach(node => {
      expect(node.metadata.keywords.some(k => k.word === 'test-keyword')).toBe(true);
    });
  });
  
  it('should apply sorting correctly', async () => {
    const result = await service.getUniversalNodes({
      sort: { by: 'netInclusionVotes', direction: 'desc' },
      // ... other options
    });
    
    // Verify descending order
    for (let i = 0; i < result.nodes.length - 1; i++) {
      expect(result.nodes[i].metadata.votes.inclusion.net)
        .toBeGreaterThanOrEqual(result.nodes[i + 1].metadata.votes.inclusion.net);
    }
  });
  
  it('should include evidence_for relationships', async () => {
    const result = await service.getUniversalNodes({
      relationships: { include: true, types: ['evidence_for'] }
    });
    
    const evidenceRels = result.relationships.filter(r => r.type === 'evidence_for');
    expect(evidenceRels.length).toBeGreaterThan(0);
  });
});
```

---

### **3. E2E Tests**

**Full Request/Response Cycle:**
```typescript
describe('Universal Graph API E2E', () => {
  it('should return default dataset', async () => {
    const response = await request(app.getHttpServer())
      .get('/graph/universal/nodes')
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200);
    
    expect(response.body.nodes).toBeDefined();
    expect(response.body.relationships).toBeDefined();
    expect(response.body.pagination).toBeDefined();
    expect(response.body.nodes.length).toBeLessThanOrEqual(200);
    
    // Verify node structure
    const node = response.body.nodes[0];
    expect(node).toHaveProperty('id');
    expect(node).toHaveProperty('type');
    expect(node).toHaveProperty('content');
    expect(node).toHaveProperty('metadata');
    expect(node.metadata).toHaveProperty('votes');
    expect(node.metadata).toHaveProperty('keywords');
    expect(node.metadata).toHaveProperty('categories');
  });
  
  it('should filter by keywords', async () => {
    const response = await request(app.getHttpServer())
      .get('/graph/universal/nodes')
      .query({
        'keywords[]': ['ai', 'ethics'],
        keywordMode: 'all',
        keywordsInclude: 'true'
      })
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200);
    
    // Verify all nodes have both keywords
    response.body.nodes.forEach(node => {
      const nodeKeywords = node.metadata.keywords.map(k => k.word);
      expect(nodeKeywords).toContain('ai');
      expect(nodeKeywords).toContain('ethics');
    });
  });
  
  it('should include evidence nodes and evidence_for relationships', async () => {
    const response = await request(app.getHttpServer())
      .get('/graph/universal/nodes')
      .query({
        'nodeTypes[]': ['evidence', 'statement'],
        'relationshipTypes[]': 'evidence_for'
      })
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200);
    
    const evidenceNodes = response.body.nodes.filter(n => n.type === 'evidence');
    expect(evidenceNodes.length).toBeGreaterThan(0);
    
    const evidenceRels = response.body.relationships.filter(r => r.type === 'evidence_for');
    expect(evidenceRels.length).toBeGreaterThan(0);
  });
});
```

---

### **4. Performance Tests**

```typescript
describe('Performance Tests', () => {
  it('should return results within 500ms for typical query', async () => {
    const start = Date.now();
    
    const result = await service.getUniversalNodes({
      filters: { /* typical filters */ },
      sort: { by: 'netInclusionVotes', direction: 'desc' },
      pagination: { limit: 200, offset: 0 },
      relationships: { include: true, types: ['shared_keyword', 'shared_category'] }
    });
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });
  
  it('should handle large result sets efficiently', async () => {
    const result = await service.getUniversalNodes({
      pagination: { limit: 1000, offset: 0 },
      // ... other options
    });
    
    expect(result.nodes.length).toBeLessThanOrEqual(1000);
    expect(result.performance.queryTimeMs).toBeLessThan(2000);
  });
});
```

---

## 📋 **API Endpoint Specification**

### **Main Endpoint**

```
GET /graph/universal/nodes
```

**Query Parameters:**

```
// Node Type Filter
?nodeTypes[]=statement&nodeTypes[]=answer&nodeTypesInclude=true

// Keyword Filter
?keywords[]=ai&keywords[]=ethics&keywordMode=all&keywordsInclude=true

// Category Filter
?categories[]=cat-1&categories[]=cat-2&categoryMode=any&categoriesInclude=true

// User Filter
?userFilter=created

// Sort
?sortBy=netInclusionVotes&sortDirection=desc

// Pagination
?limit=200&offset=0

// Relationships
?includeRelationships=true&relationshipTypes[]=shared_keyword&relationshipTypes[]=evidence_for
```

**Response:**

```json
{
  "nodes": [
    {
      "id": "stmt-123",
      "type": "statement",
      "content": "AI will transform society...",
      "createdAt": "2025-01-15T10:30:00Z",
      "updatedAt": "2025-01-16T14:20:00Z",
      "createdBy": "user-456",
      "publicCredit": true,
      "metadata": {
        "votes": {
          "inclusion": { "positive": 45, "negative": 3, "net": 42 },
          "content": { "positive": 38, "negative": 5, "net": 33 }
        },
        "keywords": [
          { "word": "ai", "frequency": 0.9 },
          { "word": "society", "frequency": 0.7 }
        ],
        "categories": [
          { "id": "cat-1", "name": "Technology", "description": "..." }
        ],
        "discussionId": "disc-789",
        "userVoteStatus": {
          "inclusionVote": "agree",
          "contentVote": null
        },
        "userVisibilityPreference": {
          "isVisible": true,
          "source": "user",
          "timestamp": 1705324800000
        }
      }
    }
  ],
  "relationships": [
    {
      "id": "stmt-123-shared_keyword-stmt-456",
      "source": "stmt-123",
      "target": "stmt-456",
      "type": "shared_keyword",
      "strength": 0.64,
      "metadata": { "keyword": "ai" }
    },
    {
      "id": "evid-789-evidence_for-stmt-123",
      "source": "evid-789",
      "target": "stmt-123",
      "type": "evidence_for",
      "strength": 1,
      "metadata": { "evidenceType": "academic_paper" }
    }
  ],
  "pagination": {
    "total": 547,
    "offset": 0,
    "limit": 200,
    "hasMore": true
  },
  "performance": {
    "nodeCount": 200,
    "relationshipCount": 342,
    "relationshipDensity": 0.017,
    "queryTimeMs": 287
  }
}
```

---

### **Helper Endpoints**

#### **Get Available Keywords**

```
GET /graph/universal/filters/keywords
```

**Response:**
```json
{
  "keywords": [
    { "word": "ai", "usageCount": 247 },
    { "word": "ethics", "usageCount": 156 },
    { "word": "technology", "usageCount": 423 }
  ]
}
```

#### **Get Available Categories**

```
GET /graph/universal/filters/categories
```

**Response:**
```json
{
  "categories": [
    {
      "id": "cat-1",
      "name": "Technology",
      "description": "...",
      "usageCount": 324,
      "parentId": null,
      "childCount": 5
    }
  ]
}
```

---

## 📅 **Phase 3 Timeline**

### **Days 1-4: Service Layer**
- ✅ Implement node fetching for all 5 types (Statement, OpenQuestion, Answer, Quantity, Evidence)
- ✅ Implement filter builders (keyword ANY/ALL, category ANY/ALL, user)
- ✅ Implement sorting with fallback logic for content votes
- ✅ Implement user context enrichment (batch VoteSchema and VisibilityService calls)
- ✅ Enforce answer-question coupling

### **Day 5: Relationship Layer**
- ✅ Implement all 6 relationship types (shared_keyword, shared_category, related_to, answers, evidence_for, categorized_as)
- ✅ Implement relationship consolidation (avoid duplicates)
- ✅ Handle cross-node references (parent info even when parent not in result set)

### **Day 6: Controller Layer**
- ✅ Create controller with query parameter parsing
- ✅ Create validation logic for all filters and sorts
- ✅ Create helper endpoints (keywords, categories dropdowns)
- ✅ Proper error handling and logging

### **Days 7-9: Testing**
- ✅ Unit tests for service methods (

    <invoke name="artifacts">
<parameter name="command">update</parameter>
<parameter name="type">text/markdown</parameter>
<parameter name="id">phase3-complete-brief</parameter>
<parameter name="old_str">### **Days 7-9: Testing**
- ✅ Unit tests for service methods (</parameter>
<parameter name="new_str">### **Days 7-9: Testing**
- ✅ Unit tests for service methods (filter builders, sorting, enrichment, relationship fetching)
- ✅ Integration tests (full queries with database)
- ✅ E2E tests (HTTP request/response cycle)
- ✅ Performance tests (<500ms target)
- ✅ Test answer-question coupling
- ✅ Test evidence relationships

### **Days 10-11: Optimization & Documentation**
- ✅ Implement caching strategy (keywords, categories, common queries)
- ✅ Performance profiling with Neo4j EXPLAIN/PROFILE
- ✅ Ensure all indexes are created
- ✅ Documentation updates (API docs, README)
- ✅ Code review and cleanup

---

## 🚀 **Deployment Checklist**

### **Pre-Deployment**

- [ ] All unit tests passing (>80% coverage)
- [ ] All integration tests passing
- [ ] All E2E tests passing
- [ ] Performance tests meet targets (<500ms)
- [ ] Code review completed
- [ ] Documentation updated
- [ ] API endpoints documented
- [ ] TypeScript types exported
- [ ] Error handling comprehensive
- [ ] Logging implemented

### **Database**

- [ ] All Neo4j indexes created (including Evidence indexes)
- [ ] Query performance profiled
- [ ] Test data seeded for staging
- [ ] Backup strategy in place

### **Caching**

- [ ] Redis configured
- [ ] Cache keys defined
- [ ] TTL values configured
- [ ] Cache invalidation tested

### **Monitoring**

- [ ] Query performance metrics tracked
- [ ] Error rates monitored
- [ ] Cache hit rates tracked
- [ ] API response times logged

---

## ✅ **Success Criteria**

### **Phase 2.5 Complete When:**

- [x] EvidenceModule properly configured with all dependencies
- [x] EvidenceService implements all required methods (20+ methods)
- [x] EvidenceController exposes all REST endpoints
- [x] All DTOs have proper validation decorators
- [x] UserSchema integration working (uncommented in EvidenceSchema)
- [x] EvidenceModule imported in nodes.module.ts
- [x] Unit tests passing (>80% coverage)
- [x] Integration tests passing
- [x] Can create, read, update, delete evidence
- [x] Can submit and retrieve peer reviews
- [x] Can vote on evidence inclusion
- [x] Can discover evidence for nodes
- [x] Documentation complete

### **Phase 3 Complete When:**

**Functional Requirements:**

✅ **Filters:**
- [ ] Node type filtering works (include/exclude)
- [ ] Answer-question coupling enforced
- [ ] Keyword filtering works (any/all, include/exclude)
- [ ] Category filtering works (any/all, include/exclude)
- [ ] User filtering works (all/created/interacted)

✅ **Sorts:**
- [ ] All 7 sort options implemented
- [ ] Content vote sorts use fallback correctly for OpenQuestion/Quantity/Evidence
- [ ] Category overlap requires category filter (validation)

✅ **Data Quality:**
- [ ] Default dataset returns correct node types (Statement, OpenQuestion, Answer, Quantity, Evidence)
- [ ] Nodes have all required fields
- [ ] Evidence nodes include peer review scores
- [ ] Quantity nodes include statistics
- [ ] Relationships have all required fields
- [ ] User context enrichment works
- [ ] Pagination works correctly

✅ **Relationships:**
- [ ] All 6 relationship types supported (including evidence_for)
- [ ] No duplicate relationships
- [ ] Relationship metadata complete
- [ ] Only relationships between nodes in result set

**Non-Functional Requirements:**

✅ **Performance:**
- [ ] <500ms for typical queries (200 nodes)
- [ ] <2000ms for large queries (1000 nodes)
- [ ] Efficient memory usage
- [ ] No N+1 query problems
- [ ] Parallel queries for node types
- [ ] Batch user context enrichment

✅ **Reliability:**
- [ ] Handles empty results gracefully
- [ ] Handles invalid inputs gracefully
- [ ] Error messages are clear
- [ ] No crashes or exceptions

✅ **Maintainability:**
- [ ] Code is well-organized
- [ ] Methods are focused and testable
- [ ] TypeScript types are complete
- [ ] Documentation is comprehensive

---

## 📚 **Reference Information**

### **Node Type Summary**

| Node Type | Extends | Inclusion Vote | Content Vote | Alternative System | Max Categories |
|-----------|---------|----------------|--------------|-------------------|----------------|
| Statement | CategorizedNodeSchema | ✓ | ✓ | - | 3 |
| OpenQuestion | CategorizedNodeSchema | ✓ | ✗ | - | 3 |
| Answer | CategorizedNodeSchema | ✓ | ✓ | - | 3 |
| Quantity | CategorizedNodeSchema | ✓ | ✗ | Numeric responses | 3 |
| Evidence | CategorizedNodeSchema | ✓ | ✗ | Peer review (3D) | 3 |

### **Relationship Type Summary**

| Type | Source | Target | Strength Calculation | Purpose |
|------|--------|--------|---------------------|---------|
| shared_keyword | Any | Any | Product of tag frequencies | Topic discovery |
| shared_category | Any | Any | Count of shared categories | Organizational discovery |
| related_to | Statement | Statement | N/A | User-created threading |
| answers | Answer | OpenQuestion | N/A | Q&A hierarchy |
| evidence_for | Evidence | Statement/Answer/Quantity | N/A | Claim verification |
| categorized_as | Any | Category | N/A | Category hierarchy |

### **Sort Options Summary**

| Sort Option | Works On | Fallback | Direction |
|-------------|----------|----------|-----------|
| netInclusionVotes | All | N/A | ASC/DESC |
| totalInclusionVotes | All | N/A | ASC/DESC |
| dateCreated | All | N/A | ASC/DESC |
| netContentVotes | Statement, Answer | inclusionNetVotes | ASC/DESC |
| totalContentVotes | Statement, Answer | totalInclusionVotes | ASC/DESC |
| categoryOverlap | All (with category filter) | N/A | DESC only |
| participantCount | All | N/A | ASC/DESC |

---

## 🔄 **Work Order Summary**

### **Step 1: Phase 2.5 - Evidence Service (Days 1-3)**

1. Create `evidence.module.ts` with proper imports
2. Create `evidence.service.ts` with all methods
3. Create `evidence.controller.ts` with all endpoints
4. Create DTOs with validation
5. Uncomment UserSchema integration in EvidenceSchema
6. Update `nodes.module.ts` to import EvidenceModule
7. Write unit tests
8. Write integration tests
9. Test end-to-end

### **Step 2: Phase 3 - Universal Graph Service (Days 4-14)**

1. Update `universal-graph.service.ts`:
   - Add EvidenceSchema to constructor
   - Implement `fetchEvidence()` method
   - Update filter builders (ANY/ALL modes)
   - Update sorting (fallback logic)
   - Update relationships (add evidence_for)
   - Implement answer-question coupling
   - Batch user context enrichment

2. Update `universal-graph.controller.ts`:
   - Update query parameter parsing
   - Add validation for new features
   - Update helper endpoints

3. Create comprehensive tests:
   - Unit tests for all service methods
   - Integration tests with real database
   - E2E tests for HTTP layer
   - Performance tests

4. Optimize and document:
   - Implement caching
   - Create/verify Neo4j indexes
   - Profile queries
   - Update documentation

---

## 📝 **Important Implementation Notes**

### **Answer-Question Coupling**

Always remember:
- Answers cannot be fetched without questions
- When user selects answer type, auto-include openquestion type
- Query pattern: fetch questions that have qualifying answers
- UI: Single checkbox labeled "Open Questions & Answers"

### **Content Vote Fallback**

For sorts using content votes:
- Statement, Answer: Use actual content votes
- OpenQuestion, Quantity, Evidence: Fallback to inclusion votes
- Use COALESCE in queries and || in code

### **Cross-Node References**

Some nodes reference parents not in result set:
- Answer → OpenQuestion: Always include parent question text in metadata
- Evidence → Parent claim: Always include parent node info in metadata
- Relationships: Only create if BOTH nodes in result set

### **Performance Priorities**

1. Parallel queries for different node types
2. Batch enrichment (votes, visibility)
3. Single query for relationships
4. Cache dropdown data (keywords, categories)
5. Use Neo4j indexes effectively

---

## 🎉 **Definition of Done**

**Phase 2.5 is complete when:**
- Evidence can be created via API
- Evidence can have peer reviews submitted
- Evidence can be discovered by parent node
- All tests passing
- Documentation updated

**Phase 3 is complete when:**
- Frontend can fetch graph with all 5 node types
- All filters work correctly (node type, keyword, category, user)
- All sorts work correctly (7 options with fallbacks)
- All relationships work correctly (6 types)
- User context enrichment works
- Performance targets met (<500ms)
- Tests passing (>80% coverage)
- Documentation complete
- Code reviewed and approved

---

## 📞 **Next Steps**

1. **Start with Phase 2.5** - Evidence Service implementation
2. Use this document as the single source of truth
3. Reference schema documentation for implementation details
4. Follow patterns from existing services (Statement, Quantity)
5. Test thoroughly at each step
6. Move to Phase 3 only after Phase 2.5 is complete

**This document contains everything needed to implement both phases successfully.**

---

**Document Version:** 2.0  
**Last Updated:** January 2025  
**Status:** Ready for Implementation</parameter>
</invoke>
</artifacts>

I've completed the comprehensive work brief that combines Phase 2.5 (Evidence Service) and Phase 3 (Universal Graph Service) into a single document. 

This document includes:

**Phase 2.5 (Evidence Service) - Complete specification for:**
- Module, service, and controller structure
- All required methods with interfaces
- DTOs with validation
- UserSchema integration fix
- Testing requirements
- 3-day timeline

**Phase 3 (Universal Graph Service) - Complete specification for:**
- All 5 node types (including Evidence)
- All 4 filters (with ANY/ALL modes)
- All 7 sort options (with fallback logic)
- All 6 relationship types (including evidence_for)
- Answer-question coupling
- Cross-node references
- User context enrichment
- Performance optimization
- Testing requirements
- 8-11 day timeline

**Key Updates Made:**
1. Added evidence_for relationship type
2. Clarified answer-question coupling (single UI checkbox)
3. Added Evidence metadata fields (peer review scores)
4. Added Quantity statistics fields
5. Documented content vote fallback logic
6. Added Neo4j indexes for Evidence
7. Complete work order and definition of done

The document is ready to take into your next conversation to begin implementation. All information is consolidated in one place with clear, actionable specifications.