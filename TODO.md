# TODO List - Post Node Creation Implementation

## Overview
**Major Milestone Achieved:** All node creation flows are now complete! 🎉

This includes:
- Statement, OpenQuestion, Answer, Quantity, Evidence, Category, and Word/Definition nodes
- Full form validation and submission
- Contextual linked node creation (Answer from Question, Definition from Word, Evidence from Statement/Answer/Quantity)
- Graph expansion with proper positioning and viewport centering

This document tracks remaining features, improvements, and known issues.

---

## Outstanding Tasks

### 1. **Node Positioning & Link Logic** ⚠️
- **Goal:** Smart node placement and relationship visualization
- **Issues:**
  - Nodes not placed proximal to parent
  - Viewport centering inconsistent
  - Link display logic incomplete
- **Components:** `calculateProximalPosition`, force simulation, link rendering
- **Complexity:** High
- **Impact:** Critical for UX

### 2. **AI Keyword Pipeline Verification**
- **Goal:** Ensure AI keyword extraction works end-to-end
- **Current State:** Suspected broken in pipeline
- **Pipeline Steps to Check:**
  1. Node creation triggers keyword extraction
  2. Keywords stored in DB
  3. Keywords returned in node data
  4. Keywords displayed in KeywordTags component
- **Complexity:** Medium

### 3. **Sort & Filter Validation + Node Type Expansion**
- **Goal:** 
  - Verify all sort/filter options return correct datasets
  - Add word, category, evidence, definition nodes to filter options
- **Current State:** 
  - Filters may not be applying correctly
  - Only some node types available in filters
- **Options to Add:** Word, Category, Evidence, Definition (currently only Statement, Question, Answer, Quantity?)
- **Complexity:** Medium

### 4. **Consistent Loading Spinners**
- **Goal:** Unified loading UX across all graph operations
- **Current State:** 
  - Different loading screens for different operations
  - Some operations have no loading indicator
- **Scenarios to Cover:**
  - Initial graph load
  - Node expansion (category, word, etc.)
  - Filter/sort changes
  - Node creation
- **Complexity:** Low-Medium

### 5. **Persistent Category/Word Node Display**
- **Goal:** Category and word nodes stay visible when clicking additional tags
- **Current State:** Clicking new tag replaces previous tag node
- **Desired Behavior:** Accumulate tag nodes until graph reload
- **Complexity:** Low-Medium

### 6. **Discussion System Integration**
- **Goal:** Show comment nodes when "Discuss" button clicked
- **Current State:** Discuss button exists but doesn't display associated comments
- **Components Affected:** All content nodes, comment nodes, discussion service
- **Complexity:** Medium

### 7. **Evidence Node Formatting**
- **Goal:** Correct layout and size for evidence nodes
- **Current State:** Evidence nodes display but may need formatting adjustments
- **Complexity:** Low

### 8. **Test Suite Updates**
- **Goal:** Update existing tests after recent node creation changes
- **Current State:** Extensive testing exists but needs updates for new features
- **Areas to Update:**
  - Node creation flows (all 7 node types)
  - Evidence expansion service
  - Contextual node creation (Answer, Definition, Evidence)
  - Universal graph node addition
- **Complexity:** Medium

---

## Future Features

### 9. **List/Table Views for Graph Data**
- **Goal:** Provide alternative tabular views of graph content
- **Description:** Create list/table views for each network view as alternative to graph visualization
- **Use Cases:**
  - Browse content in traditional format
  - Easier sorting and filtering in tabular format
  - Better for accessibility
  - Complement to graph exploration
- **Complexity:** Medium-High
- **Priority:** Future enhancement

---

## Priority Ordering

### **High Priority (Core Functionality)**
1. Node Positioning & Link Logic - Critical for graph usability
2. AI Keyword Pipeline - Core feature, affects all new nodes
3. Sort & Filter Validation + Expansion - Affects data integrity & discovery

### **Medium Priority (UX Improvements)**
4. Consistent Loading Spinners - Professional polish, user confidence
5. Persistent Tag Nodes - Enhances exploration workflow
6. Discussion System - Major feature but standalone
7. Test Suite Updates - Maintain code quality after recent changes

### **Low Priority (Polish)**
8. Evidence Node Formatting - Visual refinement

### **Future Features**
9. List/Table Views - Alternative visualization format

---

## Quick Wins vs. Complex Issues

### Quick Wins (1-2 hours each)
- **Consistent Loading Spinners** - Create reusable component, wire everywhere
- **Evidence Node Formatting** - CSS/layout adjustments
- **Filter Node Type Addition** - Add node types to filter dropdown

### Medium Complexity (3-5 hours)
- **Persistent Tag Nodes** - Graph state management
- **Full Filter Validation** - Validate and fix all filters
- **Keyword Pipeline Debugging** - End-to-end verification
- **Test Suite Updates** - Update tests for new node creation flows

### Complex (5+ hours)
- **Positioning & Links** - Core graph behavior
- **Discussion System** - New interaction pattern

---

## Dependencies & Notes

- **Node Positioning** should be done first - it affects all node additions
- **AI Keywords** is important to fix before users create too many nodes
- **Sort/Filter** affects how users find existing content
- **Discussion System** is a major feature but relatively independent
- **Persistent Tags** depends on understanding current graph state management
- **Evidence Formatting** is quick but low impact
- **Loading Spinners** can be done at any time, improves UX across the board
- **Test Suite Updates** should be done after major feature implementations stabilize
- **List/Table Views** is a future enhancement requiring significant UI/UX design

---

## Next Steps

**Recommended Starting Point:**
- Option A: Tackle Node Positioning & Link Logic (foundation for everything)
- Option B: Quick wins first (Loading Spinners + Evidence Formatting) for immediate polish
- Option C: Fix AI Keywords (affects all future node creation)