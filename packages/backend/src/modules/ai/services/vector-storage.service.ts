// packages/backend/src/modules/ai/services/vector-storage.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OpenAiService } from './openai.service';
import { ConfigService } from '@nestjs/config';

// Define the schema for vector storage
import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class VectorEntry {
  @Prop({ required: true })
  text: string;

  @Prop({ required: true, type: [Number] })
  embedding: number[];

  @Prop({ required: true })
  callId: string;

  @Prop({ required: true })
  metadata: Record<string, any>;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export type VectorEntryDocument = VectorEntry & Document;
export const VectorEntrySchema = SchemaFactory.createForClass(VectorEntry);

// Create an index for similarity search
VectorEntrySchema.index({ callId: 1 });

@Injectable()
export class VectorStorageService {
  private readonly logger = new Logger(VectorStorageService.name);
  private readonly embeddingModel: string;

  constructor(
    @InjectModel(VectorEntry.name) private vectorModel: Model<VectorEntryDocument>,
    private readonly openAiService: OpenAiService,
    private readonly configService: ConfigService,
  ) {
    this.embeddingModel = this.configService.get<string>('openai.embeddingModel') || 'text-embedding-3-small';
  }

  /**
   * Stores a conversation entry with its vector embedding
   */
  async storeEntry(text: string, callId: string, metadata: Record<string, any> = {}): Promise<VectorEntryDocument> {
    try {
      // Generate embedding for the text
      const embedding = await this.generateEmbedding(text);
      
      // Create and store the vector entry
      const vectorEntry = new this.vectorModel({
        text,
        embedding,
        callId,
        metadata,
      });
      
      await vectorEntry.save();
      this.logger.debug(`Stored vector entry for call ${callId}`);
      
      return vectorEntry;
    } catch (error) {
      this.logger.error(`Error storing vector entry: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find similar conversation entries for context
   */
  async findSimilar(text: string, callId: string, limit: number = 5): Promise<VectorEntryDocument[]> {
    try {
      // Generate embedding for the query text
      const queryEmbedding = await this.generateEmbedding(text);
      
      // Find vector entries for the same call
      const entries = await this.vectorModel
        .find({ callId })
        .sort({ createdAt: -1 })
        .limit(20); // Get recent entries first
      
      if (!entries.length) {
        return [];
      }
      
      // Calculate cosine similarity for each entry
      const entriesWithSimilarity = entries.map(entry => {
        const similarity = this.calculateCosineSimilarity(queryEmbedding, entry.embedding);
        return { entry, similarity };
      });
      
      // Sort by similarity and return top matches
      return entriesWithSimilarity
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .map(item => item.entry);
    } catch (error) {
      this.logger.error(`Error finding similar entries: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Get conversation history for a call
   */
  async getCallHistory(callId: string, limit: number = 10): Promise<VectorEntryDocument[]> {
    return this.vectorModel
      .find({ callId })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  /**
   * Clear conversation history for a call
   */
  async clearCallHistory(callId: string): Promise<void> {
    await this.vectorModel.deleteMany({ callId });
    this.logger.debug(`Cleared vector storage for call ${callId}`);
  }

  /**
   * Generate embedding for text using OpenAI
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const embedding = await this.openAiService.createEmbedding(text, this.embeddingModel);
      return embedding;
    } catch (error) {
      this.logger.error(`Error generating embedding: ${error.message}`, error.stack);
      // Return a zero vector as fallback
      return new Array(1536).fill(0);
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same dimensions');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    return dotProduct / (normA * normB);
  }
}