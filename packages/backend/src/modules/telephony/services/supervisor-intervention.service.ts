import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Call, CallDocument, CallStatus } from '../schemas/call.schema';
import { TwilioService } from './twilio.service';
import { WebhookService } from '../../integrations/services/webhook.service';
import { WebhookEventType } from '../../integrations/enums/webhook-event-type.enum';

export interface InterventionMessage {
  callId: string;
  supervisorId: string;
  message: string;
  timestamp: Date;
  type: 'suggestion' | 'override' | 'transfer' | 'end';
}

export interface CallIntervention {
  callId: string;
  supervisorId: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'ended';
  messages: InterventionMessage[];
  isTransferred: boolean;
}

@Injectable()
export class SupervisorInterventionService {
  private readonly logger = new Logger(SupervisorInterventionService.name);
  private readonly activeInterventions = new Map<string, CallIntervention>();

  constructor(
    @InjectModel(Call.name) private readonly callModel: Model<CallDocument>,
    private readonly twilioService: TwilioService,
    private readonly webhookService: WebhookService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Start supervisor intervention for a call
   */
  async startIntervention(callId: string, supervisorId: string): Promise<CallIntervention> {
    try {
      // Check if the call exists
      const call = await this.callModel.findById(callId).exec();
      if (!call) {
        throw new NotFoundException(`Call with ID ${callId} not found`);
      }
      
      // Check if the call is in progress
      if (call.status !== CallStatus.IN_PROGRESS) {
        throw new Error(`Call is not in progress (current status: ${call.status})`);
      }
      
      // Check if intervention is already in progress
      if (this.activeInterventions.has(callId)) {
        return this.activeInterventions.get(callId);
      }
      
      // Create a new intervention
      const intervention: CallIntervention = {
        callId,
        supervisorId,
        startTime: new Date(),
        status: 'active',
        messages: [],
        isTransferred: false,
      };
      
      // Store the intervention
      this.activeInterventions.set(callId, intervention);
      
      // Update the call document with supervisor information
      await this.callModel.findByIdAndUpdate(callId, {
        supervisor: supervisorId,
        'metadata.supervisorIntervention': true,
        'metadata.interventionStartTime': intervention.startTime,
      });
      
      // Emit event for monitoring
      this.eventEmitter.emit('call.intervention.started', {
        callId,
        supervisorId,
        timestamp: intervention.startTime,
      });
      
      // Send webhook notification
      this.webhookService.triggerWebhookEvent({
        eventType: WebhookEventType.CONVERSATION_MILESTONE,
        data: {
          callId,
          supervisorId,
          type: 'intervention_started',
          timestamp: intervention.startTime.toISOString(),
        },
      }).catch(error => {
        this.logger.error(`Error triggering webhook for intervention start: ${error.message}`);
      });
      
      return intervention;
    } catch (error) {
      this.logger.error(`Error starting intervention: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Send a message during intervention
   */
  async sendInterventionMessage(
    callId: string,
    supervisorId: string,
    message: string,
    type: 'suggestion' | 'override' | 'transfer' | 'end' = 'suggestion',
  ): Promise<InterventionMessage> {
    try {
      // Check if intervention exists
      const intervention = this.activeInterventions.get(callId);
      if (!intervention) {
        throw new Error(`No active intervention for call ${callId}`);
      }
      
      // Check if the supervisor matches
      if (intervention.supervisorId !== supervisorId) {
        throw new Error('Supervisor ID does not match the intervention');
      }
      
      // Check if intervention is still active
      if (intervention.status !== 'active') {
        throw new Error('Intervention is no longer active');
      }
      
      // Create intervention message
      const interventionMessage: InterventionMessage = {
        callId,
        supervisorId,
        message,
        timestamp: new Date(),
        type,
      };
      
      // Add the message to the intervention
      intervention.messages.push(interventionMessage);
      
      // Handle different message types
      if (type === 'override') {
        // For override, the supervisor's message becomes the AI's message
        await this.callModel.findByIdAndUpdate(callId, {
          $push: {
            conversation: {
              timestamp: new Date(),
              speaker: 'ai',
              message,
              metadata: {
                overriddenBySupervisor: true,
                supervisorId,
              },
            },
          },
        });
        
        // Update in Twilio (in real implementation)
        try {
          // This would need to interrupt the current AI response
          // and replace it with the supervisor's message
          await this.twilioService.sendTextToCall(callId, message);
        } catch (error) {
          this.logger.error(`Error sending override message to Twilio: ${error.message}`);
        }
      } else if (type === 'transfer') {
        // Mark the intervention as transferred
        intervention.isTransferred = true;
        
        // In a real implementation, we would transfer the call to the supervisor
        // For now, we'll just update the call status
        await this.callModel.findByIdAndUpdate(callId, {
          'metadata.transferredToSupervisor': true,
          'metadata.transferTimestamp': new Date(),
        });
      } else if (type === 'end') {
        // End the call
        await this.endIntervention(callId, supervisorId);
        
        // End the call in Twilio (in real implementation)
        try {
          const call = await this.callModel.findById(callId).exec();
          if (call?.sid) {
            await this.twilioService.endCall(call.sid);
          }
        } catch (error) {
          this.logger.error(`Error ending call in Twilio: ${error.message}`);
        }
      }
      
      // Emit event for monitoring
      this.eventEmitter.emit('call.intervention.message', interventionMessage);
      
      return interventionMessage;
    } catch (error) {
      this.logger.error(`Error sending intervention message: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * End a supervisor intervention
   */
  async endIntervention(callId: string, supervisorId: string): Promise<CallIntervention> {
    try {
      // Check if intervention exists
      const intervention = this.activeInterventions.get(callId);
      if (!intervention) {
        throw new Error(`No active intervention for call ${callId}`);
      }
      
      // Check if the supervisor matches
      if (intervention.supervisorId !== supervisorId) {
        throw new Error('Supervisor ID does not match the intervention');
      }
      
      // Check if intervention is still active
      if (intervention.status !== 'active') {
        return intervention;
      }
      
      // End the intervention
      intervention.status = 'ended';
      intervention.endTime = new Date();
      
      // Update the call document
      await this.callModel.findByIdAndUpdate(callId, {
        'metadata.interventionEndTime': intervention.endTime,
      });
      
      // Emit event for monitoring
      this.eventEmitter.emit('call.intervention.ended', {
        callId,
        supervisorId,
        timestamp: intervention.endTime,
        duration: intervention.endTime.getTime() - intervention.startTime.getTime(),
        messageCount: intervention.messages.length,
      });
      
      // Send webhook notification
      this.webhookService.triggerWebhookEvent({
        eventType: WebhookEventType.CONVERSATION_MILESTONE,
        data: {
          callId,
          supervisorId,
          type: 'intervention_ended',
          timestamp: intervention.endTime.toISOString(),
          duration: intervention.endTime.getTime() - intervention.startTime.getTime(),
          messageCount: intervention.messages.length,
        },
      }).catch(error => {
        this.logger.error(`Error triggering webhook for intervention end: ${error.message}`);
      });
      
      return intervention;
    } catch (error) {
      this.logger.error(`Error ending intervention: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get an active intervention
   */
  getIntervention(callId: string): CallIntervention | null {
    return this.activeInterventions.get(callId) || null;
  }

  /**
   * Check if a call has an active intervention
   */
  hasActiveIntervention(callId: string): boolean {
    const intervention = this.activeInterventions.get(callId);
    return intervention !== undefined && intervention.status === 'active';
  }

  /**
   * Get all active interventions
   */
  getAllActiveInterventions(): CallIntervention[] {
    return Array.from(this.activeInterventions.values())
      .filter(intervention => intervention.status === 'active');
  }
}