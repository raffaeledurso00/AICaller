import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum IntegrationType {
  SALESFORCE = 'salesforce',
  HUBSPOT = 'hubspot',
  ZOHO = 'zoho',
  CUSTOM = 'custom',
}

export type IntegrationDocument = Integration & Document;

@Schema({ timestamps: true })
export class Integration {
  @Prop({ required: true })
  name: string;

  @Prop({
    type: String,
    enum: IntegrationType,
    required: true,
  })
  type: IntegrationType;

  @Prop({ type: Object, required: true })
  config: Record<string, any>;

  @Prop({ type: Object, default: {} })
  fieldMapping: Record<string, string>;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  lastSyncDate?: Date;

  @Prop()
  lastErrorDate?: Date;

  @Prop()
  lastErrorMessage?: string;

  @Prop({ default: 0 })
  syncCount: number;

  @Prop({ default: 0 })
  errorCount: number;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const IntegrationSchema = SchemaFactory.createForClass(Integration);