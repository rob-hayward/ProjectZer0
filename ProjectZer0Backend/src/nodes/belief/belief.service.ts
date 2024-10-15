import { Injectable } from '@nestjs/common';
import { BeliefSchema } from '../../neo4j/schemas/belief.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class BeliefService {
  constructor(private readonly beliefSchema: BeliefSchema) {}

  async createBelief(beliefData: any) {
    const beliefWithId = {
      ...beliefData,
      id: uuidv4(),
    };
    return this.beliefSchema.createBelief(beliefWithId);
  }

  async getBelief(id: string) {
    return this.beliefSchema.getBelief(id);
  }

  async updateBelief(id: string, updateData: any) {
    return this.beliefSchema.updateBelief(id, updateData);
  }

  async deleteBelief(id: string) {
    return this.beliefSchema.deleteBelief(id);
  }

  async setVisibilityStatus(id: string, isVisible: boolean) {
    return this.beliefSchema.setVisibilityStatus(id, isVisible);
  }

  async getVisibilityStatus(id: string) {
    return this.beliefSchema.getVisibilityStatus(id);
  }
}
