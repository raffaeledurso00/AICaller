import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class OpenAiService {
  private readonly openai: OpenAI;
  private readonly logger = new Logger(OpenAiService.name);
  private readonly model: string;
  private readonly temperature: number;
  private readonly maxTokens: number;
  private readonly embeddingModel: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('openai.apiKey');
    
    if (!apiKey) {
      this.logger.error('OpenAI API key is not set');
      throw new Error('OpenAI API key is required');
    }

    this.openai = new OpenAI({
      apiKey,
    });

    this.model = this.configService.get<string>('openai.model') || 'gpt-4';
    this.temperature = this.configService.get<number>('openai.temperature') || 0.7;
    this.maxTokens = this.configService.get<number>('openai.maxTokens') || 500;
    this.embeddingModel = this.configService.get<string>('openai.embeddingModel') || 'text-embedding-ada-002';
  }

  async generateResponse(
    prompt: string,
    conversationHistory: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [],
    options: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
    } = {},
  ): Promise<string> {
    try {
      // Properly type the messages for OpenAI API
      const messages = [
        ...conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        { role: 'user' as const, content: prompt },
      ];

      const response = await this.openai.chat.completions.create({
        model: options.model || this.model,
        messages,
        temperature: options.temperature ?? this.temperature,
        max_tokens: options.maxTokens ?? this.maxTokens,
      });

      const generatedText = response.choices[0]?.message?.content;

      if (!generatedText) {
        throw new Error('No response generated');
      }

      return generatedText;
    } catch (error) {
      this.logger.error(`Error generating OpenAI response: ${error.message}`, error.stack);
      throw error;
    }
  }

  async generateCallScript(
    campaignType: string, 
    productInfo: Record<string, any>,
    targetAudience: Record<string, any>,
  ): Promise<string> {
    const prompt = `
      Create a conversational script for an AI-powered call center agent.
      
      Campaign Type: ${campaignType}
      Product/Service Information: ${JSON.stringify(productInfo)}
      Target Audience: ${JSON.stringify(targetAudience)}
      
      The script should:
      1. Include a natural-sounding introduction
      2. Cover key talking points about the product/service
      3. Include responses to common objections
      4. Have a clear call-to-action
      5. End with a polite closing
      
      Make it sound conversational and natural, not robotic or scripted.
    `;

    return this.generateResponse(prompt, [
      {
        role: 'system',
        content: 'You are an expert in creating effective and natural-sounding call scripts for AI-powered call centers.',
      },
    ]);
  }

  async processChatMessage(
    message: string,
    context: Record<string, any>,
    conversationHistory: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  ): Promise<{ response: string; extractedInfo?: Record<string, any> }> {
    try {
      // First, generate a response to the customer
      const responsePrompt = `
        Based on the following conversation history and context, provide a helpful and natural response to the customer's latest message.
        
        Context:
        ${JSON.stringify(context)}
        
        Customer's latest message: ${message}
      `;
      
      const response = await this.generateResponse(responsePrompt, conversationHistory);
      
      // Then, extract any important information from the message
      const extractionPrompt = `
        Extract any important information from the following customer message:
        "${message}"
        
        Based on the conversation context:
        ${JSON.stringify(context)}
        
        Return ONLY a JSON object with relevant extracted fields. If no information can be extracted, return an empty object {}.
      `;
      
      const extractionResult = await this.generateResponse(extractionPrompt, [
        {
          role: 'system',
          content: 'You are an AI trained to extract structured information from text. Only return valid JSON.',
        },
      ]);
      
      let extractedInfo = {};
      try {
        extractedInfo = JSON.parse(extractionResult);
      } catch (error) {
        this.logger.warn(`Failed to parse extracted information as JSON: ${extractionResult}`);
      }
      
      return {
        response,
        extractedInfo,
      };
    } catch (error) {
      this.logger.error(`Error processing chat message: ${error.message}`, error.stack);
      throw error;
    }
  }

  async analyzeCallSentiment(transcript: string): Promise<Record<string, any>> {
    const prompt = `
      Analyze the following call transcript and provide sentiment analysis:
      
      ${transcript}
      
      Please return a JSON object with the following fields:
      - overallSentiment: (positive, neutral, negative)
      - customerSentiment: (positive, neutral, negative)
      - agentPerformance: (excellent, good, average, poor)
      - keyPoints: [array of key points from the conversation]
      - actionItems: [array of recommended follow-up actions]
      - improvementAreas: [array of areas where the conversation could be improved]
    `;

    const analysisText = await this.generateResponse(prompt, [
      {
        role: 'system',
        content: 'You are an expert in call center conversation analysis. Only return valid JSON.',
      },
    ]);

    try {
      return JSON.parse(analysisText);
    } catch (error) {
      this.logger.error(`Failed to parse sentiment analysis result as JSON: ${analysisText}`);
      return {
        error: 'Failed to parse analysis result',
        rawText: analysisText,
      };
    }
  }

  /**
   * Generate embeddings for text using OpenAI's embedding models
   * This is used for vector search in the conversation context
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text.trim(),
      });

      return response.data[0].embedding;
    } catch (error) {
      this.logger.error(`Error generating embedding: ${error.message}`, error.stack);
      throw error;
    }
  }
}