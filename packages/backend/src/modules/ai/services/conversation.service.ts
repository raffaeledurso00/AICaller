import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OpenAiService } from './openai.service';
import { Call, CallDocument } from '../../telephony/schemas/call.schema';
import { Campaign } from '../../campaigns/schemas/campaign.schema';
import { Contact } from '../../contacts/schemas/contact.schema';

interface ConversationContext {
  callId: string;
  campaignId: string;
  contactId: string;
  scriptTemplate: string;
  scriptVariables: Record<string, any>;
  extractedInfo: Record<string, any>;
  goals: string[];
  currentState: 'introduction' | 'information_gathering' | 'objection_handling' | 'closing' | 'ended';
}

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);
  private readonly activeConversations = new Map<string, ConversationContext>();

  constructor(
    private readonly openAiService: OpenAiService,
    @InjectModel(Call.name) private readonly callModel: Model<CallDocument>,
  ) {}

  async initializeConversation(
    callId: string,
    campaign: Campaign,
    contact: Contact,
  ): Promise<string> {
    // Extract IDs safely with type assertion
    const campaignId = (campaign as unknown as { _id?: string | { toString(): string } })._id 
      ? typeof (campaign as any)._id === 'string' 
        ? (campaign as any)._id 
        : (campaign as any)._id.toString()
      : '';
      
    const contactId = (contact as unknown as { _id?: string | { toString(): string } })._id
      ? typeof (contact as any)._id === 'string'
        ? (contact as any)._id
        : (contact as any)._id.toString()
      : '';
    
    // Initialize conversation context
    const context: ConversationContext = {
      callId,
      campaignId,
      contactId,
      scriptTemplate: campaign.scriptTemplate,
      scriptVariables: campaign.scriptVariables || {},
      extractedInfo: {},
      goals: ['introduce_service', 'gather_information', 'address_concerns', 'secure_commitment'],
      currentState: 'introduction',
    };

    // Store the conversation context
    this.activeConversations.set(callId, context);

    // Generate the initial greeting based on the script template and variables
    const systemPrompt = {
      role: 'system' as const,
      content: `
        You are an AI assistant making a call on behalf of a business. Be conversational, polite, and helpful.
        
        Campaign type: ${campaign.type}
        Script template: ${campaign.scriptTemplate}
        Contact name: ${contact.firstName} ${contact.lastName}
        
        Your goal is to have a natural conversation. Introduce yourself clearly as an AI assistant calling on behalf of the business.
        
        Never pretend to be a human. If asked directly, acknowledge that you are an AI assistant.
        
        The call is currently in the INTRODUCTION phase. Start with a greeting and introduce yourself and the purpose of the call.
      `,
    };

    // Replace variables in the script template
    let processedTemplate = campaign.scriptTemplate;
    Object.entries(context.scriptVariables).forEach(([key, value]) => {
      processedTemplate = processedTemplate.replace(new RegExp(`{{${key}}}`, 'g'), value as string);
    });

    processedTemplate = processedTemplate.replace(
      '{{contact_name}}',
      `${contact.firstName} ${contact.lastName}`,
    );

    try {
      // Generate the initial greeting
      const initialGreeting = await this.openAiService.generateResponse(
        'Generate an introduction for the call based on the script template.',
        [systemPrompt],
      );

      // Store this as the first message in the call
      await this.callModel.findByIdAndUpdate(callId, {
        $push: {
          conversation: {
            timestamp: new Date(),
            speaker: 'ai',
            message: initialGreeting,
          },
        },
      });

      return initialGreeting;
    } catch (error) {
      this.logger.error(`Error initializing conversation: ${error.message}`, error.stack);
      throw error;
    }
  }

  async processUserInput(callId: string, userInput: string): Promise<string> {
    // Get the conversation context
    const context = this.activeConversations.get(callId);
    if (!context) {
      throw new Error(`Conversation with ID ${callId} not found`);
    }

    try {
      // Retrieve the call and its conversation history
      const call = await this.callModel.findById(callId).exec();
      if (!call) {
        throw new Error(`Call with ID ${callId} not found`);
      }

      // Add the user input to the call conversation
      await this.callModel.findByIdAndUpdate(callId, {
        $push: {
          conversation: {
            timestamp: new Date(),
            speaker: 'human',
            message: userInput,
          },
        },
      });

      // Convert the conversation history to the format expected by OpenAI
      const conversationHistory = call.conversation.map((msg) => ({
        role: msg.speaker === 'ai' ? 'assistant' as const : 'user' as const,
        content: msg.message,
      }));

      // Determine the current state of the conversation
      this.updateConversationState(context, userInput);

      // Create a system message for the current state
      const systemMessage = {
        role: 'system' as const,
        content: this.getSystemPromptForState(context),
      };

      // Process the message and get AI response and extracted information
      const { response, extractedInfo } = await this.openAiService.processChatMessage(
        userInput,
        {
          currentState: context.currentState,
          scriptTemplate: context.scriptTemplate,
          scriptVariables: context.scriptVariables,
          extractedInfo: context.extractedInfo,
          goals: context.goals,
        },
        [systemMessage, ...conversationHistory],
      );

      // Update the conversation context with the extracted information
      if (extractedInfo && Object.keys(extractedInfo).length > 0) {
        context.extractedInfo = { ...context.extractedInfo, ...extractedInfo };
        // Update the call document with the extracted information
        await this.callModel.findByIdAndUpdate(callId, {
          $set: { 'aiContext.extractedInfo': context.extractedInfo },
        });
      }

      // Add the AI response to the call conversation
      await this.callModel.findByIdAndUpdate(callId, {
        $push: {
          conversation: {
            timestamp: new Date(),
            speaker: 'ai',
            message: response,
          },
        },
      });

      return response;
    } catch (error) {
      this.logger.error(`Error processing user input: ${error.message}`, error.stack);
      throw error;
    }
  }

  private updateConversationState(context: ConversationContext, userInput: string): void {
    // Simple state transition logic based on the conversation flow
    // In a real implementation, this would be more sophisticated and use AI to determine state
    switch (context.currentState) {
      case 'introduction':
        // After introduction, move to information gathering
        context.currentState = 'information_gathering';
        break;
      case 'information_gathering':
        // If we've collected enough information or detected objections, move to objection handling
        if (
          Object.keys(context.extractedInfo).length >= 3 ||
          userInput.toLowerCase().includes('concern') ||
          userInput.toLowerCase().includes('issue') ||
          userInput.toLowerCase().includes('problem') ||
          userInput.toLowerCase().includes('not interested')
        ) {
          context.currentState = 'objection_handling';
        }
        break;
      case 'objection_handling':
        // If objections are handled, move to closing
        if (
          userInput.toLowerCase().includes('ok') ||
          userInput.toLowerCase().includes('that sounds good') ||
          userInput.toLowerCase().includes('sure') ||
          userInput.toLowerCase().includes('yes')
        ) {
          context.currentState = 'closing';
        }
        break;
      case 'closing':
        // If the closing is done, mark as ended
        if (
          userInput.toLowerCase().includes('goodbye') ||
          userInput.toLowerCase().includes('bye') ||
          userInput.toLowerCase().includes('thank')
        ) {
          context.currentState = 'ended';
        }
        break;
    }
  }

  private getSystemPromptForState(context: ConversationContext): string {
    // Provide different instructions based on the current state
    switch (context.currentState) {
      case 'introduction':
        return `
          You are an AI assistant making a call on behalf of a business. Be conversational, polite, and helpful.
          You are in the INTRODUCTION phase. Your goal is to introduce yourself and the purpose of the call.
          Make sure to clearly identify yourself as an AI assistant calling on behalf of the business.
        `;
      case 'information_gathering':
        return `
          You are an AI assistant making a call on behalf of a business. Be conversational, polite, and helpful.
          You are in the INFORMATION GATHERING phase. Your goal is to gather relevant information from the contact.
          
          Information already collected: ${JSON.stringify(context.extractedInfo)}
          
          Ask follow-up questions to gather more details. Be specific but natural in your questions.
          Listen carefully to the responses and acknowledge what the contact is saying.
        `;
      case 'objection_handling':
        return `
          You are an AI assistant making a call on behalf of a business. Be conversational, polite, and helpful.
          You are in the OBJECTION HANDLING phase. Your goal is to address any concerns or objections raised by the contact.
          
          Information collected: ${JSON.stringify(context.extractedInfo)}
          
          Be empathetic and understanding. Provide clear and helpful responses to concerns.
          Don't be pushy, but try to find solutions or alternatives that could address their concerns.
        `;
      case 'closing':
        return `
          You are an AI assistant making a call on behalf of a business. Be conversational, polite, and helpful.
          You are in the CLOSING phase. Your goal is to wrap up the conversation and secure a commitment if appropriate.
          
          Information collected: ${JSON.stringify(context.extractedInfo)}
          
          Summarize the key points of the conversation. If the contact has shown interest, confirm next steps.
          If the contact is not interested, be respectful and thank them for their time.
          End the conversation in a professional and friendly manner.
        `;
      case 'ended':
        return `
          You are an AI assistant making a call on behalf of a business. Be conversational, polite, and helpful.
          The conversation is ending. Thank the contact for their time and say goodbye.
        `;
      default:
        return `
          You are an AI assistant making a call on behalf of a business. Be conversational, polite, and helpful.
          Have a natural conversation with the contact. Be clear, concise, and focused on their needs.
        `;
    }
  }

  async endConversation(callId: string): Promise<void> {
    // Get the conversation context
    const context = this.activeConversations.get(callId);
    if (!context) {
      throw new Error(`Conversation with ID ${callId} not found`);
    }

    try {
      // Update the call with the final context and state
      await this.callModel.findByIdAndUpdate(callId, {
        $set: {
          'aiContext.finalState': context.currentState,
          'aiContext.extractedInfo': context.extractedInfo,
        },
      });

      // Get the full call record
      const call = await this.callModel.findById(callId).exec();
      if (!call) {
        throw new Error(`Call with ID ${callId} not found`);
      }

      // Generate a transcript from the conversation
      const transcript = call.conversation
        .map((msg) => `${msg.speaker.toUpperCase()}: ${msg.message}`)
        .join('\n\n');

      // Analyze the call sentiment and outcomes
      const analysis = await this.openAiService.analyzeCallSentiment(transcript);

      // Update the call with the analysis
      await this.callModel.findByIdAndUpdate(callId, {
        $set: {
          metadata: {
            ...call.metadata,
            analysis,
          },
        },
      });

      // Remove the conversation from memory
      this.activeConversations.delete(callId);
    } catch (error) {
      this.logger.error(`Error ending conversation: ${error.message}`, error.stack);
      throw error;
    }
  }
}