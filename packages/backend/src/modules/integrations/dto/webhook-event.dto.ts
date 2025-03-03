import { IsEnum, IsNotEmpty, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WebhookEventType } from '../enums/webhook-event-type.enum';

export class WebhookEventDto {
  @ApiProperty({
    enum: WebhookEventType,
    description: 'The type of event that triggered the webhook',
  })
  @IsEnum(WebhookEventType)
  @IsNotEmpty()
  eventType: WebhookEventType;

  @ApiProperty({
    description: 'The data payload for the webhook event',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  data: Record<string, any>;
}