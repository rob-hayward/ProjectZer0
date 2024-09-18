import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Neo4j Connection (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/users/test (GET)', () => {
    return request(app.getHttpServer())
      .get('/users/test')
      .expect(200)
      .expect((res) => {
        expect(res.text).toContain('Connection successful');
      });
  });

  afterAll(async () => {
    await app.close();
  });
});
