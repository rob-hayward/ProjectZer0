import { registerAs } from '@nestjs/config';

export default registerAs('keyword-extraction', () => ({
  projectZeroAIUrl: process.env.PROJECT_ZERO_AI_URL || 'http://localhost:5001',
  maxRetries: parseInt(process.env.KEYWORD_EXTRACTION_MAX_RETRIES || '3', 10),
  retryDelay: parseInt(
    process.env.KEYWORD_EXTRACTION_RETRY_DELAY || '1000',
    10,
  ),
  defaultFrequency: parseInt(process.env.KEYWORD_DEFAULT_FREQUENCY || '1', 10),
  userKeywordWeight: parseInt(process.env.USER_KEYWORD_WEIGHT || '2', 10),
}));
