import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { WordSchema } from '../../neo4j/schemas/word.schema';
import { DictionaryService } from '../../dictionary/dictionary.service';
import { DiscussionService } from '../discussion/discussion.service';
import { CommentService } from '../comment/comment.service';

@Injectable()
export class WordService {
  constructor(
    private readonly wordSchema: WordSchema,
    private readonly dictionaryService: DictionaryService,
    private readonly discussionService: DiscussionService,
    private readonly commentService: CommentService,
  ) {}

  async checkWordExistence(word: string): Promise<boolean> {
    return this.wordSchema.checkWordExistence(word);
  }

  async createWord(wordData: {
    word: string;
    createdBy: string;
    definition?: string;
    discussion?: string;
    publicCredit: boolean;
  }) {
    const exists = await this.checkWordExistence(wordData.word);
    if (exists) {
      throw new HttpException('Word already exists', HttpStatus.CONFLICT);
    }

    const freeDictionaryDefinition = await this.dictionaryService.getDefinition(
      wordData.word,
    );

    // Create the word node
    const wordNode = await this.wordSchema.createWord({
      word: wordData.word,
      createdBy: wordData.createdBy,
      initialDefinition:
        wordData.definition ||
        freeDictionaryDefinition ||
        'No definition available',
      publicCredit: wordData.publicCredit,
    });

    // If user provided a definition, add it with 1 vote
    if (wordData.definition) {
      await this.wordSchema.addDefinition({
        word: wordData.word,
        createdBy: wordData.createdBy,
        definitionText: wordData.definition,
      });
      await this.wordSchema.voteWord(wordData.word, wordData.createdBy, true);
    }

    // If we got a definition from the dictionary API and it's different from the user's, add it with 0 votes
    if (
      freeDictionaryDefinition &&
      freeDictionaryDefinition !== wordData.definition
    ) {
      await this.wordSchema.addDefinition({
        word: wordData.word,
        createdBy: 'FreeDictionaryAPI',
        definitionText: freeDictionaryDefinition,
      });
    }

    // Create discussion
    const discussion = await this.discussionService.createDiscussion({
      createdBy: wordData.createdBy,
      associatedNodeId: wordNode.id,
      associatedNodeType: 'WordNode',
    });

    // Update word with discussion ID
    await this.wordSchema.updateWordWithDiscussionId(
      wordNode.id,
      discussion.id,
    );

    // Add initial comment if provided
    if (wordData.discussion) {
      await this.commentService.createComment({
        createdBy: wordData.createdBy,
        discussionId: discussion.id,
        commentText: wordData.discussion,
      });
    }

    // Fetch the complete word node with all related data
    return this.getWord(wordData.word);
  }

  async getWord(word: string) {
    const wordNode = await this.wordSchema.getWord(word);
    if (!wordNode) return null;

    // Fetch associated discussion and comments
    if (wordNode.discussionId) {
      const discussion = await this.discussionService.getDiscussion(
        wordNode.discussionId,
      );
      if (discussion) {
        const comments = await this.commentService.getCommentsByDiscussionId(
          discussion.id,
        );
        discussion.comments = comments;
      }
      wordNode.discussion = discussion;
    }

    return wordNode;
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
