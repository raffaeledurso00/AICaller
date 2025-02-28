import { IsString, IsNotEmpty, IsEnum, IsArray, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WebhookEventType } from '../enums/webhook-event-type.enum';

export class CreateWebhookDto {
  @ApiProperty({
    example: 'New Call Notification',
    description: 'The name of the webhook',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'https://example.com/webhook',
    description: 'The URL to send webhook events to',
  })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiProperty({
    type: [String],
    enum: WebhookEventType,
    example: [WebhookEventType.CALL_COMPLETED, WebhookEventType.CALL_FAILED],
    description: 'The events this webhook subscribes to',
  })
  @IsArray()
  @IsEnum(WebhookEventType, { each: true })
  events: WebhookEventType[];

  @ApiProperty({
    example: true,
    description: 'Whether the webhook is active',
    default: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}