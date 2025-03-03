// packages/backend/src/common/common.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { AuditLog, AuditLogSchema } from './schemas/audit-log.schema';
import { EncryptionService } from './services/encryption.service';
import { AuditLogService } from './services/audit-log.service';
import { GdprService } from './services/gdpr.service';
import { SecurityReviewService } from './services/security-review.service';
import { GdprController } from './controllers/gdpr.controller';
import { AuditLogController } from './controllers/audit-log.controller';
import { SecurityReviewController } from './controllers/security-review.controller';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
  ],
  controllers: [GdprController, AuditLogController, SecurityReviewController],
  providers: [EncryptionService, AuditLogService, GdprService, SecurityReviewService],
  exports: [EncryptionService, AuditLogService, GdprService, SecurityReviewService],
})
export class CommonModule {}