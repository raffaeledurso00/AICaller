import { IsOptional, IsString, IsEnum, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CallStatus, CallOutcome } from '../schemas/call.schema';

export class UpdateCallDto {
  @ApiProperty({
    enum: CallStatus,
    description: 'The status of the call',
    required: false,
  })
  @IsOptional()
  @IsEnum(CallStatus)
  status?: CallStatus;

  @ApiProperty({
    enum: CallOutcome,
    description: 'The outcome of the call',
    required: false,
  })
  @IsOptional()
  @IsEnum(CallOutcome)
  outcome?: CallOutcome;

  @ApiProperty({
    example: 'This customer requested a callback next week',
    description: 'Notes about the call',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    example: { agentComments: 'Very interested prospect' },
    description: 'Additional metadata about the call',
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}