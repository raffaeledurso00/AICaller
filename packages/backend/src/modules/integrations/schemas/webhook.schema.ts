import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { WebhookEventType } from '../enums/webhook-event-type.enum';

export type WebhookDocument = Webhook & Document;

@Schema({ timestamps: true })
export class Webhook {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  url: string;

  @Prop({ type: [String], enum: WebhookEventType, required: true })
  events: WebhookEventType[];

  @Prop({ required: true })
  secret: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  lastSuccessfulDelivery?: Date;

  @Prop()
  lastFailedDelivery?: Date;

  @Prop()
  lastErrorMessage?: string;

  @Prop({ default: 0 })
  successCount: number;

  @Prop({ default: 0 })
  errorCount: number;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const WebhookSchema = SchemaFactory.createForClass(Webhook);