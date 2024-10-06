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
import { BeliefService } from './belief.service';

@Controller('nodes/belief')
@UseGuards(JwtAuthGuard)
export class BeliefController {
  constructor(private readonly beliefService: BeliefService) {}

  @Post()
  async createBelief(@Body() beliefData: any) {
    return this.beliefService.createBelief(beliefData);
  }

  @Get(':id')
  async getBelief(@Param('id') id: string) {
    return this.beliefService.getBelief(id);
  }

  @Put(':id')
  async updateBelief(@Param('id') id: string, @Body() updateData: any) {
    return this.beliefService.updateBelief(id, updateData);
  }

  @Delete(':id')
  async deleteBelief(@Param('id') id: string) {
    return this.beliefService.deleteBelief(id);
  }
}
