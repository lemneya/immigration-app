import { pipeline, Pipeline, env } from '@xenova/transformers';
import NodeCache from 'node-cache';
import pino from 'pino';
import { EmbeddingRequest, BatchEmbeddingRequest, EmbeddingResponse, BatchEmbeddingResponse } from '../types';

const logger = pino({ name: 'GemmaEmbeddingService' });

export class GemmaEmbeddingService {
  private model: Pipeline | null = null;
  private cache: NodeCache;
  private modelName: string;
  private isLoading = false;
  private loadingPromise: Promise<Pipeline> | null = null;

  constructor() {
    // Use Gemma embeddings model - fallback to multilingual if not available
    this.modelName = process.env.GEMMA_MODEL || 'Xenova/all-MiniLM-L6-v2';
    
    // Cache embeddings for 1 hour
    this.cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });
    
    // Configure transformers to use local models when available
    env.allowLocalModels = true;
    env.allowRemoteModels = true;
  }

  private async loadModel(): Promise<Pipeline> {
    if (this.model) return this.model;
    
    if (this.isLoading && this.loadingPromise) {
      return this.loadingPromise;
    }

    this.isLoading = true;
    logger.info(`Loading embedding model: ${this.modelName}`);
    
    try {
      this.loadingPromise = pipeline('feature-extraction', this.modelName, {
        quantized: true, // Use quantized model for better performance
        device: 'cpu',   // Use CPU for better compatibility
      });
      
      this.model = await this.loadingPromise;
      logger.info('Embedding model loaded successfully');
      return this.model;
    } catch (error) {
      logger.error('Failed to load embedding model:', error);
      throw new Error('Failed to initialize embedding model');
    } finally {
      this.isLoading = false;
      this.loadingPromise = null;
    }
  }

  private getCacheKey(text: string, dimensions?: number): string {
    return `embed:${dimensions || 'default'}:${Buffer.from(text).toString('base64').slice(0, 32)}`;
  }

  private async generateEmbedding(text: string, dimensions?: number): Promise<number[]> {
    const cacheKey = this.getCacheKey(text, dimensions);
    const cached = this.cache.get<number[]>(cacheKey);
    
    if (cached) {
      logger.debug('Cache hit for embedding');
      return cached;
    }

    const model = await this.loadModel();
    
    try {
      // Generate embedding
      const output = await model(text, { pooling: 'mean', normalize: true });
      let embedding = Array.from(output.data as Float32Array);
      
      // Apply Matryoshka dimension truncation if specified
      if (dimensions && dimensions < embedding.length) {
        embedding = embedding.slice(0, dimensions);
        // Re-normalize after truncation
        const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        embedding = embedding.map(val => val / norm);
      }
      
      // Cache the result
      this.cache.set(cacheKey, embedding);
      
      return embedding;
    } catch (error) {
      logger.error('Failed to generate embedding:', error);
      throw new Error('Embedding generation failed');
    }
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const startTime = Date.now();
    
    try {
      const embedding = await this.generateEmbedding(request.text, request.dimensions);
      
      const response: EmbeddingResponse = {
        embedding,
        dimensions: embedding.length,
        model: this.modelName,
        text: request.text,
        metadata: request.metadata
      };
      
      logger.info(`Generated embedding in ${Date.now() - startTime}ms`);
      return response;
    } catch (error) {
      logger.error('Embedding request failed:', error);
      throw error;
    }
  }

  async batchEmbed(request: BatchEmbeddingRequest): Promise<BatchEmbeddingResponse> {
    const startTime = Date.now();
    
    try {
      const embeddings = await Promise.all(
        request.texts.map(async (text, index) => {
          const embedding = await this.generateEmbedding(text, request.dimensions);
          return {
            embedding,
            dimensions: embedding.length,
            model: this.modelName,
            text,
            metadata: request.metadata?.[index]
          };
        })
      );

      const response: BatchEmbeddingResponse = {
        embeddings,
        model: this.modelName,
        dimensions: embeddings[0]?.dimensions || 0,
        count: embeddings.length
      };
      
      logger.info(`Generated ${embeddings.length} embeddings in ${Date.now() - startTime}ms`);
      return response;
    } catch (error) {
      logger.error('Batch embedding request failed:', error);
      throw error;
    }
  }

  async similarity(text1: string, text2: string): Promise<number> {
    const [embedding1, embedding2] = await Promise.all([
      this.generateEmbedding(text1),
      this.generateEmbedding(text2)
    ]);

    // Cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  getCacheStats() {
    return {
      keys: this.cache.keys().length,
      hits: this.cache.getStats().hits,
      misses: this.cache.getStats().misses,
      model: this.modelName,
      isLoaded: this.model !== null
    };
  }

  clearCache() {
    this.cache.flushAll();
    logger.info('Embedding cache cleared');
  }
}