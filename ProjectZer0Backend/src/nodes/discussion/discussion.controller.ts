import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { DiscussionService } from './discussion.service';

@Controller('discussions')
@UseGuards(JwtAuthGuard)
export class DiscussionController {
  constructor(private readonly discussionService: DiscussionService) {}

  @Post()
  async createDiscussion(
    @Body()
    discussionData: {
      createdBy: string;
      associatedNodeId: string;
      associatedNodeType: string;
      initialComment?: string;
    },
  ) {
    return this.discussionService.createDiscussion(discussionData);
  }

  @Get(':id')
  async getDiscussion(@Param('id') id: string) {
    return this.discussionService.getDiscussion(id);
  }

  @Put(':id')
  async updateDiscussion(@Param('id') id: string, @Body() updateData: any) {
    return this.discussionService.updateDiscussion(id, updateData);
  }

  @Delete(':id')
  async deleteDiscussion(@Param('id') id: string) {
    return this.discussionService.deleteDiscussion(id);
  }

  @Put(':id/visibility')
  async setVisibilityStatus(
    @Param('id') id: string,
    @Body() visibilityData: { isVisible: boolean },
  ) {
    return this.discussionService.setVisibilityStatus(
      id,
      visibilityData.isVisible,
    );
  }

  @Get(':id/visibility')
  async getVisibilityStatus(@Param('id') id: string) {
    return this.discussionService.getVisibilityStatus(id);
  }
}
