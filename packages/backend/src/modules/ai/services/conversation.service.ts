import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OpenAiService } from './openai.service';
import { VectorStorageService } from './vector-storage.service';
import { Call, CallDocument } from '../../telephony/schemas/call.schema';
import { Campaign, CampaignDocument } from '../../campaigns/schemas/campaign.schema';
import { Contact, ContactDocument } from '../../contacts/schemas/contact.schema';

// Define types for conversation management
interface ConversationContext {
  callId: string;
  campaignId: string;
  contactId: string;
  scriptTemplate: string;
  scriptVariables: Record<string, any>;
  currentState: string;
}

// Utility function to safely extract document ID
function safeExtractId(doc: { _id?: unknown }): string {
  if (!doc._id) return '';
  return typeof doc._id === 'string' || doc._id instanceof Types.ObjectId
    ? doc._id.toString()
    : '';
}

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);
  private readonly activeConversations = new Map<string, ConversationContext>();

  constructor(
    private readonly openAiService: OpenAiService,
    private readonly vectorStorageService: VectorStorageService,
    @InjectModel(Call.name) private readonly callModel: Model<CallDocument>,
  ) {}

  /**
   * Initialize a conversation for a specific call
   */
  async initializeConversation(
    callId: string, 
    campaign: CampaignDocument, 
    contact: ContactDocument
  ): Promise<string> {
    try {
      // Safely extract campaign and contact IDs
      const campaignId = safeExtractId(campaign);
      const contactId = safeExtractId(contact);

      // Prepare context
      const context: ConversationContext = {
        callId,
        campaignId,
        contactId,
        scriptTemplate: campaign.scriptTemplate,
        scriptVariables: campaign.scriptVariables || {},
        currentState: 'introduction',
      };

      // Store context
      this.activeConversations.set(callId, context);

      // Process script template
      const processedTemplate = this.processScriptTemplate(context, contact);

      // Generate initial greeting
      const greeting = await this.generateInitialGreeting(
        campaign, 
        contact, 
        processedTemplate
      );

      // Store greeting in call document
      await this.storeMessage(callId, 'ai', greeting);

      return greeting;
    } catch (error) {
      this.logger.error(`Conversation initialization error: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Process user input in an ongoing conversation
   */
  async processUserInput(
    callId: string, 
    userInput: string
  ): Promise<string> {
    // Retrieve conversation context
    const context = this.activeConversations.get(callId);
    if (!context) {
      throw new Error(`Conversation with ID ${callId} not found`);
    }

    try {
      // Store user message
      await this.storeMessage(callId, 'human', userInput);

      // Get conversation history
      const conversationHistory = await this.getConversationHistory(callId);

      // Generate AI response
      const response = await this.generateResponse(
        userInput, 
        context, 
        conversationHistory
      );

      // Store AI response
      await this.storeMessage(callId, 'ai', response);

      // Update conversation state
      this.updateConversationState(context, userInput);

      return response;
    } catch (error) {
      this.logger.error(`User input processing error: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * End the conversation
   */
  async endConversation(callId: string): Promise<void> {
    try {
      // Retrieve and validate context
      const context = this.activeConversations.get(callId);
      if (!context) {
        this.logger.warn(`No active conversation found for call ${callId}`);
        return;
      }

      // Generate conversation summary
      const summary = await this.generateConversationSummary(callId);

      // Update call document
      await this.callModel.findByIdAndUpdate(callId, {
        $set: {
          'aiContext.finalState': context.currentState,
          'metadata.conversationSummary': summary,
        },
      });

      // Remove from active conversations
      this.activeConversations.delete(callId);
    } catch (error) {
      this.logger.error(`Conversation end error: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Process script template with variables
   */
  private processScriptTemplate(
    context: ConversationContext, 
    contact: ContactDocument
  ): string {
    let template = context.scriptTemplate;

    // Replace variables
    Object.entries(context.scriptVariables).forEach(([key, value]) => {
      template = template.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    // Replace contact name
    template = template.replace(
      '{{contact_name}}', 
      `${contact.firstName} ${contact.lastName}`
    );

    return template;
  }

  /**
   * Generate initial greeting
   */
  private async generateInitialGreeting(
    campaign: CampaignDocument,
    contact: ContactDocument,
    scriptTemplate: string
  ): Promise<string> {
    const prompt = `Generate an introductory greeting for a call:
      Campaign Type: ${campaign.type}
      Contact Name: ${contact.firstName} ${contact.lastName}
      Script Template: ${scriptTemplate}
      
      Guidelines:
      - Be conversational
      - Clearly identify as an AI assistant
      - Reference the purpose of the call
    `;

    const systemPrompt = {
      role: 'system' as const,
      content: 'You are an AI assistant making an initial call introduction'
    };

    return this.openAiService.generateResponse(prompt, [systemPrompt]);
  }

  /**
   * Store message in call document
   */
  private async storeMessage(
    callId: string, 
    speaker: 'ai' | 'human', 
    message: string
  ): Promise<void> {
    await this.callModel.findByIdAndUpdate(callId, {
      $push: {
        conversation: {
          timestamp: new Date(),
          speaker,
          message,
        },
      },
    });
  }

  /**
   * Retrieve conversation history
   */
  private async getConversationHistory(
    callId: string
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const call = await this.callModel.findById(callId).exec();
    
    if (!call) {
      throw new Error(`Call ${callId} not found`);
    }

    return call.conversation.map(msg => ({
      role: msg.speaker === 'human' ? 'user' : 'assistant',
      content: msg.message,
    }));
  }

  /**
   * Generate AI response
   */
  private async generateResponse(
    userInput: string, 
    context: ConversationContext, 
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    const systemPrompt = {
      role: 'system' as const,
      content: `You are an AI assistant in a conversation. 
        Current conversation state: ${context.currentState}
        Focus on having a natural, helpful conversation.`,
    };

    return this.openAiService.generateResponse(
      userInput,
      [systemPrompt, ...conversationHistory]
    );
  }

  /**
   * Update conversation state
   */
  private updateConversationState(
    context: ConversationContext, 
    userInput: string
  ): void {
    const input = userInput.toLowerCase();

    // Simple state transition logic
    switch (context.currentState) {
      case 'introduction':
        if (input.includes('tell me more') || input.includes('interested')) {
          context.currentState = 'information_gathering';
        }
        break;
      case 'information_gathering':
        if (input.includes('concern') || input.includes('problem')) {
          context.currentState = 'objection_handling';
        }
        break;
      case 'objection_handling':
        if (input.includes('okay') || input.includes('sounds good')) {
          context.currentState = 'closing';
        }
        break;
      case 'closing':
        if (input.includes('goodbye') || input.includes('thank you')) {
          context.currentState = 'ended';
        }
        break;
    }
  }

  /**
   * Generate conversation summary
   */
  private async generateConversationSummary(
    callId: string
  ): Promise<string> {
    try {
      const call = await this.callModel.findById(callId).exec();
      
      if (!call) {
        throw new Error(`Call ${callId} not found`);
      }

      const transcript = call.conversation
        .map(msg => `${msg.speaker.toUpperCase()}: ${msg.message}`)
        .join('\n\n');

      const systemPrompt = {
        role: 'system' as const,
        content: 'Create a clear, concise summary of the conversation.',
      };

      return this.openAiService.generateResponse(
        `Summarize this conversation concisely:

${transcript}

Provide key points, outcomes, and main discussion topics.`,
        [systemPrompt]
      );
    } catch (error) {
      this.logger.error(`Summary generation error: ${error.message}`, error.stack);
      return 'Unable to generate conversation summary.';
    }
  }
}