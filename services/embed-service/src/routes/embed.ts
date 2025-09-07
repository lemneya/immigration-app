import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { GemmaEmbeddingService } from '../services/GemmaEmbeddingService';
import { VectorStoreService } from '../services/VectorStoreService';
import { 
  EmbeddingRequest, 
  BatchEmbeddingRequest, 
  SearchRequest,
  DeduplicationRequest,
  FieldMappingRequest,
  RAGRequest
} from '../types';
import pino from 'pino';

const logger = pino({ name: 'EmbedRoutes' });
const router = Router();

// Services
const embeddingService = new GemmaEmbeddingService();
const vectorStore = new VectorStoreService();

// Validation schemas
const EmbedSchema = z.object({
  text: z.string().min(1).max(10000),
  model: z.string().optional(),
  dimensions: z.number().min(1).max(1024).optional(),
  language: z.enum(['en', 'es', 'ar', 'fr']).optional(),
  metadata: z.record(z.any()).optional()
});

const BatchEmbedSchema = z.object({
  texts: z.array(z.string().min(1).max(10000)).max(100),
  model: z.string().optional(),
  dimensions: z.number().min(1).max(1024).optional(),
  language: z.enum(['en', 'es', 'ar', 'fr']).optional(),
  metadata: z.array(z.record(z.any())).optional()
});

const SearchSchema = z.object({
  query: z.string().min(1).max(1000),
  topK: z.number().min(1).max(100).optional(),
  threshold: z.number().min(0).max(1).optional(),
  language: z.enum(['en', 'es', 'ar', 'fr']).optional(),
  collection: z.string().optional(),
  filters: z.record(z.any()).optional()
});

const DeduplicationSchema = z.object({
  text: z.string().min(1).max(10000),
  collection: z.string(),
  threshold: z.number().min(0).max(1).optional(),
  language: z.enum(['en', 'es', 'ar', 'fr']).optional()
});

const FieldMappingSchema = z.object({
  ocrText: z.string().min(1).max(10000),
  formFields: z.array(z.string()).min(1).max(100),
  confidence: z.number().min(0).max(1).optional(),
  language: z.enum(['en', 'es', 'ar', 'fr']).optional()
});

const RAGSchema = z.object({
  query: z.string().min(1).max(1000),
  language: z.enum(['en', 'es', 'ar', 'fr']).optional(),
  category: z.string().optional(),
  topK: z.number().min(1).max(20).optional()
});

// Health check
router.get('/health', (req: Request, res: Response) => {
  const stats = embeddingService.getCacheStats();
  res.json({
    status: 'healthy',
    service: 'embed-service',
    version: '1.0.0',
    model: stats.model,
    cache: {
      keys: stats.keys,
      hits: stats.hits,
      misses: stats.misses
    },
    timestamp: new Date().toISOString()
  });
});

// Generate single embedding
router.post('/embed/text', async (req: Request, res: Response) => {
  try {
    const data = EmbedSchema.parse(req.body);
    const request: EmbeddingRequest = {
      text: data.text,
      model: data.model,
      dimensions: data.dimensions,
      language: data.language,
      metadata: data.metadata
    };

    const result = await embeddingService.embed(request);
    res.json(result);
  } catch (error) {
    logger.error('Single embedding failed:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to generate embedding' });
  }
});

// Generate batch embeddings
router.post('/embed/batch', async (req: Request, res: Response) => {
  try {
    const data = BatchEmbedSchema.parse(req.body);
    const request: BatchEmbeddingRequest = {
      texts: data.texts,
      model: data.model,
      dimensions: data.dimensions,
      language: data.language,
      metadata: data.metadata
    };

    const result = await embeddingService.batchEmbed(request);
    res.json(result);
  } catch (error) {
    logger.error('Batch embedding failed:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to generate batch embeddings' });
  }
});

// Semantic search
router.post('/search', async (req: Request, res: Response) => {
  try {
    const data = SearchSchema.parse(req.body);
    const request: SearchRequest = {
      query: data.query,
      topK: data.topK,
      threshold: data.threshold,
      language: data.language,
      collection: data.collection,
      filters: data.filters
    };

    // Generate embedding for the query
    const queryEmbedding = await embeddingService.embed({ text: request.query });
    
    // Search vector store
    const result = await vectorStore.search(request, queryEmbedding.embedding);
    res.json(result);
  } catch (error) {
    logger.error('Search failed:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Search failed' });
  }
});

// Document deduplication
router.post('/deduplicate', async (req: Request, res: Response) => {
  try {
    const data = DeduplicationSchema.parse(req.body);
    
    // Generate embedding for the text
    const embedding = await embeddingService.embed({ text: data.text });
    
    // Find duplicates
    const duplicates = await vectorStore.findDuplicates(
      embedding.embedding,
      data.collection,
      data.threshold || 0.9
    );

    const response = {
      isDuplicate: duplicates.length > 0,
      duplicates,
      confidence: duplicates[0]?.score || 0
    };

    res.json(response);
  } catch (error) {
    logger.error('Deduplication failed:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Deduplication failed' });
  }
});

// OCR field mapping
router.post('/field-mapping', async (req: Request, res: Response) => {
  try {
    const data = FieldMappingSchema.parse(req.body);
    
    // Generate embedding for OCR text
    const ocrEmbedding = await embeddingService.embed({ text: data.ocrText });
    
    // Generate embeddings for form fields
    const fieldEmbeddings = await embeddingService.batchEmbed({ 
      texts: data.formFields 
    });

    // Calculate similarities and find best matches
    const mappings = [];
    for (const fieldEmbedding of fieldEmbeddings.embeddings) {
      const similarity = await embeddingService.similarity(data.ocrText, fieldEmbedding.text);
      
      if (similarity >= (data.confidence || 0.5)) {
        mappings.push({
          ocrText: data.ocrText,
          fieldName: fieldEmbedding.text,
          confidence: similarity
        });
      }
    }

    // Sort by confidence
    mappings.sort((a, b) => b.confidence - a.confidence);

    res.json({ mappings });
  } catch (error) {
    logger.error('Field mapping failed:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Field mapping failed' });
  }
});

// RAG (Retrieval Augmented Generation) query
router.post('/rag', async (req: Request, res: Response) => {
  try {
    const data = RAGSchema.parse(req.body);
    
    // Generate embedding for the query
    const queryEmbedding = await embeddingService.embed({ text: data.query });
    
    // Search knowledge base
    const results = await vectorStore.searchKnowledgeBase(
      queryEmbedding.embedding,
      data.language,
      data.category,
      data.topK || 5
    );

    // Simple RAG response - in production, this would use an LLM
    const sources = results.map(r => ({
      id: r.id,
      title: r.title,
      content: r.content,
      category: r.category,
      language: r.language,
      tags: r.tags,
      url: r.url
    }));

    const answer = sources.length > 0 
      ? `Based on the available information: ${sources[0].content.substring(0, 500)}...`
      : "I couldn't find relevant information for your query.";

    res.json({
      answer,
      sources,
      confidence: results[0]?.similarity || 0
    });
  } catch (error) {
    logger.error('RAG query failed:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'RAG query failed' });
  }
});

// Store embedding
router.post('/store', async (req: Request, res: Response) => {
  try {
    const { text, collection = 'default', language = 'en', metadata = {} } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Generate embedding
    const embedding = await embeddingService.embed({ text });
    
    // Store in vector database
    const id = await vectorStore.store({
      id: '', // Will be generated by database
      text,
      embedding: embedding.embedding,
      metadata,
      language,
      collection,
      created_at: new Date(),
      updated_at: new Date()
    });

    res.json({ id, stored: true });
  } catch (error) {
    logger.error('Store failed:', error);
    res.status(500).json({ error: 'Failed to store embedding' });
  }
});

// Get service statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const cacheStats = embeddingService.getCacheStats();
    const dbStats = await vectorStore.getStats();

    res.json({
      cache: cacheStats,
      database: dbStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Stats failed:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Clear cache
router.post('/cache/clear', (req: Request, res: Response) => {
  try {
    embeddingService.clearCache();
    res.json({ cleared: true, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Cache clear failed:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

export default router;