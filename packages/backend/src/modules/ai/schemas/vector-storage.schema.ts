// packages/backend/src/modules/ai/schemas/vector-store.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Call } from '../../telephony/schemas/call.schema';
import { Campaign } from '../../campaigns/schemas/campaign.schema';

export type VectorDocument = Vector & Document;

@Schema({ timestamps: true })
export class Vector {
  @Prop({ required: true })
  text: string;

  @Prop({ type: [Number], required: true })
  embedding: number[];

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Call', required: false })
  call?: Call;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Campaign', required: false })
  campaign?: Campaign;

  @Prop({ required: true })
  type: string; // 'user_input', 'ai_response', 'system_message', etc.

  @Prop()
  timestamp: Date;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const VectorSchema = SchemaFactory.createForClass(Vector);

// Create an index for vector similarity search
VectorSchema.index(
  { embedding: 1 },
  {
    name: 'embeddingIndex',
  }
);