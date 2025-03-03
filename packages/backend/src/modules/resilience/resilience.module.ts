// packages/backend/src/modules/resilience/resilience.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { RetryService } from './services/retry.service';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { FallbackService } from './services/fallback.service';
import { ErrorTrackingService } from './services/error-tracking.service';
import { ErrorLog, ErrorLogSchema } from './schemas/error-log.schema';
import { ResilienceController } from './controllers/resilience.controller';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: ErrorLog.name, schema: ErrorLogSchema },
    ]),
  ],
  controllers: [ResilienceController],
  providers: [
    RetryService,
    CircuitBreakerService,
    FallbackService,
    ErrorTrackingService,
  ],
  exports: [
    RetryService,
    CircuitBreakerService,
    FallbackService,
    ErrorTrackingService,
  ],
})
export class ResilienceModule {}