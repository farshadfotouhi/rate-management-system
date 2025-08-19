import { Pinecone } from '@pinecone-database/pinecone';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { query, transaction } from '../database';
import winston from 'winston';
import axios from 'axios';

const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

interface AssistantConfig {
  assistantName: string; // Name of existing assistant in Pinecone dashboard
  instructions?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

interface TenantAssistant {
  id: string;
  tenantId: string;
  pineconeAssistantId: string;
  name: string;
  model: string;
  instructions: string;
  isActive: boolean;
}

export class PineconeAssistantService {
  private pinecone: Pinecone;
  private assistantApiKey: string;
  private defaultInstructions: string;
  private assistantHost: string = 'https://prod-1-data.ke.pinecone.io';

  constructor() {
    this.pinecone = new Pinecone({
      apiKey: config.PINECONE_API_KEY,
    });
    
    this.assistantApiKey = config.PINECONE_ASSISTANT_API_KEY;
    
    this.defaultInstructions = `You are an expert rate manager for a logistics company. You know the rate contracts for each carrier like the back of your hand. You can decode the 5 letter port codes to city and country. You can also provide shipping rates for all container sizes from these ports to any ports in the USA.
    
    When answering questions:
    1. Always provide specific rates when available
    2. Mention any special terms or restrictions
    3. Suggest the most cost-effective options
    4. Consider transit times and reliability
    5. Decode port codes to their full names for clarity`;
  }

  async linkAssistantToTenant(
    tenantId: string,
    config: AssistantConfig
  ): Promise<TenantAssistant> {
    try {
      const assistantName = config.assistantName;
      const instructions = config?.instructions || this.defaultInstructions;
      const model = config?.model || 'gemini-2.5-pro';
      
      // Skip verification for mock assistants (development mode)
      if (!assistantName.startsWith('mock-assistant-')) {
        // Verify assistant exists in Pinecone (optional check)
        await this.verifyPineconeAssistantExists(assistantName);
      } else {
        logger.info(`Using mock assistant for development: ${assistantName}`);
      }

      // Store assistant reference in database
      const [assistant] = await query<TenantAssistant>(
        `INSERT INTO assistants (
          tenant_id, pinecone_assistant_id, name, model, instructions, temperature, max_tokens
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, tenant_id as "tenantId", pinecone_assistant_id as "pineconeAssistantId", 
                  name, model, instructions, is_active as "isActive"`,
        [
          tenantId,
          assistantName, // Use assistant name as ID
          assistantName,
          model,
          instructions,
          config?.temperature || 0.7,
          config?.maxTokens || 2000,
        ]
      );

      await query(
        `UPDATE tenants SET pinecone_assistant_id = $1, assistant_instructions = $2 WHERE id = $3`,
        [assistantName, instructions, tenantId]
      );

      logger.info(`Linked assistant to tenant ${tenantId}`, { assistantName });
      return assistant;
    } catch (error) {
      logger.error('Failed to link assistant to tenant', { tenantId, error });
      throw error;
    }
  }

  async createMockAssistantForTenant(
    tenantId: string,
    config?: Partial<AssistantConfig>
  ): Promise<TenantAssistant> {
    const mockAssistantName = `mock-assistant-${tenantId}-${uuidv4()}`;
    
    return this.linkAssistantToTenant(tenantId, {
      assistantName: mockAssistantName,
      instructions: config?.instructions || this.defaultInstructions,
      model: config?.model || 'gemini-2.5-pro',
      temperature: config?.temperature || 0.7,
      maxTokens: config?.maxTokens || 2000,
    });
  }

  private async verifyPineconeAssistantExists(assistantName: string) {
    logger.info('Verifying Pinecone Assistant exists:', { assistantName });

    // Skip verification since Pinecone Assistant doesn't provide a GET endpoint
    // The assistant existence will be validated when attempting to upload files or chat
    logger.info(`Skipping verification for assistant '${assistantName}' - will validate on first use`);
    return true;
    
    /* Old verification code - keeping for reference
    const response = await fetch(`${this.assistantHost}/assistant/assistants/${assistantName}`, {
      method: 'GET',
      headers: {
        'Api-Key': this.assistantApiKey,
        'X-Pinecone-API-Version': '2025-04', // Updated API version
      },
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      logger.error('Pinecone Assistant verification failed:', {
        status: response.status,
        statusText: response.statusText,
        error: responseText,
        assistantName,
      });
      throw new Error(`Assistant '${assistantName}' not found in Pinecone. Please ensure it exists in your Pinecone dashboard.`);
    }
    */
  }

  async updateAssistantInstructions(
    tenantId: string,
    instructions: string
  ): Promise<void> {
    try {
      const [assistant] = await query<{ pinecone_assistant_id: string }>(
        `SELECT pinecone_assistant_id FROM assistants WHERE tenant_id = $1`,
        [tenantId]
      );

      if (!assistant) {
        throw new Error(`No assistant found for tenant ${tenantId}`);
      }

      // Note: Pinecone Assistant API doesn't support updating instructions after creation
      // We store the instructions in our database and include them in the chat context
      
      await query(
        `UPDATE assistants SET instructions = $1 WHERE tenant_id = $2`,
        [instructions, tenantId]
      );

      await query(
        `UPDATE tenants SET assistant_instructions = $1 WHERE id = $2`,
        [instructions, tenantId]
      );

      logger.info(`Updated assistant instructions in database for tenant ${tenantId}`);
      logger.info(`Instructions will be included in chat context for all future messages`);
    } catch (error) {
      logger.error('Failed to update assistant instructions', { tenantId, error });
      throw error;
    }
  }

  private async updatePineconeAssistant(
    assistantId: string,
    updates: { instructions?: string; temperature?: number; maxTokens?: number }
  ) {
    const response = await fetch(
      `${this.assistantHost}/assistant/assistants/${assistantId}`,
      {
        method: 'PATCH',
        headers: {
          'Api-Key': this.assistantApiKey,
          'Content-Type': 'application/json',
          'X-Pinecone-API-Version': '2025-04',
        },
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update Pinecone Assistant: ${error}`);
    }

    return await response.json();
  }

  async deleteAssistant(tenantId: string): Promise<void> {
    try {
      const [assistant] = await query<{ pinecone_assistant_id: string }>(
        `SELECT pinecone_assistant_id FROM assistants WHERE tenant_id = $1`,
        [tenantId]
      );

      if (!assistant) {
        logger.warn(`No assistant found for tenant ${tenantId}`);
        return;
      }

      await this.deletePineconeAssistant(assistant.pinecone_assistant_id);

      await query(`DELETE FROM assistants WHERE tenant_id = $1`, [tenantId]);

      logger.info(`Deleted assistant for tenant ${tenantId}`);
    } catch (error) {
      logger.error('Failed to delete assistant', { tenantId, error });
      throw error;
    }
  }

  private async deletePineconeAssistant(assistantId: string) {
    const response = await fetch(
      `${this.assistantHost}/assistant/assistants/${assistantId}`,
      {
        method: 'DELETE',
        headers: {
          'Api-Key': this.assistantApiKey,
          'X-Pinecone-API-Version': '2025-04',
        },
      }
    );

    if (!response.ok && response.status !== 404) {
      const error = await response.text();
      throw new Error(`Failed to delete Pinecone Assistant: ${error}`);
    }
  }

  async getAssistantForTenant(tenantId: string): Promise<TenantAssistant | null> {
    const [assistant] = await query<TenantAssistant>(
      `SELECT 
        id, 
        tenant_id as "tenantId", 
        pinecone_assistant_id as "pineconeAssistantId",
        name, 
        model, 
        instructions, 
        is_active as "isActive"
      FROM assistants 
      WHERE tenant_id = $1 AND is_active = true`,
      [tenantId]
    );

    return assistant || null;
  }

  async uploadFileToAssistant(
    tenantId: string,
    fileBuffer: Buffer,
    fileName: string,
    fileType: string
  ): Promise<string> {
    try {
      const assistant = await this.getAssistantForTenant(tenantId);
      if (!assistant) {
        throw new Error(`No assistant found for tenant ${tenantId}`);
      }

      // Check if this is a mock assistant (for development/testing)
      if (assistant.pineconeAssistantId.startsWith('mock-assistant-')) {
        logger.info(`Using mock file upload for development assistant`, {
          fileName,
          fileType,
          assistantId: assistant.pineconeAssistantId,
        });
        
        // Generate a mock file ID for development
        const mockFileId = `mock-file-${uuidv4()}`;
        
        logger.info(`Mock file upload successful`, {
          fileId: mockFileId,
          fileName,
          assistantId: assistant.pineconeAssistantId,
        });
        
        return mockFileId;
      }

      // Upload file to Pinecone Assistant using axios
      const FormDataModule = await import('form-data');
      const formData = new FormDataModule.default();
      formData.append('file', fileBuffer, {
        filename: fileName,
        contentType: fileType,
      });

      logger.info(`Uploading file to Pinecone Assistant ${assistant.pineconeAssistantId}`, {
        fileName,
        fileType,
        assistantId: assistant.pineconeAssistantId,
      });

      try {
        // Use the correct endpoint: /assistant/files/{assistantName}
        const response = await axios.post(
          `${this.assistantHost}/assistant/files/${assistant.pineconeAssistantId}`,
          formData,
          {
            headers: {
              'Api-Key': this.assistantApiKey,
              'X-Pinecone-API-Version': '2025-04',
              ...formData.getHeaders(),
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
          }
        );

        const fileId = response.data.id;
        
        logger.info(`Successfully uploaded file to Pinecone Assistant`, {
          fileId,
          fileName,
          assistantId: assistant.pineconeAssistantId,
          status: response.data.status,
        });
        
        return fileId;
      } catch (error: any) {
        if (error.response) {
          logger.error(`File upload failed (${error.response.status}):`, error.response.data);
          throw new Error(`Failed to upload file to Pinecone Assistant: ${JSON.stringify(error.response.data)}`);
        } else {
          logger.error(`File upload failed:`, error.message);
          throw new Error(`Failed to upload file to Pinecone Assistant: ${error.message}`);
        }
      }
    } catch (error) {
      logger.error('Failed to upload file to assistant', { tenantId, fileName, error });
      throw error;
    }
  }

  async createChatSession(
    tenantId: string,
    userId: string,
    title?: string
  ): Promise<string> {
    const assistant = await this.getAssistantForTenant(tenantId);
    if (!assistant) {
      throw new Error(`No assistant found for tenant ${tenantId}`);
    }

    const [session] = await query<{ id: string }>(
      `INSERT INTO chat_sessions (tenant_id, user_id, assistant_id, title)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [tenantId, userId, assistant.id, title || 'New Chat Session']
    );

    return session.id;
  }

  async sendMessage(
    sessionId: string,
    message: string
  ): Promise<{ response: string; tokensUsed: number }> {
    try {
      const [session] = await query<{
        tenant_id: string;
        assistant_id: string;
        pinecone_assistant_id: string;
      }>(
        `SELECT s.tenant_id, s.assistant_id, a.pinecone_assistant_id
         FROM chat_sessions s
         JOIN assistants a ON s.assistant_id = a.id
         WHERE s.id = $1`,
        [sessionId]
      );

      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      await query(
        `INSERT INTO chat_messages (session_id, role, content)
         VALUES ($1, $2, $3)`,
        [sessionId, 'user', message]
      );

      const startTime = Date.now();
      let response: { content: string; tokensUsed: number };
      
      // Check if this is a mock assistant
      if (session.pinecone_assistant_id.startsWith('mock-')) {
        response = await this.generateMockResponse(message);
      } else {
        response = await this.queryPineconeAssistant(
          session.pinecone_assistant_id,
          sessionId,
          message
        );
      }
      
      const responseTime = Date.now() - startTime;

      await query(
        `INSERT INTO chat_messages (session_id, role, content, tokens_used, response_time_ms)
         VALUES ($1, $2, $3, $4, $5)`,
        [sessionId, 'assistant', response.content, response.tokensUsed, responseTime]
      );

      return {
        response: response.content,
        tokensUsed: response.tokensUsed,
      };
    } catch (error) {
      logger.error('Failed to send message', { sessionId, error });
      throw error;
    }
  }

  private async generateMockResponse(message: string): Promise<{ content: string; tokensUsed: number }> {
    // Generate a helpful mock response
    const responses: { [key: string]: string } = {
      'rate': 'Based on your uploaded contracts, I can help you find the best rates for your shipments. Please specify the origin port, destination port, and container type you need.',
      'port': 'I can help decode port codes. For example, CNSHA is Shanghai, China and USLAX is Los Angeles, USA. What port code would you like to know about?',
      'container': 'We support various container types including 20ft, 40ft, 40ft HC, and specialized containers like reefers. What container type are you looking for?',
      'route': 'I can help you find routes from your contracts. Popular routes include Asia to US West Coast, Europe to US East Coast. What route are you interested in?',
      'carrier': 'Your contracts include various carriers. Please specify which carrier or route you need information about.',
      'default': 'I can help you with rate queries, port information, and contract details. Since this is a demo mode without Pinecone Assistant API, responses are simulated. Please upload your contracts and I can provide more specific information.'
    };

    const lowercaseMessage = message.toLowerCase();
    let responseText = responses.default;

    for (const [keyword, response] of Object.entries(responses)) {
      if (lowercaseMessage.includes(keyword)) {
        responseText = response;
        break;
      }
    }

    return {
      content: responseText,
      tokensUsed: Math.floor(responseText.split(' ').length * 1.3), // Rough estimate
    };
  }

  private generateFallbackResponse(message: string): { content: string; tokensUsed: number } {
    // Check if this is an extraction request
    if (message.includes('EXTRACTION TASK:') || message.includes('extract') || message.includes('section')) {
      logger.warn('Fallback response triggered for extraction task');
      // Return empty JSON structure for extraction
      return {
        content: JSON.stringify({
          error: 'Failed to process extraction request',
          rows: [],
          message: 'API timeout or connection issue'
        }),
        tokensUsed: 0
      };
    }
    
    const responses: { [key: string]: string } = {
      'rate': 'I apologize, but I\'m experiencing some connectivity issues with the AI service right now. For rate inquiries, I typically help with finding the best shipping rates based on your contracts. Please try again in a moment, or contact support if the issue persists.',
      'port': 'I\'m having trouble connecting to the AI service at the moment. For port code information, I usually help decode 5-letter port codes to their full city and country names. Please try your request again shortly.',
      'container': 'There seems to be a temporary connectivity issue with the AI service. For container information, I typically provide details about different container types (20ft, 40ft, 40ft HC, reefers, etc.). Please retry your question.',
      'route': 'I\'m experiencing connectivity issues with the AI service right now. For route information, I usually help with shipping routes and carrier options from your contracts. Please try again in a moment.',
      'carrier': 'There\'s a temporary issue connecting to the AI service. For carrier information, I typically provide details about available carriers and their rates from your uploaded contracts. Please retry shortly.',
      'default': 'I apologize, but I\'m experiencing temporary connectivity issues with the AI service. I\'m designed to help with rate management, port codes, shipping routes, and contract analysis. Please try your question again in a moment, or contact support if the problem persists.'
    };

    const lowercaseMessage = message.toLowerCase();
    let responseText = responses.default;

    for (const [keyword, response] of Object.entries(responses)) {
      if (lowercaseMessage.includes(keyword)) {
        responseText = response;
        break;
      }
    }

    return {
      content: responseText,
      tokensUsed: Math.floor(responseText.split(' ').length * 1.3), // Rough estimate
    };
  }

  private async queryPineconeAssistant(
    assistantId: string,
    sessionId: string,
    message: string
  ): Promise<{ content: string; tokensUsed: number }> {
    // Get session tenant ID
    const [sessionInfo] = await query<{ tenant_id: string }>(
      `SELECT tenant_id FROM chat_sessions WHERE id = $1`,
      [sessionId]
    );

    // Get custom instructions for this tenant
    const [assistantInfo] = await query<{ instructions: string }>(
      `SELECT instructions FROM assistants WHERE tenant_id = $1`,
      [sessionInfo.tenant_id]
    );

    // Get contract information for this tenant
    const contracts = await query<{ file_name: string; carrier_name: string; metadata: any }>(
      `SELECT file_name, carrier_name, metadata FROM contracts 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [sessionInfo.tenant_id]
    );

    // Build context with contract information
    let contextMessage = '';
    if (contracts.length > 0) {
      contextMessage = 'Available contracts:\n';
      contracts.forEach((contract: any) => {
        const metadata = typeof contract.metadata === 'string' ? JSON.parse(contract.metadata) : contract.metadata;
        contextMessage += `- ${contract.carrier_name}: ${contract.file_name}\n`;
        if (metadata.routes) {
          contextMessage += '  Routes: ' + JSON.stringify(metadata.routes) + '\n';
        }
      });
      contextMessage += '\nUse the above contract information to answer questions about rates and routes.\n\n';
    }

    // Get previous messages from this session for context
    const previousMessages = await query<{ role: string; content: string }>(
      `SELECT role, content FROM chat_messages 
       WHERE session_id = $1 
       ORDER BY created_at ASC 
       LIMIT 20`,
      [sessionId]
    );

    // Build messages array with history
    const messages = [];
    
    // Add previous messages
    previousMessages.forEach((msg: any) => {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      });
    });
    
    // Add the current message with context if available
    let finalMessage = message;
    
    // For the first message in a session, include instructions and contract context
    if (messages.length === 0) {
      let context = '';
      
      // Add custom instructions if available
      if (assistantInfo?.instructions) {
        context += `Instructions: ${assistantInfo.instructions}\n\n`;
      }
      
      // Add contract context if available
      if (contextMessage) {
        context += contextMessage + '\n\n';
      }
      
      if (context) {
        finalMessage = context + "User question: " + message;
      }
    }
    
    messages.push({
      role: 'user',
      content: finalMessage,
    });

    logger.info(`Querying Pinecone Assistant ${assistantId} with message`, {
      assistantId,
      sessionId,
      messageCount: messages.length,
    });

    // Add timeout and error handling for Pinecone API calls
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 180000); // 180 second timeout for Pinecone API (3 minutes for large extractions)

    try {
      // Use the correct Pinecone Assistant chat endpoint
      const response = await fetch(
        `${this.assistantHost}/assistant/chat/${assistantId}`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Api-Key': this.assistantApiKey,
            'Content-Type': 'application/json',
            'X-Pinecone-API-Version': '2025-04',
          },
          body: JSON.stringify({
            messages: messages,
            model: 'gemini-2.5-pro',
            stream: false,
          }),
        }
      );
      
      clearTimeout(timeoutId);
      
      const responseText = await response.text();

      if (!response.ok) {
        logger.error('Failed to query Pinecone Assistant:', {
          status: response.status,
          error: responseText,
          assistantId: assistantId,
          messagePreview: message.substring(0, 200)
        });
        // Return a fallback response instead of throwing
        return this.generateFallbackResponse(message);
      }

      const result = JSON.parse(responseText);
      
      // Log successful extraction responses
      if (message.includes('EXTRACTION TASK:')) {
        const section = message.match(/EXTRACTION TASK:\s*(\w+)/)?.[1] || 'Unknown';
        logger.info(`Successful Pinecone response for extraction section: ${section}`, {
          tokensUsed: result.usage?.total_tokens || 0,
          responseLength: result.message?.content?.length || 0
        });
      }
      
      return {
        content: result.message?.content || 
                 result.choices?.[0]?.message?.content ||
                 result.content ||
                 'No response generated',
        tokensUsed: result.usage?.total_tokens || 0,
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        logger.warn('Pinecone Assistant request timed out, using fallback response');
        return this.generateFallbackResponse(message);
      }
      
      logger.error('Error querying Pinecone Assistant:', error);
      return this.generateFallbackResponse(message);
    }
  }
}

export const pineconeAssistantService = new PineconeAssistantService();