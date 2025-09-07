import { Pool, PoolClient } from 'pg';
import pino from 'pino';
import { StoredEmbedding, SearchRequest, SearchResponse, SearchResult } from '../types';

const logger = pino({ name: 'VectorStoreService' });

export class VectorStoreService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.POSTGRES_URL || 'postgresql://postgres:postgres@localhost:5432/bmore_vectors',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.initializeDatabase();
  }

  private async initializeDatabase() {
    try {
      const client = await this.pool.connect();
      
      // Enable pgvector extension
      await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
      
      // Create embeddings table
      await client.query(`
        CREATE TABLE IF NOT EXISTS embeddings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          text TEXT NOT NULL,
          embedding VECTOR(384), -- Default dimension for all-MiniLM-L6-v2
          metadata JSONB DEFAULT '{}',
          language VARCHAR(2) DEFAULT 'en',
          collection VARCHAR(100) DEFAULT 'default',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Create indexes for better performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_embeddings_collection 
        ON embeddings (collection);
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_embeddings_language 
        ON embeddings (language);
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_embeddings_created_at 
        ON embeddings (created_at);
      `);

      // Create vector similarity index (HNSW for approximate nearest neighbor)
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_embeddings_embedding 
        ON embeddings USING hnsw (embedding vector_cosine_ops);
      `);

      // Create knowledge base tables
      await client.query(`
        CREATE TABLE IF NOT EXISTS knowledge_base (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          category VARCHAR(100),
          language VARCHAR(2) DEFAULT 'en',
          tags TEXT[],
          url TEXT,
          embedding VECTOR(384),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_knowledge_category_language 
        ON knowledge_base (category, language);
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_knowledge_embedding 
        ON knowledge_base USING hnsw (embedding vector_cosine_ops);
      `);

      client.release();
      logger.info('Vector database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize vector database:', error);
      throw error;
    }
  }

  async store(embedding: StoredEmbedding): Promise<string> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO embeddings (text, embedding, metadata, language, collection)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `;
      
      const values = [
        embedding.text,
        `[${embedding.embedding.join(',')}]`, // Convert array to vector format
        JSON.stringify(embedding.metadata),
        embedding.language,
        embedding.collection
      ];

      const result = await client.query(query, values);
      const id = result.rows[0].id;
      
      logger.info(`Stored embedding with ID: ${id}`);
      return id;
    } catch (error) {
      logger.error('Failed to store embedding:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async batchStore(embeddings: StoredEmbedding[]): Promise<string[]> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      const ids: string[] = [];
      
      for (const embedding of embeddings) {
        const query = `
          INSERT INTO embeddings (text, embedding, metadata, language, collection)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `;
        
        const values = [
          embedding.text,
          `[${embedding.embedding.join(',')}]`,
          JSON.stringify(embedding.metadata),
          embedding.language,
          embedding.collection
        ];

        const result = await client.query(query, values);
        ids.push(result.rows[0].id);
      }
      
      await client.query('COMMIT');
      logger.info(`Batch stored ${ids.length} embeddings`);
      return ids;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to batch store embeddings:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async search(request: SearchRequest, queryEmbedding: number[]): Promise<SearchResponse> {
    const startTime = Date.now();
    const client = await this.pool.connect();
    
    try {
      const topK = request.topK || 10;
      const threshold = request.threshold || 0.5;
      const collection = request.collection || 'default';
      
      let query = `
        SELECT 
          id,
          text,
          metadata,
          language,
          1 - (embedding <=> $1) as similarity
        FROM embeddings
        WHERE collection = $2
        AND 1 - (embedding <=> $1) >= $3
      `;
      
      const values: any[] = [
        `[${queryEmbedding.join(',')}]`,
        collection,
        threshold
      ];

      // Add language filter if specified
      if (request.language) {
        query += ` AND language = $${values.length + 1}`;
        values.push(request.language);
      }

      // Add metadata filters
      if (request.filters) {
        Object.entries(request.filters).forEach(([key, value]) => {
          query += ` AND metadata->>'${key}' = $${values.length + 1}`;
          values.push(value);
        });
      }

      query += ` ORDER BY similarity DESC LIMIT $${values.length + 1}`;
      values.push(topK);

      const result = await client.query(query, values);
      
      const results: SearchResult[] = result.rows.map(row => ({
        id: row.id,
        text: row.text,
        score: row.similarity,
        metadata: row.metadata
      }));

      const response: SearchResponse = {
        results,
        query: request.query,
        count: results.length,
        took: Date.now() - startTime
      };

      logger.info(`Vector search completed in ${response.took}ms, found ${response.count} results`);
      return response;
    } catch (error) {
      logger.error('Vector search failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async findDuplicates(
    embedding: number[], 
    collection: string = 'default', 
    threshold: number = 0.9
  ): Promise<SearchResult[]> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT 
          id,
          text,
          metadata,
          language,
          1 - (embedding <=> $1) as similarity
        FROM embeddings
        WHERE collection = $2
        AND 1 - (embedding <=> $1) >= $3
        ORDER BY similarity DESC
        LIMIT 10
      `;

      const values = [
        `[${embedding.join(',')}]`,
        collection,
        threshold
      ];

      const result = await client.query(query, values);
      
      return result.rows.map(row => ({
        id: row.id,
        text: row.text,
        score: row.similarity,
        metadata: row.metadata
      }));
    } catch (error) {
      logger.error('Duplicate search failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async storeKnowledgeBase(
    title: string,
    content: string,
    category: string,
    language: string,
    embedding: number[],
    tags: string[] = [],
    url?: string
  ): Promise<string> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO knowledge_base (title, content, category, language, embedding, tags, url)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `;
      
      const values = [
        title,
        content,
        category,
        language,
        `[${embedding.join(',')}]`,
        tags,
        url
      ];

      const result = await client.query(query, values);
      const id = result.rows[0].id;
      
      logger.info(`Stored knowledge base entry with ID: ${id}`);
      return id;
    } catch (error) {
      logger.error('Failed to store knowledge base entry:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async searchKnowledgeBase(
    queryEmbedding: number[],
    language?: string,
    category?: string,
    topK: number = 5
  ) {
    const client = await this.pool.connect();
    
    try {
      let query = `
        SELECT 
          id,
          title,
          content,
          category,
          language,
          tags,
          url,
          1 - (embedding <=> $1) as similarity
        FROM knowledge_base
        WHERE 1 = 1
      `;
      
      const values: any[] = [`[${queryEmbedding.join(',')}]`];

      if (language) {
        query += ` AND language = $${values.length + 1}`;
        values.push(language);
      }

      if (category) {
        query += ` AND category = $${values.length + 1}`;
        values.push(category);
      }

      query += ` ORDER BY similarity DESC LIMIT $${values.length + 1}`;
      values.push(topK);

      const result = await client.query(query, values);
      return result.rows;
    } catch (error) {
      logger.error('Knowledge base search failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getStats() {
    const client = await this.pool.connect();
    
    try {
      const embeddingStats = await client.query(`
        SELECT 
          collection,
          language,
          COUNT(*) as count
        FROM embeddings 
        GROUP BY collection, language
      `);

      const knowledgeStats = await client.query(`
        SELECT 
          category,
          language,
          COUNT(*) as count
        FROM knowledge_base 
        GROUP BY category, language
      `);

      return {
        embeddings: embeddingStats.rows,
        knowledge: knowledgeStats.rows
      };
    } catch (error) {
      logger.error('Failed to get stats:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
    logger.info('Vector store connection closed');
  }
}