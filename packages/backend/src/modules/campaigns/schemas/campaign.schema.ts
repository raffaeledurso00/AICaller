import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export enum CampaignStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum CampaignType {
  SALES = 'sales',
  SURVEY = 'survey',
  SUPPORT = 'support',
  APPOINTMENT = 'appointment',
  INFO_GATHERING = 'info_gathering',
  LEAD_QUALIFICATION = 'lead_qualification',
}

export type CampaignDocument = Campaign & Document & { _id: string };

@Schema({ timestamps: true })
export class Campaign {
  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop({
    type: String,
    enum: CampaignType,
    default: CampaignType.SALES,
  })
  type: CampaignType;

  @Prop({
    type: String,
    enum: CampaignStatus,
    default: CampaignStatus.DRAFT,
  })
  status: CampaignStatus;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  owner: User;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }] })
  supervisors: User[];

  @Prop({ required: true })
  scriptTemplate: string;

  @Prop({ type: Object })
  scriptVariables: Record<string, any>;

  @Prop()
  startDate: Date;

  @Prop()
  endDate: Date;
  
  @Prop({ default: 0 })
  maxConcurrentCalls: number;

  @Prop({ default: 0 })
  totalContacts: number;

  @Prop({ default: 0 })
  contactedCount: number;

  @Prop({ default: 0 })
  successCount: number;

  @Prop({ type: Object, default: {} })
  settings: {
    callRetryAttempts?: number;
    callRetryDelay?: number;
    callTimeWindow?: {
      start: string; // e.g., "09:00"
      end: string; // e.g., "17:00"
      timezone: string; // e.g., "America/New_York"
    };
    successCriteria?: Record<string, any>;
  };

  @Prop({ type: Object, default: {} })
  metrics: Record<string, any>;
}

export const CampaignSchema = SchemaFactory.createForClass(Campaign);