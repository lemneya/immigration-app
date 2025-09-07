export interface EmbeddingRequest {
  text: string;
  model?: string;
  dimensions?: number;
  language?: 'en' | 'es' | 'ar' | 'fr';
  metadata?: Record<string, any>;
}

export interface BatchEmbeddingRequest {
  texts: string[];
  model?: string;
  dimensions?: number;
  language?: 'en' | 'es' | 'ar' | 'fr';
  metadata?: Record<string, any>[];
}

export interface EmbeddingResponse {
  embedding: number[];
  dimensions: number;
  model: string;
  text: string;
  metadata?: Record<string, any>;
}

export interface BatchEmbeddingResponse {
  embeddings: EmbeddingResponse[];
  model: string;
  dimensions: number;
  count: number;
}

export interface SearchRequest {
  query: string;
  topK?: number;
  threshold?: number;
  language?: 'en' | 'es' | 'ar' | 'fr';
  collection?: string;
  filters?: Record<string, any>;
}

export interface SearchResult {
  id: string;
  text: string;
  score: number;
  metadata?: Record<string, any>;
  embedding?: number[];
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  count: number;
  took: number;
}

export interface StoredEmbedding {
  id: string;
  text: string;
  embedding: number[];
  metadata: Record<string, any>;
  language: string;
  collection: string;
  created_at: Date;
  updated_at: Date;
}

export interface DeduplicationRequest {
  text: string;
  collection: string;
  threshold?: number;
  language?: 'en' | 'es' | 'ar' | 'fr';
}

export interface DeduplicationResponse {
  isDuplicate: boolean;
  duplicates: SearchResult[];
  confidence: number;
}

export interface FieldMappingRequest {
  ocrText: string;
  formFields: string[];
  confidence?: number;
  language?: 'en' | 'es' | 'ar' | 'fr';
}

export interface FieldMappingResponse {
  mappings: {
    ocrText: string;
    fieldName: string;
    confidence: number;
  }[];
}

export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  language: string;
  tags: string[];
  url?: string;
}

export interface RAGRequest {
  query: string;
  language?: 'en' | 'es' | 'ar' | 'fr';
  category?: string;
  topK?: number;
}

export interface RAGResponse {
  answer: string;
  sources: KnowledgeEntry[];
  confidence: number;
}