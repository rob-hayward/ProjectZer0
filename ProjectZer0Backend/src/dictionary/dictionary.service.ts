import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosError } from 'axios';

@Injectable()
export class DictionaryService {
  private readonly apiUrl = 'https://api.dictionaryapi.dev/api/v2/entries/en';

  async getDefinition(word: string): Promise<string | null> {
    try {
      const response = await axios.get(`${this.apiUrl}/${word}`);
      if (
        response.data &&
        response.data[0] &&
        response.data[0].meanings &&
        response.data[0].meanings[0] &&
        response.data[0].meanings[0].definitions
      ) {
        return response.data[0].meanings[0].definitions[0].definition;
      }
      return null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        console.error(
          `Error fetching definition for ${word}:`,
          axiosError.message,
        );
        if (axiosError.response?.status === 404) {
          return null; // Word not found in the dictionary
        }
      } else {
        console.error(
          `Unexpected error fetching definition for ${word}:`,
          error,
        );
      }
      throw new HttpException(
        'Error fetching definition from external API',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
