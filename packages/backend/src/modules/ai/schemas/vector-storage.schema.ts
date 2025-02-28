import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type VectorStorageDocument = VectorStorage & Document;

@Schema({ timestamps: true })
export class VectorStorage {
  @Prop({ required: true })
  callId: string;

  @Prop({ required: true })
  conversationId: string;

  @Prop({ required: true, index: true })
  text: string;

  @Prop({ type: [Number], required: true })
  embedding: number[];

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop({ type: MongooseSchema.Types.Mixed })
  context: any;

  @Prop({ default: 0 })
  relevanceScore: number;

  @Prop()
  timestamp: Date;
}

export const VectorStorageSchema = SchemaFactory.createForClass(VectorStorage);

// Add text index for basic search capabilities
VectorStorageSchema.index({ text: 'text' });

// Add compound index for efficiently retrieving conversation chunks
VectorStorageSchema.index({ conversationId: 1, timestamp: -1 });