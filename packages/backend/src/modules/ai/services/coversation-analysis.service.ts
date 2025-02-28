import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAiService } from './openai.service';
import { Call, CallDocument } from '../../telephony/schemas/call.schema';

export interface SentimentAnalysis {
  overall: 'positive' | 'neutral' | 'negative';
  confidence: number;
  segments: Array<{
    text: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    score: number;
  }>;
}

export interface EntityAnalysis {
  type: string;
  value: string;
  confidence: number;
  startIndex?: number;
  endIndex?: number;
}

export interface IntentAnalysis {
  intent: string;
  confidence: number;
  entities?: EntityAnalysis[];
}

export interface ConversationMetrics {
  aiTalkTime: number;
  humanTalkTime: number;
  aiResponseTime: number;
  totalSilence: number;
  interruptions: number;
  turnsPerMinute: number;
  humanEngagement: number;
}

export interface ConversationInsights {
  keyTopics: string[];
  keyConcerns: string[];
  opportunities: string[];
  missedPoints: string[];
  nextSteps: string[];
  successProbability: number;
}

@Injectable()
export class ConversationAnalysisService {
  private readonly logger = new Logger(ConversationAnalysisService.name);

  constructor(
    private readonly openAiService: OpenAiService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Analyze the sentiment of a conversation or message
   */
  async analyzeSentiment(
    text: string,
    options: { detailed?: boolean } = {},
  ): Promise<SentimentAnalysis> {
    this.logger.debug(`Analyzing sentiment for text of length ${text.length}`);
    
    try {
      const prompt = options.detailed
        ? `Analyze the sentiment of the following text in detail. Provide an overall sentiment (positive, neutral, or negative), a confidence score (0-1), and analyze individual segments of the text with their own sentiment scores:

Text: "${text}"

Return your analysis as valid JSON with this structure:
{
  "overall": "positive|neutral|negative",
  "confidence": 0.85,
  "segments": [
    {
      "text": "segment text here",
      "sentiment": "positive|neutral|negative",
      "score": 0.8
    }
  ]
}`
        : `Analyze the sentiment of the following text. Provide an overall sentiment (positive, neutral, or negative) and a confidence score (0-1):

Text: "${text}"

Return your analysis as valid JSON with this structure:
{
  "overall": "positive|neutral|negative",
  "confidence": 0.85,
  "segments": []
}`;

      const result = await this.openAiService.generateResponse(prompt, [
        {
          role: 'system',
          content: 'You are a precise sentiment analysis tool that returns only well-formed JSON without any additional text.',
        },
      ]);

      try {
        // Parse and validate the response
        const parsedResult = JSON.parse(result);
        return {
          overall: parsedResult.overall,
          confidence: parsedResult.confidence,
          segments: parsedResult.segments || [],
        };
      } catch (parseError) {
        this.logger.error(`Failed to parse sentiment analysis result: ${parseError.message}`);
        throw new Error('Invalid sentiment analysis result format');
      }
    } catch (error) {
      this.logger.error(`Error analyzing sentiment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Extract entities from a text (names, dates, products, locations, etc.)
   */
  async extractEntities(
    text: string,
    targetEntities: string[] = [],
  ): Promise<EntityAnalysis[]> {
    this.logger.debug(`Extracting entities from text of length ${text.length}`);
    
    try {
      const entitiesInstruction = targetEntities.length > 0
        ? `Focus on extracting these specific entity types: ${targetEntities.join(', ')}.`
        : 'Extract all relevant entities such as names, dates, times, locations, organizations, products, services, amounts, numbers, etc.';
      
      const prompt = `Extract named entities from the following text. ${entitiesInstruction}

Text: "${text}"

Return the entities as valid JSON with this structure:
[
  {
    "type": "person",
    "value": "John Smith",
    "confidence": 0.95
  },
  {
    "type": "date",
    "value": "next Tuesday",
    "confidence": 0.8
  }
]`;

      const result = await this.openAiService.generateResponse(prompt, [
        {
          role: 'system',
          content: 'You are a precise entity extraction tool that returns only well-formed JSON without any additional text.',
        },
      ]);

      try {
        // Parse and validate the response
        const parsedResult = JSON.parse(result);
        return parsedResult;
      } catch (parseError) {
        this.logger.error(`Failed to parse entity extraction result: ${parseError.message}`);
        throw new Error('Invalid entity extraction result format');
      }
    } catch (error) {
      this.logger.error(`Error extracting entities: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Detect intents from user messages
   */
  async detectIntent(
    text: string,
    possibleIntents: string[] = [],
  ): Promise<IntentAnalysis> {
    this.logger.debug(`Detecting intent for text of length ${text.length}`);
    
    try {
      const intentsInstruction = possibleIntents.length > 0
        ? `Choose the most likely intent from this list: ${possibleIntents.join(', ')}.`
        : 'Identify the most likely intent expressed in the text.';
      
      const prompt = `Detect the user's intent from the following text. ${intentsInstruction}

Text: "${text}"

Return the intent analysis as valid JSON with this structure:
{
  "intent": "request_information",
  "confidence": 0.85,
  "entities": [
    {
      "type": "product",
      "value": "premium subscription",
      "confidence": 0.9
    }
  ]
}`;

      const result = await this.openAiService.generateResponse(prompt, [
        {
          role: 'system',
          content: 'You are a precise intent detection tool that returns only well-formed JSON without any additional text.',
        },
      ]);

      try {
        // Parse and validate the response
        const parsedResult = JSON.parse(result);
        return {
          intent: parsedResult.intent,
          confidence: parsedResult.confidence,
          entities: parsedResult.entities || [],
        };
      } catch (parseError) {
        this.logger.error(`Failed to parse intent detection result: ${parseError.message}`);
        throw new Error('Invalid intent detection result format');
      }
    } catch (error) {
      this.logger.error(`Error detecting intent: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Analyze the full conversation for insights and metrics
   */
  async analyzeConversation(call: Call | CallDocument): Promise<{
    insights: ConversationInsights;
    metrics: ConversationMetrics;
    sentiment: SentimentAnalysis;
  }> {
    this.logger.log(`Analyzing conversation for call ${call._id}`);
    
    try {
      if (!call.conversation || call.conversation.length === 0) {
        throw new Error('No conversation data available for analysis');
      }

      // Prepare conversation transcript
      const transcript = call.conversation
        .map(msg => `${msg.speaker.toUpperCase()}: ${msg.message}`)
        .join('\n\n');

      // Calculate basic metrics
      const metrics = this.calculateConversationMetrics(call);

      // Get AI-generated insights
      const insights = await this.generateConversationInsights(transcript, call);

      // Get overall sentiment
      const fullText = call.conversation
        .filter(msg => msg.speaker === 'human')
        .map(msg => msg.message)
        .join(' ');
      
      const sentiment = await this.analyzeSentiment(fullText);

      return {
        insights,
        metrics,
        sentiment,
      };
    } catch (error) {
      this.logger.error(`Error analyzing conversation: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Calculate conversation metrics based on the call data
   */
  private calculateConversationMetrics(call: Call | CallDocument): ConversationMetrics {
    // Initialize metrics
    const metrics: ConversationMetrics = {
      aiTalkTime: 0,
      humanTalkTime: 0,
      aiResponseTime: 0,
      totalSilence: 0,
      interruptions: 0,
      turnsPerMinute: 0,
      humanEngagement: 0,
    };

    if (!call.conversation || call.conversation.length < 2) {
      return metrics;
    }

    // Calculate conversation duration in minutes
    const startTime = new Date(call.startTime || call.createdAt).getTime();
    const endTime = new Date(call.endTime || new Date()).getTime();
    const durationMinutes = (endTime - startTime) / (1000 * 60);

    // Count turns by speaker
    let aiTurns = 0;
    let humanTurns = 0;
    let previousSpeaker = null;
    let previousTimestamp = null;

    call.conversation.forEach((msg, index) => {
      // Count turns
      if (msg.speaker === 'ai') {
        aiTurns++;
      } else {
        humanTurns++;
      }

      // Estimate talk time based on message length (very rough approximation)
      const wordCount = msg.message.split(' ').length;
      const estimatedSeconds = wordCount * 0.5; // Assuming 2 words per second

      if (msg.speaker === 'ai') {
        metrics.aiTalkTime += estimatedSeconds;
      } else {
        metrics.humanTalkTime += estimatedSeconds;
      }

      // Detect interruptions (speaker changes without enough time between messages)
      if (previousSpeaker && previousSpeaker !== msg.speaker && previousTimestamp) {
        const timeBetweenMessages = new Date(msg.timestamp).getTime() - new Date(previousTimestamp).getTime();
        if (timeBetweenMessages < 1000) { // Less than 1 second
          metrics.interruptions++;
        }
      }

      // Calculate AI response time
      if (msg.speaker === 'ai' && index > 0 && call.conversation[index - 1].speaker === 'human') {
        const humanTimestamp = new Date(call.conversation[index - 1].timestamp).getTime();
        const aiTimestamp = new Date(msg.timestamp).getTime();
        metrics.aiResponseTime += (aiTimestamp - humanTimestamp) / 1000;
      }

      previousSpeaker = msg.speaker;
      previousTimestamp = msg.timestamp;
    });

    // Calculate average AI response time
    if (aiTurns > 0) {
      metrics.aiResponseTime /= aiTurns;
    }

    // Calculate turns per minute
    metrics.turnsPerMinute = durationMinutes > 0 ? (aiTurns + humanTurns) / durationMinutes : 0;

    // Calculate human engagement (ratio of human talk time to total talk time)
    const totalTalkTime = metrics.aiTalkTime + metrics.humanTalkTime;
    metrics.humanEngagement = totalTalkTime > 0 ? metrics.humanTalkTime / totalTalkTime : 0;

    // Estimate silence time
    const totalCallDuration = call.duration || Math.round(durationMinutes * 60);
    metrics.totalSilence = Math.max(0, totalCallDuration - totalTalkTime);

    return metrics;
  }

  /**
   * Generate conversation insights using AI
   */
  private async generateConversationInsights(
    transcript: string,
    call: Call | CallDocument,
  ): Promise<ConversationInsights> {
    try {
      // We may need to truncate very long transcripts to fit the AI model's context window
      const maxTranscriptLength = 10000;
      const truncatedTranscript = transcript.length > maxTranscriptLength
        ? `${transcript.substring(0, maxTranscriptLength / 2)}...[TRUNCATED]...${transcript.substring(transcript.length - maxTranscriptLength / 2)}`
        : transcript;

      const prompt = `Analyze the following conversation transcript between an AI agent and a human customer. Identify key topics discussed, main concerns expressed by the customer, potential opportunities, any important points that were missed, and recommended next steps. Also estimate the probability of a successful outcome.

Conversation Purpose: ${call.outcome || 'Not specified'}

Transcript:
${truncatedTranscript}

Return your analysis as valid JSON with this structure:
{
  "keyTopics": ["topic1", "topic2"],
  "keyConcerns": ["concern1", "concern2"],
  "opportunities": ["opportunity1", "opportunity2"],
  "missedPoints": ["point1", "point2"],
  "nextSteps": ["step1", "step2"],
  "successProbability": 0.75
}`;

      const result = await this.openAiService.generateResponse(prompt, [
        {
          role: 'system',
          content: 'You are an expert conversation analyst that identifies key insights and returns only well-formed JSON without any additional text.',
        },
      ]);

      try {
        // Parse and validate the response
        const parsedResult = JSON.parse(result);
        return {
          keyTopics: parsedResult.keyTopics || [],
          keyConcerns: parsedResult.keyConcerns || [],
          opportunities: parsedResult.opportunities || [],
          missedPoints: parsedResult.missedPoints || [],
          nextSteps: parsedResult.nextSteps || [],
          successProbability: parsedResult.successProbability || 0,
        };
      } catch (parseError) {
        this.logger.error(`Failed to parse conversation insights: ${parseError.message}`);
        throw new Error('Invalid conversation insights format');
      }
    } catch (error) {
      this.logger.error(`Error generating conversation insights: ${error.message}`, error.stack);
      throw new Error(`Failed to generate conversation insights: ${error.message}`);
    }
  }

  /**
   * Analyze a specific message within a conversation
   */
  async analyzeMessage(
    message: string,
    context: {
      previousMessages: Array<{ speaker: string; message: string }>;
      campaignType?: string;
      stage?: string;
    },
  ): Promise<{
    sentiment: SentimentAnalysis;
    intent: IntentAnalysis;
    entities: EntityAnalysis[];
    suggestedResponse?: string;
  }> {
    this.logger.debug(`Analyzing message: ${message.substring(0, 50)}...`);
    
    try {
      // Run parallel analyses for efficiency
      const [sentiment, intent, entities] = await Promise.all([
        this.analyzeSentiment(message),
        this.detectIntent(message),
        this.extractEntities(message),
      ]);

      // Generate a suggested response if appropriate
      let suggestedResponse: string | undefined;
      
      if (context.previousMessages && context.previousMessages.length > 0) {
        const conversationHistory = [
          ...context.previousMessages.map(msg => ({
            role: msg.speaker === 'ai' ? 'assistant' as const : 'user' as const,
            content: msg.message,
          })),
          { role: 'user' as const, content: message },
        ];

        suggestedResponse = await this.openAiService.generateResponse(
          'Generate a helpful response to the customer based on their message and the conversation history.',
          [
            {
              role: 'system',
              content: `You are an AI assistant for ${context.campaignType || 'a business'}. The conversation is currently in the ${context.stage || 'middle'} stage.`,
            },
            ...conversationHistory,
          ],
        );
      }

      return {
        sentiment,
        intent,
        entities,
        suggestedResponse,
      };
    } catch (error) {
      this.logger.error(`Error analyzing message: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Generate conversation summaries for reporting and review
   */
  async generateSummary(call: Call | CallDocument): Promise<string> {
    this.logger.log(`Generating summary for call ${call._id}`);
    
    try {
      if (!call.conversation || call.conversation.length === 0) {
        throw new Error('No conversation data available for summary');
      }

      // Prepare conversation transcript
      const transcript = call.conversation
        .map(msg => `${msg.speaker.toUpperCase()}: ${msg.message}`)
        .join('\n\n');

      const prompt = `Provide a concise summary of the following conversation between an AI agent and a customer. Focus on the key points discussed, any decisions made, and the outcome of the conversation.

Conversation Context:
- Purpose: ${call.outcome || 'Not specified'}
- Date: ${new Date(call.startTime || call.createdAt).toLocaleDateString()}
- Duration: ${call.duration ? `${Math.floor(call.duration / 60)}:${String(call.duration % 60).padStart(2, '0')}` : 'Unknown'}

Transcript:
${transcript}

Your summary should be 3-5 paragraphs long and cover the main points of the conversation.`;

      return this.openAiService.generateResponse(prompt, [
        {
          role: 'system',
          content: 'You are an expert at summarizing conversations in a clear, concise, and professional manner.',
        },
      ]);
    } catch (error) {
      this.logger.error(`Error generating summary: ${error.message}`, error.stack);
      throw error;
    }
  }
}