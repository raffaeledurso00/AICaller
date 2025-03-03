import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Call, CallSchema } from './schemas/call.schema';
import { TwilioService } from './services/twilio.service';
import { CallService } from './services/call.service';
import { RealTimeTranscriptionService } from './services/real-time-transcription.service';
import { SupervisorInterventionService } from './services/supervisor-intervention.service';
import { TelephonyController } from './controllers/telephony.controller';
import { TranscriptionController } from './controllers/transcription.controller';
import { SupervisorController } from './controllers/supervisor.controller';
import { AiModule } from '../ai/ai.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { ResilienceModule } from '../resilience/resilience.module';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([{ name: Call.name, schema: CallSchema }]),
    EventEmitterModule.forRoot(),
    AiModule,
    IntegrationsModule,
    ResilienceModule,
  ],
  controllers: [TelephonyController, TranscriptionController, SupervisorController],
  providers: [
    TwilioService, 
    CallService, 
    RealTimeTranscriptionService,
    SupervisorInterventionService
  ],
  exports: [
    TwilioService, 
    CallService, 
    RealTimeTranscriptionService,
    SupervisorInterventionService
  ],
})
export class TelephonyModule {}