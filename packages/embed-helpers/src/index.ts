import axios from 'axios';

export interface ContextualHint {
  id: string;
  title: string;
  content: string;
  confidence: number;
  language: string;
}

export interface EmbedClient {
  searchContextualHints: (query: string, language?: string) => Promise<ContextualHint[]>;
  deduplicateDocument: (text: string, collection: string) => Promise<boolean>;
  mapOCRField: (ocrText: string, formFields: string[]) => Promise<{ field: string; confidence: number }[]>;
  storeKnowledge: (title: string, content: string, category: string, language: string) => Promise<string>;
}

export class BmoreEmbedClient implements EmbedClient {
  private baseUrl: string;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(baseUrl: string = process.env.EMBED_SERVICE_URL || 'http://localhost:3011') {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  private getCacheKey(method: string, params: any): string {
    return `${method}:${JSON.stringify(params)}`;
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
    
    // Simple cache cleanup - remove entries older than timeout
    if (this.cache.size > 1000) {
      const now = Date.now();
      for (const [k, v] of this.cache.entries()) {
        if (now - v.timestamp > this.cacheTimeout) {
          this.cache.delete(k);
        }
      }
    }
  }

  async searchContextualHints(query: string, language: string = 'en'): Promise<ContextualHint[]> {
    const cacheKey = this.getCacheKey('searchContextualHints', { query, language });
    const cached = this.getFromCache<ContextualHint[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await axios.post(`${this.baseUrl}/api/rag`, {
        query,
        language,
        category: 'field-help',
        topK: 3
      });

      const hints: ContextualHint[] = response.data.sources.map((source: any, index: number) => ({
        id: source.id,
        title: source.title,
        content: source.content,
        confidence: Math.max(0, response.data.confidence - (index * 0.1)),
        language: source.language || language
      }));

      this.setCache(cacheKey, hints);
      return hints;
    } catch (error) {
      console.error('Failed to search contextual hints:', error);
      return [];
    }
  }

  async deduplicateDocument(text: string, collection: string): Promise<boolean> {
    const cacheKey = this.getCacheKey('deduplicateDocument', { text: text.slice(0, 100), collection });
    const cached = this.getFromCache<boolean>(cacheKey);
    
    if (cached !== null) {
      return cached;
    }

    try {
      const response = await axios.post(`${this.baseUrl}/api/deduplicate`, {
        text,
        collection,
        threshold: 0.9
      });

      const isDuplicate = response.data.isDuplicate;
      this.setCache(cacheKey, isDuplicate);
      return isDuplicate;
    } catch (error) {
      console.error('Failed to check for duplicates:', error);
      return false;
    }
  }

  async mapOCRField(
    ocrText: string, 
    formFields: string[]
  ): Promise<{ field: string; confidence: number }[]> {
    const cacheKey = this.getCacheKey('mapOCRField', { 
      ocrText: ocrText.slice(0, 100), 
      formFields 
    });
    const cached = this.getFromCache<{ field: string; confidence: number }[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await axios.post(`${this.baseUrl}/api/field-mapping`, {
        ocrText,
        formFields,
        confidence: 0.7
      });

      const mappings = response.data.mappings.map((mapping: any) => ({
        field: mapping.fieldName,
        confidence: mapping.confidence
      }));

      this.setCache(cacheKey, mappings);
      return mappings;
    } catch (error) {
      console.error('Failed to map OCR fields:', error);
      return [];
    }
  }

  async storeKnowledge(
    title: string,
    content: string,
    category: string,
    language: string = 'en'
  ): Promise<string> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/store`, {
        text: `${title}\n\n${content}`,
        collection: 'knowledge-base',
        language,
        metadata: {
          title,
          content,
          category,
          type: 'knowledge-entry'
        }
      });

      return response.data.id;
    } catch (error) {
      console.error('Failed to store knowledge:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/health`, {
        timeout: 5000
      });
      return response.data.status === 'healthy';
    } catch (error) {
      return false;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// Form.io integration helpers
export interface FormioFieldEnhancer {
  enhanceField: (component: any, language?: string) => Promise<any>;
  addContextualHelp: (component: any, hints: ContextualHint[]) => any;
}

export class BmoreFormioEnhancer implements FormioFieldEnhancer {
  private embedClient: EmbedClient;

  constructor(embedClient: EmbedClient) {
    this.embedClient = embedClient;
  }

  async enhanceField(component: any, language: string = 'en'): Promise<any> {
    if (!component.key || !component.label) {
      return component;
    }

    // Generate search query from field properties
    const query = `${component.label} ${component.description || ''} ${component.placeholder || ''}`.trim();
    
    if (!query || query.length < 3) {
      return component;
    }

    try {
      const hints = await this.embedClient.searchContextualHints(query, language);
      
      if (hints.length > 0) {
        return this.addContextualHelp(component, hints);
      }
    } catch (error) {
      console.warn('Failed to enhance field with contextual hints:', error);
    }

    return component;
  }

  addContextualHelp(component: any, hints: ContextualHint[]): any {
    const topHint = hints[0];
    
    if (!topHint || topHint.confidence < 0.5) {
      return component;
    }

    // Add tooltip with contextual help
    const enhancedComponent = {
      ...component,
      tooltip: topHint.content.length > 200 
        ? `${topHint.content.substring(0, 200)}...` 
        : topHint.content,
      
      // Add custom properties for frontend rendering
      contextualHelp: {
        hints,
        primaryHint: topHint,
        hasHelp: true
      }
    };

    // Add description if not already present
    if (!component.description && topHint.content.length <= 100) {
      enhancedComponent.description = topHint.content;
    }

    return enhancedComponent;
  }
}

// OCR enhancement helpers
export class BmoreOCREnhancer {
  private embedClient: EmbedClient;

  constructor(embedClient: EmbedClient) {
    this.embedClient = embedClient;
  }

  async enhanceOCRResults(
    ocrResults: Array<{ text: string; confidence: number }>,
    formSchema: any
  ): Promise<Array<{ text: string; confidence: number; suggestedField?: string; mappingConfidence?: number }>> {
    if (!formSchema.components || !Array.isArray(formSchema.components)) {
      return ocrResults;
    }

    // Extract field labels/keys from form schema
    const formFields = this.extractFormFields(formSchema.components);
    
    if (formFields.length === 0) {
      return ocrResults;
    }

    const enhancedResults = [];
    
    for (const result of ocrResults) {
      if (result.text.length < 2) {
        enhancedResults.push(result);
        continue;
      }

      try {
        const mappings = await this.embedClient.mapOCRField(result.text, formFields);
        
        if (mappings.length > 0 && mappings[0].confidence > 0.7) {
          enhancedResults.push({
            ...result,
            suggestedField: mappings[0].field,
            mappingConfidence: mappings[0].confidence
          });
        } else {
          enhancedResults.push(result);
        }
      } catch (error) {
        console.warn('Failed to enhance OCR result:', error);
        enhancedResults.push(result);
      }
    }

    return enhancedResults;
  }

  private extractFormFields(components: any[]): string[] {
    const fields: string[] = [];
    
    const traverse = (comps: any[]) => {
      for (const comp of comps) {
        if (comp.key && comp.label) {
          fields.push(`${comp.label} (${comp.key})`);
        }
        
        if (comp.components && Array.isArray(comp.components)) {
          traverse(comp.components);
        }
        
        if (comp.columns && Array.isArray(comp.columns)) {
          comp.columns.forEach((col: any) => {
            if (col.components) {
              traverse(col.components);
            }
          });
        }
      }
    };
    
    traverse(components);
    return fields;
  }
}

// Export default client instance
export const bmoreEmbedClient = new BmoreEmbedClient();
export const bmoreFormioEnhancer = new BmoreFormioEnhancer(bmoreEmbedClient);
export const bmoreOCREnhancer = new BmoreOCREnhancer(bmoreEmbedClient);