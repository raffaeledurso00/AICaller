import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { OpenAiService } from './services/openai.service';
import { ConversationService } from './services/conversation.service';
import { VectorStorageService } from './services/vector-storage.service';
import { ScriptValidatorService } from './services/script-validator.service';
import { ScriptTesterService } from './services/script-tester.service';
import { AiController } from './controllers/ai.controller';
import { ScriptController } from './controllers/script.controller';
import { Call, CallSchema } from '../telephony/schemas/call.schema';
import { VectorStorage, VectorStorageSchema } from './schemas/vector-storage.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Call.name, schema: CallSchema },
      { name: VectorStorage.name, schema: VectorStorageSchema },
    ]),
  ],
  controllers: [AiController, ScriptController],
  providers: [
    OpenAiService, 
    ConversationService, 
    VectorStorageService,
    ScriptValidatorService,
    ScriptTesterService,
  ],
  exports: [
    OpenAiService, 
    ConversationService, 
    VectorStorageService,
    ScriptValidatorService,
    ScriptTesterService,
  ],
})
export class AiModule {}