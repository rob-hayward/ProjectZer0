import axios from 'axios';

const BASE_URL = process.env.PROJECT_ZERO_AI_URL || 'http://localhost:5001';

export async function testConnection() {
  try {
    const response = await axios.get(`${BASE_URL}/`);
    return response.data;
  } catch (error) {
    console.error('Error connecting to FastAPI:', error);
    throw error;
  }
}

export async function processText(content: string) {
  try {
    const response = await axios.post(`${BASE_URL}/process_text`, {
      id: Date.now().toString(),
      data: content,
    });
    return response.data;
  } catch (error) {
    console.error('Error processing text:', error);
    throw error;
  }
}

export async function processTextAsync(content: string) {
  try {
    const response = await axios.post(`${BASE_URL}/process_text_async`, {
      id: Date.now().toString(),
      data: content,
    });
    return response.data;
  } catch (error) {
    console.error('Error processing text asynchronously:', error);
    throw error;
  }
}

export async function getResult(taskId: string) {
  try {
    const response = await axios.get(`${BASE_URL}/get_result/${taskId}`);
    return response.data;
  } catch (error) {
    console.error('Error getting result:', error);
    throw error;
  }
}
