// src/nodes/category/category.controller.ts - REFACTORED TO SCHEMA ARCHITECTURE

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CategoryService } from './category.service';

/**
 * DTOs for Category endpoints
 * Note: name is auto-generated from wordIds, description field removed
 */
interface CreateCategoryDto {
  wordIds: string[]; // 1-5 words - name will be auto-generated from these
  publicCredit?: boolean;
  parentCategoryId?: string;
  initialComment?: string;
}

interface UpdateCategoryDto {
  publicCredit?: boolean;
}

interface VoteDto {
  isPositive: boolean;
}

/**
 * CategoryController - HTTP layer for category operations
 *
 * RESPONSIBILITIES:
 * ✅ Parse and validate HTTP requests
 * ✅ Extract user from JWT (req.user.sub)
 * ✅ Call CategoryService methods
 * ✅ Return appropriate HTTP status codes
 * ✅ Handle HTTP-specific errors
 *
 * NOT RESPONSIBLE FOR:
 * ❌ Business logic (that's CategoryService)
 * ❌ Database queries (that's CategorySchema)
 * ❌ Complex validation (that's CategoryService)
 *
 * SPECIAL NOTES:
 * - Category names are auto-generated from constituent words
 * - No description field (definitions exist on the words themselves)
 * - Only publicCredit can be updated after creation
 */
@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoryController {
  private readonly logger = new Logger(CategoryController.name);

  constructor(private readonly categoryService: CategoryService) {}

  // ============================================
  // CRUD ENDPOINTS
  // ============================================

  /**
   * Create a new category
   * POST /categories
   * Body: { wordIds: string[], publicCredit?: boolean, parentCategoryId?: string, initialComment?: string }
   * Note: Name is auto-generated from wordIds
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createCategory(
    @Body() createDto: CreateCategoryDto,
    @Request() req: any,
  ) {
    // Validate wordIds
    if (!createDto.wordIds || createDto.wordIds.length === 0) {
      throw new BadRequestException('At least one word ID is required');
    }

    if (createDto.wordIds.length > 5) {
      throw new BadRequestException('Maximum 5 words allowed per category');
    }

    // Validate user
    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.log(`Creating category from ${createDto.wordIds.length} words`);

    const createdCategory = await this.categoryService.createCategory({
      createdBy: req.user.sub,
      publicCredit: createDto.publicCredit,
      wordIds: createDto.wordIds,
      parentCategoryId: createDto.parentCategoryId,
      initialComment: createDto.initialComment,
    });

    this.logger.debug(
      `Created category: ${createdCategory.name} (${createdCategory.id})`,
    );
    return createdCategory;
  }

  /**
   * Get a category by ID
   * GET /categories/:id
   */
  @Get(':id')
  async getCategory(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Category ID is required');
    }

    this.logger.debug(`Getting category: ${id}`);

    const category = await this.categoryService.getCategory(id);

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return category;
  }

  /**
   * Update a category
   * PUT /categories/:id
   * Body: { publicCredit?: boolean }
   * Note: Name cannot be updated (auto-generated), description field removed
   */
  @Put(':id')
  async updateCategory(
    @Param('id') id: string,
    @Body() updateDto: UpdateCategoryDto,
    @Request() req: any,
  ) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Category ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    // Validate at least one field provided
    if (updateDto.publicCredit === undefined) {
      throw new BadRequestException(
        'publicCredit field is required for update',
      );
    }

    this.logger.log(`Updating category: ${id}`);

    const updatedCategory = await this.categoryService.updateCategory(id, {
      publicCredit: updateDto.publicCredit,
    });

    if (!updatedCategory) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return updatedCategory;
  }

  /**
   * Delete a category
   * DELETE /categories/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCategory(@Param('id') id: string, @Request() req: any) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Category ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(`Deleting category: ${id}`);
    await this.categoryService.deleteCategory(id);
    this.logger.debug(`Category deleted: ${id}`);
  }

  // ============================================
  // VOTING ENDPOINTS
  // ============================================

  /**
   * Vote on category inclusion
   * POST /categories/:id/vote-inclusion
   * Body: { isPositive: boolean }
   * Note: Categories only have inclusion voting (no content voting)
   */
  @Post(':id/vote-inclusion')
  async voteInclusion(
    @Param('id') id: string,
    @Body() voteDto: VoteDto,
    @Request() req: any,
  ) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Category ID is required');
    }

    if (voteDto.isPositive === undefined || voteDto.isPositive === null) {
      throw new BadRequestException('Vote status (isPositive) is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `User ${req.user.sub} voting ${voteDto.isPositive ? 'positive' : 'negative'} on category ${id}`,
    );

    return await this.categoryService.voteInclusion(
      id,
      req.user.sub,
      voteDto.isPositive,
    );
  }

  /**
   * Get user's vote status for a category
   * GET /categories/:id/vote-status
   */
  @Get(':id/vote-status')
  async getVoteStatus(@Param('id') id: string, @Request() req: any) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Category ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Getting vote status for category ${id}, user ${req.user.sub}`,
    );

    return await this.categoryService.getVoteStatus(id, req.user.sub);
  }

  /**
   * Remove user's vote from a category
   * DELETE /categories/:id/vote
   */
  @Delete(':id/vote')
  @HttpCode(HttpStatus.OK)
  async removeVote(@Param('id') id: string, @Request() req: any) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Category ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Removing vote from category ${id} for user ${req.user.sub}`,
    );

    return await this.categoryService.removeVote(id, req.user.sub);
  }

  /**
   * Get vote counts for a category
   * GET /categories/:id/votes
   */
  @Get(':id/votes')
  async getVotes(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Category ID is required');
    }

    this.logger.debug(`Getting votes for category: ${id}`);

    return await this.categoryService.getVotes(id);
  }

  // ============================================
  // HIERARCHY ENDPOINTS
  // ============================================

  /**
   * Get category hierarchy
   * GET /categories/hierarchy
   * Optional query param: rootId
   */
  @Get('hierarchy/tree')
  async getCategoryHierarchy(@Request() req: any) {
    const rootId = req.query?.rootId;

    this.logger.debug(
      `Getting category hierarchy${rootId ? ` for root: ${rootId}` : ''}`,
    );

    return await this.categoryService.getCategoryHierarchy(rootId);
  }

  /**
   * Get categories for a specific node
   * GET /categories/node/:nodeId
   */
  @Get('node/:nodeId')
  async getCategoriesForNode(@Param('nodeId') nodeId: string) {
    if (!nodeId || nodeId.trim() === '') {
      throw new BadRequestException('Node ID is required');
    }

    this.logger.debug(`Getting categories for node: ${nodeId}`);

    return await this.categoryService.getCategoriesForNode(nodeId);
  }

  // ============================================
  // QUERY ENDPOINTS
  // ============================================

  /**
   * Get all categories (admin/overview)
   * GET /categories
   */
  @Get()
  async getAllCategories() {
    this.logger.debug('Getting all categories');
    return await this.categoryService.getAllCategories();
  }

  /**
   * Get approved categories (passed inclusion threshold)
   * GET /categories/approved/list
   */
  @Get('approved/list')
  async getApprovedCategories() {
    this.logger.debug('Getting approved categories');
    return await this.categoryService.getApprovedCategories();
  }

  /**
   * Get category with composed words for universal graph visualization
   * GET /categories/:id/with-contents
   * Phase 2c: Load category + composed words onto graph
   */
  @Get(':id/with-contents')
  async getCategoryWithContents(@Param('id') id: string, @Request() req: any) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Category ID is required');
    }

    this.logger.debug(`Getting category with contents for graph: ${id}`);

    return await this.categoryService.getCategoryWithContentsForGraph(id, {
      userId: req.user?.sub,
    });
  }
}
