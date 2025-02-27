import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ProcessChatMessageDto {
  @ApiProperty({
    example: "I'm interested in learning more about your service.",
    description: 'The user message to process',
  })
  @IsString()
  @IsNotEmpty()
  message: string;
}