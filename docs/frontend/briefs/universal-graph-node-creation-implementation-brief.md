# Universal Graph Node Creation Implementation Brief
## ProjectZer0 Frontend Development

**Version:** 1.0  
**Date:** November 24, 2025  
**Status:** Ready for Implementation  
**Estimated Duration:** 8 chat sessions

---

## 📋 Executive Summary

This brief outlines the systematic implementation of node creation functionality in the Universal Graph view, enabling users to create and add all content node types (Statement, OpenQuestion, Answer, Quantity, Evidence, Category) directly from the graph interface through two methods:

1. **Central Control Node Creation** - General creation via navigation ring button
2. **Linked Creation** - Contextual creation from existing nodes (Answer, Evidence, Related)

---

## 🎯 Project Objectives

### Primary Goals
- Enable complete CRUD operations for all content node types in Universal Graph
- Implement category tagging support across all applicable node types
- Maintain consistent UX patterns across all creation flows
- Ensure seamless integration with existing Universal Graph architecture

### Success Criteria
- All 7 node types (Word, Statement, OpenQuestion, Answer, Quantity, Evidence, Category) can be created from Universal Graph
- Category tagging works correctly (max 3 per node)
- Forms display properly as graph nodes with correct positioning
- New nodes appear in graph immediately after creation
- Relationships auto-create for linked node creation
- All validation and error handling works correctly

---

## 📊 Current State Assessment

### ✅ Existing Infrastructure

**Form Components (Ready to Use):**
- Multi-step form pattern established
- Shared components: `FormNavigation`, `KeywordInput`, `DiscussionInput`, `MessageDisplay`, `CharacterCount`, `StepIndicator`
- Existing forms: Word, Statement, OpenQuestion, Quantity, AlternativeDefinition
- Review components with API integration

**UI Components (Ready to Use):**
- `CategoryTags.svelte` - Display categories as clickable text links
- `KeywordTags.svelte` - Display keywords as clickable text links
- `NodeHeader.svelte` - Consistent header styling
- `ContentBox.svelte` - Structured layout system (optional for forms)

**Graph Integration Patterns:**
- `CreateNodeNode.svelte` - Multi-type creation with color cycling
- `CreateAlternativeDefinitionNode.svelte` - Linked creation pattern reference
- Color cycling animation until type selection
- Step indicators (circular dots)

**Backend APIs:**
- Node creation endpoints: `/nodes/word`, `/nodes/statement`, `/nodes/openquestion`, `/nodes/quantity`
- Category endpoint: `/categories` (fetch and create)
- Evidence endpoint: TBD (verify with backend)
- Answer endpoint: `/nodes/answer` (assumed)

### ⚠️ Gaps to Address

**Missing Form Components:**
- Answer node creation forms (Input, Review)
- Evidence node creation forms (Input, Review)
- Category node creation forms (Input, Review)
- CategoryInput shared component

**Missing Integrations:**
- Category tagging in existing forms (Statement, OpenQuestion, Quantity)
- Universal Graph node addition after creation
- Linked creation buttons on content nodes
- Relationship creation for linked nodes

---

## 🎨 Design System

### Color Palette (Updated Destiny-Inspired Synthwave)

**⚠️ CRITICAL: Single Source of Truth**
All colors MUST be imported from `/src/lib/constants/colors.ts` and `/src/lib/constants/graph/nodes.ts`. Never hard-code color values in components!

```typescript
// Always import colors like this:
import { COLORS } from '$lib/constants/colors';
import { NODE_CONSTANTS } from '$lib/constants/graph/nodes';
```

**Content Node Colors:**
```typescript
COLORS.PRIMARY.OPEN_QUESTION: '#5BB7FF'    // Bright cerulean
COLORS.PRIMARY.ANSWER:        '#B68CFF'    // Lavender-violet
COLORS.PRIMARY.QUANTITY:      '#48E0C2'    // Aqua-tech
COLORS.PRIMARY.STATEMENT:     '#FF7FD1'    // Magenta-crystal
COLORS.PRIMARY.WORD:          '#FFD86E'    // Warm golden
COLORS.PRIMARY.DEFINITION:    '#FFB447'    // Amber-clarity
COLORS.PRIMARY.CATEGORY:      '#FF8A3D'    // Orange-coral
COLORS.PRIMARY.EVIDENCE:      '#67F28E'    // Supportive green
COLORS.PRIMARY.COMMENT:       '#FF6B6B'    // Lively coral-red
```

**Node-Specific Color Objects (from NODE_CONSTANTS):**
```typescript
NODE_CONSTANTS.COLORS.ANSWER.background    // '#B68CFF33' (with alpha)
NODE_CONSTANTS.COLORS.ANSWER.border        // '#B68CFFFF'
NODE_CONSTANTS.COLORS.ANSWER.text          // '#B68CFFFF'
// etc. for each node type
```

**CreateNodeNode Color Cycling Pattern:**
```typescript
// Before type selection - cycles through:
OPEN_QUESTION → ANSWER → QUANTITY → STATEMENT → 
WORD → DEFINITION → CATEGORY → EVIDENCE
// Interval: 2000ms

// After type selection - locks to type-specific color
```

**Form Styling Standards:**
- Font: `Inter` (migrated from Orbitron)
- Input border: `2px solid rgba(255, 255, 255, 0.3)`
- Focus border: `3px solid rgba(255, 255, 255, 0.8)`
- Error border: `2px solid #ff4444`
- Button primary: `rgba(74, 144, 226, 0.3)` background
- Character count: Top-right, `12px` Inter

**Step Indicators:**
- Radius: `4px`
- Inactive: `rgba(255, 255, 255, 0.2)`
- Active: `rgba(255, 255, 255, 0.8)`
- Spacing: `20px` horizontal

---

## 🏗️ Implementation Phases

### **PHASE 1: Core Category Infrastructure** (Chat 1-2)

#### Objectives
- Create reusable CategoryInput component
- Integrate category tagging into Statement, OpenQuestion, and Quantity forms
- Update Review components to display categories
- Ensure API payloads include category IDs

#### Files Required in Project Knowledge

**For Chat 1 (CategoryInput Creation):**
```
/src/lib/constants/colors.ts
/src/lib/constants/graph/nodes.ts
/src/lib/components/forms/createNode/shared/KeywordInput.svelte
/src/lib/components/forms/createNode/shared/FormNavigation.svelte
/src/lib/components/graph/nodes/ui/CategoryTags.svelte
/src/lib/styles/forms.ts
/src/lib/constants/validation.ts
```

**For Chat 2 (Form Integration):**
```
/src/lib/components/forms/createNode/statement/StatementInput.svelte
/src/lib/components/forms/createNode/statement/StatementReview.svelte
/src/lib/components/forms/createNode/openquestion/OpenQuestionInput.svelte
/src/lib/components/forms/createNode/openquestion/OpenQuestionReview.svelte
/src/lib/components/forms/createNode/quantity/QuantityInput.svelte
/src/lib/components/forms/createNode/quantity/QuantityReview.svelte
/src/lib/components/forms/createNode/shared/CategoryInput.svelte (newly created)
```

#### Deliverables

**Chat 1:**
- `CategoryInput.svelte` component
  - Fetch categories from `/categories` endpoint
  - Searchable/filterable dropdown or list
  - Max 3 category selection (enforced)
  - Display as removable chips
  - "Create new category" link
  - Validation messaging

**Chat 2:**
- Updated Statement forms (5 steps total)
  - Insert CategoryInput between KeywordInput and DiscussionInput
  - Update StatementReview to display CategoryTags
  - Include `categories: string[]` in API payload
  - Update step indicators

- Updated OpenQuestion forms (5 steps total)
  - Same pattern as Statement
  - Update step count

- Updated Quantity forms (7 steps total)
  - Insert CategoryInput after KeywordInput
  - Update QuantityReview
  - Update step count

#### Validation Criteria
- [ ] CategoryInput component renders correctly
- [ ] Can select 1-3 categories
- [ ] Selected categories display as chips with remove button
- [ ] Validation prevents selecting >3 categories
- [ ] All three node types include category step
- [ ] Review components show CategoryTags correctly
- [ ] API payloads include category IDs
- [ ] Step indicators show correct count

---

### **PHASE 2: Answer Node Creation** (Chat 3)

#### Objectives
- Create Answer node creation forms
- Implement Answer node container with proper flow
- Integrate with OpenQuestion nodes for contextual answering
- Enable category tagging for answers

#### Files Required in Project Knowledge
```
/src/lib/components/forms/createNode/statement/StatementInput.svelte (as reference)
/src/lib/components/forms/createNode/statement/StatementReview.svelte (as reference)
/src/lib/components/forms/createNode/shared/KeywordInput.svelte
/src/lib/components/forms/createNode/shared/CategoryInput.svelte
/src/lib/components/forms/createNode/shared/DiscussionInput.svelte
/src/lib/components/forms/createNode/shared/FormNavigation.svelte
/src/lib/components/forms/createNode/shared/MessageDisplay.svelte
/src/lib/components/graph/nodes/createNode/CreateAlternativeDefinitionNode.svelte (as pattern)
/src/lib/constants/colors.ts
/src/lib/constants/graph/nodes.ts
/src/lib/types/domain/nodes.ts (AnswerNode interface)
```

#### Deliverables

**AnswerInput.svelte:**
- Text area for answer (280 char limit)
- Required field validation
- Similar to StatementInput but with `answerText` field
- Display parent question context (read-only)

**AnswerReview.svelte:**
- Display: answer text, parent question, keywords, categories, discussion
- Submit to `/nodes/answer` endpoint
- Payload includes `questionId` from parent
- Success navigation to answer view or parent question

**CreateAnswerNode.svelte:**
- 5-step flow: AnswerInput → KeywordInput → CategoryInput → DiscussionInput → AnswerReview
- Accept props: `questionId`, `questionText` for context
- Color: ANSWER (#B68CFF)
- Step indicators (5 dots)

**OpenQuestionNode Integration:**
- Add/verify "Answer" button triggers CreateAnswerNode
- Pass questionId and questionText context

#### Validation Criteria
- [ ] AnswerInput component renders and validates correctly
- [ ] Answer text limited to 280 characters
- [ ] Parent question context displays prominently
- [ ] All 5 steps work in sequence
- [ ] CategoryInput allows category selection
- [ ] AnswerReview displays all fields correctly with CategoryTags
- [ ] API submission includes all required fields
- [ ] Answer appears in question's answer list after creation
- [ ] Navigation works correctly after success

---

### **PHASE 3: Evidence Node Creation - Part 1** (Chat 4)

#### Objectives
- Create complex EvidenceInput component with multiple field types
- Handle validation for required vs optional fields
- Implement parent node context display

#### Files Required in Project Knowledge
```
/src/lib/components/forms/createNode/shared/FormNavigation.svelte
/src/lib/styles/forms.ts
/src/lib/constants/validation.ts
/src/lib/constants/colors.ts
/src/lib/types/domain/nodes.ts (EvidenceNode interface)
```

#### Deliverables

**EvidenceInput.svelte:**
- **Title field** (required, 280 char max, text input)
- **URL field** (required, URL validation, text input)
- **Evidence type dropdown** (required, 8 options):
  - peer_reviewed_study
  - government_report
  - news_article
  - expert_opinion
  - dataset
  - video
  - image
  - other
- **Authors field** (optional, comma-separated input)
- **Publication date** (optional, date picker)
- **Description** (optional, 500 char max, textarea)
- **Parent node display** (read-only, shows what this evidence is for)
- Comprehensive validation
- May need vertical scrolling or 2-page form due to field count

#### Validation Criteria
- [ ] All required fields (title, URL, type) validate correctly
- [ ] URL field validates URL format
- [ ] Character limits enforced
- [ ] Optional fields can be left blank
- [ ] Parent node information displays clearly
- [ ] Form is readable and not cramped
- [ ] Validation errors display appropriately
- [ ] Can navigate back from this step

---

### **PHASE 4: Evidence Node Creation - Part 2** (Chat 5)

#### Objectives
- Complete Evidence node creation with Review component
- Create Evidence node container
- Integrate Evidence buttons on parent nodes (Statement, Answer, Quantity)

#### Files Required in Project Knowledge
```
/src/lib/components/forms/createNode/evidence/EvidenceInput.svelte (from Chat 4)
/src/lib/components/forms/createNode/shared/KeywordInput.svelte
/src/lib/components/forms/createNode/shared/CategoryInput.svelte
/src/lib/components/forms/createNode/shared/DiscussionInput.svelte
/src/lib/components/forms/createNode/shared/FormNavigation.svelte
/src/lib/components/forms/createNode/shared/MessageDisplay.svelte
/src/lib/components/graph/nodes/createNode/CreateAlternativeDefinitionNode.svelte (as pattern)
/src/lib/components/graph/nodes/ui/CategoryTags.svelte
/src/lib/components/graph/nodes/ui/KeywordTags.svelte
/src/lib/constants/colors.ts
/src/lib/types/domain/nodes.ts (EvidenceNode interface)
```

#### Deliverables

**EvidenceReview.svelte:**
- Display all evidence fields clearly
- Parse authors from comma-separated string to array
- Show parent node prominently
- Display CategoryTags and KeywordTags
- Submit to `/nodes/evidence` endpoint (verify exact endpoint)
- Payload structure:
  ```typescript
  {
    title: string;
    url: string;
    authors?: string[];
    publicationDate?: string;
    description?: string;
    evidenceType: string;
    parentNodeId: string;
    parentNodeType: 'StatementNode' | 'AnswerNode' | 'QuantityNode';
    userKeywords?: string[];
    categories?: string[];
    initialComment?: string;
    publicCredit: boolean;
  }
  ```

**CreateEvidenceNode.svelte:**
- 5-step flow: EvidenceInput → KeywordInput → CategoryInput → DiscussionInput → EvidenceReview
- Accept props: `parentNodeId`, `parentNodeType`, `parentTitle`
- Color: EVIDENCE (#67F28E)
- Display parent context throughout flow

**Parent Node Integration:**
- Add "Add Evidence" button to StatementNode
- Add "Add Evidence" button to AnswerNode (if applicable)
- Add "Add Evidence" button to QuantityNode
- Buttons pass parent context to CreateEvidenceNode

#### Validation Criteria
- [ ] EvidenceReview displays all fields correctly
- [ ] Authors array created properly from comma-separated input
- [ ] CategoryTags and KeywordTags render
- [ ] API submission successful with all fields
- [ ] Evidence creation endpoint works (verify with backend)
- [ ] Parent node context maintained throughout flow
- [ ] Evidence appears linked to parent after creation
- [ ] "Add Evidence" buttons present on all three parent types

---

### **PHASE 5: Category Node Creation** (Chat 6)

#### Objectives
- Create Category node creation forms
- Implement word selection interface (1-5 words)
- Auto-generate category name preview
- Enable hierarchical category creation (optional parent)

#### Files Required in Project Knowledge
```
/src/lib/components/forms/createNode/shared/FormNavigation.svelte
/src/lib/components/forms/createNode/shared/DiscussionInput.svelte
/src/lib/components/forms/createNode/shared/MessageDisplay.svelte
/src/lib/components/graph/nodes/createNode/CreateNodeNode.svelte (for pattern)
/src/lib/styles/forms.ts
/src/lib/constants/colors.ts
/src/lib/types/domain/nodes.ts (CategoryNode interface)
```

#### Deliverables

**CategoryCreationInput.svelte:**
- Word selection interface
  - Fetch available words from `/nodes/word/all` or search endpoint
  - Searchable/filterable list
  - Select 1-5 words (enforced)
  - Display selected as chips with remove
- Auto-generated name preview
  - Show how category name will look: "artificial intelligence"
  - Update dynamically as words selected/removed
- Optional parent category dropdown
  - Fetch categories from `/categories`
  - Allow selecting one parent (hierarchical)
- Validation: 1-5 words required

**CategoryCreationReview.svelte:**
- Display selected words clearly
- Show final category name prominently
- Show parent category if selected
- Display discussion if provided
- Submit to `/categories` POST endpoint
- Payload:
  ```typescript
  {
    wordIds: string[];  // 1-5 word UUIDs
    parentCategoryId?: string;
    publicCredit: boolean;
    initialComment?: string;
  }
  ```

**CreateCategoryNode.svelte:**
- 3-step flow: CategoryCreationInput → DiscussionInput → CategoryCreationReview
- Color: CATEGORY (#FF8A3D)
- Note: Categories don't have keywords (they ARE keyword combinations)
- Simpler flow than other nodes

#### Validation Criteria
- [ ] Can search/filter available words
- [ ] Word selection enforces 1-5 limit
- [ ] Selected words display as removable chips
- [ ] Category name preview updates correctly
- [ ] Parent category selection works (optional)
- [ ] Review shows all information clearly
- [ ] API submission successful
- [ ] New category appears in category lists
- [ ] Category name generated correctly on backend

---

### **PHASE 6: Universal Graph Integration - Central Method** (Chat 7)

#### Objectives
- Integrate CreateNodeNode into Universal Graph via navigation ring
- Implement post-creation graph updates (add node, center viewport)
- Handle simulation reheating for new node positioning

#### Files Required in Project Knowledge
```
/src/lib/components/graph/nodes/createNode/CreateNodeNode.svelte
/src/routes/graph/universal/+page.svelte
/src/lib/stores/universalGraphStore.ts
/src/lib/services/graph/UniversalGraphManager.ts
/src/lib/services/graph/universal/UniversalPositioning.ts
/docs/frontend/universal-graph-frontend.md
```

#### Deliverables

**Navigation Ring Integration:**
- Add/verify "Create Node" button in navigation ring
- On click: Replace control node with CreateNodeNode
- CreateNodeNode handles type selection → form flow internally

**Post-Creation Graph Update:**
- New method in universalGraphStore: `addNewNodeToGraph(nodeData, position?)`
- Fetch newly created node data (with all relationships)
- Transform to EnhancedNode format (match existing transformation pipeline)
- Calculate position using vote-based positioning or proximal positioning
- Insert into nodes array
- Create graph links if needed

**Viewport Management:**
- After node added: `centerOnNodeById(newNodeId, transitionDuration)`
- Smooth animation to new node
- Highlight new node briefly (glow effect?)

**Simulation Update:**
- Reheat simulation with gentle wake: `updateState(newData, wakePower: 0.2)`
- Allow new node to settle naturally
- Maintain existing node positions (don't disturb)

#### Validation Criteria
- [ ] "Create Node" button visible and functional
- [ ] CreateNodeNode replaces control node on click
- [ ] All node type creation flows work from this entry point
- [ ] After creation, new node appears in graph
- [ ] Viewport centers on new node smoothly
- [ ] New node has correct position (vote-based)
- [ ] Simulation reheats gently
- [ ] Existing nodes not disrupted
- [ ] New node has all expected properties and relationships

---

### **PHASE 7: Universal Graph Integration - Linked Method** (Chat 8)

#### Objectives
- Add contextual creation buttons to all content nodes
- Implement proximal form positioning (appear near parent)
- Create relationships automatically between linked nodes
- Final comprehensive testing of all creation methods

#### Files Required in Project Knowledge
```
/src/lib/components/graph/nodes/openquestion/OpenQuestionNode.svelte
/src/lib/components/graph/nodes/statement/StatementNode.svelte
/src/lib/components/graph/nodes/answer/AnswerNode.svelte
/src/lib/components/graph/nodes/quantity/QuantityNode.svelte
/src/lib/components/graph/nodes/word/WordNode.svelte
/src/lib/components/graph/nodes/createNode/CreateAnswerNode.svelte
/src/lib/components/graph/nodes/createNode/CreateEvidenceNode.svelte
/src/lib/components/graph/nodes/createNode/CreateAlternativeDefinitionNode.svelte
/src/lib/components/graph/nodes/createNode/CreateNodeNode.svelte
/src/routes/graph/universal/+page.svelte
/src/lib/services/graph/UniversalGraphManager.ts
/docs/frontend/universal-graph-frontend.md
```

#### Deliverables

**Linked Creation Buttons:**
- **OpenQuestion node:** "Answer" button → CreateAnswerNode
- **Statement/Answer/Quantity nodes:** "Add Evidence" button → CreateEvidenceNode
- **Word node:** "Add Alt Definition" button → CreateAlternativeDefinitionNode (already exists!)
- **All content nodes:** "Create Related" button → CreateNodeNode (generic creation)

**Proximal Positioning:**
- Use existing `calculateProximalPosition(sourcePosition, nodes, offset)` utility
- Place form node near parent with 100-150px offset
- Avoid overlapping existing nodes
- Maintain visibility (within viewport if possible)

**Form Node Display:**
- Forms appear as nodes in graph with distinct styling:
  - Dashed border or different glow to distinguish from content
  - Larger size to accommodate form content
  - Semi-transparent background
- Cancel button removes form node from graph
- Success replaces form node with created content node

**Relationship Creation:**
- Answer → Question: `responds_to` link with `answers` type
- Evidence → Parent: `evidence_for` link
- Related nodes: `related_to` link with keyword (if applicable)
- Relationships created immediately after node creation
- Links animate into place

**Comprehensive Testing:**
- Test all 7 node types via central method
- Test all linked creation methods (Answer, Evidence, Alt Definition, Related)
- Test category selection across all applicable nodes
- Test form cancellation
- Test multiple sequential creations
- Test in different graph states (empty, sparse, dense)
- Test error handling and validation
- Test network failures and retries

#### Validation Criteria
- [ ] All linked creation buttons present and functional
- [ ] Forms appear proximal to parent nodes
- [ ] Forms positioned to avoid overlaps
- [ ] Form nodes visually distinct from content nodes
- [ ] Cancel removes form node cleanly
- [ ] Success replaces form with content node
- [ ] Relationships created automatically
- [ ] Links animate smoothly
- [ ] All node types can be created via both methods
- [ ] Category tagging works in all flows
- [ ] Error handling works correctly
- [ ] Multiple sequential creations work
- [ ] Graph remains stable and performant
- [ ] No memory leaks or orphaned nodes

---

## 📐 Technical Specifications

### API Payload Standards

All node creation follows this pattern:
```typescript
{
  [contentField]: string,        // statement, questionText, answerText, etc.
  createdBy: userId,
  userKeywords?: string[],        // Optional
  categories?: string[],          // NEW - max 3 category IDs
  initialComment?: string,        // Optional (maps to discussion)
  publicCredit: boolean,
  // Node-specific fields...
}
```

### Form Step Counts

| Node Type | Steps | Flow |
|-----------|-------|------|
| Word | 4 | Word → Definition → Discussion → Review |
| Statement | 5 | Statement → Keywords → Categories → Discussion → Review |
| OpenQuestion | 5 | Question → Keywords → Categories → Discussion → Review |
| Answer | 5 | Answer → Keywords → Categories → Discussion → Review |
| Quantity | 7 | Question → Unit Category → Unit → Keywords → Categories → Discussion → Review |
| Evidence | 5 | Evidence Details → Keywords → Categories → Discussion → Review |
| Category | 3 | Word Selection → Discussion → Review |

### Node Type Colors (Destiny-Inspired Synthwave)

**CRITICAL: Always import from `/src/lib/constants/colors.ts` - NEVER hard-code color values!**

```typescript
// From /src/lib/constants/colors.ts
import { COLORS } from '$lib/constants/colors';

COLORS.PRIMARY.OPEN_QUESTION: '#5BB7FF'    // Bright cerulean
COLORS.PRIMARY.ANSWER:        '#B68CFF'    // Lavender-violet
COLORS.PRIMARY.QUANTITY:      '#48E0C2'    // Aqua-tech
COLORS.PRIMARY.STATEMENT:     '#FF7FD1'    // Magenta-crystal
COLORS.PRIMARY.WORD:          '#FFD86E'    // Warm golden
COLORS.PRIMARY.DEFINITION:    '#FFB447'    // Amber-clarity
COLORS.PRIMARY.CATEGORY:      '#FF8A3D'    // Orange-coral
COLORS.PRIMARY.EVIDENCE:      '#67F28E'    // Supportive green
COLORS.PRIMARY.COMMENT:       '#FF6B6B'    // Lively coral-red
```

**Usage Example:**
```svelte
<script lang="ts">
  import { COLORS } from '$lib/constants/colors';
  import { NODE_CONSTANTS } from '$lib/constants/graph/nodes';
  
  // CORRECT ✅
  const answerColor = COLORS.PRIMARY.ANSWER;
  const answerBorder = NODE_CONSTANTS.COLORS.ANSWER.border;
  
  // WRONG ❌ - Never do this!
  // const answerColor = '#B68CFF';
</script>
```

### Component Architecture

**Shared Form Components (Reusable):**
- `NodeTypeSelect.svelte` - Type selection dropdown
- `KeywordInput.svelte` - Keyword entry with chips
- `CategoryInput.svelte` - Category selection (NEW)
- `DiscussionInput.svelte` - Optional discussion textarea
- `FormNavigation.svelte` - Back/Next buttons
- `MessageDisplay.svelte` - Success/error messages
- `CharacterCount.svelte` - Character limit display
- `StepIndicator.svelte` - Progress dots

**Node-Specific Components:**
- Input components: Primary content entry
- Review components: Final confirmation before submission
- Container components: Orchestrate multi-step flow

**Display Components:**
- `CategoryTags.svelte` - Clickable category list
- `KeywordTags.svelte` - Clickable keyword list
- `NodeHeader.svelte` - Consistent headers

### Universal Graph Integration Points

**Store Methods:**
```typescript
// universalGraphStore
addNewNodeToGraph(nodeData, position?)
removeNodeFromGraph(nodeId)
updateNodeData(nodeId, newData)

// UniversalGraphManager
centerOnNodeById(nodeId, duration)
updateState(newData?, wakePower = 0.2)
```

**Position Calculation:**
```typescript
calculateProximalPosition(
  sourcePosition: { x: number, y: number },
  existingNodes: EnhancedNode[],
  offsetDistance: number = 100
): { x: number, y: number }
```

**Relationship Creation:**
```typescript
createRelationship(
  sourceId: string,
  targetId: string,
  type: 'responds_to' | 'evidence_for' | 'related_to' | 'answers'
): Promise<void>
```

---

## ✅ Acceptance Criteria

### Functional Requirements
- [ ] All 7 node types can be created from Universal Graph
- [ ] Category tagging works across all applicable nodes (max 3)
- [ ] Keyword tagging works across all applicable nodes
- [ ] Discussion (initial comment) can be added to all nodes
- [ ] Public credit option works for all nodes
- [ ] Forms validate all required fields
- [ ] Forms enforce character limits
- [ ] Error messages display clearly
- [ ] Success messages appear after creation
- [ ] Navigation works correctly after submission

### Graph Integration Requirements
- [ ] Central control node creation method works
- [ ] Linked creation methods work from all parent types
- [ ] Forms appear proximal to parent nodes
- [ ] Forms visually distinct from content nodes
- [ ] New nodes appear in graph after creation
- [ ] Viewport centers on new nodes
- [ ] Simulation reheats gently after new node added
- [ ] Relationships auto-create for linked nodes
- [ ] Cancel removes form nodes cleanly
- [ ] Multiple sequential creations work

### Performance Requirements
- [ ] Form rendering smooth (<100ms)
- [ ] API submissions complete in reasonable time (<3s)
- [ ] Graph updates don't lag or stutter
- [ ] No memory leaks from form components
- [ ] Simulation remains stable with new nodes

### UX Requirements
- [ ] Consistent styling across all forms
- [ ] Clear step progression indicators
- [ ] Intuitive navigation (back/next buttons)
- [ ] Helpful placeholder text
- [ ] Clear error messages
- [ ] Success feedback visible
- [ ] Color-coded by node type
- [ ] Responsive to user input

---

## 🧪 Testing Strategy

### Unit Testing Focus
- Individual form component validation
- Character limit enforcement
- Category/keyword chip management
- API payload construction
- Position calculation logic

### Integration Testing Focus
- Multi-step form flows
- API submission and response handling
- Graph store updates
- Relationship creation
- Viewport centering
- Simulation updates

### Manual Testing Checklist

**Per Node Type:**
- [ ] Create from central node
- [ ] Create from linked node (if applicable)
- [ ] Add minimum required fields only
- [ ] Add all optional fields
- [ ] Test validation (empty, over-limit)
- [ ] Select 0, 1, 2, 3 categories
- [ ] Add 0, 1, multiple keywords
- [ ] Add discussion text
- [ ] Submit and verify creation
- [ ] Verify node appears in graph
- [ ] Verify relationships created
- [ ] Cancel form mid-flow

**Cross-Node Testing:**
- [ ] Create multiple different types in sequence
- [ ] Create linked chain (Question → Answer → Evidence)
- [ ] Test in empty graph
- [ ] Test in dense graph (200+ nodes)
- [ ] Test error recovery
- [ ] Test network failure scenarios

---

## 🚀 Deployment Considerations

### Rollout Strategy
1. **Phase 1-2:** Deploy category infrastructure (low risk)
2. **Phase 3-5:** Deploy new node types incrementally (medium risk)
3. **Phase 6-7:** Deploy graph integration (higher risk, test thoroughly)

### Monitoring Points
- API endpoint success rates
- Form completion rates
- Error frequency by node type
- Graph performance metrics after creation
- User feedback on UX

### Rollback Plan
- Forms are additive, can be disabled via feature flag
- Database changes (category support) must be backwards compatible
- Graph integration can fall back to existing behavior

---

## 📚 Reference Documentation

### Key Architecture Documents
- `/docs/frontend/universal-graph-frontend.md` - Universal Graph architecture
- `/src/lib/types/domain/nodes.ts` - Node type definitions
- `/src/lib/types/graph/enhanced.ts` - Enhanced node types

### Style Guides
- `/src/lib/styles/forms.ts` - Form styling constants
- `/src/lib/constants/colors.ts` - Color palette
- `/src/lib/constants/graph/nodes.ts` - Node constants

### Existing Patterns
- `/src/lib/components/graph/nodes/createNode/CreateNodeNode.svelte` - Multi-type creation
- `/src/lib/components/graph/nodes/createNode/CreateAlternativeDefinitionNode.svelte` - Linked creation
- `/src/lib/components/forms/createNode/statement/` - Complete form example

---

## 📝 Notes for Implementation

### Best Practices
1. **Always start by reading existing similar components** - Don't reinvent patterns
2. **ALWAYS import colors from constants files** - Never hard-code hex values
   ```typescript
   import { COLORS } from '$lib/constants/colors';
   import { NODE_CONSTANTS } from '$lib/constants/graph/nodes';
   ```
3. **Test validation thoroughly** - Users will try to break it
4. **Keep forms simple** - Don't overwhelm with options
5. **Provide helpful feedback** - Clear errors, success messages
6. **Think mobile** - Forms should work on smaller screens (future consideration)

### Common Pitfalls to Avoid
- **Hard-coding color values instead of importing from constants** - Always use `COLORS` and `NODE_CONSTANTS`
- Forgetting to update step counts after adding new steps
- Hardcoding other values instead of using constants
- Not handling API errors gracefully
- Forgetting to include categories in API payload
- Not testing linked creation flows thoroughly
- Assuming network requests succeed

### Code Quality Standards
- Clean, readable code with meaningful variable names
- **Always import colors from `/src/lib/constants/colors.ts` and `/src/lib/constants/graph/nodes.ts`** - single source of truth
- Consistent styling with existing forms
- Comprehensive error handling
- Proper TypeScript typing
- Comments for complex logic only
- No console.logs in production code (use proper logging)

---

## 🎯 Success Metrics

### Quantitative
- 100% of node types support creation from Universal Graph
- 0 critical bugs in production
- <100ms form render time
- <3s API submission time
- 0 memory leaks detected

### Qualitative
- User can create any node type intuitively
- Forms feel consistent across all types
- Error messages are helpful and clear
- Success flows feel satisfying
- Graph remains stable and performant

---

## 📞 Support & Questions

During implementation, refer back to this brief for:
- Required files per phase
- Technical specifications
- Validation criteria
- Testing checklists

For questions or clarifications, consult:
- Existing similar components for patterns
- Architecture documentation for context
- Project knowledge for latest code

---

**Document Status:** Ready for Implementation  
**Last Updated:** November 24, 2025  
**Version:** 1.0  
**Next Review:** After Phase 4 completion (mid-project check-in)

---

*This brief is a living document. Update as needed based on implementation learnings, but maintain version history and change notes.*