import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { OpenAiService } from './services/openai.service';
import { ConversationService } from './services/conversation.service';
import { AiController } from './controllers/ai.controller';
import { Call, CallSchema } from '../telephony/schemas/call.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([{ name: Call.name, schema: CallSchema }]),
  ],
  controllers: [AiController],
  providers: [OpenAiService, ConversationService],
  exports: [OpenAiService, ConversationService],
})
export class AiModule {}