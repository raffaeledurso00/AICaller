import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { ThrottlerGuard } from '@nestjs/throttler';

// Configuration imports
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import openaiConfig from './config/openai.config';
import twilioConfig from './config/twilio.config';

// Module imports
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AiModule } from './modules/ai/ai.module';
import { TelephonyModule } from './modules/telephony/telephony.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { ContactsModule } from './modules/contacts/contacts.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, openaiConfig, twilioConfig],
    }),

    // Database
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('database.uri') || '',
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }),
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // milliseconds
        limit: 100,
      },
    ]),

    // Feature modules
    DatabaseModule,
    AuthModule,
    UsersModule,
    AiModule,
    TelephonyModule,
    CampaignsModule,
    ContactsModule,
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
export class AppModule {}
