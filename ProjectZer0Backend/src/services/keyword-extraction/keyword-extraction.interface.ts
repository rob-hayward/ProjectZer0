// Type definitions for keyword extraction

export interface KeywordWithFrequency {
  word: string;
  frequency: number;
  source: 'user' | 'ai';
}

export interface KeywordExtractionResult {
  keywords: KeywordWithFrequency[];
}

export interface KeywordExtractionRequest {
  text: string;
  userKeywords?: string[];
}

export interface ProjectZeroAIResult {
  status: string;
  processed_data?: {
    id: string;
    keyword_extraction: {
      keywords: string[];
    };
  };
}
