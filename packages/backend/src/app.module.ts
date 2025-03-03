// packages/backend/src/app.module.ts
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ErrorHandlingMiddleware } from './common/middleware/error-handling.middleware';
import { CacheMiddleware } from './common/middleware/cache.middleware';
import { AuditLogMiddleware } from './common/middleware/audit-log.middleware';

// Configuration imports
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import openaiConfig from './config/openai.config';
import twilioConfig from './config/twilio.config';
import webhookConfig from './config/webhook.config';
import telephonyConfig from './config/telephony.config';
import resilienceConfig from './config/resilience.config';
import cacheConfig from './config/cache.config';
import securityConfig from './config/security.config';

// Module imports
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AiModule } from './modules/ai/ai.module';
import { TelephonyModule } from './modules/telephony/telephony.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { ResilienceModule } from './modules/resilience/resilience.module';
import { CommonModule } from './common/common.module';

// Controllers
import { HealthController } from './common/controllers/health.controller';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        jwtConfig,
        openaiConfig,
        twilioConfig,
        webhookConfig,
        telephonyConfig,
        resilienceConfig,
        cacheConfig,
        securityConfig,
      ],
    }),
    
    // Database
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('database.uri') || '',
      }),
    }),
    
    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl: 60000, // milliseconds
      limit: 100,
    }]),
    
    // Event emitter for real-time communication
    EventEmitterModule.forRoot(),
    
    // Feature modules
    DatabaseModule,
    AuthModule,
    UsersModule,
    AiModule,
    TelephonyModule,
    CampaignsModule,
    ContactsModule,
    SchedulerModule,
    DashboardModule,
    IntegrationsModule,
    ResilienceModule,
    CommonModule,
  ],
  controllers: [
    HealthController,
  ],
  providers: [
    // Global guards
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ErrorHandlingMiddleware, CacheMiddleware, AuditLogMiddleware)
      .forRoutes('*');
  }
}