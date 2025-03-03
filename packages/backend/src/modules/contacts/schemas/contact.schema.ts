import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Campaign } from '../../campaigns/schemas/campaign.schema';

export enum ContactStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DO_NOT_CALL = 'do_not_call',
}


export type ContactDocument = Contact & Document;

@Schema({ timestamps: true })
export class Contact {
  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true })
  externalIds: {
    salesforce?: string;
    hubspot?: string;
    zoho?: string;
    custom?: string;
  };
  
  @Prop({ required: true })
  phoneNumber: string;

  @Prop()
  email: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Campaign', required: true })
  campaign: Campaign;

  @Prop({
    type: String,
    enum: ContactStatus,
    default: ContactStatus.PENDING,
  })
  status: ContactStatus;

  @Prop({ default: 0 })
  attemptCount: number;

  @Prop()
  lastAttemptDate: Date;

  @Prop()
  nextAttemptDate: Date;

  @Prop()
  scheduledTime: Date;

  @Prop({ default: false })
  isSuccessful: boolean;

  @Prop()
  successDate: Date;

  @Prop({ type: Object, default: {} })
  data: Record<string, any>;

  @Prop({ type: [{ type: Object }] })
  history: Array<{
    timestamp: Date;
    action: string;
    notes?: string;
    data?: Record<string, any>;
  }>;

  @Prop({ type: [String] })
  tags: string[];

  @Prop({ type: Object, default: {} })
  customFields: Record<string, any>;
}

export const ContactSchema = SchemaFactory.createForClass(Contact);