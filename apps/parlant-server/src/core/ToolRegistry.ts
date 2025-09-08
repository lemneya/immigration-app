import axios from 'axios';
import { logger } from '../utils/logger';

interface ToolDefinition {
  name: string;
  description: string;
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  parameters: Record<string, ToolParameter>;
  authentication?: {
    type: 'bearer' | 'apikey' | 'basic';
    token?: string;
    header?: string;
  };
  timeout?: number;
  retries?: number;
}

interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'file';
  required: boolean;
  description?: string;
  enum?: string[];
  default?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

interface ToolCall {
  tool: string;
  parameters: Record<string, any>;
  context?: any;
}

interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    executionTime: number;
    endpoint: string;
    retries: number;
  };
}

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  constructor() {
    this.initializeDefaultTools();
  }

  private async initializeDefaultTools() {
    // This method is called from ConversationEngine
    // Tools are registered there to avoid circular dependencies
  }

  async registerTool(tool: ToolDefinition): Promise<void> {
    // Validate tool definition
    this.validateToolDefinition(tool);
    
    this.tools.set(tool.name, tool);
    logger.info(`Registered tool: ${tool.name}`);
  }

  async callTool(toolCall: ToolCall): Promise<ToolResult> {
    const startTime = Date.now();
    const tool = this.tools.get(toolCall.tool);
    
    if (!tool) {
      return {
        success: false,
        error: `Tool '${toolCall.tool}' not found`,
        metadata: {
          executionTime: Date.now() - startTime,
          endpoint: 'unknown',
          retries: 0
        }
      };
    }

    try {
      // Validate parameters
      const validationResult = this.validateParameters(tool, toolCall.parameters);
      if (!validationResult.valid) {
        return {
          success: false,
          error: `Parameter validation failed: ${validationResult.errors.join(', ')}`,
          metadata: {
            executionTime: Date.now() - startTime,
            endpoint: tool.endpoint,
            retries: 0
          }
        };
      }

      // Execute tool call with retries
      const result = await this.executeWithRetries(tool, toolCall.parameters, tool.retries || 2);
      
      return {
        success: true,
        data: result,
        metadata: {
          executionTime: Date.now() - startTime,
          endpoint: tool.endpoint,
          retries: tool.retries || 0
        }
      };

    } catch (error) {
      logger.error(`Tool execution failed for ${toolCall.tool}:`, error);
      
      return {
        success: false,
        error: error.message || 'Tool execution failed',
        metadata: {
          executionTime: Date.now() - startTime,
          endpoint: tool.endpoint,
          retries: tool.retries || 0
        }
      };
    }
  }

  private async executeWithRetries(
    tool: ToolDefinition, 
    parameters: Record<string, any>, 
    maxRetries: number
  ): Promise<any> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.executeToolCall(tool, parameters);
        return result;
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          logger.warn(`Tool ${tool.name} failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
        }
      }
    }
    
    throw lastError;
  }

  private async executeToolCall(tool: ToolDefinition, parameters: Record<string, any>): Promise<any> {
    const config: any = {
      method: tool.method || 'POST',
      url: tool.endpoint,
      timeout: tool.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Parlant-Immigration-Suite/1.0'
      }
    };

    // Add authentication
    if (tool.authentication) {
      switch (tool.authentication.type) {
        case 'bearer':
          config.headers.Authorization = `Bearer ${tool.authentication.token}`;
          break;
        case 'apikey':
          config.headers[tool.authentication.header || 'X-API-Key'] = tool.authentication.token;
          break;
      }
    }

    // Handle different HTTP methods
    if (config.method === 'GET') {
      config.params = parameters;
    } else {
      // Handle file uploads
      const hasFiles = Object.values(parameters).some(param => 
        param && typeof param === 'object' && param.buffer
      );

      if (hasFiles) {
        const FormData = require('form-data');
        const formData = new FormData();
        
        Object.entries(parameters).forEach(([key, value]) => {
          if (value && typeof value === 'object' && value.buffer) {
            formData.append(key, value.buffer, value.originalname || 'file');
          } else {
            formData.append(key, value);
          }
        });
        
        config.data = formData;
        config.headers = { ...config.headers, ...formData.getHeaders() };
      } else {
        config.data = parameters;
      }
    }

    const response = await axios(config);
    
    // Handle different response formats
    if (response.data.success !== undefined) {
      if (response.data.success) {
        return response.data.data || response.data;
      } else {
        throw new Error(response.data.error || 'Tool returned unsuccessful result');
      }
    }
    
    return response.data;
  }

  private validateToolDefinition(tool: ToolDefinition): void {
    if (!tool.name || !tool.endpoint) {
      throw new Error('Tool must have name and endpoint');
    }
    
    if (!tool.parameters || typeof tool.parameters !== 'object') {
      throw new Error('Tool must have parameters definition');
    }
    
    // Validate each parameter
    Object.entries(tool.parameters).forEach(([name, param]) => {
      if (!param.type || !['string', 'number', 'boolean', 'object', 'array', 'file'].includes(param.type)) {
        throw new Error(`Invalid parameter type for ${name}: ${param.type}`);
      }
    });
  }

  private validateParameters(tool: ToolDefinition, parameters: Record<string, any>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    // Check required parameters
    Object.entries(tool.parameters).forEach(([name, param]) => {
      if (param.required && (parameters[name] === undefined || parameters[name] === null)) {
        errors.push(`Required parameter missing: ${name}`);
        return;
      }
      
      const value = parameters[name];
      if (value === undefined || value === null) return;
      
      // Type validation
      switch (param.type) {
        case 'string':
          if (typeof value !== 'string') {
            errors.push(`Parameter ${name} must be a string`);
          } else if (param.enum && !param.enum.includes(value)) {
            errors.push(`Parameter ${name} must be one of: ${param.enum.join(', ')}`);
          }
          break;
        case 'number':
          if (typeof value !== 'number' || isNaN(value)) {
            errors.push(`Parameter ${name} must be a number`);
          } else if (param.validation) {
            if (param.validation.min !== undefined && value < param.validation.min) {
              errors.push(`Parameter ${name} must be >= ${param.validation.min}`);
            }
            if (param.validation.max !== undefined && value > param.validation.max) {
              errors.push(`Parameter ${name} must be <= ${param.validation.max}`);
            }
          }
          break;
        case 'boolean':
          if (typeof value !== 'boolean') {
            errors.push(`Parameter ${name} must be a boolean`);
          }
          break;
        case 'object':
          if (typeof value !== 'object' || Array.isArray(value)) {
            errors.push(`Parameter ${name} must be an object`);
          }
          break;
        case 'array':
          if (!Array.isArray(value)) {
            errors.push(`Parameter ${name} must be an array`);
          }
          break;
        case 'file':
          if (!value || !value.buffer) {
            errors.push(`Parameter ${name} must be a file with buffer`);
          }
          break;
      }
    });
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  async getAvailableTools(): Promise<ToolDefinition[]> {
    return Array.from(this.tools.values());
  }

  async getTool(name: string): Promise<ToolDefinition | undefined> {
    return this.tools.get(name);
  }

  async getToolsByCategory(category: string): Promise<ToolDefinition[]> {
    // This could be extended to support categorization
    return Array.from(this.tools.values()).filter(tool => 
      tool.description.toLowerCase().includes(category.toLowerCase())
    );
  }

  async unregisterTool(name: string): Promise<boolean> {
    const removed = this.tools.delete(name);
    if (removed) {
      logger.info(`Unregistered tool: ${name}`);
    }
    return removed;
  }

  async updateTool(name: string, updates: Partial<ToolDefinition>): Promise<boolean> {
    const existing = this.tools.get(name);
    if (!existing) {
      return false;
    }
    
    const updated = { ...existing, ...updates };
    this.validateToolDefinition(updated);
    
    this.tools.set(name, updated);
    logger.info(`Updated tool: ${name}`);
    return true;
  }

  // Special method for handling immigration-specific tool orchestration
  async orchestrateImmigrationWorkflow(workflowType: string, parameters: any): Promise<any> {
    switch (workflowType) {
      case 'document_analysis_workflow':
        return this.handleDocumentAnalysisWorkflow(parameters);
      case 'form_completion_workflow':
        return this.handleFormCompletionWorkflow(parameters);
      case 'case_status_workflow':
        return this.handleCaseStatusWorkflow(parameters);
      default:
        throw new Error(`Unknown workflow type: ${workflowType}`);
    }
  }

  private async handleDocumentAnalysisWorkflow(parameters: any) {
    // 1. Analyze document
    const analysisResult = await this.callTool({
      tool: 'analyze_document',
      parameters: { document: parameters.document, analysis_type: 'full' }
    });

    if (!analysisResult.success) {
      throw new Error(`Document analysis failed: ${analysisResult.error}`);
    }

    // 2. Translate if needed
    let translationResult = null;
    if (parameters.needsTranslation && analysisResult.data.detectedLanguage !== 'en') {
      translationResult = await this.callTool({
        tool: 'translate_text',
        parameters: {
          text: analysisResult.data.extractedText,
          fromLanguage: analysisResult.data.detectedLanguage,
          toLanguage: 'en'
        }
      });
    }

    return {
      analysis: analysisResult.data,
      translation: translationResult?.success ? translationResult.data : null
    };
  }

  private async handleFormCompletionWorkflow(parameters: any) {
    // This could orchestrate multiple tools for complex form completion
    const result = await this.callTool({
      tool: 'fill_form',
      parameters
    });
    
    return result;
  }

  private async handleCaseStatusWorkflow(parameters: any) {
    // 1. Check status
    const statusResult = await this.callTool({
      tool: 'check_case_status',
      parameters: { receiptNumber: parameters.receiptNumber }
    });

    if (!statusResult.success) {
      return statusResult;
    }

    // 2. Suggest next actions based on status
    const suggestions = this.generateStatusBasedSuggestions(statusResult.data);
    
    return {
      status: statusResult.data,
      suggestions
    };
  }

  private generateStatusBasedSuggestions(statusData: any): string[] {
    const suggestions = [];
    
    if (statusData.status?.includes('Request for Additional Evidence')) {
      suggestions.push('Review the RFE notice carefully');
      suggestions.push('Gather requested documents');
      suggestions.push('Consider consulting with an attorney');
    }
    
    if (statusData.status?.includes('Interview')) {
      suggestions.push('Prepare for your interview');
      suggestions.push('Review your application');
      suggestions.push('Gather all required documents');
    }
    
    return suggestions;
  }
}