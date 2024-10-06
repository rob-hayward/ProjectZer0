// src/nodes/word/word.service.ts

import { Injectable } from '@nestjs/common';
import { WordSchema } from '../../neo4j/schemas/word.schema';

@Injectable()
export class WordService {
  constructor(private readonly wordSchema: WordSchema) {}

  async checkWordExistence(word: string): Promise<boolean> {
    return this.wordSchema.checkWordExistence(word);
  }

  async createWord(wordData: any) {
    return this.wordSchema.createWord(wordData);
  }

  async getWord(word: string) {
    return this.wordSchema.getWord(word);
  }

  async updateWord(word: string, updateData: any) {
    return this.wordSchema.updateWord(word, updateData);
  }

  async deleteWord(word: string) {
    return this.wordSchema.deleteWord(word);
  }

  async voteWord(word: string, userId: string, isPositive: boolean) {
    return this.wordSchema.voteWord(word, userId, isPositive);
  }

  async getWordVotes(word: string) {
    return this.wordSchema.getWordVotes(word);
  }
}
