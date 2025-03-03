import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../modules/users/schemas/user.schema';

export type AuditLogDocument = AuditLog & Document;

export enum AuditActionType {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  LOGIN = 'login',
  LOGOUT = 'logout',
  ACCESS = 'access',
  EXPORT = 'export',
  OTHER = 'other',
}

@Schema({ timestamps: true })
export class AuditLog {
  @Prop({ required: true })
  action: AuditActionType;

  @Prop({ required: true })
  entity: string;

  @Prop()
  entityId?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  user?: User;

  @Prop()
  userId?: string;

  @Prop()
  userEmail?: string;

  @Prop()
  ipAddress?: string;

  @Prop()
  userAgent?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop()
  status?: string;

  @Prop()
  timestamp: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// Add indexes for better query performance
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ entity: 1, entityId: 1 });
AuditLogSchema.index({ userId: 1 });
AuditLogSchema.index({ timestamp: -1 });