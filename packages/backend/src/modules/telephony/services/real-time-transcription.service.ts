import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Call, CallDocument } from '../schemas/call.schema';
import { WebhookService } from '../../integrations/services/webhook.service';
import { WebhookEventType } from '../../integrations/enums/webhook-event-type.enum';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface TranscriptionSegment {
  id: string;
  callId: string;
  speaker: 'ai' | 'human';
  text: string;
  confidence: number;
  startTime: number; // milliseconds from call start
  endTime: number; // milliseconds from call start
  isFinal: boolean;
}

export interface CallTranscript {
  callId: string;
  segments: TranscriptionSegment[];
  summary?: string;
  keywords?: string[];
  sentimentScore?: number; // -1 to 1 scale
}

@Injectable()
export class RealTimeTranscriptionService {
  private readonly logger = new Logger(RealTimeTranscriptionService.name);
  private readonly transcripts = new Map<string, CallTranscript>();
  private readonly callStartTimes = new Map<string, Date>();
  private readonly segmentIdCounter = new Map<string, number>();
  private readonly enableRealTimeAnalysis: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly webhookService: WebhookService,
    private readonly eventEmitter: EventEmitter2,
    @InjectModel(Call.name) private readonly callModel: Model<CallDocument>,
  ) {
    this.enableRealTimeAnalysis = this.configService.get<boolean>('telephony.enableRealTimeAnalysis', false);
  }

  /**
   * Register a new call for real-time transcription
   */
  registerCall(callId: string): void {
    this.logger.log(`Registering call ${callId} for real-time transcription`);
    
    // Initialize transcript for this call
    this.transcripts.set(callId, {
      callId,
      segments: [],
    });
    
    // Record call start time
    this.callStartTimes.set(callId, new Date());
    
    // Initialize segment counter
    this.segmentIdCounter.set(callId, 0);
  }

  /**
   * Process a new audio segment from the call
   * This would typically be called by the Twilio webhook when audio is received
   */
  async processAudioSegment(
    callId: string,
    speaker: 'ai' | 'human',
    audioData: string, // base64 encoded audio or URL to audio
    startTime: number,
    endTime: number,
    mockText?: string, // Used for testing or when actual STT is not available
  ): Promise<TranscriptionSegment> {
    // Retrieve call transcript
    const transcript = this.transcripts.get(callId);
    if (!transcript) {
      throw new Error(`Call ${callId} not registered for transcription`);
    }
    
    try {
      // Generate a unique segment ID
      const segmentId = `${callId}-${this.getNextSegmentId(callId)}`;
      
      // In a production system, we would process the audio with a real-time STT service
      // For this implementation, we'll use the mock text if provided, or a generic message
      const text = mockText || (speaker === 'human' 
        ? "I'm interested in learning more about your service." 
        : "Thank you for your interest. Let me tell you more about our offerings.");
      
      // Create a new segment
      const segment: TranscriptionSegment = {
        id: segmentId,
        callId,
        speaker,
        text,
        confidence: 0.95, // Mock confidence score
        startTime,
        endTime,
        isFinal: true,
      };
      
      // Add the segment to the transcript
      transcript.segments.push(segment);
      
      // Store the message in the call document
      await this.callModel.findByIdAndUpdate(callId, {
        $push: {
          conversation: {
            timestamp: new Date(),
            speaker: segment.speaker,
            message: segment.text,
          },
        },
      });
      
      // Emit event for real-time monitoring
      this.eventEmitter.emit('transcription.segment', segment);
      
      // If real-time analysis is enabled, analyze the segment
      if (this.enableRealTimeAnalysis) {
        await this.analyzeSegment(transcript, segment);
      }
      
      // If this is a human speaker, send webhook notification
      if (speaker === 'human') {
        this.webhookService.triggerWebhookEvent({
          eventType: WebhookEventType.CONVERSATION_MILESTONE,
          data: {
            callId,
            segmentId: segment.id,
            text: segment.text,
            speaker: segment.speaker,
            timestamp: new Date().toISOString(),
          },
        }).catch(error => {
          this.logger.error(`Error triggering webhook for segment: ${error.message}`);
        });
      }
      
      return segment;
    } catch (error) {
      this.logger.error(`Error processing audio segment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Analyze a transcription segment for sentiment, keywords, etc.
   */
  private async analyzeSegment(
    transcript: CallTranscript,
    segment: TranscriptionSegment,
  ): Promise<void> {
    try {
      // In a production system, we would use NLP services to extract:
      // - Sentiment
      // - Keywords/entities
      // - Intent
      // - Etc.
      
      // For this implementation, we'll use a simple rule-based approach
      
      // Update transcript with mock analysis
      if (segment.speaker === 'human') {
        // Simple sentiment detection based on keywords
        const positiveKeywords = ['interested', 'great', 'good', 'yes', 'like', 'thank'];
        const negativeKeywords = ['not interested', 'expensive', 'no', 'bad', 'don\'t', 'cannot'];
        
        let sentimentScore = 0;
        const text = segment.text.toLowerCase();
        
        // Check for positive keywords
        for (const keyword of positiveKeywords) {
          if (text.includes(keyword)) {
            sentimentScore += 0.2;
          }
        }
        
        // Check for negative keywords
        for (const keyword of negativeKeywords) {
          if (text.includes(keyword)) {
            sentimentScore -= 0.2;
          }
        }
        
        // Clamp to range [-1, 1]
        sentimentScore = Math.max(-1, Math.min(1, sentimentScore));
        
        // Update transcript sentiment
        transcript.sentimentScore = sentimentScore;
        
        // Extract simple keywords
        const words = text.split(/\s+/);
        const keywords = words.filter(word => 
          word.length > 4 && !['about', 'would', 'could', 'should', 'their'].includes(word)
        );
        
        // Update transcript keywords
        transcript.keywords = Array.from(new Set([...(transcript.keywords || []), ...keywords]));
      }
    } catch (error) {
      this.logger.error(`Error analyzing segment: ${error.message}`, error.stack);
    }
  }

  /**
   * Get the full transcript for a call
   */
  getTranscript(callId: string): CallTranscript | null {
    return this.transcripts.get(callId) || null;
  }

  /**
   * Generate a formatted transcript text with timestamps
   */
  getFormattedTranscript(callId: string): string {
    const transcript = this.transcripts.get(callId);
    if (!transcript) {
      return '';
    }
    
    // Sort segments by start time
    const sortedSegments = [...transcript.segments].sort((a, b) => a.startTime - b.startTime);
    
    // Format each segment with timestamp and speaker
    return sortedSegments.map(segment => {
      const timeString = this.formatTimestamp(segment.startTime);
      return `[${timeString}] ${segment.speaker.toUpperCase()}: ${segment.text}`;
    }).join('\n\n');
  }

  /**
   * End transcription for a call and generate a summary
   */
  async endTranscription(callId: string): Promise<CallTranscript | null> {
    const transcript = this.transcripts.get(callId);
    if (!transcript) {
      return null;
    }
    
    try {
      // In a production system, we would generate a comprehensive summary
      // For this implementation, we'll use a simple approach
      
      const humanSegments = transcript.segments.filter(s => s.speaker === 'human');
      const aiSegments = transcript.segments.filter(s => s.speaker === 'ai');
      
      // Simple summary
      transcript.summary = `Call contained ${transcript.segments.length} segments, ` +
        `with ${humanSegments.length} from the customer and ${aiSegments.length} from the AI. ` +
        `Overall sentiment: ${this.describeSentiment(transcript.sentimentScore || 0)}`;
      
      // Store the summary in the call document
      await this.callModel.findByIdAndUpdate(callId, {
        $set: {
          'metadata.transcriptSummary': transcript.summary,
          'metadata.transcriptKeywords': transcript.keywords,
          'metadata.sentimentScore': transcript.sentimentScore,
        },
      });
      
      // Clean up resources
      this.callStartTimes.delete(callId);
      this.segmentIdCounter.delete(callId);
      
      // Don't remove from transcripts map to allow retrieval after call ends
      
      return transcript;
    } catch (error) {
      this.logger.error(`Error ending transcription: ${error.message}`, error.stack);
      return transcript;
    }
  }

  /**
   * Get the next segment ID for a call
   */
  private getNextSegmentId(callId: string): number {
    const counter = this.segmentIdCounter.get(callId) || 0;
    this.segmentIdCounter.set(callId, counter + 1);
    return counter;
  }

  /**
   * Format a timestamp in milliseconds to a readable string
   */
  private formatTimestamp(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Convert a sentiment score to a descriptive string
   */
  private describeSentiment(score: number): string {
    if (score > 0.5) return 'Very Positive';
    if (score > 0.1) return 'Positive';
    if (score > -0.1) return 'Neutral';
    if (score > -0.5) return 'Negative';
    return 'Very Negative';
  }
}