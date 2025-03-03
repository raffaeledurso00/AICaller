import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { AuditLog, AuditLogSchema } from './schemas/audit-log.schema';
import { EncryptionService } from './services/encryption.service';
import { AuditLogService } from './services/audit-log.service';
import { GdprService } from './services/gdpr.service';
import { GdprController } from './controllers/gdpr.controller';
import { AuditLogController } from './controllers/audit-log.controller';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
  ],
  controllers: [GdprController, AuditLogController],
  providers: [EncryptionService, AuditLogService, GdprService],
  exports: [EncryptionService, AuditLogService, GdprService],
})
export class CommonModule {}