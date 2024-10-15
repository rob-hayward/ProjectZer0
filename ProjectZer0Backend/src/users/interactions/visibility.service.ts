import { Injectable } from '@nestjs/common';
import { InteractionSchema } from '../../neo4j/schemas/interaction.schema';

@Injectable()
export class VisibilityService {
  constructor(private readonly interactionSchema: InteractionSchema) {}

  async getObjectVisibility(
    userId: string,
    objectId: string,
    objectVisibilityStatus: boolean,
  ) {
    const userVisibilityPreference =
      await this.interactionSchema.getVisibilityPreference(userId, objectId);
    return userVisibilityPreference !== undefined
      ? userVisibilityPreference
      : objectVisibilityStatus;
  }

  async setUserVisibilityPreference(
    userId: string,
    objectId: string,
    isVisible: boolean,
  ) {
    return this.interactionSchema.setVisibilityPreference(
      userId,
      objectId,
      isVisible,
    );
  }

  async getUserVisibilityPreferences(userId: string) {
    return this.interactionSchema.getVisibilityPreferences(userId);
  }
}
