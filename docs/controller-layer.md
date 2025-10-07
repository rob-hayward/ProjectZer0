# Controller Layer Architecture - Complete Reference

**ProjectZer0 Backend - HTTP & Request Handling Layer**  
**Version:** 1.0  
**Last Updated:** 07/10/2025  
**Status:** Production Ready

---

## Navigation Note

This documentation covers the HTTP layer (controllers) for all 8 content nodes plus Comment and Discussion controllers.

**Reading Recommendation:**
- **For quick reference:** Jump to Section 14 (Quick Reference)
- **For new team members:** Read sections 1-3, then review specific controllers in Section 4
- **For implementation:** Focus on Section 3 (Core Patterns) and Section 12 (Best Practices)
- **For AI context:** Provide sections 1-3 and the specific controller section (4.1-4.10) relevant to your task

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Philosophy](#2-architecture-philosophy)
3. [Core Patterns](#3-core-patterns)
4. [Controller Reference](#4-controller-reference)
   - 4.1 WordController
   - 4.2 DefinitionController
   - 4.3 CategoryController
   - 4.4 StatementController
   - 4.5 OpenQuestionController
   - 4.6 AnswerController
   - 4.7 QuantityController
   - 4.8 EvidenceController
   - 4.9 CommentController
   - 4.10 DiscussionController
5. [HTTP Status Codes](#5-http-status-codes)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [DTO Patterns](#7-dto-patterns)
8. [Validation Patterns](#8-validation-patterns)
9. [Request/Response Transformation](#9-requestresponse-transformation)
10. [Error Handling](#10-error-handling)
11. [Testing Patterns](#11-testing-patterns)
12. [Best Practices](#12-best-practices)
13. [Comparison Tables](#13-comparison-tables)
14. [Quick Reference](#14-quick-reference)
15. [Architectural Decisions](#15-architectural-decisions)
16. [Related Documentation](#16-related-documentation)

---

## 1. Overview

### 1.1 Purpose

The controller layer is the HTTP boundary of the application, handling all HTTP requests and responses. Controllers translate between HTTP and business logic, delegating all operations to the service layer.

### 1.2 Responsibilities

**Controllers ARE responsible for:**
- ✅ HTTP request/response handling
- ✅ Input validation at the boundary
- ✅ Authentication/authorization enforcement
- ✅ User context extraction (JWT)
- ✅ HTTP status code selection
- ✅ DTO validation
- ✅ Logging HTTP operations

**Controllers are NOT responsible for:**
- ❌ Business logic (that's services)
- ❌ Database operations (that's schemas)
- ❌ Complex validation (that's services)
- ❌ Data transformation (minimal only)

### 1.3 Controller Inventory

| Controller | Path | Endpoints | Voting Pattern | Special Features |
|-----------|------|-----------|----------------|------------------|
| **WordController** | `/words` | 9 | Inclusion-only | Word string as ID |
| **DefinitionController** | `/definitions` | 13 | Dual voting | Separate vote removal |
| **CategoryController** | `/categories` | 9+ | Inclusion-only | Hierarchy queries |
| **StatementController** | `/nodes/statement` | 11+ | Dual voting | Network endpoints |
| **OpenQuestionController** | `/nodes/openquestion` | 9 | Inclusion-only | Required comment |
| **AnswerController** | `/nodes/answer` | 11 | Dual voting | Parent question |
| **QuantityController** | `/nodes/quantity` | 13+ | Inclusion-only | Response submission |
| **EvidenceController** | `/nodes/evidence` | 15+ | Inclusion-only | Peer review endpoints |
| **CommentController** | `/comments` | 11+ | Content-only | Edit window, visibility |
| **DiscussionController** | `/discussions` | 6+ | None | Read-only (no POST) |

---

## 2. Architecture Philosophy

### 2.1 Layered Architecture

```
┌─────────────────────────────────────────────────┐
│              HTTP Client Layer                  │
│  (Browser, Mobile App, External Services)       │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│              Controller Layer                   │
│  • Route definitions (@Get, @Post, etc.)       │
│  • DTOs for validation                         │
│  • JWT guard application                       │
│  • User extraction from req.user.sub           │
│  • HTTP status codes                           │
│  • Minimal validation                          │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│              Service Layer                      │
│  (Business logic, orchestration)                │
└─────────────────────────────────────────────────┘
```

### 2.2 Design Principles

1. **Thin Controllers** - Minimal logic, delegate to services
2. **Validation First** - Check inputs before service calls
3. **Explicit Status Codes** - Use decorators for clarity
4. **JWT Everywhere** - All endpoints require authentication (JwtAuthGuard)
5. **Consistent DTOs** - Type-safe request/response contracts
6. **Clear Routes** - RESTful, predictable endpoint structure

---

## 3. Core Patterns

### 3.1 Controller Structure Pattern

**Standard Controller Class:**

```typescript
@Controller('path')
@UseGuards(JwtAuthGuard)  // ← Applied at class level
export class NodeController {
  private readonly logger = new Logger(NodeController.name);

  constructor(
    private readonly nodeService: NodeService,  // ← ONLY inject service
  ) {}

  // CRUD endpoints
  // Voting endpoints
  // Special endpoints (if applicable)
}
```

**Key Points:**
- ✅ **Single service injection** (controller → service only)
- ✅ **JwtAuthGuard at class level** (all endpoints authenticated)
- ✅ **Logger with controller name** for clear logging
- ✅ **Route prefix** via `@Controller()` decorator

---

### 3.2 JWT Authentication Pattern

**Universal Pattern (All Controllers):**

```typescript
@Controller('path')
@UseGuards(JwtAuthGuard)  // ← CRITICAL: All endpoints protected
export class NodeController {
  @Post()
  async createNode(@Body() createDto: CreateDto, @Request() req: any) {
    // User ID extracted from JWT token
    const userId = req.user.sub;  // ← Standard extraction point
    
    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }
    
    await this.nodeService.createNode({
      ...createDto,
      createdBy: userId,  // ← Pass to service
    });
  }
}
```

**JWT Payload Structure:**
```typescript
req.user = {
  sub: 'user-uuid',      // User ID (always use this)
  email: 'user@example.com',
  // ... other claims
}
```

**Key Points:**
- ✅ Guard applied at **class level** (not per-endpoint)
- ✅ User ID accessed via `req.user.sub`
- ✅ Always validate `req.user?.sub` exists
- ✅ Pass `createdBy: req.user.sub` to service methods

---

### 3.3 CRUD Endpoint Pattern

**Create (POST):**

```typescript
@Post()
@HttpCode(HttpStatus.CREATED)  // ← Explicit 201 status
async createNode(@Body() createDto: CreateDto, @Request() req: any) {
  // 1. Validate required fields
  if (!createDto.field || createDto.field.trim() === '') {
    throw new BadRequestException('Field is required');
  }
  
  // 2. Validate user context
  if (!req.user?.sub) {
    throw new BadRequestException('User ID is required');
  }
  
  // 3. Log operation
  this.logger.log(`Creating node from user ${req.user.sub}`);
  
  // 4. Call service
  const result = await this.nodeService.createNode({
    ...createDto,
    createdBy: req.user.sub,
  });
  
  // 5. Return result (no transformation)
  return result;
}
```

**Read (GET):**

```typescript
@Get(':id')
async getNode(@Param('id') id: string) {
  // 1. Validate parameter
  if (!id || id.trim() === '') {
    throw new BadRequestException('Node ID is required');
  }
  
  // 2. Log operation
  this.logger.debug(`Getting node: ${id}`);
  
  // 3. Call service
  const node = await this.nodeService.getNode(id);
  
  // 4. Handle not found
  if (!node) {
    throw new NotFoundException(`Node with ID ${id} not found`);
  }
  
  // 5. Return result
  return node;
}
```

**Update (PUT):**

```typescript
@Put(':id')
async updateNode(
  @Param('id') id: string,
  @Body() updateDto: UpdateDto,
  @Request() req: any,
) {
  // 1. Validate parameters
  if (!id || id.trim() === '') {
    throw new BadRequestException('Node ID is required');
  }
  
  if (!req.user?.sub) {
    throw new BadRequestException('User ID is required');
  }
  
  // 2. Log operation
  this.logger.log(`Updating node: ${id}`);
  
  // 3. Call service
  const result = await this.nodeService.updateNode(id, updateDto);
  
  // 4. Return result
  return result;
}
```

**Delete (DELETE):**

```typescript
@Delete(':id')
@HttpCode(HttpStatus.NO_CONTENT)  // ← Explicit 204 status
async deleteNode(@Param('id') id: string, @Request() req: any) {
  // 1. Validate parameters
  if (!id || id.trim() === '') {
    throw new BadRequestException('Node ID is required');
  }
  
  if (!req.user?.sub) {
    throw new BadRequestException('User ID is required');
  }
  
  // 2. Log operation
  this.logger.log(`Deleting node: ${id}`);
  
  // 3. Call service
  await this.nodeService.deleteNode(id);
  
  // 4. No return (204 No Content)
}
```

---

### 3.4 Voting Endpoint Patterns

**Inclusion-Only Pattern (Word, Category, OpenQuestion, Quantity, Evidence):**

```typescript
// Vote on inclusion
@Post(':id/vote-inclusion')
async voteInclusion(
  @Param('id') id: string,
  @Body() voteDto: VoteDto,
  @Request() req: any,
): Promise<VoteResult> {
  if (!id || id.trim() === '') {
    throw new BadRequestException('Node ID is required');
  }
  
  if (!req.user?.sub) {
    throw new BadRequestException('User ID is required');
  }
  
  if (typeof voteDto.isPositive !== 'boolean') {
    throw new BadRequestException('isPositive must be a boolean');
  }
  
  return await this.nodeService.voteInclusion(id, req.user.sub, voteDto.isPositive);
}

// Get vote status
@Get(':id/vote-status')
async getVoteStatus(@Param('id') id: string, @Request() req: any): Promise<VoteStatus | null> {
  if (!id || id.trim() === '') {
    throw new BadRequestException('Node ID is required');
  }
  
  if (!req.user?.sub) {
    throw new BadRequestException('User ID is required');
  }
  
  return await this.nodeService.getVoteStatus(id, req.user.sub);
}

// Remove vote
@Delete(':id/vote')
async removeVote(@Param('id') id: string, @Request() req: any): Promise<VoteResult> {
  if (!id || id.trim() === '') {
    throw new BadRequestException('Node ID is required');
  }
  
  if (!req.user?.sub) {
    throw new BadRequestException('User ID is required');
  }
  
  return await this.nodeService.removeVote(id, req.user.sub);
}

// Get vote totals
@Get(':id/votes')
async getVotes(@Param('id') id: string): Promise<VoteResult | null> {
  if (!id || id.trim() === '') {
    throw new BadRequestException('Node ID is required');
  }
  
  return await this.nodeService.getVotes(id);
}
```

**Dual Voting Pattern (Definition, Statement, Answer):**

```typescript
// Vote on inclusion
@Post(':id/vote-inclusion')
async voteInclusion(...): Promise<VoteResult> {
  // Same as above
}

// Vote on content
@Post(':id/vote-content')
async voteContent(
  @Param('id') id: string,
  @Body() voteDto: VoteDto,
  @Request() req: any,
): Promise<VoteResult> {
  if (!id || id.trim() === '') {
    throw new BadRequestException('Node ID is required');
  }
  
  if (!req.user?.sub) {
    throw new BadRequestException('User ID is required');
  }
  
  if (typeof voteDto.isPositive !== 'boolean') {
    throw new BadRequestException('isPositive must be a boolean');
  }
  
  return await this.nodeService.voteContent(id, req.user.sub, voteDto.isPositive);
}

// Remove vote (requires 'kind' parameter)
@Delete(':id/vote')
async removeVote(
  @Param('id') id: string,
  @Body() removeVoteDto: RemoveVoteDto,
  @Request() req: any,
): Promise<VoteResult> {
  if (!id || id.trim() === '') {
    throw new BadRequestException('Node ID is required');
  }
  
  if (!req.user?.sub) {
    throw new BadRequestException('User ID is required');
  }
  
  if (!removeVoteDto.kind || !['INCLUSION', 'CONTENT'].includes(removeVoteDto.kind)) {
    throw new BadRequestException('Vote kind must be INCLUSION or CONTENT');
  }
  
  return await this.nodeService.removeVote(id, req.user.sub, removeVoteDto.kind);
}
```

---

### 3.5 DTO Pattern

**Standard DTOs per Controller:**

```typescript
// Create DTO (required fields + optional fields)
interface CreateNodeDto {
  field: string;                // Required
  publicCredit?: boolean;       // Optional with default
  categoryIds?: string[];       // Optional array
  initialComment?: string;      // Optional
}

// Update DTO (all optional)
interface UpdateNodeDto {
  field?: string;
  publicCredit?: boolean;
}

// Vote DTO (universal)
interface VoteDto {
  isPositive: boolean;
}

// Remove Vote DTO (dual voting only)
interface RemoveVoteDto {
  kind: 'INCLUSION' | 'CONTENT';
}
```

**DTO Placement:**
- DTOs defined at **top of controller file**
- One DTO per operation type
- Interface (not class) for simplicity
- Type validation handled by guards + manual checks

---

## 4. Controller Reference

### 4.1 WordController

**Route:** `/words`  
**Voting:** Inclusion-only  
**Special Characteristics:** Uses word string as ID (not UUID)

**Endpoints:**

```typescript
// CRUD
POST   /words                     // Create word
GET    /words/:word               // Get word (word string, not UUID)
PUT    /words/:word               // Update word
DELETE /words/:word               // Delete word

// Voting (inclusion only)
POST   /words/:word/vote-inclusion
GET    /words/:word/vote-status
DELETE /words/:word/vote
GET    /words/:word/votes

// Utility
GET    /words/:word/approved      // Check if word approved
```

**Unique Patterns:**
- Parameter is `:word` (string) instead of `:id` (UUID)
- Word normalized to lowercase in service layer

---

### 4.2 DefinitionController

**Route:** `/definitions`  
**Voting:** Dual (inclusion + content)  
**Special Characteristics:** Separate endpoints for removing each vote type

**Endpoints:**

```typescript
// CRUD
POST   /definitions                         // Create definition
GET    /definitions/:id                     // Get definition
PUT    /definitions/:id                     // Update definition
DELETE /definitions/:id                     // Delete definition

// Voting (dual: inclusion + content)
POST   /definitions/:id/vote-inclusion
POST   /definitions/:id/vote-content
GET    /definitions/:id/vote-status
DELETE /definitions/:id/vote-inclusion      // Remove inclusion vote
DELETE /definitions/:id/vote-content        // Remove content vote
GET    /definitions/:id/votes

// Definition queries
GET    /definitions/word/:word              // Get all definitions for word
GET    /definitions/word/:word/top          // Get top definition
```

**Unique Patterns:**
- Separate DELETE endpoints for inclusion vs content votes
- Word-specific query endpoints

---

### 4.3 CategoryController

**Route:** `/categories`  
**Voting:** Inclusion-only  
**Special Characteristics:** 1-5 words required, hierarchy endpoints

**Endpoints:**

```typescript
// CRUD
POST   /categories                    // Create category
GET    /categories/:id                // Get category
PUT    /categories/:id                // Update category
DELETE /categories/:id                // Delete category

// Voting (inclusion only)
POST   /categories/:id/vote-inclusion
GET    /categories/:id/vote-status
DELETE /categories/:id/vote
GET    /categories/:id/votes

// Hierarchy
GET    /categories/hierarchy          // Get full hierarchy
GET    /categories/:id/children       // Get child categories
GET    /categories/:id/parent         // Get parent category
```

**Validation:**
- `wordIds` array required (1-5 words)
- `wordIds.length` must be 1-5

---

### 4.4 StatementController

**Route:** `/nodes/statement`  
**Voting:** Dual (inclusion + content)  
**Special Characteristics:** Network relationship endpoints, required initial comment

**Endpoints:**

```typescript
// CRUD
POST   /nodes/statement                           // Create statement
GET    /nodes/statement/:id                       // Get statement
PUT    /nodes/statement/:id                       // Update statement
DELETE /nodes/statement/:id                       // Delete statement

// Voting (dual: inclusion + content)
POST   /nodes/statement/:id/vote-inclusion
POST   /nodes/statement/:id/vote-content
GET    /nodes/statement/:id/vote-status
DELETE /nodes/statement/:id/vote                  // Requires 'kind' in body
GET    /nodes/statement/:id/votes

// Network relationships (UNIQUE TO STATEMENT)
POST   /nodes/statement/:id/related              // Create related statement
POST   /nodes/statement/:id/link/:targetId       // Create direct relationship
DELETE /nodes/statement/:id/link/:targetId       // Remove relationship
GET    /nodes/statement/:id/related              // Get related statements
```

**Validation:**
- `initialComment` required
- `categoryIds` max 3
- `kind` required in remove vote body

---

### 4.5 OpenQuestionController

**Route:** `/nodes/openquestion`  
**Voting:** Inclusion-only  
**Special Characteristics:** Required initial comment, parent to Answer nodes

**Endpoints:**

```typescript
// CRUD
POST   /nodes/openquestion                  // Create question
GET    /nodes/openquestion/:id              // Get question
PUT    /nodes/openquestion/:id              // Update question
DELETE /nodes/openquestion/:id              // Delete question

// Voting (inclusion only)
POST   /nodes/openquestion/:id/vote-inclusion
GET    /nodes/openquestion/:id/vote-status
DELETE /nodes/openquestion/:id/vote
GET    /nodes/openquestion/:id/votes

// Query
GET    /nodes/openquestion                  // Get all questions (with options)
```

**Validation:**
- `questionText` required
- `initialComment` required
- `categoryIds` max 3

---

### 4.6 AnswerController

**Route:** `/nodes/answer`  
**Voting:** Dual (inclusion + content)  
**Special Characteristics:** Parent question ID required

**Endpoints:**

```typescript
// CRUD
POST   /nodes/answer                        // Create answer
GET    /nodes/answer/:id                    // Get answer
PUT    /nodes/answer/:id                    // Update answer
DELETE /nodes/answer/:id                    // Delete answer

// Voting (dual: inclusion + content)
POST   /nodes/answer/:id/vote-inclusion
POST   /nodes/answer/:id/vote-content
GET    /nodes/answer/:id/vote-status
DELETE /nodes/answer/:id/vote               // Requires 'kind' in body
GET    /nodes/answer/:id/votes

// Answer queries
GET    /nodes/answer/question/:questionId   // Get answers for question
```

**Validation:**
- `answerText` required
- `parentQuestionId` required
- `categoryIds` max 3
- `kind` required in remove vote body

---

### 4.7 QuantityController

**Route:** `/nodes/quantity`  
**Voting:** Inclusion-only  
**Special Characteristics:** Numeric response system, unit validation

**Endpoints:**

```typescript
// CRUD
POST   /nodes/quantity                         // Create quantity node
GET    /nodes/quantity/:id                     // Get quantity node
PUT    /nodes/quantity/:id                     // Update quantity node
DELETE /nodes/quantity/:id                     // Delete quantity node

// Voting (inclusion only)
POST   /nodes/quantity/:id/vote-inclusion
GET    /nodes/quantity/:id/vote-status
DELETE /nodes/quantity/:id/vote
GET    /nodes/quantity/:id/votes

// Numeric response system (UNIQUE TO QUANTITY)
POST   /nodes/quantity/:id/responses           // Submit numeric response
GET    /nodes/quantity/:id/responses/mine      // Get user's response
DELETE /nodes/quantity/:id/responses/mine      // Delete user's response
GET    /nodes/quantity/:id/statistics          // Get statistical aggregation

// Utility
GET    /nodes/quantity/:id/responses/allowed   // Check if responses allowed
```

**Validation:**
- `question` required
- `unitCategoryId` required
- `defaultUnitId` required
- `categoryIds` max 3
- Response `value` must be number
- Response `unitId` required

---

### 4.8 EvidenceController

**Route:** `/nodes/evidence`  
**Voting:** Inclusion-only  
**Special Characteristics:** 3D peer review system, parent node validation

**Endpoints:**

```typescript
// CRUD
POST   /nodes/evidence                         // Create evidence
GET    /nodes/evidence/:id                     // Get evidence
PUT    /nodes/evidence/:id                     // Update evidence
DELETE /nodes/evidence/:id                     // Delete evidence

// Voting (inclusion only)
POST   /nodes/evidence/:id/vote-inclusion
GET    /nodes/evidence/:id/vote-status
DELETE /nodes/evidence/:id/vote
GET    /nodes/evidence/:id/votes

// Peer review system (UNIQUE TO EVIDENCE - 3D)
POST   /nodes/evidence/:id/reviews            // Submit peer review
GET    /nodes/evidence/:id/reviews/stats      // Get aggregate review stats
GET    /nodes/evidence/:id/reviews/mine       // Get user's review
GET    /nodes/evidence/:id/reviews/allowed    // Check if review allowed

// Evidence queries
GET    /nodes/evidence/parent/:parentNodeId   // Get evidence for parent node
GET    /nodes/evidence/:id/approved           // Check if approved
```

**Validation:**
- `title` required
- `url` required (validated in service)
- `parentNodeId` required
- `parentNodeType` required (Statement/Answer/Quantity)
- `evidenceType` required (11 types)
- `publicCredit` must be boolean
- `categoryIds` max 3
- `publicationDate` parsed from string to Date
- Review scores 1-5 for each dimension

---

### 4.9 CommentController

**Route:** `/comments`  
**Voting:** Content-only (no inclusion)  
**Special Characteristics:** 15-minute edit window, visibility preferences

**Endpoints:**

```typescript
// CRUD
POST   /comments                           // Create comment
GET    /comments/:id                       // Get comment
PUT    /comments/:id                       // Update comment (15min window)
DELETE /comments/:id                       // Delete comment

// Voting (content only - no inclusion voting for comments)
POST   /comments/:id/vote                  // Vote on content
GET    /comments/:id/vote-status
DELETE /comments/:id/vote
GET    /comments/:id/votes

// Comment-specific
GET    /comments/:id/can-edit              // Check edit eligibility
GET    /comments/discussion/:discussionId  // Get all comments for discussion

// Visibility (UNIQUE TO COMMENT)
POST   /comments/:id/visibility            // Set visibility preference
GET    /comments/:id/visibility            // Get visibility status
```

**Unique Patterns:**
- Comments only support **content voting** (no inclusion)
- 15-minute edit window enforced
- Visibility preferences per user
- Route is `/comments/:id/vote` (not `/vote-content`)

---

### 4.10 DiscussionController

**Route:** `/discussions`  
**Voting:** None  
**Special Characteristics:** Read-only, no POST endpoint

**Endpoints:**

```typescript
// READ ONLY (no POST - discussions created by content nodes)
GET    /discussions/:id                    // Get discussion
GET    /discussions/:id/with-comments      // Get discussion + comments
GET    /discussions/:id/comment-count      // Get comment count

// Management
PUT    /discussions/:id                    // Update discussion
DELETE /discussions/:id                    // Delete discussion

// Node queries
GET    /discussions/node/:nodeId/:nodeType // Get discussion for node
```

**Architectural Note:**
Discussions are **NOT created via POST /discussions**. They are created automatically when content nodes (Word, Statement, etc.) are created with an `initialComment`. This controller is read-only for discussion retrieval.

---

## 5. HTTP Status Codes

### 5.1 Standard Status Codes

**Success (2xx):**

```typescript
// 200 OK (default for GET, PUT)
@Get(':id')
async getNode(@Param('id') id: string) {
  return await this.service.getNode(id);
}

// 201 Created (POST endpoints)
@Post()
@HttpCode(HttpStatus.CREATED)  // ← Explicit
async createNode(@Body() dto: CreateDto) {
  return await this.service.createNode(dto);
}

// 204 No Content (DELETE endpoints)
@Delete(':id')
@HttpCode(HttpStatus.NO_CONTENT)  // ← Explicit
async deleteNode(@Param('id') id: string) {
  await this.service.deleteNode(id);
  // No return statement
}
```

**Client Errors (4xx):**

```typescript
// 400 Bad Request - Invalid input
throw new BadRequestException('Field is required');

// 401 Unauthorized - Missing or invalid JWT
// (Handled automatically by JwtAuthGuard)

// 403 Forbidden - User lacks permission
throw new HttpException('Only creator can delete', HttpStatus.FORBIDDEN);

// 404 Not Found - Resource doesn't exist
throw new NotFoundException(`Node with ID ${id} not found`);
```

**Server Errors (5xx):**

```typescript
// 500 Internal Server Error - Unexpected errors
// (Caught by exception filters, logged by service layer)
```

### 5.2 Status Code Matrix

| Method | Endpoint Pattern | Success Status | Notes |
|--------|-----------------|----------------|-------|
| POST | `/nodes/type` | 201 Created | Explicit `@HttpCode` |
| GET | `/nodes/type/:id` | 200 OK | Default |
| PUT | `/nodes/type/:id` | 200 OK | Default |
| DELETE | `/nodes/type/:id` | 204 No Content | Explicit `@HttpCode` |
| POST | `/:id/vote-*` | 200 OK | Returns VoteResult |
| GET | `/:id/vote-status` | 200 OK | Returns VoteStatus or null |
| DELETE | `/:id/vote` | 200 OK | Returns VoteResult |

---

## 6. Authentication & Authorization

### 6.1 JWT Guard Application

**Class-Level (Standard):**

```typescript
@Controller('path')
@UseGuards(JwtAuthGuard)  // ← Applied to ALL endpoints
export class NodeController {
  // All methods automatically protected
}
```

**Method-Level (Rare):**

```typescript
@Controller('path')
export class NodeController {
  @Get('public')
  // No guard - public endpoint
  
  @Post()
  @UseGuards(JwtAuthGuard)  // ← Method-specific
  async create() {}
}
```

**Architectural Decision:** Use class-level guards for consistency. All ProjectZer0 endpoints require authentication.

### 6.2 User Context Extraction

**Standard Pattern:**

```typescript
async createNode(@Body() dto: CreateDto, @Request() req: any) {
  // 1. Extract user ID
  const userId = req.user.sub;
  
  // 2. Validate exists (defensive)
  if (!req.user?.sub) {
    throw new BadRequestException('User ID is required');
  }
  
  // 3. Use in service call
  await this.service.createNode({
    ...dto,
    createdBy: userId,
  });
}
```

**JWT Payload:**
```typescript
// req.user structure after JwtAuthGuard
{
  sub: 'user-uuid',         // ← ALWAYS use this
  email: 'user@example.com',
  iat: 1234567890,
  exp: 1234567890
}
```

### 6.3 Authorization Checks

**Controller-Level (Minimal):**

```typescript
// ONLY basic ownership checks at controller
if (comment.createdBy !== req.user.sub) {
  throw new HttpException(
    'Only creator can delete comment',
    HttpStatus.FORBIDDEN
  );
}
```

**Most authorization handled in service layer (preferred)**

---

## 7. DTO Patterns

### 7.1 Standard DTOs

**Create DTOs:**

```typescript
// Simple node (Word, Category)
interface CreateNodeDto {
  field: string;
  publicCredit?: boolean;
  initialComment?: string;
}

// Categorized node (Statement, OpenQuestion, Answer, Quantity, Evidence)
interface CreateNodeDto {
  text: string;
  publicCredit?: boolean;
  categoryIds?: string[];        // 0-3 categories
  userKeywords?: string[];
  initialComment?: string;       // Required for Statement/OpenQuestion
}

// Parent-child node (Definition, Answer, Evidence)
interface CreateNodeDto {
  text: string;
  publicCredit?: boolean;
  parentId: string;              // Required
  categoryIds?: string[];
  initialComment?: string;
}
```

**Update DTOs:**

```typescript
// All fields optional
interface UpdateNodeDto {
  text?: string;
  publicCredit?: boolean;
  userKeywords?: string[];
  categoryIds?: string[];
}
```

**Voting DTOs:**

```typescript
// Standard vote DTO (all voting endpoints)
interface VoteDto {
  isPositive: boolean;
}

// Remove vote DTO (dual voting only)
interface RemoveVoteDto {
  kind: 'INCLUSION' | 'CONTENT';
}
```

**Special System DTOs:**

```typescript
// Quantity - Response submission
interface SubmitResponseDto {
  value: number;
  unitId: string;
}

// Evidence - Peer review
interface SubmitPeerReviewDto {
  qualityScore: number;        // 1-5
  independenceScore: number;   // 1-5
  relevanceScore: number;      // 1-5
  comments?: string;
}

// Comment - Visibility
interface VisibilityDto {
  isVisible: boolean;
}
```

### 7.2 DTO Validation Strategy

**Type Validation:**
```typescript
// Boolean validation
if (typeof dto.isPositive !== 'boolean') {
  throw new BadRequestException('isPositive must be a boolean');
}

// Number validation
if (typeof dto.value !== 'number' || isNaN(dto.value)) {
  throw new BadRequestException('Valid numeric value is required');
}

// String validation
if (!dto.field || dto.field.trim() === '') {
  throw new BadRequestException('Field is required');
}

// Array validation
if (dto.categoryIds && dto.categoryIds.length > 3) {
  throw new BadRequestException('Maximum 3 categories allowed');
}
```

**Range Validation:**
```typescript
// Score range (Evidence peer review)
if (dto.qualityScore < 1 || dto.qualityScore > 5) {
  throw new BadRequestException('Quality score must be between 1 and 5');
}

// Array length (Category words)
if (dto.wordIds.length < 1 || dto.wordIds.length > 5) {
  throw new BadRequestException('Category must have 1-5 words');
}
```

**Enum Validation:**
```typescript
// Vote kind validation
if (!['INCLUSION', 'CONTENT'].includes(dto.kind)) {
  throw new BadRequestException('Vote kind must be INCLUSION or CONTENT');
}

// Evidence type validation
const validTypes = [
  'academic_paper', 'news_article', 'government_report',
  'dataset', 'book', 'website', 'legal_document',
  'expert_testimony', 'survey_study', 'meta_analysis', 'other'
];
if (!validTypes.includes(dto.evidenceType)) {
  throw new BadRequestException('Invalid evidence type');
}
```

---

## 8. Validation Patterns

### 8.1 Required Field Validation

**Standard Pattern:**

```typescript
@Post()
async createNode(@Body() dto: CreateDto, @Request() req: any) {
  // Validate DTO fields
  if (!dto.field || dto.field.trim() === '') {
    throw new BadRequestException('Field is required');
  }
  
  // Validate user context
  if (!req.user?.sub) {
    throw new BadRequestException('User ID is required');
  }
  
  // Proceed to service
  return await this.service.createNode({...});
}
```

### 8.2 Array Limit Validation

```typescript
// Category limit (0-3)
if (dto.categoryIds && dto.categoryIds.length > 3) {
  throw new BadRequestException('Maximum 3 categories allowed');
}

// Word limit (1-5) - Category only
if (!dto.wordIds || dto.wordIds.length === 0) {
  throw new BadRequestException('At least one word is required');
}

if (dto.wordIds.length > 5) {
  throw new BadRequestException('Maximum 5 words allowed');
}
```

### 8.3 Parameter Validation

```typescript
@Get(':id')
async getNode(@Param('id') id: string) {
  if (!id || id.trim() === '') {
    throw new BadRequestException('Node ID is required');
  }
  
  // Proceed
}
```

### 8.4 Date Parsing Validation

```typescript
// Evidence publication date
let publicationDate: Date | undefined;
if (dto.publicationDate) {
  publicationDate = new Date(dto.publicationDate);
  if (isNaN(publicationDate.getTime())) {
    throw new BadRequestException('Invalid publication date format');
  }
}
```

### 8.5 Validation Order

1. **Route parameters** (`:id`, `:word`)
2. **User context** (`req.user.sub`)
3. **Required fields** (text, IDs)
4. **Type validation** (boolean, number)
5. **Format validation** (dates, URLs)
6. **Range validation** (scores, lengths)
7. **Array limits** (categories, words)
8. **Enum validation** (types, kinds)

---

## 9. Request/Response Transformation

### 9.1 Request Transformation

**Minimal Transformation (Preferred):**

```typescript
@Post()
async createNode(@Body() dto: CreateDto, @Request() req: any) {
  // Only add user context
  return await this.service.createNode({
    ...dto,
    createdBy: req.user.sub,  // ← Only transformation
  });
}
```

**Default Values:**

```typescript
// Boolean defaults
const result = await this.service.createNode({
  ...dto,
  createdBy: req.user.sub,
  publicCredit: dto.publicCredit ?? false,  // ← Default to false
});
```

**Type Conversion (Date parsing):**

```typescript
// Parse string to Date
let publicationDate: Date | undefined;
if (dto.publicationDate) {
  publicationDate = new Date(dto.publicationDate);
}

return await this.service.createEvidence({
  ...dto,
  publicationDate,  // ← Converted
  createdBy: req.user.sub,
});
```

### 9.2 Response Transformation

**No Transformation (Standard):**

```typescript
@Get(':id')
async getNode(@Param('id') id: string) {
  const node = await this.service.getNode(id);
  return node;  // ← Direct return, no transformation
}
```

**Wrapper Objects (Rare):**

```typescript
// Comment can-edit check
@Get(':id/can-edit')
async canEditComment(@Param('id') id: string, @Request() req: any) {
  const canEdit = await this.service.canEditComment(id, req.user.sub);
  return { canEdit };  // ← Simple wrapper
}
```

**Success Indicators:**

```typescript
// Visibility preference response
return {
  success: true,
  preference: {
    isVisible: result.isVisible,
    nodeId: dto.nodeId,
    source: result.source,
    timestamp: result.timestamp,
  },
};
```

---

## 10. Error Handling

### 10.1 Controller Error Pattern

**Standard Pattern:**

```typescript
@Post()
async createNode(@Body() dto: CreateDto, @Request() req: any) {
  // Validation throws BadRequestException
  if (!dto.field || dto.field.trim() === '') {
    throw new BadRequestException('Field is required');
  }
  
  // Service layer throws exceptions
  // Controller does NOT catch - let NestJS exception filters handle
  return await this.service.createNode({...});
}
```

**Key Principle:** Controllers throw exceptions but DON'T catch service exceptions

### 10.2 Exception Types

**BadRequestException (400):**
```typescript
// Invalid input
throw new BadRequestException('Field is required');

// Type error
throw new BadRequestException('isPositive must be a boolean');

// Range error
throw new BadRequestException('Score must be between 1 and 5');

// Limit exceeded
throw new BadRequestException('Maximum 3 categories allowed');
```

**NotFoundException (404):**
```typescript
// Resource not found
const node = await this.service.getNode(id);
if (!node) {
  throw new NotFoundException(`Node with ID ${id} not found`);
}
```

**HttpException (Custom Status):**
```typescript
// 403 Forbidden
throw new HttpException(
  'Only creator can delete comment',
  HttpStatus.FORBIDDEN
);

// 401 Unauthorized
throw new HttpException(
  'User ID is required',
  HttpStatus.UNAUTHORIZED
);
```

### 10.3 Error Response Format

**NestJS Automatic Format:**
```json
{
  "statusCode": 400,
  "message": "Field is required",
  "error": "Bad Request"
}
```

**Array of Messages:**
```json
{
  "statusCode": 400,
  "message": [
    "Field is required",
    "publicCredit must be a boolean"
  ],
  "error": "Bad Request"
}
```

---

## 11. Testing Patterns

### 11.1 Controller Test Structure

```typescript
describe('NodeController', () => {
  let controller: NodeController;
  let mockService: jest.Mocked<NodeService>;
  
  beforeEach(() => {
    // Setup mocks
    mockService = {
      createNode: jest.fn(),
      getNode: jest.fn(),
      updateNode: jest.fn(),
      deleteNode: jest.fn(),
      voteInclusion: jest.fn(),
      getVoteStatus: jest.fn(),
      removeVote: jest.fn(),
      getVotes: jest.fn(),
    } as unknown as jest.Mocked<NodeService>;
    
    controller = new NodeController(mockService);
  });
  
  describe('CRUD Operations', () => {
    describe('createNode', () => {
      it('should create node with valid data', async () => {
        // Test implementation
      });
      
      it('should throw BadRequestException if field missing', async () => {
        // Test implementation
      });
      
      it('should throw BadRequestException if user ID missing', async () => {
        // Test implementation
      });
    });
    
    describe('getNode', () => {
      it('should return node if found', async () => {});
      it('should throw NotFoundException if not found', async () => {});
      it('should throw BadRequestException if ID invalid', async () => {});
    });
    
    // ... more tests
  });
  
  describe('Voting Operations', () => {
    describe('voteInclusion', () => {
      it('should vote with valid data', async () => {});
      it('should throw if isPositive not boolean', async () => {});
    });
  });
});
```

### 11.2 Mock Request Pattern

```typescript
// Mock authenticated request
const mockRequest = {
  user: {
    sub: 'user-uuid-123',
    email: 'user@example.com',
  },
} as any;

// Test with mock request
const result = await controller.createNode(mockDto, mockRequest);
```

### 11.3 Test Coverage Requirements

**Per Controller:**
- CRUD operations: ~12 tests (4 operations × 3 scenarios)
- Voting operations: ~12-16 tests (varies by pattern)
- Special operations: ~0-12 tests (varies by node)
- Validation: ~8-12 tests

**Total:** ~40-60 tests per controller

---

## 12. Best Practices

### 12.1 Controller Design - DO

✅ Apply `@UseGuards(JwtAuthGuard)` at class level  
✅ Use explicit `@HttpCode()` for 201 and 204  
✅ Extract user ID from `req.user.sub`  
✅ Validate required fields before service call  
✅ Throw specific exceptions (BadRequest, NotFound)  
✅ Use DTOs for all request bodies  
✅ Log operations at appropriate levels  
✅ Return service results directly (no transformation)  
✅ Use `async/await` consistently  
✅ Validate boolean types explicitly  

### 12.2 Controller Design - DON'T

❌ Don't inject schemas directly (only services)  
❌ Don't add business logic in controllers  
❌ Don't catch service exceptions (let filters handle)  
❌ Don't transform responses unnecessarily  
❌ Don't forget user ID validation  
❌ Don't use untyped `any` for DTOs  
❌ Don't skip input validation  
❌ Don't forget `@HttpCode()` for POST/DELETE  
❌ Don't apply guards per-method (use class-level)  
❌ Don't wrap exceptions unnecessarily  

### 12.3 Validation Best Practices

**✅ Good:**
```typescript
// Specific validation
if (!dto.field || dto.field.trim() === '') {
  throw new BadRequestException('Field is required');
}

// Type checking
if (typeof dto.isPositive !== 'boolean') {
  throw new BadRequestException('isPositive must be a boolean');
}

// Range checking
if (dto.categoryIds && dto.categoryIds.length > 3) {
  throw new BadRequestException('Maximum 3 categories allowed');
}
```

**❌ Bad:**
```typescript
// Vague validation
if (!dto.field) {
  throw new BadRequestException('Invalid data');
}

// No type checking
// Assumes isPositive is boolean

// No range checking
// Allows any number of categories
```

### 12.4 Logging Guidelines

```typescript
// Entry point - LOG level
this.logger.log(`Creating node from user ${req.user.sub}`);

// Detailed operations - DEBUG level
this.logger.debug(`Getting node: ${id}`);
this.logger.debug(`Vote result: ${JSON.stringify(result)}`);

// Success operations - LOG level
this.logger.log(`Successfully created node: ${id}`);

// Errors - Let service layer handle (don't log in controller)
```

### 12.5 Route Design Principles

**RESTful Patterns:**
```typescript
// ✅ Good - RESTful
POST   /nodes/statement
GET    /nodes/statement/:id
PUT    /nodes/statement/:id
DELETE /nodes/statement/:id

// ❌ Bad - Non-RESTful
POST   /createStatement
GET    /getStatement/:id
POST   /updateStatement/:id
```

**Action Endpoints:**
```typescript
// ✅ Good - Clear action
POST   /nodes/statement/:id/vote-inclusion
POST   /nodes/statement/:id/vote-content
DELETE /nodes/statement/:id/vote

// ❌ Bad - Unclear
POST   /nodes/statement/:id/inclusion
POST   /nodes/statement/:id/content
POST   /nodes/statement/:id/remove-vote
```

---

## 13. Comparison Tables

### 13.1 Controller Complexity

| Controller | Endpoints | DTOs | Validation Rules | Test Count |
|-----------|-----------|------|------------------|------------|
| Word | 9 | 3 | 5 | ~50 |
| Definition | 13 | 4 | 6 | ~65 |
| Category | 12 | 3 | 7 | ~60 |
| Statement | 15 | 4 | 7 | ~75 |
| OpenQuestion | 10 | 3 | 7 | ~55 |
| Answer | 12 | 4 | 8 | ~65 |
| Quantity | 13 | 4 | 9 | ~70 |
| Evidence | 15 | 5 | 11 | ~75 |
| Comment | 11 | 4 | 6 | ~60 |
| Discussion | 6 | 1 | 3 | ~35 |

### 13.2 Voting Endpoint Patterns

| Controller | Inclusion | Content | Remove Pattern | Endpoints |
|-----------|-----------|---------|----------------|-----------|
| Word | ✅ | ❌ | Simple | 4 |
| Definition | ✅ | ✅ | Separate | 6 |
| Category | ✅ | ❌ | Simple | 4 |
| Statement | ✅ | ✅ | Body param | 5 |
| OpenQuestion | ✅ | ❌ | Simple | 4 |
| Answer | ✅ | ✅ | Body param | 5 |
| Quantity | ✅ | ❌ | Simple | 4 |
| Evidence | ✅ | ❌ | Simple | 4 |
| Comment | ❌ | ✅ | Simple | 4 |
| Discussion | ❌ | ❌ | N/A | 0 |

### 13.3 Special Endpoint Patterns

| Controller | Special Endpoints | Purpose |
|-----------|------------------|---------|
| Statement | `/related`, `/link/:targetId` | Network relationships |
| Quantity | `/responses`, `/statistics` | Numeric response system |
| Evidence | `/reviews`, `/reviews/stats` | Peer review system |
| Comment | `/can-edit`, `/visibility` | Edit window, visibility |
| Category | `/hierarchy`, `/children` | Hierarchical queries |
| Definition | `/word/:word/top` | Top definition query |

### 13.4 Validation Matrix

| Validation | Word | Def | Cat | Stmt | OQ | Ans | Qty | Evd | Com | Disc |
|-----------|------|-----|-----|------|----|-----|-----|-----|-----|------|
| **Required fields** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **User ID** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Boolean type** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Category limit (≤3)** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Word limit (1-5)** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Parent ID** | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Date parsing** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Score range (1-5)** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Numeric value** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Required comment** | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 14. Quick Reference

### 14.1 Standard Imports

```typescript
// Core NestJS decorators
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';

// Authentication
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

// Service
import { NodeService } from './node.service';

// Types
import type { VoteResult, VoteStatus } from '../../neo4j/schemas/vote.schema';
```

### 14.2 Universal Route Patterns

**CRUD:**
```typescript
POST   /{resource}           // Create
GET    /{resource}/:id       // Read
PUT    /{resource}/:id       // Update
DELETE /{resource}/:id       // Delete
```

**Voting (Inclusion-Only):**
```typescript
POST   /{resource}/:id/vote-inclusion
GET    /{resource}/:id/vote-status
DELETE /{resource}/:id/vote
GET    /{resource}/:id/votes
```

**Voting (Dual):**
```typescript
POST   /{resource}/:id/vote-inclusion
POST   /{resource}/:id/vote-content
GET    /{resource}/:id/vote-status
DELETE /{resource}/:id/vote              // Requires 'kind' in body
GET    /{resource}/:id/votes
```

### 14.3 Validation Checklist

**Per Endpoint:**
- [ ] Route parameters validated (`:id`, `:word`)
- [ ] User ID validated (`req.user?.sub`)
- [ ] Required fields present
- [ ] Boolean types checked
- [ ] Number types checked
- [ ] Date formats validated
- [ ] Array limits enforced
- [ ] Enum values validated
- [ ] Clear error messages

### 14.4 HTTP Status Code Quick Reference

```typescript
// Success
200 OK              // GET, PUT (default)
201 Created         // POST (explicit @HttpCode)
204 No Content      // DELETE (explicit @HttpCode)

// Client Errors
400 Bad Request     // BadRequestException
401 Unauthorized    // JwtAuthGuard (automatic)
403 Forbidden       // HttpException with FORBIDDEN
404 Not Found       // NotFoundException

// Server Errors
500 Internal        // Unhandled exceptions (automatic)
```

### 14.5 Common DTO Patterns

```typescript
// Create DTO
interface CreateNodeDto {
  text: string;
  publicCredit?: boolean;
  categoryIds?: string[];
  userKeywords?: string[];
  initialComment?: string;
}

// Update DTO
interface UpdateNodeDto {
  text?: string;
  publicCredit?: boolean;
  userKeywords?: string[];
  categoryIds?: string[];
}

// Vote DTO
interface VoteDto {
  isPositive: boolean;
}

// Remove Vote DTO (dual voting)
interface RemoveVoteDto {
  kind: 'INCLUSION' | 'CONTENT';
}
```

---

## 15. Architectural Decisions

### 15.1 Class-Level JWT Guards

**Decision:** Apply `@UseGuards(JwtAuthGuard)` at class level

**Rationale:**
- All ProjectZer0 endpoints require authentication
- Reduces duplication
- Prevents forgetting guards on new endpoints
- Consistent security posture

**Impact:** 100% endpoint authentication coverage

### 15.2 Thin Controllers

**Decision:** Minimal logic in controllers, delegate to services

**Rationale:**
- Controllers are HTTP boundary only
- Business logic belongs in service layer
- Easier to test services independently
- Better separation of concerns

**Impact:** Clear architectural layers

### 15.3 No Exception Catching

**Decision:** Controllers throw but don't catch exceptions

**Rationale:**
- NestJS exception filters handle all exceptions
- Automatic status code mapping
- Consistent error responses
- Reduces controller complexity

**Impact:** Cleaner controller code

### 15.4 Direct Service Returns

**Decision:** Return service results without transformation

**Rationale:**
- Controllers shouldn't modify business data
- Services return properly formatted data
- Reduces transformation bugs
- Simpler controller code

**Impact:** ~95% of endpoints return directly

### 15.5 Explicit Status Codes

**Decision:** Use `@HttpCode()` for POST and DELETE

**Rationale:**
- 201 Created more accurate than 200 OK
- 204 No Content for successful deletes
- Clear HTTP semantics
- Better API design

**Impact:** All POST/DELETE use explicit codes

### 15.6 DTO as Interfaces

**Decision:** Use TypeScript interfaces for DTOs (not classes)

**Rationale:**
- Simpler than class-based validation
- Validation done manually in controller
- No runtime overhead
- Easier to maintain

**Impact:** All DTOs are interfaces

### 15.7 Separate Voting Endpoints

**Decision:** Definition uses separate DELETE endpoints for vote types

**Rationale:**
- Clear which vote type being removed
- RESTful approach
- No body required for DELETE

**Alternative:** Statement/Answer use body parameter
**Reason:** Reduce endpoint count, still explicit

### 15.8 Discussion Creation Location

**Decision:** No POST /discussions endpoint

**Rationale:**
- Discussions created automatically via content creation
- Discussion Schema called directly by services
- Prevents orphaned discussions
- Clearer workflow

**Impact:** DiscussionController is read-only

---

## 16. Related Documentation

**Service Layer:** `service-layer.md` - Business logic patterns  
**Schema Layer:** `schema-layer.md` - Database patterns  
**API Documentation:** OpenAPI/Swagger specifications  
**Authentication:** JWT implementation and configuration  
**Testing:** E2E testing strategies  

---

## Document Metadata

**Version:** 1.0  
**Last Updated:** 2025  
**Status:** Production Ready  
**Maintainer:** ProjectZer0 Team

**Total Controllers Documented:** 10  
**Total Endpoints Documented:** ~120  
**Architectural Consistency:** 100%

---

## Usage Notes

**For Development:**
- Reference Quick Reference (Section 14) for daily work
- Use Comparison Tables (Section 13) for pattern identification
- Follow Best Practices (Section 12) for new endpoints

**For AI Context:**
- Provide Sections 1-3 for architectural understanding
- Add specific controller section (4.1-4.10) for task context
- Include Section 8 (Validation) for input handling

**For Onboarding:**
- Read Sections 1-3 (Overview, Philosophy, Core Patterns)
- Study one controller in detail (Section 4.x)
- Review Best Practices (Section 12)
- Use Quick Reference (Section 14) daily

**For Testing:**
- Follow patterns in Section 11
- Use validation checklist (Section 14.3)
- Reference mock patterns (Section 11.2)

---

**End of Controller Layer Documentation**

This documentation complements `service-layer.md` and `schema-layer.md` to provide complete architectural coverage of the ProjectZer0 backend HTTP layer.