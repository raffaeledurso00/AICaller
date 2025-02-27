import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TwilioService } from './twilio.service';
import { Call, CallDocument, CallStatus, CallOutcome } from '../schemas/call.schema';
import { ConversationService } from '../../ai/services/conversation.service';

@Injectable()
export class CallService {
  private readonly logger = new Logger(CallService.name);

  constructor(
    @InjectModel(Call.name) private readonly callModel: Model<CallDocument>,
    private readonly twilioService: TwilioService,
    private readonly conversationService: ConversationService,
  ) {}

  async createCall(callData: Partial<Call>): Promise<CallDocument> {
    this.logger.log(`Creating new call record for campaign: ${callData.campaign}`);
    
    const newCall = new this.callModel(callData);
    return newCall.save();
  }

  async findById(id: string): Promise<CallDocument> {
    const call = await this.callModel.findById(id)
      .populate('campaign')
      .populate('contact')
      .populate('supervisor')
      .exec();
      
    if (!call) {
      throw new NotFoundException(`Call with ID ${id} not found`);
    }
    
    return call;
  }

  async updateStatus(id: string, status: CallStatus): Promise<CallDocument> {
    this.logger.log(`Updating call ${id} status to ${status}`);
    
    const updatedCall = await this.callModel.findByIdAndUpdate(
      id,
      { status },
      { new: true },
    ).exec();
    
    if (!updatedCall) {
      throw new NotFoundException(`Call with ID ${id} not found`);
    }
    
    return updatedCall;
  }

  async updateCallDetails(id: string, details: Partial<Call>): Promise<CallDocument> {
    const updatedCall = await this.callModel.findByIdAndUpdate(
      id,
      details,
      { new: true },
    ).exec();
    
    if (!updatedCall) {
      throw new NotFoundException(`Call with ID ${id} not found`);
    }
    
    return updatedCall;
  }

  async completeCall(id: string, outcome: CallOutcome): Promise<CallDocument> {
    const now = new Date();
    const call = await this.findById(id);
    
    // Calculate duration if start time exists
    let duration = 0;
    if (call.startTime) {
      duration = Math.floor((now.getTime() - call.startTime.getTime()) / 1000);
    }
    
    // End the conversation in the AI service
    try {
      await this.conversationService.endConversation(id);
    } catch (error) {
      this.logger.error(`Error ending conversation for call ${id}: ${error.message}`);
      // Continue with call completion even if conversation ending fails
    }
    
    // Update the call record
    const completedCall = await this.callModel.findByIdAndUpdate(
      id,
      {
        status: CallStatus.COMPLETED,
        outcome,
        endTime: now,
        duration,
      },
      { new: true },
    ).exec();
    
    if (!completedCall) {
      throw new NotFoundException(`Call with ID ${id} not found`);
    }
    
    return completedCall;
  }

  async initiateOutboundCall(
    campaignId: string, 
    contactId: string,
    fromNumber: string,
    toNumber: string,
    webhookBaseUrl: string,
  ): Promise<CallDocument> {
    // Create the call record first
    const newCall = await this.createCall({
      campaign: new Types.ObjectId(campaignId) as any,
      contact: new Types.ObjectId(contactId) as any,
      fromNumber,
      toNumber,
      status: CallStatus.INITIATED,
      startTime: new Date(),
    });
    
// Generate webhook URLs
const callId = (newCall as any)._id.toString();
const voiceWebhookUrl = `${webhookBaseUrl}/api/telephony/webhook/voice/${callId}`;
const statusWebhookUrl = `${webhookBaseUrl}/api/telephony/webhook/status/${callId}`;
    try {
      // Initiate the call through Twilio
      const twilioCall = await this.twilioService.makeCall(
        toNumber,
        fromNumber,
        voiceWebhookUrl,
        statusWebhookUrl,
      );
      
      // Update the call record with Twilio SID
      await this.updateCallDetails(callId, {
        sid: twilioCall.sid,
      });
      
      return this.findById(callId);
    } catch (error) {
      // If call initiation fails, update the call status
      await this.updateCallDetails(callId, {
        status: CallStatus.FAILED,
        endTime: new Date(),
        duration: 0,
      });
      
      throw error;
    }
  }
  
  async processIncomingAudio(callId: string, audioUrl: string): Promise<string> {
    // In a real implementation, this would:
    // 1. Convert the audio to text using a Speech-to-Text service
    // 2. Process the text through the Conversation Service
    // 3. Return the AI response
    
    // For now, we'll use a simple placeholder
    this.logger.log(`Processing incoming audio for call ${callId} from ${audioUrl}`);
    
    // Mock: Extract a simple message from the recording URL (normally would use STT)
    const mockText = "Hello, I'm interested in learning more about your service.";
    
    // Process through conversation service
    const response = await this.conversationService.processUserInput(callId, mockText);
    
    // Add entry to call conversation (normally this would be done in conversationService)
    await this.callModel.findByIdAndUpdate(callId, {
      $push: {
        conversation: {
          timestamp: new Date(),
          speaker: 'human',
          message: mockText,
        }
      }
    });
    
    return response;
  }
  
  async getCampaignCalls(campaignId: string): Promise<CallDocument[]> {
    return this.callModel.find({ campaign: campaignId })
      .populate('contact')
      .sort({ startTime: -1 })
      .exec();
  }
  
  async getContactCalls(contactId: string): Promise<CallDocument[]> {
    return this.callModel.find({ contact: contactId })
      .populate('campaign')
      .sort({ startTime: -1 })
      .exec();
  }
}