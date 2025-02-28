import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { Webhook, WebhookSchema } from './schemas/webhook.schema';
import { Integration, IntegrationSchema } from './schemas/integration.schema';
import { WebhookService } from './services/webhook.service';
import { CrmService } from './services/crm.service';
import { IntegrationsController } from './controllers/integrations.controller';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Webhook.name, schema: WebhookSchema },
      { name: Integration.name, schema: IntegrationSchema },
    ]),
  ],
  controllers: [IntegrationsController],
  providers: [WebhookService, CrmService],
  exports: [WebhookService, CrmService],
})
export class IntegrationsModule {}