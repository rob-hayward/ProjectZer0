import { Injectable } from '@nestjs/common';
import { DefinitionSchema } from '../../neo4j/schemas/definition.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DefinitionService {
  constructor(private readonly definitionSchema: DefinitionSchema) {}

  async createDefinition(definitionData: {
    word: string;
    createdBy: string;
    definitionText: string;
  }) {
    const definitionWithId = {
      ...definitionData,
      id: uuidv4(),
    };
    return this.definitionSchema.createDefinition(definitionWithId);
  }

  async getDefinition(id: string) {
    return this.definitionSchema.getDefinition(id);
  }

  async updateDefinition(id: string, updateData: { definitionText: string }) {
    return this.definitionSchema.updateDefinition(id, updateData);
  }

  async deleteDefinition(id: string) {
    return this.definitionSchema.deleteDefinition(id);
  }

  async setVisibilityStatus(id: string, isVisible: boolean) {
    return this.definitionSchema.setVisibilityStatus(id, isVisible);
  }

  async getVisibilityStatus(id: string) {
    return this.definitionSchema.getVisibilityStatus(id);
  }
}
