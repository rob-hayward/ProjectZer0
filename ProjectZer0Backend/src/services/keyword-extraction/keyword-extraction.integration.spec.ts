import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KeywordExtractionService } from './keyword-extraction.service';
import keywordExtractionConfig from './keyword-extraction.config';
import * as fs from 'fs';
import * as path from 'path';

// This test requires the ProjectZeroAI service to be running
// Skip this test with 'SKIP_INTEGRATION=true jest' if the service is not available
const skipIfNoService =
  process.env.SKIP_INTEGRATION === 'true' ? describe.skip : describe;

skipIfNoService('KeywordExtractionService Integration', () => {
  let service: KeywordExtractionService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [keywordExtractionConfig],
        }),
      ],
      providers: [KeywordExtractionService, ConfigService],
    }).compile();

    service = module.get<KeywordExtractionService>(KeywordExtractionService);
  });

  it('should extract keywords from real text', async () => {
    // Create test data directory if it doesn't exist
    const testOutputDir = path.join(__dirname, 'test-outputs');
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }

    const testText = `
      Statement nodes represent the core content type of ProjectZero - user-created statements 
      that express viewpoints, claims, or ideas. They serve as the primary nodes in the 
      knowledge graph, connecting related concepts through shared keywords. 
      Statement nodes are the "beating heart" of ProjectZero, serving essential functions.
    `;

    const userKeywords = ['statement', 'knowledge graph', 'core concept'];

    try {
      // Actual API call
      const result = await service.extractKeywords({
        text: testText,
        userKeywords,
      });

      // Log detailed results for inspection
      const outputPath = path.join(testOutputDir, 'extraction-result.json');
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

      console.log(`Results saved to: ${outputPath}`);

      // Basic verification
      expect(result).toBeDefined();
      expect(result.keywords).toBeDefined();
      expect(result.keywords.length).toBeGreaterThan(0);

      // Check if user keywords are included
      const userKeywordsFound = userKeywords.every((keyword) =>
        result.keywords.some(
          (k) => k.word === keyword.toLowerCase() && k.source === 'user',
        ),
      );
      expect(userKeywordsFound).toBe(true);

      // Verify some AI keywords were extracted
      const aiKeywordsCount = result.keywords.filter(
        (k) => k.source === 'ai',
      ).length;
      expect(aiKeywordsCount).toBeGreaterThan(0);
    } catch (error) {
      // Provide helpful error message if service is not running
      if (error.code === 'ECONNREFUSED') {
        console.error(`
          ❌ Integration test failed: Cannot connect to ProjectZeroAI service
          Make sure the service is running at the configured URL
          To skip this test, use: SKIP_INTEGRATION=true npm test
        `);
      }
      throw error;
    }
  }, 30000); // Increase timeout to 30 seconds for API call
});
