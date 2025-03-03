import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AuditLog, AuditLogDocument, AuditActionType } from '../schemas/audit-log.schema';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);
  private readonly isEnabled: boolean;

  constructor(
    @InjectModel(AuditLog.name) private readonly auditLogModel: Model<AuditLogDocument>,
    private readonly configService: ConfigService,
  ) {
    this.isEnabled = this.configService.get<boolean>('security.auditLogging', false);
  }

  /**
   * Log an audit event
   */
  async log(
    action: AuditActionType,
    entity: string,
    userId: string | null,
    request: Request | null,
    metadata: Record<string, any> = {},
    status: string = 'success',
    entityId?: string,
  ): Promise<void> {
    // Skip if audit logging is disabled
    if (!this.isEnabled) {
      return;
    }

    try {
      // Extract IP address and user agent from request if available
      const ipAddress = request?.ip || '';
      const userAgent = request?.headers['user-agent'] || '';
      const userEmail = (request as any)?.user?.email || '';

      // Create the audit log entry
      await this.auditLogModel.create({
        action,
        entity,
        entityId,
        userId,
        userEmail,
        ipAddress,
        userAgent,
        metadata,
        status,
        timestamp: new Date(),
      });
    } catch (error) {
      // Log error but don't fail the operation
      this.logger.error(`Failed to create audit log: ${error.message}`, error.stack);
    }
  }

  /**
   * Get audit logs with filtering
   */
  async getAuditLogs(
    filters: {
      action?: AuditActionType;
      entity?: string;
      entityId?: string;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {},
    page: number = 1,
    limit: number = 50,
  ): Promise<{ logs: AuditLogDocument[]; total: number }> {
    const query: any = {};

    // Apply filters
    if (filters.action) {
      query.action = filters.action;
    }
    if (filters.entity) {
      query.entity = filters.entity;
    }
    if (filters.entityId) {
      query.entityId = filters.entityId;
    }
    if (filters.userId) {
      query.userId = filters.userId;
    }
    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) {
        query.timestamp.$gte = filters.startDate;
      }
      if (filters.endDate) {
        query.timestamp.$lte = filters.endDate;
      }
    }

    // Execute query with pagination
    const total = await this.auditLogModel.countDocuments(query);
    const logs = await this.auditLogModel
      .find(query)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    return { logs, total };
  }
}