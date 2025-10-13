# API Node Creation Reference - Frontend Guide

**ProjectZer0 Backend - Node Creation API Documentation**  
**Version:** 1.0  
**Last Updated:** October 13, 2025  
**Status:** Production Ready ✅

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Common Patterns](#common-patterns)
4. [Statement Node](#1-statement-node)
5. [OpenQuestion Node](#2-openquestion-node)
6. [Answer Node](#3-answer-node)
7. [Quantity Node](#4-quantity-node)
8. [Evidence Node](#5-evidence-node)
9. [Dropdown Options Reference](#dropdown-options-reference)
10. [Error Handling](#error-handling)

---

## Overview

This document provides complete API specifications for creating all 5 primary content node types in ProjectZer0. Each section includes:

- ✅ Complete request/response structures
- ✅ Field descriptions and validation rules
- ✅ Required vs optional fields
- ✅ Dropdown/select options
- ✅ Example requests with cURL
- ✅ Common error scenarios

**Base URL:** `http://localhost:3000/api` (development)

**All endpoints require JWT authentication via cookie.**

---

## Authentication

All node creation endpoints require authentication via JWT token in cookie.

**Cookie Format:**
```
Cookie: jwt=<your-jwt-token>
```

**User ID Extraction:**
- User ID automatically extracted from JWT token (`req.user.sub`)
- No need to include `createdBy` in request body
- Backend assigns creator from authenticated user

---

## Common Patterns

### Universal Fields (All Node Types)

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `publicCredit` | boolean | No | `true` | Show author publicly |
| `categoryIds` | string[] | No | `[]` | Category IDs (max 3) |
| `userKeywords` | string[] | No | - | Manual keywords (else AI extracts) |
| `initialComment` | string | Varies | - | First discussion comment |

### Category Selection
- **Maximum:** 3 categories per node
- **Validation:** All categories must exist and have `inclusionNetVotes > 0`
- **Format:** Array of category UUIDs
- **Example:** `["cat-uuid-1", "cat-uuid-2"]`

### Keyword Input
- **Option 1:** Provide `userKeywords` array (manual)
- **Option 2:** Omit `userKeywords` (AI extracts automatically)
- **Source Tag:** User keywords marked as `source: "user"`, AI as `source: "ai"`
- **Frequency:** User keywords get `frequency: 1`, AI assigns 0.0-1.0

### Discussion Creation
- **Optional for most:** Statement, OpenQuestion **require** initial comment
- **Format:** String, 1-280 characters
- **Creates:** DiscussionNode + initial CommentNode
- **Returns:** `discussionId` in response

---

## 1. Statement Node

### Endpoint
```
POST /api/nodes/statement
```

### Request Body Structure

```typescript
{
  statement: string;              // REQUIRED, 1-280 chars
  publicCredit?: boolean;         // Optional, default: true
  categoryIds?: string[];         // Optional, max 3
  userKeywords?: string[];        // Optional, else AI extracts
  parentStatementId?: string;     // Optional, for threading
  initialComment: string;         // REQUIRED, 1-280 chars
}
```

### Field Details

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `statement` | string | **YES** | 1-280 chars | Main statement text |
| `publicCredit` | boolean | No | true/false | Show author name publicly |
| `categoryIds` | string[] | No | Max 3, must exist & approved | Category UUIDs |
| `userKeywords` | string[] | No | - | Manual keywords (optional) |
| `parentStatementId` | string | No | Must exist & approved | Parent statement for threading |
| `initialComment` | string | **YES** | 1-280 chars | First discussion comment |

### Validation Rules

- ✅ `statement`: Cannot be empty, max 280 characters
- ✅ `categoryIds`: Maximum 3, all must exist with `inclusionNetVotes > 0`
- ✅ `parentStatementId`: Must exist and have `inclusionNetVotes > 0`
- ✅ `initialComment`: **REQUIRED**, cannot be empty, max 280 characters
- ✅ `publicCredit`: Must be boolean if provided

### Voting Pattern
- **Inclusion Voting:** ✅ Yes
- **Content Voting:** ✅ Yes (after inclusion passes)

### Special Features
- **Network Relationships:** Can link to parent statements (RELATED_TO)
- **Discovery:** Creates SHARED_TAG and SHARED_CATEGORY relationships

### Example Request

```bash
curl -X POST http://localhost:3000/api/nodes/statement \
  -H "Content-Type: application/json" \
  -H "Cookie: jwt=YOUR_JWT_TOKEN" \
  -d '{
    "statement": "Artificial intelligence is transforming healthcare through improved diagnostic accuracy and workflow efficiency.",
    "publicCredit": true,
    "categoryIds": ["cat-tech-uuid", "cat-health-uuid"],
    "userKeywords": ["artificial intelligence", "healthcare", "diagnostics"],
    "initialComment": "Opening discussion on AI in healthcare. What are the key ethical considerations?"
  }'
```

### Example Response

```json
{
  "id": "stmt-abc123-uuid",
  "statement": "Artificial intelligence is transforming healthcare...",
  "createdBy": "google-oauth2|113247584252508452361",
  "publicCredit": true,
  "discussionId": "discussion-stmt-abc123-uuid",
  "createdAt": {
    "year": {"low": 2025, "high": 0},
    "month": {"low": 10, "high": 0},
    "day": {"low": 13, "high": 0},
    "hour": {"low": 14, "high": 0},
    "minute": {"low": 30, "high": 0},
    "second": {"low": 15, "high": 0},
    "nanosecond": {"low": 123000000, "high": 0},
    "timeZoneOffsetSeconds": {"low": 0, "high": 0}
  },
  "updatedAt": { /* same structure */ },
  "inclusionPositiveVotes": 0,
  "inclusionNegativeVotes": 0,
  "inclusionNetVotes": 0,
  "contentPositiveVotes": 0,
  "contentNegativeVotes": 0,
  "contentNetVotes": 0
}
```

**Note:** Keywords and categories returned via GET endpoint, not POST.

### Common Errors

| Status | Error Message | Cause | Solution |
|--------|---------------|-------|----------|
| 400 | "Statement text is required" | Empty statement | Provide statement text |
| 400 | "Statement text cannot exceed 280 characters" | Too long | Reduce to 280 chars |
| 400 | "Maximum 3 categories allowed" | >3 categories | Limit to 3 categories |
| 400 | "Category X does not exist" | Invalid category ID | Use valid category UUID |
| 400 | "Category X must have passed inclusion threshold" | Unapproved category | Use approved category |
| 400 | "Initial comment is required" | Missing comment | Provide initial comment |
| 400 | "User ID is required" | Invalid JWT | Check authentication |
| 401 | "Unauthorized" | Missing/expired JWT | Re-authenticate |

---

## 2. OpenQuestion Node

### Endpoint
```
POST /api/nodes/openquestion
```

### Request Body Structure

```typescript
{
  questionText: string;           // REQUIRED, 1-280 chars
  publicCredit?: boolean;         // Optional, default: true
  categoryIds?: string[];         // Optional, max 3
  userKeywords?: string[];        // Optional, else AI extracts
  initialComment: string;         // REQUIRED, 1-280 chars
}
```

### Field Details

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `questionText` | string | **YES** | 1-280 chars | Question text (auto-adds "?" if missing) |
| `publicCredit` | boolean | No | true/false | Show author name publicly |
| `categoryIds` | string[] | No | Max 3, must exist & approved | Category UUIDs |
| `userKeywords` | string[] | No | - | Manual keywords (optional) |
| `initialComment` | string | **YES** | 1-280 chars | First discussion comment |

### Validation Rules

- ✅ `questionText`: Cannot be empty, max 280 characters
- ✅ Question mark: Automatically added if not present
- ✅ `categoryIds`: Maximum 3, all must exist with `inclusionNetVotes > 0`
- ✅ `initialComment`: **REQUIRED**, cannot be empty, max 280 characters
- ✅ `publicCredit`: Must be boolean if provided

### Voting Pattern
- **Inclusion Voting:** ✅ Yes (determines if question is valid)
- **Content Voting:** ❌ No (uses inclusion votes only)

### Special Features
- **Auto-formatting:** Adds "?" if not present
- **Parent to Answers:** Answers can only be submitted after inclusion passes
- **Discovery:** Creates SHARED_TAG and SHARED_CATEGORY relationships

### Example Request

```bash
curl -X POST http://localhost:3000/api/nodes/openquestion \
  -H "Content-Type: application/json" \
  -H "Cookie: jwt=YOUR_JWT_TOKEN" \
  -d '{
    "questionText": "How will AI impact employment in the next decade",
    "publicCredit": true,
    "categoryIds": ["cat-econ-uuid", "cat-tech-uuid"],
    "initialComment": "Curious to hear different perspectives on AI and job markets."
  }'
```

**Note:** Question mark will be added automatically: "How will AI impact employment in the next decade?"

### Example Response

```json
{
  "id": "oq-def456-uuid",
  "questionText": "How will AI impact employment in the next decade?",
  "createdBy": "google-oauth2|113247584252508452361",
  "publicCredit": true,
  "discussionId": "discussion-oq-def456-uuid",
  "createdAt": { /* Neo4j DateTime */ },
  "updatedAt": { /* Neo4j DateTime */ },
  "inclusionPositiveVotes": 0,
  "inclusionNegativeVotes": 0,
  "inclusionNetVotes": 0,
  "contentPositiveVotes": 0,
  "contentNegativeVotes": 0,
  "contentNetVotes": 0
}
```

**Note:** `contentNetVotes` falls back to `inclusionNetVotes` for OpenQuestion nodes (no separate content voting).

### Common Errors

| Status | Error Message | Cause | Solution |
|--------|---------------|-------|----------|
| 400 | "Question text is required" | Empty question | Provide question text |
| 400 | "Question text cannot exceed 280 characters" | Too long | Reduce to 280 chars |
| 400 | "Maximum 3 categories allowed" | >3 categories | Limit to 3 categories |
| 400 | "Initial comment is required" | Missing comment | Provide initial comment |
| 400 | "User ID is required" | Invalid JWT | Check authentication |
| 401 | "Unauthorized" | Missing/expired JWT | Re-authenticate |

---

## 3. Answer Node

### Endpoint
```
POST /api/nodes/answer
```

### Request Body Structure

```typescript
{
  answerText: string;             // REQUIRED, 1-280 chars
  parentQuestionId: string;       // REQUIRED, UUID
  publicCredit?: boolean;         // Optional, default: true
  categoryIds?: string[];         // Optional, max 3
  userKeywords?: string[];        // Optional, else AI extracts
  initialComment?: string;        // Optional, 1-280 chars
}
```

### Field Details

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `answerText` | string | **YES** | 1-280 chars | Answer text |
| `parentQuestionId` | string | **YES** | Valid UUID, must exist & approved | Parent OpenQuestion UUID |
| `publicCredit` | boolean | No | true/false | Show author name publicly |
| `categoryIds` | string[] | No | Max 3, must exist & approved | Category UUIDs |
| `userKeywords` | string[] | No | - | Manual keywords (optional) |
| `initialComment` | string | No | 1-280 chars | First discussion comment (optional) |

### Validation Rules

- ✅ `answerText`: Cannot be empty, max 280 characters
- ✅ `parentQuestionId`: **REQUIRED**, must exist and have `inclusionNetVotes > 0`
- ✅ `categoryIds`: Maximum 3, all must exist with `inclusionNetVotes > 0`
- ✅ `initialComment`: Optional, max 280 characters if provided
- ✅ `publicCredit`: Must be boolean if provided

### Voting Pattern
- **Inclusion Voting:** ✅ Yes
- **Content Voting:** ✅ Yes (after inclusion passes)

### Special Features
- **Parent Validation:** Parent question must have passed inclusion threshold
- **Parent Info:** GET endpoint returns parent question details
- **Sorting:** Sorted by content votes (quality), then inclusion votes
- **Discovery:** Creates SHARED_TAG and SHARED_CATEGORY relationships

### Example Request

```bash
curl -X POST http://localhost:3000/api/nodes/answer \
  -H "Content-Type: application/json" \
  -H "Cookie: jwt=YOUR_JWT_TOKEN" \
  -d '{
    "answerText": "AI will likely automate routine tasks while creating new roles in AI oversight, maintenance, and ethics.",
    "parentQuestionId": "oq-def456-uuid",
    "publicCredit": true,
    "categoryIds": ["cat-econ-uuid", "cat-tech-uuid"],
    "userKeywords": ["automation", "ai ethics", "job creation"]
  }'
```

### Example Response

```json
{
  "id": "ans-ghi789-uuid",
  "answerText": "AI will likely automate routine tasks while creating new roles...",
  "parentQuestionId": "oq-def456-uuid",
  "createdBy": "google-oauth2|113247584252508452361",
  "publicCredit": true,
  "discussionId": null,
  "createdAt": { /* Neo4j DateTime */ },
  "updatedAt": { /* Neo4j DateTime */ },
  "inclusionPositiveVotes": 0,
  "inclusionNegativeVotes": 0,
  "inclusionNetVotes": 0,
  "contentPositiveVotes": 0,
  "contentNegativeVotes": 0,
  "contentNetVotes": 0
}
```

**Note:** GET endpoint includes `parentQuestion` object with full question details.

### Common Errors

| Status | Error Message | Cause | Solution |
|--------|---------------|-------|----------|
| 400 | "Answer text is required" | Empty answer | Provide answer text |
| 400 | "Answer text cannot exceed 280 characters" | Too long | Reduce to 280 chars |
| 400 | "Parent question ID is required" | Missing parent | Provide parent question UUID |
| 400 | "Parent question not found" | Invalid UUID | Use valid question UUID |
| 400 | "Parent question must pass inclusion threshold" | Unapproved question | Wait for question approval |
| 400 | "Maximum 3 categories allowed" | >3 categories | Limit to 3 categories |
| 400 | "User ID is required" | Invalid JWT | Check authentication |
| 401 | "Unauthorized" | Missing/expired JWT | Re-authenticate |

---

## 4. Quantity Node

### Endpoint
```
POST /api/nodes/quantity
```

### Request Body Structure

```typescript
{
  question: string;               // REQUIRED, 1-280 chars
  unitCategoryId: string;         // REQUIRED (see dropdown options)
  defaultUnitId: string;          // REQUIRED (must belong to category)
  publicCredit?: boolean;         // Optional, default: true
  categoryIds?: string[];         // Optional, max 3
  userKeywords?: string[];        // Optional, else AI extracts
  initialComment?: string;        // Optional, 1-280 chars
}
```

### Field Details

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `question` | string | **YES** | 1-280 chars | Measurement question |
| `unitCategoryId` | string | **YES** | Valid unit category | Unit category (length, mass, etc.) |
| `defaultUnitId` | string | **YES** | Valid unit in category | Default unit for responses |
| `publicCredit` | boolean | No | true/false | Show author name publicly |
| `categoryIds` | string[] | No | Max 3, must exist & approved | Category UUIDs |
| `userKeywords` | string[] | No | - | Manual keywords (optional) |
| `initialComment` | string | No | 1-280 chars | First discussion comment (optional) |

### Validation Rules

- ✅ `question`: Cannot be empty, max 280 characters
- ✅ `unitCategoryId`: **REQUIRED**, must be valid unit category (see dropdown options)
- ✅ `defaultUnitId`: **REQUIRED**, must belong to specified unit category
- ✅ Unit validation: Backend validates unit belongs to category
- ✅ `categoryIds`: Maximum 3, all must exist with `inclusionNetVotes > 0`
- ✅ `initialComment`: Optional, max 280 characters if provided
- ✅ `publicCredit`: Must be boolean if provided

### Voting Pattern
- **Inclusion Voting:** ✅ Yes (determines if responses allowed)
- **Content Voting:** ❌ No (uses numeric responses instead)

### Special Features
- **Numeric Responses:** Users submit value + unit after inclusion passes
- **Unit Validation:** All responses validated against unit category
- **Value Normalization:** All values converted to base unit for comparison
- **Statistical Aggregation:** Min, max, mean, median, std dev, percentiles
- **Response Requirement:** Must pass inclusion threshold before responses allowed
- **Discovery:** Creates SHARED_TAG and SHARED_CATEGORY relationships

### Example Request

```bash
curl -X POST http://localhost:3000/api/nodes/quantity \
  -H "Content-Type: application/json" \
  -H "Cookie: jwt=YOUR_JWT_TOKEN" \
  -d '{
    "question": "What is your height in meters?",
    "unitCategoryId": "length",
    "defaultUnitId": "meter",
    "publicCredit": true,
    "categoryIds": [],
    "initialComment": "Testing quantity node creation with height measurement"
  }'
```

### Example Response

```json
{
  "id": "qty-jkl012-uuid",
  "question": "What is your height in meters?",
  "unitCategoryId": "length",
  "defaultUnitId": "meter",
  "responseCount": 0,
  "createdBy": "google-oauth2|113247584252508452361",
  "publicCredit": true,
  "discussionId": "discussion-qty-jkl012-uuid",
  "createdAt": { /* Neo4j DateTime */ },
  "updatedAt": { /* Neo4j DateTime */ },
  "inclusionPositiveVotes": 0,
  "inclusionNegativeVotes": 0,
  "inclusionNetVotes": 0,
  "contentPositiveVotes": 0,
  "contentNegativeVotes": 0,
  "contentNetVotes": 0
}
```

**Note:** `contentNetVotes` falls back to `inclusionNetVotes` for Quantity nodes.

### Submitting Numeric Responses

**Endpoint:** `POST /api/nodes/quantity/:id/response`

**Only allowed after inclusion passes** (`inclusionNetVotes > 0`)

```bash
curl -X POST http://localhost:3000/api/nodes/quantity/qty-jkl012-uuid/response \
  -H "Content-Type: application/json" \
  -H "Cookie: jwt=YOUR_JWT_TOKEN" \
  -d '{
    "value": 1.75,
    "unitId": "meter"
  }'
```

**Response:**
```json
{
  "id": "response-uuid",
  "userId": "google-oauth2|113247584252508452361",
  "quantityNodeId": "qty-jkl012-uuid",
  "categoryId": "length",
  "value": 1.75,
  "unitId": "meter",
  "normalizedValue": 1.75,
  "createdAt": "2025-10-13T14:38:48.583Z",
  "updatedAt": "2025-10-13T14:38:48.583Z"
}
```

### Getting Statistics

**Endpoint:** `GET /api/nodes/quantity/:id/statistics`

```json
{
  "responseCount": 1,
  "min": 1.75,
  "max": 1.75,
  "mean": 1.75,
  "median": 1.75,
  "standardDeviation": 0,
  "percentiles": {
    "10": 1.75,
    "25": 1.75,
    "50": 1.75,
    "75": 1.75,
    "90": 1.75,
    "95": 1.75,
    "99": 1.75
  },
  "distributionCurve": [[1.75, 1]],
  "responses": [ /* all responses */ ]
}
```

### Common Errors

| Status | Error Message | Cause | Solution |
|--------|---------------|-------|----------|
| 400 | "Question text is required" | Empty question | Provide question text |
| 400 | "Question text cannot exceed 280 characters" | Too long | Reduce to 280 chars |
| 400 | "Unit category ID is required" | Missing unit category | Provide unit category |
| 400 | "Default unit ID is required" | Missing default unit | Provide default unit |
| 400 | "Unit X is not valid for category Y" | Wrong unit for category | Check unit belongs to category |
| 400 | "Maximum 3 categories allowed" | >3 categories | Limit to 3 categories |
| 400 | "Quantity node must pass inclusion threshold" | Response before approval | Wait for inclusion approval |
| 400 | "Valid numeric value is required" | Invalid response value | Provide valid number |
| 401 | "Unauthorized" | Missing/expired JWT | Re-authenticate |

---

## 5. Evidence Node

### Endpoint
```
POST /api/nodes/evidence
```

### Request Body Structure

```typescript
{
  title: string;                  // REQUIRED, 1-280 chars
  url: string;                    // REQUIRED, valid URL
  evidenceType: string;           // REQUIRED (see dropdown options)
  parentNodeId: string;           // REQUIRED, UUID
  parentNodeType: string;         // REQUIRED (StatementNode/AnswerNode/QuantityNode)
  description?: string;           // Optional, 1-280 chars
  authors?: string[];             // Optional, array of author names
  publicationDate?: string;       // Optional, ISO date string
  publicCredit?: boolean;         // Optional, default: true
  categoryIds?: string[];         // Optional, max 3
  userKeywords?: string[];        // Optional, else AI extracts
  initialComment?: string;        // Optional, 1-280 chars
}
```

### Field Details

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `title` | string | **YES** | 1-280 chars | Evidence title |
| `url` | string | **YES** | Valid URL format | Source URL |
| `evidenceType` | string | **YES** | Valid type (see options) | Type of evidence |
| `parentNodeId` | string | **YES** | Valid UUID, must exist & approved | Parent node UUID |
| `parentNodeType` | string | **YES** | StatementNode/AnswerNode/QuantityNode | Parent node type |
| `description` | string | No | 1-280 chars | Evidence description |
| `authors` | string[] | No | - | Author names |
| `publicationDate` | string | No | ISO 8601 date | Publication date |
| `publicCredit` | boolean | No | true/false | Show author name publicly |
| `categoryIds` | string[] | No | Max 3, must exist & approved | Category UUIDs |
| `userKeywords` | string[] | No | - | Manual keywords (optional) |
| `initialComment` | string | No | 1-280 chars | First discussion comment (optional) |

### Validation Rules

- ✅ `title`: Cannot be empty, max 280 characters
- ✅ `url`: **REQUIRED**, must be valid URL format
- ✅ `evidenceType`: **REQUIRED**, must be valid type (see dropdown options)
- ✅ `parentNodeId`: **REQUIRED**, must exist and have `inclusionNetVotes > 0`
- ✅ `parentNodeType`: **REQUIRED**, must be "StatementNode", "AnswerNode", or "QuantityNode"
- ✅ `description`: Optional, max 280 characters if provided
- ✅ `publicationDate`: Optional, must be valid ISO 8601 date if provided
- ✅ `categoryIds`: Maximum 3, all must exist with `inclusionNetVotes > 0`
- ✅ `initialComment`: Optional, max 280 characters if provided
- ✅ `publicCredit`: Must be boolean if provided

### Voting Pattern
- **Inclusion Voting:** ✅ Yes (determines if evidence valid)
- **Content Voting:** ❌ No (uses 3D peer review instead)

### Special Features
- **3D Peer Review:** Quality (1-5), Independence (1-5), Relevance (1-5)
- **Multiple Parent Types:** Can link to Statement, Answer, or Quantity nodes
- **Parent Validation:** Parent must have passed inclusion threshold
- **Parent Info:** GET endpoint returns parent node details
- **URL Validation:** Backend validates URL format
- **Peer Review Requirement:** Must pass inclusion threshold before reviews allowed
- **Discovery:** Creates SHARED_TAG and SHARED_CATEGORY relationships

### Example Request

```bash
curl -X POST http://localhost:3000/api/nodes/evidence \
  -H "Content-Type: application/json" \
  -H "Cookie: jwt=YOUR_JWT_TOKEN" \
  -d '{
    "title": "Stanford Study on AI and Healthcare Efficiency",
    "url": "https://med.stanford.edu/news/ai-healthcare-study-2024.html",
    "evidenceType": "academic_paper",
    "parentNodeId": "ans-ghi789-uuid",
    "parentNodeType": "AnswerNode",
    "description": "Peer-reviewed study demonstrating AI improvements in diagnostic accuracy and workflow efficiency in healthcare settings",
    "authors": ["Dr. Jane Smith", "Dr. Robert Chen"],
    "publicationDate": "2024-09-15",
    "publicCredit": true,
    "categoryIds": []
  }'
```

### Example Response

```json
{
  "id": "evid-mno345-uuid",
  "title": "Stanford Study on AI and Healthcare Efficiency",
  "url": "https://med.stanford.edu/news/ai-healthcare-study-2024.html",
  "evidenceType": "academic_paper",
  "parentNodeId": "ans-ghi789-uuid",
  "parentNodeType": "AnswerNode",
  "description": "Peer-reviewed study demonstrating AI improvements...",
  "authors": ["Dr. Jane Smith", "Dr. Robert Chen"],
  "publicationDate": "2024-09-15T00:00:00.000Z",
  "createdBy": "google-oauth2|113247584252508452361",
  "publicCredit": true,
  "discussionId": "discussion-evid-mno345-uuid",
  "createdAt": { /* Neo4j DateTime */ },
  "updatedAt": { /* Neo4j DateTime */ },
  "inclusionPositiveVotes": 0,
  "inclusionNegativeVotes": 0,
  "inclusionNetVotes": 0,
  "contentPositiveVotes": 0,
  "contentNegativeVotes": 0,
  "contentNetVotes": 0,
  "avgQualityScore": 0,
  "avgIndependenceScore": 0,
  "avgRelevanceScore": 0,
  "overallScore": 0,
  "reviewCount": 0
}
```

**Note:** GET endpoint includes `parentInfo` object with parent node details.

### Submitting Peer Reviews

**Endpoint:** `POST /api/nodes/evidence/:id/reviews`

**Only allowed after inclusion passes** (`inclusionNetVotes > 0`)

**One review per user per evidence**

```bash
curl -X POST http://localhost:3000/api/nodes/evidence/evid-mno345-uuid/reviews \
  -H "Content-Type: application/json" \
  -H "Cookie: jwt=YOUR_JWT_TOKEN" \
  -d '{
    "qualityScore": 5,
    "independenceScore": 4,
    "relevanceScore": 5,
    "comments": "Excellent peer-reviewed study from Stanford. High methodological rigor."
  }'
```

**Response:**
```json
{
  "id": "review-uuid",
  "evidenceId": "evid-mno345-uuid",
  "userId": "google-oauth2|113247584252508452361",
  "qualityScore": 5,
  "independenceScore": 4,
  "relevanceScore": 5,
  "comments": "Excellent peer-reviewed study from Stanford...",
  "createdAt": "2025-10-13T15:01:34.996Z"
}
```

### Peer Review Scores

- **Quality Score (1-5):** Methodological rigor, research quality
- **Independence Score (1-5):** Source independence, potential bias
- **Relevance Score (1-5):** Relevance to the parent claim
- **Overall Score:** Average of all three dimensions

**GET endpoint shows aggregate scores:**
```json
{
  "avgQualityScore": 5.0,
  "avgIndependenceScore": 4.0,
  "avgRelevanceScore": 5.0,
  "overallScore": 4.67,
  "reviewCount": 1
}
```

### Common Errors

| Status | Error Message | Cause | Solution |
|--------|---------------|-------|----------|
| 400 | "Title is required" | Empty title | Provide title |
| 400 | "Title cannot exceed 280 characters" | Too long | Reduce to 280 chars |
| 400 | "URL is required" | Missing URL | Provide URL |
| 400 | "Invalid URL format" | Malformed URL | Use valid URL format |
| 400 | "Evidence type is required" | Missing type | Provide evidence type |
| 400 | "Invalid evidence type" | Wrong type | Use valid type from dropdown |
| 400 | "Parent node ID is required" | Missing parent | Provide parent node UUID |
| 400 | "Parent node type is required" | Missing type | Provide parent node type |
| 400 | "Invalid parent node type" | Wrong type | Use StatementNode/AnswerNode/QuantityNode |
| 400 | "Parent node not found" | Invalid UUID | Use valid parent node UUID |
| 400 | "Parent node must pass inclusion threshold" | Unapproved parent |

<artifact identifier="api-node-creation-reference" type="application/vnd.ant.code" language="markdown" title="API Node Creation Reference for Frontend (Part 2)">
| 400 | "Parent node must pass inclusion threshold" | Unapproved parent | Wait for parent approval |
| 400 | "Maximum 3 categories allowed" | >3 categories | Limit to 3 categories |
| 400 | "Evidence must pass inclusion threshold" | Review before approval | Wait for inclusion approval |
| 400 | "Quality score must be between 1 and 5" | Invalid score | Use 1-5 range |
| 400 | "User has already reviewed this evidence" | Duplicate review | Each user can review once |
| 401 | "Unauthorized" | Missing/expired JWT | Re-authenticate |

---

## Dropdown Options Reference

### Unit Categories (for Quantity Nodes)

**Use for `unitCategoryId` field in Quantity creation**

| Category ID | Category Name | Description | Base Unit |
|-------------|---------------|-------------|-----------|
| `currency` | Currency | Monetary values | USD |
| `length` | Length | Distance or length measurements | meter |
| `mass` | Mass | Weight or mass measurements | kilogram |
| `temperature` | Temperature | Temperature measurements | kelvin |
| `time` | Time | Time duration measurements | second |
| `volume` | Volume | Volume measurements | liter |
| `area` | Area | Area measurements | square_meter |
| `percentage` | Percentage | Percentage values | percent |
| `count` | Count | Discrete counting | count |

### Units by Category

**Use for `defaultUnitId` field in Quantity creation**

#### Currency Units
- `usd` - US Dollar ($)
- `eur` - Euro (€)
- `gbp` - British Pound (£)
- `jpy` - Japanese Yen (¥)

#### Length Units
- `meter` - Meter (m) *[base unit]*
- `kilometer` - Kilometer (km)
- `centimeter` - Centimeter (cm)
- `millimeter` - Millimeter (mm)
- `inch` - Inch (in)
- `foot` - Foot (ft)
- `yard` - Yard (yd)
- `mile` - Mile (mi)

#### Mass Units
- `kilogram` - Kilogram (kg) *[base unit]*
- `gram` - Gram (g)
- `milligram` - Milligram (mg)
- `pound` - Pound (lb)
- `ounce` - Ounce (oz)
- `ton` - Metric Ton (t)

#### Temperature Units
- `kelvin` - Kelvin (K) *[base unit]*
- `celsius` - Celsius (°C)
- `fahrenheit` - Fahrenheit (°F)

#### Time Units
- `second` - Second (s) *[base unit]*
- `minute` - Minute (min)
- `hour` - Hour (h)
- `day` - Day (d)
- `week` - Week (wk)
- `month` - Month (mo)
- `year` - Year (yr)

#### Volume Units
- `liter` - Liter (L) *[base unit]*
- `milliliter` - Milliliter (mL)
- `cubic_meter` - Cubic Meter (m³)
- `gallon_us` - US Gallon (gal)
- `quart_us` - US Quart (qt)
- `pint_us` - US Pint (pt)
- `cup_us` - US Cup (cup)
- `fluid_ounce_us` - US Fluid Ounce (fl oz)

#### Area Units
- `square_meter` - Square Meter (m²) *[base unit]*
- `square_kilometer` - Square Kilometer (km²)
- `square_centimeter` - Square Centimeter (cm²)
- `square_millimeter` - Square Millimeter (mm²)
- `square_foot` - Square Foot (ft²)
- `square_inch` - Square Inch (in²)
- `acre` - Acre (ac)
- `hectare` - Hectare (ha)

#### Percentage Units
- `percent` - Percent (%) *[base unit]*

#### Count Units
- `count` - Count *[base unit]*

---

### Evidence Types (for Evidence Nodes)

**Use for `evidenceType` field in Evidence creation**

| Type ID | Display Name | Description |
|---------|--------------|-------------|
| `academic_paper` | Academic Paper | Peer-reviewed research papers |
| `news_article` | News Article | Journalistic news articles |
| `government_report` | Government Report | Official government publications |
| `dataset` | Dataset | Statistical datasets and databases |
| `book` | Book | Published books |
| `website` | Website | General web content |
| `legal_document` | Legal Document | Court documents, legislation |
| `expert_testimony` | Expert Testimony | Expert witness statements |
| `survey_study` | Survey Study | Survey-based research |
| `meta_analysis` | Meta Analysis | Analysis of multiple studies |
| `other` | Other | Other evidence types |

---

### Parent Node Types (for Evidence Nodes)

**Use for `parentNodeType` field in Evidence creation**

| Type | Description | When to Use |
|------|-------------|-------------|
| `StatementNode` | Link to Statement | Evidence supports a statement |
| `AnswerNode` | Link to Answer | Evidence supports an answer |
| `QuantityNode` | Link to Quantity | Evidence supports quantity data |

**Important:** Use exact capitalization (e.g., "AnswerNode" not "answer")

---

## Error Handling

### Standard Error Response Format

All API errors follow this structure:

```json
{
  "statusCode": 400,
  "message": "Error message here",
  "error": "Bad Request"
}
```

Or with multiple messages:

```json
{
  "statusCode": 400,
  "message": [
    "Field is required",
    "Another validation error"
  ],
  "error": "Bad Request"
}
```

### HTTP Status Codes

| Code | Status | Description |
|------|--------|-------------|
| 200 | OK | Successful GET, PUT |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Validation error, invalid input |
| 401 | Unauthorized | Missing or invalid JWT token |
| 403 | Forbidden | User lacks permission |
| 404 | Not Found | Resource doesn't exist |
| 500 | Internal Server Error | Server error |

### Common Error Scenarios

#### Authentication Errors

**Missing JWT Token:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Solution:** Include JWT token in cookie header

**Expired JWT Token:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Solution:** Re-authenticate to get new token

---

#### Validation Errors

**Empty Required Field:**
```json
{
  "statusCode": 400,
  "message": "Statement text is required"
}
```

**Solution:** Provide required field

**Text Too Long:**
```json
{
  "statusCode": 400,
  "message": "Statement text cannot exceed 280 characters (current: 350)"
}
```

**Solution:** Reduce text length to 280 characters

**Too Many Categories:**
```json
{
  "statusCode": 400,
  "message": "Maximum 3 categories allowed"
}
```

**Solution:** Limit to 3 categories maximum

**Invalid Boolean:**
```json
{
  "statusCode": 400,
  "message": "publicCredit must be a boolean value"
}
```

**Solution:** Use `true` or `false` (not strings)

---

#### Parent Validation Errors

**Parent Not Found:**
```json
{
  "statusCode": 400,
  "message": "Parent question not found"
}
```

**Solution:** Use valid parent node UUID

**Parent Not Approved:**
```json
{
  "statusCode": 400,
  "message": "Parent question must pass inclusion threshold before answers can be added"
}
```

**Solution:** Wait for parent node to be approved (inclusionNetVotes > 0)

---

#### Category Validation Errors

**Category Not Found:**
```json
{
  "statusCode": 400,
  "message": "Category abc-123 does not exist"
}
```

**Solution:** Use valid category UUID

**Category Not Approved:**
```json
{
  "statusCode": 400,
  "message": "Category abc-123 must have passed inclusion threshold"
}
```

**Solution:** Use approved category (inclusionNetVotes > 0)

---

#### Unit Validation Errors (Quantity)

**Invalid Unit for Category:**
```json
{
  "statusCode": 400,
  "message": "Unit foot is not valid for category mass"
}
```

**Solution:** Ensure unit belongs to the specified category

**Missing Unit Fields:**
```json
{
  "statusCode": 400,
  "message": "Unit category ID is required"
}
```

**Solution:** Provide both `unitCategoryId` and `defaultUnitId`

---

#### Evidence-Specific Errors

**Invalid URL:**
```json
{
  "statusCode": 400,
  "message": "Invalid URL format"
}
```

**Solution:** Use valid URL format (https://example.com)

**Invalid Evidence Type:**
```json
{
  "statusCode": 400,
  "message": "Invalid evidence type"
}
```

**Solution:** Use valid evidence type from dropdown options

**Invalid Parent Node Type:**
```json
{
  "statusCode": 400,
  "message": "Invalid parent node type"
}
```

**Solution:** Use "StatementNode", "AnswerNode", or "QuantityNode" (exact capitalization)

---

## Frontend Integration Guidelines

### Form Field Recommendations

#### Statement Form
```typescript
{
  statement: <textarea maxLength={280} required />,
  publicCredit: <checkbox defaultChecked />,
  categoryIds: <multi-select max={3} />,
  userKeywords: <tag-input optional />,
  parentStatementId: <autocomplete optional />,
  initialComment: <textarea maxLength={280} required />
}
```

#### OpenQuestion Form
```typescript
{
  questionText: <textarea maxLength={280} required />,
  publicCredit: <checkbox defaultChecked />,
  categoryIds: <multi-select max={3} />,
  userKeywords: <tag-input optional />,
  initialComment: <textarea maxLength={280} required />
}
```

#### Answer Form
```typescript
{
  answerText: <textarea maxLength={280} required />,
  parentQuestionId: <hidden value={questionId} required />,
  publicCredit: <checkbox defaultChecked />,
  categoryIds: <multi-select max={3} />,
  userKeywords: <tag-input optional />,
  initialComment: <textarea maxLength={280} optional />
}
```

#### Quantity Form
```typescript
{
  question: <textarea maxLength={280} required />,
  unitCategoryId: <select options={unitCategories} required />,
  defaultUnitId: <select options={unitsForCategory} required />,
  publicCredit: <checkbox defaultChecked />,
  categoryIds: <multi-select max={3} />,
  userKeywords: <tag-input optional />,
  initialComment: <textarea maxLength={280} optional />
}
```

#### Evidence Form
```typescript
{
  title: <input maxLength={280} required />,
  url: <input type="url" required />,
  evidenceType: <select options={evidenceTypes} required />,
  parentNodeId: <hidden value={parentId} required />,
  parentNodeType: <hidden value={parentType} required />,
  description: <textarea maxLength={280} optional />,
  authors: <tag-input optional />,
  publicationDate: <date-picker optional />,
  publicCredit: <checkbox defaultChecked />,
  categoryIds: <multi-select max={3} />,
  userKeywords: <tag-input optional />,
  initialComment: <textarea maxLength={280} optional />
}
```

---

### Character Counter Implementation

All text fields with 280 character limit should include live character counter:

```typescript
const [text, setText] = useState('');
const remaining = 280 - text.length;

<div>
  <textarea 
    value={text}
    onChange={(e) => setText(e.target.value)}
    maxLength={280}
  />
  <span className={remaining < 20 ? 'text-red-500' : ''}>
    {remaining} characters remaining
  </span>
</div>
```

---

### Keyword Input Component

**Option 1: AI Extraction (Recommended)**
- Leave `userKeywords` empty
- Backend extracts automatically
- Show loading state during creation
- Display extracted keywords after creation

**Option 2: Manual Input**
- Provide tag input component
- Allow adding/removing keywords
- No length limit on keywords array
- Each keyword stored as separate string

```typescript
const [keywords, setKeywords] = useState<string[]>([]);

<TagInput
  value={keywords}
  onChange={setKeywords}
  placeholder="Add keywords (or leave empty for AI extraction)"
/>
```

---

### Category Selection Component

**Requirements:**
- Multi-select dropdown
- Maximum 3 selections
- Show only approved categories (`inclusionNetVotes > 0`)
- Display category name + description on hover
- Allow deselecting categories

```typescript
const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

<MultiSelect
  options={approvedCategories}
  value={selectedCategories}
  onChange={setSelectedCategories}
  max={3}
  placeholder="Select up to 3 categories (optional)"
/>
```

**Fetch approved categories:**
```typescript
GET /api/categories?minInclusionVotes=1
```

---

### Unit Category/Unit Selection (Quantity)

**Cascading Dropdowns:**

1. **Select Unit Category First:**
```typescript
const [unitCategory, setUnitCategory] = useState('');
const [availableUnits, setAvailableUnits] = useState([]);

useEffect(() => {
  if (unitCategory) {
    // Fetch units for selected category
    const units = getUnitsForCategory(unitCategory);
    setAvailableUnits(units);
  }
}, [unitCategory]);

<select value={unitCategory} onChange={(e) => setUnitCategory(e.target.value)}>
  <option value="">Select measurement type...</option>
  <option value="length">Length</option>
  <option value="mass">Mass</option>
  <option value="temperature">Temperature</option>
  {/* ... */}
</select>
```

2. **Then Select Default Unit:**
```typescript
<select disabled={!unitCategory}>
  <option value="">Select unit...</option>
  {availableUnits.map(unit => (
    <option key={unit.id} value={unit.id}>
      {unit.name} ({unit.symbol})
    </option>
  ))}
</select>
```

---

### Evidence Type Selection

**Dropdown with descriptions:**

```typescript
<select required>
  <option value="">Select evidence type...</option>
  <option value="academic_paper">Academic Paper - Peer-reviewed research</option>
  <option value="news_article">News Article - Journalistic reporting</option>
  <option value="government_report">Government Report - Official publications</option>
  <option value="dataset">Dataset - Statistical data</option>
  <option value="book">Book - Published books</option>
  <option value="website">Website - General web content</option>
  <option value="legal_document">Legal Document - Court/legislation</option>
  <option value="expert_testimony">Expert Testimony - Expert statements</option>
  <option value="survey_study">Survey Study - Survey research</option>
  <option value="meta_analysis">Meta Analysis - Study of studies</option>
  <option value="other">Other - Other sources</option>
</select>
```

---

### Date Input (Evidence Publication Date)

**ISO 8601 Format Required:**

```typescript
const [date, setDate] = useState('');

<input 
  type="date"
  value={date}
  onChange={(e) => setDate(e.target.value)}
/>

// When submitting:
publicationDate: date // Browser sends as "YYYY-MM-DD"
```

Backend accepts: `"2024-09-15"` or `"2024-09-15T00:00:00.000Z"`

---

### Author Input (Evidence)

**Tag input for multiple authors:**

```typescript
const [authors, setAuthors] = useState<string[]>([]);

<TagInput
  value={authors}
  onChange={setAuthors}
  placeholder="Add author names (optional)"
  addOnBlur
  addOnEnter
/>

// Submits as: ["Dr. Jane Smith", "Dr. Robert Chen"]
```

---

### Form Submission Example

```typescript
const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();
  
  setLoading(true);
  setError(null);
  
  try {
    const response = await fetch('/api/nodes/statement', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // JWT automatically included via cookie
      },
      credentials: 'include', // Important for cookies
      body: JSON.stringify({
        statement: statementText,
        publicCredit: showCredit,
        categoryIds: selectedCategories,
        userKeywords: keywords.length > 0 ? keywords : undefined,
        initialComment: commentText,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }
    
    const newNode = await response.json();
    
    // Success - redirect or update UI
    router.push(`/statement/${newNode.id}`);
    
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

---

## Neo4j DateTime Serialization

All timestamps returned in Neo4j DateTime format:

```json
{
  "year": {"low": 2025, "high": 0},
  "month": {"low": 10, "high": 0},
  "day": {"low": 13, "high": 0},
  "hour": {"low": 14, "high": 0},
  "minute": {"low": 30, "high": 0},
  "second": {"low": 15, "high": 0},
  "nanosecond": {"low": 123000000, "high": 0},
  "timeZoneOffsetSeconds": {"low": 0, "high": 0}
}
```

**Convert to JavaScript Date:**

```typescript
function neo4jDateToJS(neo4jDate: any): Date {
  return new Date(
    neo4jDate.year.low,
    neo4jDate.month.low - 1, // Months are 0-indexed in JS
    neo4jDate.day.low,
    neo4jDate.hour.low,
    neo4jDate.minute.low,
    neo4jDate.second.low,
    neo4jDate.nanosecond.low / 1000000 // Convert nanoseconds to milliseconds
  );
}

// Usage:
const createdAt = neo4jDateToJS(node.createdAt);
console.log(createdAt.toISOString()); // "2025-10-13T14:30:15.123Z"
```

---

## Testing Checklist for Frontend

### Before Development
- [ ] Review all 5 node type structures
- [ ] Understand required vs optional fields
- [ ] Note character limits (280 for all text fields)
- [ ] Review dropdown options (units, evidence types)
- [ ] Understand parent node requirements (Answer, Evidence)

### During Development
- [ ] Implement character counters for all text fields
- [ ] Validate required fields before submission
- [ ] Show loading states during API calls
- [ ] Handle all error scenarios gracefully
- [ ] Test with invalid data (too long, missing required, etc.)
- [ ] Test category selection (max 3 limit)
- [ ] Test unit cascading dropdowns (Quantity)
- [ ] Test parent node validation (Answer, Evidence)

### After Implementation
- [ ] Test each node type creation end-to-end
- [ ] Verify keywords extracted when not provided
- [ ] Verify discussion created when comment provided
- [ ] Test with JWT token expiration
- [ ] Test error message display
- [ ] Verify Neo4j DateTime conversion
- [ ] Test all dropdown selections work correctly

---

## Quick Reference

### Text Limits (All 280 Characters)
- Statement: 280
- Question: 280
- Answer: 280
- Quantity question: 280
- Evidence title: 280
- Evidence description: 280
- Comment: 280

### Required Fields by Node Type

| Node Type | Always Required | Conditionally Required |
|-----------|----------------|----------------------|
| Statement | `statement`, `initialComment` | - |
| OpenQuestion | `questionText`, `initialComment` | - |
| Answer | `answerText`, `parentQuestionId` | - |
| Quantity | `question`, `unitCategoryId`, `defaultUnitId` | - |
| Evidence | `title`, `url`, `evidenceType`, `parentNodeId`, `parentNodeType` | - |

### Maximum Limits
- Categories: 3 per node
- Keywords: No limit (but AI typically extracts 5-15)
- Authors (Evidence): No limit

---

**Document Version:** 1.0  
**Last Updated:** October 13, 2025  
**Status:** Production Ready ✅  
**Maintainer:** ProjectZer0 Team

**For questions or issues, refer to:**
- `docs/schema-layer.md` - Database architecture
- `docs/service-layer.md` - Business logic patterns
- `docs/controller-layer.md` - HTTP layer patterns
- `docs/universal-graph-backend.md` - Graph API reference

---

**End of API Node Creation Reference**
