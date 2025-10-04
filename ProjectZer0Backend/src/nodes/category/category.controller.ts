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
import type { VoteResult, VoteStatus } from '../../neo4j/schemas/vote.schema';

/**
 * DTOs for Category endpoints
 */
interface CreateCategoryDto {
  name: string;
  description?: string;
  createdBy: string;
  publicCredit?: boolean;
  wordIds: string[]; // 1-5 words
  parentCategoryId?: string;
  initialComment?: string;
}

interface UpdateCategoryDto {
  name?: string;
  description?: string;
  publicCredit?: boolean;
}

interface VoteDto {
  isPositive: boolean;
}

@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoryController {
  private readonly logger = new Logger(CategoryController.name);

  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createCategory(
    @Body() createDto: CreateCategoryDto,
    @Request() req: any,
  ) {
    if (!createDto.name || createDto.name.trim() === '') {
      throw new BadRequestException('Category name is required');
    }

    if (!createDto.wordIds || createDto.wordIds.length === 0) {
      throw new BadRequestException('At least one word is required');
    }

    if (createDto.wordIds.length > 5) {
      throw new BadRequestException('Maximum 5 words allowed');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.log(`Creating category: ${createDto.name}`);

    const createdCategory = await this.categoryService.createCategory({
      name: createDto.name,
      description: createDto.description,
      createdBy: req.user.sub,
      publicCredit: createDto.publicCredit,
      wordIds: createDto.wordIds,
      parentCategoryId: createDto.parentCategoryId,
      initialComment: createDto.initialComment,
    });

    this.logger.debug(`Created category: ${JSON.stringify(createdCategory)}`);
    return createdCategory;
  }

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

    this.logger.debug(`Updating category: ${id}`);

    const updatedCategory = await this.categoryService.updateCategory(
      id,
      updateDto,
    );
    this.logger.debug(`Updated category: ${JSON.stringify(updatedCategory)}`);
    return updatedCategory;
  }

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
    this.logger.debug(`Deleted category: ${id}`);
  }

  @Post(':id/vote-inclusion')
  async voteInclusion(
    @Param('id') id: string,
    @Body() voteDto: VoteDto,
    @Request() req: any,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Category ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    if (typeof voteDto.isPositive !== 'boolean') {
      throw new BadRequestException('isPositive must be a boolean');
    }

    const result = await this.categoryService.voteInclusion(
      id,
      req.user.sub,
      voteDto.isPositive,
    );

    return result;
  }

  @Get(':id/vote-status')
  async getVoteStatus(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<VoteStatus | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Category ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    return await this.categoryService.getVoteStatus(id, req.user.sub);
  }

  @Delete(':id/vote')
  async removeVote(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Category ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    return await this.categoryService.removeVote(id, req.user.sub);
  }

  @Get(':id/votes')
  async getVotes(@Param('id') id: string): Promise<VoteResult | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Category ID is required');
    }

    return await this.categoryService.getVotes(id);
  }

  @Get('hierarchy/all')
  async getCategoryHierarchy() {
    this.logger.debug('Getting category hierarchy');
    return await this.categoryService.getCategoryHierarchy();
  }

  @Get('hierarchy/:rootId')
  async getCategoryHierarchyFrom(@Param('rootId') rootId: string) {
    if (!rootId || rootId.trim() === '') {
      throw new BadRequestException('Root ID is required');
    }

    return await this.categoryService.getCategoryHierarchy(rootId);
  }

  @Get('node/:nodeId/categories')
  async getCategoriesForNode(@Param('nodeId') nodeId: string) {
    if (!nodeId || nodeId.trim() === '') {
      throw new BadRequestException('Node ID is required');
    }

    return await this.categoryService.getCategoriesForNode(nodeId);
  }

  @Get()
  async getAllCategories() {
    return await this.categoryService.getAllCategories();
  }

  @Get('approved/list')
  async getApprovedCategories() {
    return await this.categoryService.getApprovedCategories();
  }
}
