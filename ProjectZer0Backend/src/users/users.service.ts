import { Injectable } from '@nestjs/common';
import { Neo4jService } from '../neo4j/neo4j.service';

@Injectable()
export class UsersService {
  constructor(private neo4jService: Neo4jService) {}

  async findOrCreateUser(auth0Id: string, email: string): Promise<any> {
    const session = this.neo4jService.getWriteSession();
    try {
      const result = await session.run(
        `
        MERGE (u:User {auth0Id: $auth0Id})
        ON CREATE SET u.email = $email, u.createdAt = datetime()
        ON MATCH SET u.lastLogin = datetime()
        RETURN u
        `,
        { auth0Id, email },
      );
      return result.records[0].get('u').properties;
    } finally {
      await session.close();
    }
  }
}
