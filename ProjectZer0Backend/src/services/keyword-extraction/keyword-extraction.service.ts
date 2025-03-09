import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { processTextAsync, getResult } from '../projectZeroAIClient';
import {
  KeywordExtractionRequest,
  KeywordExtractionResult,
  KeywordWithFrequency,
  ProjectZeroAIResult,
} from './keyword-extraction.interface';

@Injectable()
export class KeywordExtractionService {
  private readonly logger = new Logger(KeywordExtractionService.name);
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly defaultFrequency: number;
  private readonly userKeywordWeight: number;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'keyword-extraction.projectZeroAIUrl',
    );
    this.maxRetries = this.configService.get<number>(
      'keyword-extraction.maxRetries',
    );
    this.retryDelay = this.configService.get<number>(
      'keyword-extraction.retryDelay',
    );
    this.defaultFrequency = this.configService.get<number>(
      'keyword-extraction.defaultFrequency',
    );
    this.userKeywordWeight = this.configService.get<number>(
      'keyword-extraction.userKeywordWeight',
    );
  }

  async extractKeywords(
    request: KeywordExtractionRequest,
  ): Promise<KeywordExtractionResult> {
    try {
      this.logger.log(
        `Extracting keywords from text: ${request.text.substring(0, 50)}...`,
      );

      // Start asynchronous processing
      const asyncResult = await processTextAsync(request.text);
      const taskId = asyncResult.task_id;
      this.logger.log(`Processing started with task ID: ${taskId}`);

      // Poll for results with retries
      let result: ProjectZeroAIResult;
      let retries = 0;

      while (retries < this.maxRetries) {
        await this.delay(this.retryDelay);

        result = await getResult(taskId);

        if (result.status === 'completed' && result.processed_data) {
          this.logger.log(`Keyword extraction completed for task ${taskId}`);
          break;
        }

        this.logger.log(
          `Task ${taskId} still processing, retry ${retries + 1}/${this.maxRetries}`,
        );
        retries++;
      }

      if (!result || result.status !== 'completed' || !result.processed_data) {
        throw new Error(
          `Failed to extract keywords after ${this.maxRetries} retries`,
        );
      }

      // Process AI keywords
      const aiKeywords = result.processed_data.keyword_extraction.keywords.map(
        (keyword) => ({
          word: keyword.toLowerCase(),
          frequency: this.defaultFrequency,
          source: 'ai' as const,
        }),
      );

      // Process user keywords if provided
      const userKeywords = request.userKeywords
        ? request.userKeywords.map((keyword) => ({
            word: keyword.toLowerCase(),
            frequency: this.userKeywordWeight, // User keywords given higher weight as requested
            source: 'user' as const,
          }))
        : [];

      // Merge keywords, prioritizing user keywords and combining frequencies
      const mergedKeywords = this.mergeKeywords([
        ...aiKeywords,
        ...userKeywords,
      ]);

      return { keywords: mergedKeywords };
    } catch (error) {
      this.logger.error(
        `Error extracting keywords: ${error.message}`,
        error.stack,
      );
      throw new Error(`Keyword extraction failed: ${error.message}`);
    }
  }

  private mergeKeywords(
    keywords: KeywordWithFrequency[],
  ): KeywordWithFrequency[] {
    const keywordMap = new Map<string, KeywordWithFrequency>();

    for (const keyword of keywords) {
      const existing = keywordMap.get(keyword.word);

      if (existing) {
        // Combine frequencies to track occurrence count
        existing.frequency += keyword.frequency;

        // Always prefer user-submitted source
        if (keyword.source === 'user') {
          existing.source = 'user';
        }
      } else {
        keywordMap.set(keyword.word, { ...keyword });
      }
    }

    return Array.from(keywordMap.values());
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
