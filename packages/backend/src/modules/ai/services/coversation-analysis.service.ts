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

      // Safely get start time
      const startTime = this.getStartTime(call);

      // Calculate basic metrics
      const metrics = this.calculateConversationMetrics(call, startTime);

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
   * Safely extract start time from call document
   */
  private getStartTime(call: Call | CallDocument): Date {
    if (call.startTime) return call.startTime;
    
    // Fallback to createdAt if startTime is not available
    const callAny = call as any;
    return callAny.createdAt || new Date();
  }

  /**
   * Calculate conversation metrics based on the call data
   */
  private calculateConversationMetrics(
    call: Call | CallDocument, 
    startTime: Date
  ): ConversationMetrics {
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

    // Safely get end time
    const endTime = this.getEndTime(call);
    const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

    // Count turns by speaker
    let aiTurns = 0;
    let humanTurns = 0;
    let previousSpeaker: 'ai' | 'human' | null = null;
    let previousTimestamp: Date | null = null;

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
        const timeBetweenMessages = new Date(msg.timestamp).getTime() - previousTimestamp.getTime();
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
      previousTimestamp = new Date(msg.timestamp);
    });

    // Calculate average AI response time
    if (aiTurns > 0) {
      metrics.aiResponseTime /= aiTurns;
    }

    // Calculate turns per minute
    metrics.turnsPerMinute = durationMinutes > 0 
      ? (aiTurns + humanTurns) / durationMinutes 
      : 0;

    // Calculate human engagement (ratio of human talk time to total talk time)
    const totalTalkTime = metrics.aiTalkTime + metrics.humanTalkTime;
    metrics.humanEngagement = totalTalkTime > 0 
      ? metrics.humanTalkTime / totalTalkTime 
      : 0;

    // Estimate silence time
    const totalCallDuration = this.getCallDuration(call);
    metrics.totalSilence = Math.max(0, totalCallDuration - totalTalkTime);

    return metrics;
  }

  /**
   * Safely get end time from call document
   */
  private getEndTime(call: Call | CallDocument): Date {
    if (call.endTime) return call.endTime;
    
    // Fallback to current time if end time is not available
    const callAny = call as any;
    return callAny.updatedAt || new Date();
  }

  /**
   * Get call duration in seconds
   */
  private getCallDuration(call: Call | CallDocument): number {
    // Check if duration is directly available
    if (call.duration) return call.duration;

    // Try to calculate duration from start and end times
    const startTime = this.getStartTime(call);
    const endTime = this.getEndTime(call);
    
    return Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
  }

  /**
   * Analyze sentiment of a text
   */
  private async analyzeSentiment(text: string): Promise<SentimentAnalysis> {
    try {
      const prompt = `
        Analyze the sentiment of the following text in detail:
        "${text}"
        
        Return a JSON object with:
        - overall sentiment (positive, neutral, or negative)
        - confidence score (0-1)
        - optional segments with individual sentiment scores
      `;

      const result = await this.openAiService.generateResponse(prompt, [
        {
          role: 'system',
          content: 'You are a sentiment analysis tool. Return a valid JSON response.',
        },
      ]);

      return JSON.parse(result);
    } catch (error) {
      this.logger.error(`Sentiment analysis error: ${error.message}`, error.stack);
      
      // Return a default neutral sentiment if analysis fails
      return {
        overall: 'neutral',
        confidence: 0.5,
        segments: [],
      };
    }
  }

  /**
   * Generate conversation insights
   */
  private async generateConversationInsights(
    transcript: string,
    call: Call | CallDocument,
  ): Promise<ConversationInsights> {
    try {
      const prompt = `
        Analyze this conversation transcript and provide insights:
        ${transcript}
        
        Return a JSON object with:
        - key topics discussed
        - main concerns
        - potential opportunities
        - missed points
        - recommended next steps
        - probability of success
      `;

      const result = await this.openAiService.generateResponse(prompt, [
        {
          role: 'system',
          content: 'You are an expert conversation analyst. Return a precise JSON response.',
        },
      ]);

      const parsedResult = JSON.parse(result);
      return {
        keyTopics: parsedResult.keyTopics || [],
        keyConcerns: parsedResult.keyConcerns || [],
        opportunities: parsedResult.opportunities || [],
        missedPoints: parsedResult.missedPoints || [],
        nextSteps: parsedResult.nextSteps || [],
        successProbability: parsedResult.successProbability || 0,
      };
    } catch (error) {
      this.logger.error(`Insights generation error: ${error.message}`, error.stack);
      
      // Return a default insights object if generation fails
      return {
        keyTopics: [],
        keyConcerns: [],
        opportunities: [],
        missedPoints: [],
        nextSteps: [],
        successProbability: 0,
      };
    }
  }
}