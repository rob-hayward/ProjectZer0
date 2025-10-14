# ProjectZer0 Frontend API Cheatsheet

**Complete Reference for Frontend Development**  
**Version:** 2.0  
**Last Updated:** October 14, 2025  
**Status:** Production Ready ✅

---

## 📋 Quick Navigation

1. [Authentication](#authentication)
2. [Node Creation APIs](#node-creation-apis)
3. [Universal Graph APIs](#universal-graph-apis)
4. [Graph Expansion APIs](#graph-expansion-apis)
5. [Quick Reference Tables](#quick-reference-tables)

---

## 🔐 Authentication

**All endpoints require JWT authentication via cookie:**

```typescript
// Include in all fetch requests
headers: {
  'Cookie': `jwt=${jwtToken}`
}

// User ID automatically extracted from JWT
// Backend gets user ID from: req.user.sub
```

---

## 🎨 Node Creation APIs

### Base URL
```
POST http://localhost:3000/api/nodes/{type}
```

### Common Fields (All Node Types)

| Field | Type | Required | Default | Max |
|-------|------|----------|---------|-----|
| `publicCredit` | boolean | No | `true` | - |
| `categoryIds` | string[] | No | `[]` | 3 |
| `userKeywords` | string[] | No | AI extracts | - |
| `initialComment` | string | Varies | - | 280 |

---

### 1️⃣ Statement

```typescript
POST /api/nodes/statement

{
  statement: string;              // REQUIRED, 1-280 chars
  publicCredit?: boolean;         // Optional, default: true
  categoryIds?: string[];         // Optional, max 3
  userKeywords?: string[];        // Optional, else AI extracts
  initialComment: string;         // REQUIRED
}

// Response: StatementData with discussionId
```

**Frontend Form:**
- ✅ Text area (280 char limit with counter)
- ✅ Public credit checkbox (default: checked)
- ✅ Category multi-select (max 3)
- ✅ Keyword input (optional)
- ✅ Initial comment text area (REQUIRED, 280 char)

---

### 2️⃣ Open Question

```typescript
POST /api/nodes/openquestion

{
  questionText: string;           // REQUIRED, 1-280 chars
  publicCredit?: boolean;
  categoryIds?: string[];
  userKeywords?: string[];
  initialComment: string;         // REQUIRED
}

// Response: OpenQuestionData with discussionId
```

**Frontend Form:**
- ✅ Text area (280 char limit)
- ✅ Public credit checkbox
- ✅ Category multi-select (max 3)
- ✅ Keyword input (optional)
- ✅ Initial comment text area (REQUIRED, 280 char)

---

### 3️⃣ Answer

```typescript
POST /api/nodes/answer

{
  questionId: string;             // REQUIRED, parent question UUID
  answerText: string;             // REQUIRED, 1-280 chars
  publicCredit?: boolean;
  categoryIds?: string[];
  userKeywords?: string[];
  initialComment?: string;        // Optional
}

// Response: AnswerData
```

**Frontend Form:**
- ✅ Hidden field: questionId (from context)
- ✅ Text area (280 char limit)
- ✅ Public credit checkbox
- ✅ Category multi-select (max 3)
- ✅ Keyword input (optional)
- ✅ Initial comment text area (optional)

**Prerequisites:**
- Parent question must have `inclusionNetVotes > 0`

---

### 4️⃣ Quantity

```typescript
POST /api/nodes/quantity

{
  question: string;               // REQUIRED, 1-280 chars
  unit: string;                   // REQUIRED, from dropdown
  publicCredit?: boolean;
  categoryIds?: string[];
  userKeywords?: string[];
  initialComment?: string;
}

// Response: QuantityData
```

**Frontend Form:**
- ✅ Text area for question (280 char limit)
- ✅ **Unit dropdown** (see [Unit Options](#unit-options))
- ✅ Public credit checkbox
- ✅ Category multi-select (max 3)
- ✅ Keyword input (optional)
- ✅ Initial comment text area (optional)

**Unit Options:**
```typescript
const UNIT_OPTIONS = [
  'dollars', 'euros', 'pounds', 'yen',
  'meters', 'kilometers', 'miles', 'feet',
  'kilograms', 'pounds_weight', 'tons',
  'celsius', 'fahrenheit', 'kelvin',
  'percentage', 'ratio', 'count',
  'seconds', 'minutes', 'hours', 'days', 'years'
];
```

---

### 5️⃣ Evidence

```typescript
POST /api/nodes/evidence

{
  parentNodeId: string;           // REQUIRED, parent UUID
  parentNodeType: string;         // REQUIRED, see below
  title: string;                  // REQUIRED, 1-280 chars
  url: string;                    // REQUIRED, valid URL
  evidenceType: string;           // REQUIRED, from dropdown
  publicCredit?: boolean;
  categoryIds?: string[];
  userKeywords?: string[];
  initialComment?: string;
}

// Response: EvidenceData
```

**Frontend Form:**
- ✅ Hidden: parentNodeId (from context)
- ✅ Hidden: parentNodeType (from context)
- ✅ Text input for title (280 char limit)
- ✅ URL input with validation
- ✅ **Evidence type dropdown** (see [Evidence Types](#evidence-types))
- ✅ Public credit checkbox
- ✅ Category multi-select (max 3)
- ✅ Keyword input (optional)
- ✅ Initial comment text area (optional)

**Parent Node Types:**
```typescript
'StatementNode' | 'AnswerNode' | 'QuantityNode'
```

**Evidence Type Options:**
```typescript
const EVIDENCE_TYPES = [
  'peer_reviewed_study',
  'government_report',
  'news_article',
  'expert_opinion',
  'dataset',
  'video',
  'image',
  'other'
];
```

**Prerequisites:**
- Parent node must have `inclusionNetVotes > 0`

---

## 🌐 Universal Graph APIs

### Main Graph Endpoint

```typescript
GET /graph/universal/nodes

// Returns: UniversalGraphResponse
{
  nodes: UniversalNodeData[];
  relationships: UniversalRelationshipData[];
  total_count: number;
  has_more: boolean;
  performance_metrics: {...}
}
```

---

### Query Parameters Reference

#### 🎯 Node Type Filtering

```typescript
?node_types=statement,answer,quantity
?includeNodeTypes=true  // true = include, false = exclude

// Defaults:
// node_types: ['statement', 'openquestion', 'answer', 'quantity', 'evidence']
// includeNodeTypes: true
```

**Frontend UI:**
- Multi-select checkboxes for node types
- Toggle for include/exclude mode

---

#### 🏷️ Keyword Filtering

```typescript
?keywords=ai,ethics,technology
?keywordMode=any  // 'any' | 'all'
?includeKeywordsFilter=true  // true = include, false = exclude

// 'any' = has at least one keyword (default)
// 'all' = has all keywords
```

**Frontend UI:**
- Multi-select or tag input for keywords
- Radio buttons for ANY/ALL mode
- Toggle for include/exclude
- Use `GET /graph/universal/filters/keywords` to get options

---

#### 📁 Category Filtering

```typescript
?categories=cat-uuid-1,cat-uuid-2
?categoryMode=any  // 'any' | 'all'
?includeCategoriesFilter=true

// 'any' = in at least one category (default)
// 'all' = in all categories
```

**Frontend UI:**
- Multi-select dropdown for categories
- Radio buttons for ANY/ALL mode
- Toggle for include/exclude
- Use `GET /graph/universal/filters/categories` to get options

---

#### 👤 User Filtering

```typescript
?user_id=google-oauth2|123456789
?userFilterMode=created  // 'all' | 'created' | 'voted' | 'interacted'

// Modes:
// 'all' = no filtering (default)
// 'created' = nodes user created
// 'voted' = nodes user voted on
// 'interacted' = nodes user voted/commented on
```

**Frontend UI:**
- Dropdown or tabs for user filter mode
- "My Content", "My Votes", "My Activity" tabs

---

#### 📄 Pagination

```typescript
?limit=50    // 1-1000, default: 200
?offset=0    // default: 0

// Calculate next page:
const nextOffset = currentOffset + limit;
const hasMore = response.has_more;
```

**Frontend UI:**
- Page size selector (25, 50, 100, 200)
- Previous/Next buttons
- Load more button (infinite scroll)

---

#### 🔢 Sorting

```typescript
?sort_by=inclusion_votes  // See options below
?sort_direction=desc      // 'asc' | 'desc'

// Sort Options:
// 'inclusion_votes' - Highest consensus first (default)
// 'content_votes' - Best quality first
// 'netVotes' - Combined votes
// 'chronological' - Newest/oldest
// 'participants' - Most engagement
// 'latest_activity' - Most recent activity
// 'keyword_relevance' - Best keyword match
```

**Frontend UI:**
- Dropdown for sort field
- Toggle or button for direction (↑↓)

---

#### 🔗 Relationships

```typescript
?include_relationships=true  // default: true
?relationship_types=shared_keyword,answers
?minCategoryOverlap=1

// Relationship Types:
// 'shared_keyword', 'related_to', 'answers', 
// 'evidence_for', 'shared_category', 'categorized_as'
```

**Frontend UI:**
- Checkbox to show/hide relationships
- Multi-select for relationship types (advanced)

---

## 🔄 Graph Expansion APIs

### Load Discussion + Comments

```typescript
GET /discussions/:discussionId/with-comments-visibility

// Returns: UniversalGraphExpansionResponse
{
  nodes: UniversalNodeData[];  // Discussion + Comments
  relationships: UniversalRelationshipData[];  // HAS_COMMENT, HAS_REPLY
  performance_metrics: {...}
}
```

**Use Case:** User clicks "Discuss" button on a node

**Frontend:**
```typescript
const discussionId = node.discussionId;
const expansion = await fetch(
  `/discussions/${discussionId}/with-comments-visibility`
);
addNodesToGraph(expansion.nodes, expansion.relationships);
```

---

### Load Word + Definitions

```typescript
GET /words/:word/with-definitions

// Returns: UniversalGraphExpansionResponse
{
  nodes: UniversalNodeData[];  // Word + Definitions
  relationships: UniversalRelationshipData[];  // DEFINES
  performance_metrics: {...}
}
```

**Use Case:** User clicks keyword tag on a node

**Frontend:**
```typescript
const word = 'artificial';
const expansion = await fetch(`/words/${word}/with-definitions`);
addNodesToGraph(expansion.nodes, expansion.relationships);
```

---

### Load Category + Composed Words

```typescript
GET /categories/:categoryId/with-contents

// Returns: UniversalGraphExpansionResponse
{
  nodes: UniversalNodeData[];  // Category + Words (1-5)
  relationships: UniversalRelationshipData[];  // COMPOSED_OF
  performance_metrics: {...}
}
```

**Use Case:** User clicks category tag on a node

**Frontend:**
```typescript
const categoryId = '9dcaa40d-3a65-4cfb-b9dd-340592ddf24d';
const expansion = await fetch(`/categories/${categoryId}/with-contents`);
addNodesToGraph(expansion.nodes, expansion.relationships);
```

---

## 📊 Quick Reference Tables

### Node Types Summary

| Type | Content Field | Has Content Votes | Requires Parent | Max Chars |
|------|---------------|-------------------|-----------------|-----------|
| Statement | `statement` | ✅ Yes | ❌ No | 280 |
| OpenQuestion | `questionText` | ❌ No | ❌ No | 280 |
| Answer | `answerText` | ✅ Yes | ✅ Question | 280 |
| Quantity | `question` | ❌ No | ❌ No | 280 |
| Evidence | `title` | ❌ No | ✅ Statement/Answer/Quantity | 280 |

---

### Sort Options Comparison

| Sort By | Best For | Direction |
|---------|----------|-----------|
| `inclusion_votes` | Finding consensus | desc ↓ |
| `content_votes` | Finding quality | desc ↓ |
| `chronological` | Recent content | desc ↓ |
| `participants` | Popular discussions | desc ↓ |
| `latest_activity` | Active content | desc ↓ |

---

### Filter Modes Cheatsheet

| Filter | Mode | Meaning | Example |
|--------|------|---------|---------|
| Keywords | ANY | Has ≥1 keyword | ai OR ethics |
| Keywords | ALL | Has all keywords | ai AND ethics |
| Categories | ANY | In ≥1 category | tech OR science |
| Categories | ALL | In all categories | tech AND science |
| User | created | User created it | My posts |
| User | voted | User voted on it | My votes |
| User | interacted | User voted/commented | My activity |

---

### Relationship Types

| Type | Connects | Use Case |
|------|----------|----------|
| `shared_keyword` | Any → Any | Similar topics |
| `related_to` | Any → Any | Manually linked |
| `answers` | Question → Answer | Q&A pairs |
| `evidence_for` | Evidence → Node | Supporting evidence |
| `shared_category` | Any → Any | Same category |
| `categorized_as` | Node → Category | Category membership |
| `defines` | Definition → Word | Word definitions |
| `composed_of` | Category → Word | Category structure |

---

## 🎨 UI Component Suggestions

### Node Creation Form Template

```tsx
<form onSubmit={handleCreate}>
  {/* Content Input */}
  <TextArea
    value={content}
    onChange={(e) => setContent(e.target.value)}
    maxLength={280}
    placeholder="Enter content..."
  />
  <CharacterCount current={content.length} max={280} />

  {/* Public Credit */}
  <Checkbox
    checked={publicCredit}
    onChange={(e) => setPublicCredit(e.target.checked)}
    label="Show my name publicly"
  />

  {/* Categories (max 3) */}
  <MultiSelect
    options={availableCategories}
    value={selectedCategories}
    onChange={setSelectedCategories}
    max={3}
    label="Categories (max 3)"
  />

  {/* Keywords (optional) */}
  <TagInput
    value={userKeywords}
    onChange={setUserKeywords}
    placeholder="Add keywords (optional, AI will extract if empty)"
  />

  {/* Initial Comment (varies by type) */}
  {requiresComment && (
    <TextArea
      value={initialComment}
      onChange={(e) => setInitialComment(e.target.value)}
      maxLength={280}
      placeholder="Start the discussion..."
      required
    />
  )}

  <Button type="submit">Create</Button>
</form>
```

---

### Graph Filter Panel Template

```tsx
<FilterPanel>
  {/* Node Types */}
  <Section title="Content Types">
    <CheckboxGroup options={NODE_TYPES} value={nodeTypes} onChange={setNodeTypes} />
    <Toggle label="Include" value={includeTypes} onChange={setIncludeTypes} />
  </Section>

  {/* Keywords */}
  <Section title="Keywords">
    <TagSelect options={availableKeywords} value={keywords} onChange={setKeywords} />
    <RadioGroup options={['any', 'all']} value={keywordMode} onChange={setKeywordMode} />
    <Toggle label="Include" value={includeKeywords} onChange={setIncludeKeywords} />
  </Section>

  {/* Categories */}
  <Section title="Categories">
    <MultiSelect options={availableCategories} value={categories} onChange={setCategories} />
    <RadioGroup options={['any', 'all']} value={categoryMode} onChange={setCategoryMode} />
    <Toggle label="Include" value={includeCategories} onChange={setIncludeCategories} />
  </Section>

  {/* User Filter */}
  <Section title="My Content">
    <Select
      options={['all', 'created', 'voted', 'interacted']}
      value={userFilterMode}
      onChange={setUserFilterMode}
    />
  </Section>

  {/* Sorting */}
  <Section title="Sort By">
    <Select options={SORT_OPTIONS} value={sortBy} onChange={setSortBy} />
    <Button onClick={toggleDirection}>{direction === 'asc' ? '↑' : '↓'}</Button>
  </Section>

  <Button onClick={applyFilters}>Apply Filters</Button>
</FilterPanel>
```

---

## 🚀 TypeScript Helpers

### Fetch Functions

```typescript
// Node creation
async function createNode<T>(
  type: 'statement' | 'openquestion' | 'answer' | 'quantity' | 'evidence',
  data: any,
  jwtToken: string
): Promise<T> {
  const response = await fetch(`/api/nodes/${type}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `jwt=${jwtToken}`
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return await response.json();
}

// Universal graph
async function fetchGraph(params: GraphParams, jwtToken: string) {
  const query = new URLSearchParams(params as any).toString();
  const response = await fetch(`/graph/universal/nodes?${query}`, {
    headers: { 'Cookie': `jwt=${jwtToken}` }
  });
  return await response.json();
}

// Graph expansion
async function expandNode(
  type: 'discussion' | 'word' | 'category',
  id: string,
  jwtToken: string
) {
  const endpoints = {
    discussion: `/discussions/${id}/with-comments-visibility`,
    word: `/words/${id}/with-definitions`,
    category: `/categories/${id}/with-contents`
  };
  
  const response = await fetch(endpoints[type], {
    headers: { 'Cookie': `jwt=${jwtToken}` }
  });
  return await response.json();
}
```

---

## ✅ Validation Rules

### All Text Fields
- ✅ 1-280 characters
- ✅ Cannot be empty
- ✅ Show character counter

### Categories
- ✅ Maximum 3 per node
- ✅ Must exist and be approved (`inclusionNetVotes > 0`)

### Parent Nodes (Answer, Evidence)
- ✅ Must exist
- ✅ Must be approved (`inclusionNetVotes > 0`)
- ✅ Must be correct type

### Evidence URL
- ✅ Must be valid URL format
- ✅ Must include protocol (http/https)

---

## 🎯 Common Patterns

### Creating Content with Categories

```typescript
// 1. Fetch available categories
const categories = await fetch('/graph/universal/filters/categories');

// 2. User selects up to 3
const selected = ['cat-123', 'cat-456'];

// 3. Include in creation
await createNode('statement', {
  statement: 'Content here',
  categoryIds: selected,
  initialComment: 'Discussion starter'
}, jwtToken);
```

---

### Building a Filter Query

```typescript
const filters = {
  node_types: ['statement', 'answer'],
  keywords: ['ai', 'ethics'],
  keywordMode: 'all',
  categories: ['tech-cat-123'],
  categoryMode: 'any',
  sort_by: 'inclusion_votes',
  sort_direction: 'desc',
  limit: 50,
  offset: 0
};

const graph = await fetchGraph(filters, jwtToken);
```

---

### Loading Expansions

```typescript
// When user clicks keyword tag
async function onKeywordClick(word: string) {
  const expansion = await expandNode('word', word, jwtToken);
  
  // Add to graph
  expansion.nodes.forEach(node => addNodeToGraph(node));
  expansion.relationships.forEach(rel => addRelationshipToGraph(rel));
}

// When user clicks discuss button
async function onDiscussClick(discussionId: string) {
  const expansion = await expandNode('discussion', discussionId, jwtToken);
  
  // Show comment thread in UI
  displayCommentThread(expansion.nodes);
}

// When user clicks category
async function onCategoryClick(categoryId: string) {
  const expansion = await expandNode('category', categoryId, jwtToken);
  
  // Show category structure
  const category = expansion.nodes[0];
  const words = expansion.nodes.slice(1);
  displayCategoryStructure(category, words, expansion.relationships);
}
```

---

## 📚 Additional Resources

- **Backend Docs:** `/docs/backend/universal-graph-backend.md`
- **Node Creation:** `/docs/frontend/node-creation-API.md`
- **Schema Layer:** `/docs/backend/schema-layer.md`
- **API Testing:** Use Postman or curl with examples above

---

**Document Status:** ✅ Complete and Production Ready  
**Last Updated:** October 14, 2025  
**Frontend Team:** Ready to start development!