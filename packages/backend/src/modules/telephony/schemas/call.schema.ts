import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Campaign } from '../../campaigns/schemas/campaign.schema';
import { Contact } from '../../contacts/schemas/contact.schema';
import { User } from '../../users/schemas/user.schema';

export enum CallStatus {
  INITIATED = 'initiated',
  RINGING = 'ringing',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  NO_ANSWER = 'no_answer',
  BUSY = 'busy',
  VOICEMAIL = 'voicemail',
}

export enum CallOutcome {
  SUCCESS = 'success',
  PARTIAL_SUCCESS = 'partial_success',
  CALLBACK_REQUESTED = 'callback_requested',
  TRANSFER_REQUESTED = 'transfer_requested',
  NOT_INTERESTED = 'not_interested',
  WRONG_NUMBER = 'wrong_number',
  DO_NOT_CALL = 'do_not_call',
  TECHNICAL_ISSUE = 'technical_issue',
  OTHER = 'other',
}

export type CallDocument = Call & Document;

@Schema({ timestamps: true })
export class Call {
  @Prop({ required: true })
  sid: string; // Twilio Call SID or other provider's ID

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Campaign', required: true })
  campaign: Campaign;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Contact', required: true })
  contact: Contact;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  supervisor: User;

  @Prop({ required: true })
  fromNumber: string;

  @Prop({ required: true })
  toNumber: string;

  @Prop({
    type: String,
    enum: CallStatus,
    default: CallStatus.INITIATED,
  })
  status: CallStatus;

  @Prop()
  startTime: Date;

  @Prop()
  endTime: Date;

  @Prop()
  duration: number; // in seconds

  @Prop({
    type: String,
    enum: CallOutcome,
  })
  outcome: CallOutcome;

  @Prop()
  recordingUrl: string;

  @Prop()
  transcriptionUrl: string;

  @Prop({ type: [Object] })
  conversation: Array<{
    timestamp: Date;
    speaker: 'ai' | 'human';
    message: string;
    sentiment?: string;
    entities?: Record<string, any>;
    intentDetected?: string;
  }>;

  @Prop()
  notes: string;

  @Prop({ type: Object, default: {} })
  metrics: {
    aiResponseTime?: number; // Average response time in ms
    humanSpeakingTime?: number; // Total time human spoke in seconds
    aiSpeakingTime?: number; // Total time AI spoke in seconds
    silenceTime?: number; // Total silence time in seconds
    interruptions?: number; // Number of times speakers interrupted each other
  };

  @Prop({ type: Object, default: {} })
  aiContext: Record<string, any>;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const CallSchema = SchemaFactory.createForClass(Call);