import { Injectable } from '@nestjs/common';
import { StatementSchema } from '../../neo4j/schemas/statement.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StatementService {
  constructor(private readonly statementSchema: StatementSchema) {}

  async createStatement(statementData: any) {
    const statementWithId = {
      ...statementData,
      id: uuidv4(),
    };
    return this.statementSchema.createStatement(statementWithId);
  }

  async getStatement(id: string) {
    return this.statementSchema.getStatement(id);
  }

  async updateStatement(id: string, updateData: any) {
    return this.statementSchema.updateStatement(id, updateData);
  }

  async deleteStatement(id: string) {
    return this.statementSchema.deleteStatement(id);
  }

  async setVisibilityStatus(id: string, isVisible: boolean) {
    return this.statementSchema.setVisibilityStatus(id, isVisible);
  }

  async getVisibilityStatus(id: string) {
    return this.statementSchema.getVisibilityStatus(id);
  }
}
