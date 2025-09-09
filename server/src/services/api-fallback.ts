import axios from 'axios';

export interface APIFallbackOptions {
  primaryURL: string;
  fallbackURLs: string[];
  timeout: number;
  retries: number;
}

export class APIFallbackClient {
  private options: APIFallbackOptions;

  constructor(options: APIFallbackOptions) {
    this.options = options;
  }

  async get(endpoint: string): Promise<any> {
    const urls = [this.options.primaryURL, ...this.options.fallbackURLs];
    
    for (let urlIndex = 0; urlIndex < urls.length; urlIndex++) {
      const baseURL = urls[urlIndex];
      
      for (let retry = 0; retry < this.options.retries; retry++) {
        try {
          const response = await axios.get(`${baseURL}${endpoint}`, {
            timeout: this.options.timeout,
          });
          
          if (urlIndex > 0) {
            console.info(`Successfully used fallback API: ${baseURL}`);
          }
          
          return response;
        } catch (error) {
          const isLastRetry = retry === this.options.retries - 1;
          const isLastURL = urlIndex === urls.length - 1;
          
          if (isLastRetry && isLastURL) {
            throw error;
          }
          
          if (isLastRetry) {
            console.warn(`API ${baseURL} failed after ${this.options.retries} retries, trying next fallback`);
            break;
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1)));
        }
      }
    }
    
    throw new Error('All API endpoints failed');
  }
}