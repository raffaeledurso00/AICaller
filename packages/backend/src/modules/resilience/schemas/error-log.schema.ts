import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class ErrorLog {
  @Prop({ required: true })
  service: string;

  @Prop({ required: true })
  errorMessage: string;

  @Prop()
  errorStack?: string;

  @Prop({ required: true })
  timestamp: Date;

  @Prop({ type: Object })
  metadata: Record<string, any>;
}

export type ErrorLogDocument = ErrorLog & Document;
export const ErrorLogSchema = SchemaFactory.createForClass(ErrorLog);

// Add indexes for common queries
ErrorLogSchema.index({ service: 1, timestamp: -1 });
ErrorLogSchema.index({ timestamp: -1 });