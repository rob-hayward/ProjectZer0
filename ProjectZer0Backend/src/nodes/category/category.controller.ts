// src/nodes/category/category.controller.ts

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
  Logger,
  HttpException,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CategoryService } from './category.service';

// Define DTOs for better type safety
interface CreateCategoryDto {
  name: string;
  description?: string;
  publicCredit: boolean;
  wordIds: string[]; // 1-5 words that compose this category
  parentCategoryId?: string; // Optional parent category for hierarchy
  initialComment?: string;
}

interface UpdateCategoryDto {
  name?: string;
  description?: string;
  publicCredit?: boolean;
}

interface VoteCategoryDto {
  isPositive: boolean;
}

interface VisibilityDto {
  isVisible: boolean;
}

interface AddCommentDto {
  commentText: string;
  parentCommentId?: string;
}

@Controller('nodes/category')
@UseGuards(JwtAuthGuard)
export class CategoryController {
  private readonly logger = new Logger(CategoryController.name);

  constructor(private readonly categoryService: CategoryService) {}

  // CRUD OPERATIONS

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createCategory(
    @Body() categoryData: CreateCategoryDto,
    @Request() req: any,
  ) {
    try {
      this.logger.log(`Creating category: ${categoryData.name}`);

      // Validate required fields
      if (!categoryData.name || categoryData.name.trim() === '') {
        throw new BadRequestException('Category name is required');
      }

      if (!categoryData.wordIds || !Array.isArray(categoryData.wordIds)) {
        throw new BadRequestException('Word IDs array is required');
      }

      if (categoryData.wordIds.length < 1 || categoryData.wordIds.length > 5) {
        throw new BadRequestException('Category must be composed of 1-5 words');
      }

      const result = await this.categoryService.createCategory({
        ...categoryData,
        createdBy: req.user.sub, // Use authenticated user ID from JWT
      });

      this.logger.log(`Successfully created category with ID: ${result.id}`);
      return result;
    } catch (error) {
      this.handleError(error, `Error creating category: ${categoryData.name}`);
    }
  }

  @Get(':id')
  async getCategory(
    @Param('id') id: string,
    @Query('includeHierarchy') includeHierarchy?: string,
    @Query('includeUsageStats') includeUsageStats?: string,
    @Query('includeDiscussion') includeDiscussion?: string,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Category ID is required');
      }

      this.logger.debug(`Retrieving category: ${id}`);

      const options = {
        includeHierarchy: includeHierarchy === 'true',
        includeUsageStats: includeUsageStats === 'true',
        includeDiscussion: includeDiscussion === 'true',
      };

      const category = await this.categoryService.getCategory(id, options);

      this.logger.debug(`Retrieved category: ${category.name}`);
      return category;
    } catch (error) {
      this.handleError(error, `Error retrieving category: ${id}`);
    }
  }

  @Put(':id')
  async updateCategory(
    @Param('id') id: string,
    @Body() updateData: UpdateCategoryDto,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Category ID is required');
      }

      this.logger.log(`Updating category: ${id}`);

      const result = await this.categoryService.updateCategory(id, updateData);

      this.logger.log(`Successfully updated category: ${id}`);
      return result;
    } catch (error) {
      this.handleError(error, `Error updating category: ${id}`);
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCategory(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Category ID is required');
      }

      this.logger.log(`Deleting category: ${id}`);

      await this.categoryService.deleteCategory(id);

      this.logger.log(`Successfully deleted category: ${id}`);
    } catch (error) {
      this.handleError(error, `Error deleting category: ${id}`);
    }
  }

  // LISTING AND FILTERING

  @Get()
  async getCategories(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('sortBy') sortBy: 'name' | 'created' | 'votes' | 'usage' = 'name',
    @Query('sortDirection') sortDirection: 'asc' | 'desc' = 'asc',
    @Query('onlyApproved') onlyApproved?: string,
    @Query('parentId') parentId?: string,
    @Query('searchQuery') searchQuery?: string,
  ) {
    try {
      this.logger.log(
        `Getting categories with params: ${JSON.stringify({
          limit,
          offset,
          sortBy,
          sortDirection,
          onlyApproved,
          parentId,
          searchQuery,
        })}`,
      );

      const options = {
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : 0,
        sortBy,
        sortDirection,
        onlyApproved: onlyApproved === 'true',
        parentId: parentId || undefined,
        searchQuery: searchQuery || undefined,
      };

      const categories = await this.categoryService.getCategories(options);

      this.logger.debug(`Retrieved ${categories.length} categories`);
      return categories;
    } catch (error) {
      this.handleError(error, 'Error retrieving categories');
    }
  }

  @Get('approved/list')
  async getApprovedCategories(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('sortBy') sortBy: 'name' | 'created' | 'votes' | 'usage' = 'name',
    @Query('sortDirection') sortDirection: 'asc' | 'desc' = 'asc',
    @Query('parentId') parentId?: string,
  ) {
    try {
      this.logger.log('Getting approved categories');

      const options = {
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : 0,
        sortBy,
        sortDirection,
        parentId: parentId || undefined,
      };

      const categories =
        await this.categoryService.getApprovedCategories(options);

      this.logger.debug(`Retrieved ${categories.length} approved categories`);
      return categories;
    } catch (error) {
      this.handleError(error, 'Error retrieving approved categories');
    }
  }

  @Get(':id/nodes')
  async getNodesUsingCategory(
    @Param('id') id: string,
    @Query('nodeTypes') nodeTypes?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('sortBy') sortBy: 'created' | 'votes' | 'type' = 'created',
    @Query('sortDirection') sortDirection: 'asc' | 'desc' = 'desc',
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Category ID is required');
      }

      this.logger.log(`Getting nodes using category: ${id}`);

      const options = {
        nodeTypes: nodeTypes
          ? (nodeTypes.split(',') as (
              | 'statement'
              | 'answer'
              | 'openquestion'
              | 'quantity'
            )[])
          : undefined,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : 0,
        sortBy,
        sortDirection,
      };

      const nodes = await this.categoryService.getNodesUsingCategory(
        id,
        options,
      );

      this.logger.debug(`Retrieved ${nodes.length} nodes using category ${id}`);
      return nodes;
    } catch (error) {
      this.handleError(error, `Error getting nodes using category: ${id}`);
    }
  }

  @Get(':id/path')
  async getCategoryPath(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Category ID is required');
      }

      this.logger.debug(`Getting category path for: ${id}`);

      const path = await this.categoryService.getCategoryPath(id);

      return { path };
    } catch (error) {
      this.handleError(error, `Error getting category path: ${id}`);
    }
  }

  @Get(':id/stats')
  async getCategoryStats(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Category ID is required');
      }

      this.logger.debug(`Getting category stats for: ${id}`);

      const stats = await this.categoryService.getCategoryStats(id);

      return stats;
    } catch (error) {
      this.handleError(error, `Error getting category stats: ${id}`);
    }
  }

  // VOTING ENDPOINTS

  @Post(':id/vote')
  async voteCategoryInclusion(
    @Param('id') id: string,
    @Body() voteData: VoteCategoryDto,
    @Request() req: any,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Category ID is required');
      }

      if (typeof voteData.isPositive !== 'boolean') {
        throw new BadRequestException(
          'Vote direction (isPositive) is required',
        );
      }

      this.logger.log(
        `Processing inclusion vote on category ${id}: ${voteData.isPositive ? 'positive' : 'negative'}`,
      );

      const result = await this.categoryService.voteCategoryInclusion(
        id,
        req.user.sub,
        voteData.isPositive,
      );

      return result;
    } catch (error) {
      this.handleError(error, `Error voting on category: ${id}`);
    }
  }

  @Get(':id/vote')
  async getCategoryVoteStatus(@Param('id') id: string, @Request() req: any) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Category ID is required');
      }

      this.logger.debug(`Getting vote status for category: ${id}`);

      const voteStatus = await this.categoryService.getCategoryVoteStatus(
        id,
        req.user.sub,
      );

      return { voteStatus };
    } catch (error) {
      this.handleError(error, `Error getting vote status for category: ${id}`);
    }
  }

  @Delete(':id/vote')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeCategoryVote(@Param('id') id: string, @Request() req: any) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Category ID is required');
      }

      this.logger.log(`Removing vote from category: ${id}`);

      await this.categoryService.removeCategoryVote(id, req.user.sub);
    } catch (error) {
      this.handleError(error, `Error removing vote from category: ${id}`);
    }
  }

  @Get(':id/votes')
  async getCategoryVotes(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Category ID is required');
      }

      this.logger.debug(`Getting vote counts for category: ${id}`);

      const votes = await this.categoryService.getCategoryVotes(id);

      return { votes };
    } catch (error) {
      this.handleError(error, `Error getting votes for category: ${id}`);
    }
  }

  // VISIBILITY ENDPOINTS

  @Put(':id/visibility')
  async setVisibilityStatus(
    @Param('id') id: string,
    @Body() visibilityData: VisibilityDto,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Category ID is required');
      }

      if (typeof visibilityData.isVisible !== 'boolean') {
        throw new BadRequestException(
          'Visibility status (isVisible) is required',
        );
      }

      this.logger.log(
        `Setting visibility for category ${id} to ${visibilityData.isVisible}`,
      );

      const result = await this.categoryService.setVisibilityStatus(
        id,
        visibilityData.isVisible,
      );

      return result;
    } catch (error) {
      this.handleError(error, `Error setting visibility for category: ${id}`);
    }
  }

  @Get(':id/visibility')
  async getVisibilityStatus(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Category ID is required');
      }

      this.logger.debug(`Getting visibility status for category: ${id}`);

      const visibilityStatus =
        await this.categoryService.getVisibilityStatus(id);

      // ✅ FIXED: Wrap service response to match test expectation
      return { isVisible: visibilityStatus };
    } catch (error) {
      this.handleError(
        error,
        `Error getting visibility status for category: ${id}`,
      );
    }
  }

  // DISCOVERY ENDPOINTS

  @Get(':id/related')
  async getRelatedContentBySharedCategories(
    @Param('id') id: string,
    @Query('nodeTypes') nodeTypes?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('sortBy')
    sortBy:
      | 'category_overlap'
      | 'created'
      | 'inclusion_votes'
      | 'content_votes' = 'category_overlap',
    @Query('sortDirection') sortDirection: 'asc' | 'desc' = 'desc',
    @Query('excludeSelf') excludeSelf?: string,
    @Query('minCategoryOverlap') minCategoryOverlap?: number,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Category ID is required');
      }

      this.logger.debug(`Getting related content for category: ${id}`);

      const options = {
        nodeTypes: nodeTypes
          ? (nodeTypes.split(',') as (
              | 'statement'
              | 'answer'
              | 'openquestion'
              | 'quantity'
            )[])
          : undefined,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : 0,
        sortBy,
        sortDirection,
        excludeSelf: excludeSelf === 'true',
        minCategoryOverlap: minCategoryOverlap
          ? Number(minCategoryOverlap)
          : undefined,
      };

      const relatedContent =
        await this.categoryService.getRelatedContentBySharedCategories(
          id,
          options,
        );

      return { relatedContent };
    } catch (error) {
      this.handleError(
        error,
        `Error getting related content for category: ${id}`,
      );
    }
  }

  @Get('node/:nodeId/categories')
  async getNodeCategories(@Param('nodeId') nodeId: string) {
    try {
      if (!nodeId || nodeId.trim() === '') {
        throw new BadRequestException('Node ID is required');
      }

      this.logger.debug(`Getting categories for node: ${nodeId}`);

      const categories = await this.categoryService.getNodeCategories(nodeId);

      return { categories };
    } catch (error) {
      this.handleError(error, `Error getting categories for node: ${nodeId}`);
    }
  }

  // DISCUSSION AND COMMENT ENDPOINTS

  @Get(':id/discussion')
  async getCategoryWithDiscussion(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Category ID is required');
      }

      this.logger.log(`Getting category with discussion: ${id}`);

      const category = await this.categoryService.getCategoryWithDiscussion(id);

      return category;
    } catch (error) {
      this.handleError(
        error,
        `Error retrieving category with discussion: ${id}`,
      );
    }
  }

  @Get(':id/comments')
  async getCategoryComments(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Category ID is required');
      }

      this.logger.log(`Getting comments for category: ${id}`);

      const result = await this.categoryService.getCategoryComments(id);

      return result;
    } catch (error) {
      this.handleError(error, `Error retrieving comments for category: ${id}`);
    }
  }

  @Post(':id/comments') // Note: should be '/comments' not '/comment'
  async addCategoryComment(
    @Param('id') id: string,
    @Body() commentData: AddCommentDto,
    @Request() req: any,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Category ID is required');
      }

      if (!commentData.commentText || commentData.commentText.trim() === '') {
        throw new BadRequestException('Comment text is required');
      }

      this.logger.log(`Adding comment to category: ${id}`);

      // ✅ FIXED: Extract values from DTO and pass in correct order
      const comment = await this.categoryService.addCategoryComment(
        id, // categoryId
        req.user.sub, // userId
        commentData.commentText, // commentText (extracted from DTO)
        commentData.parentCommentId, // parentCommentId (extracted from DTO)
      );

      return comment;
    } catch (error) {
      this.handleError(error, `Error adding comment to category: ${id}`);
    }
  }

  // UTILITY ENDPOINTS

  @Get(':id/approved')
  async isCategoryApproved(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Category ID is required');
      }

      this.logger.debug(`Checking approval status for category: ${id}`);

      const isApproved = await this.categoryService.isCategoryApproved(id);

      return { isApproved };
    } catch (error) {
      this.handleError(error, `Error checking approval for category: ${id}`);
    }
  }

  // PRIVATE HELPER METHODS

  /**
   * Centralized error handling
   */
  private handleError(error: any, context: string): never {
    this.logger.error(`${context}: ${error.message}`, error.stack);

    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException
    ) {
      throw error;
    }

    // Log the full error for debugging while throwing a generic message
    throw new HttpException(
      {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'An internal server error occurred',
        error: 'Internal Server Error',
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
