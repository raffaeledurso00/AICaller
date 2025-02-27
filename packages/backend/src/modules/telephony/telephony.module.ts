import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { Call, CallSchema } from './schemas/call.schema';
import { TwilioService } from './services/twilio.service';
import { CallService } from './services/call.service';
import { TelephonyController } from './controllers/telephony.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([{ name: Call.name, schema: CallSchema }]),
    AiModule,
  ],
  controllers: [TelephonyController],
  providers: [TwilioService, CallService],
  exports: [TwilioService, CallService],
})
export class TelephonyModule {}