import { 
    IsString, 
    IsNotEmpty, 
    IsOptional, 
    IsEmail, 
    IsObject, 
    IsArray, 
    IsEnum,
    ValidateNested,
    IsDate,
    IsBoolean,
  } from 'class-validator';
  import { Type } from 'class-transformer';
  import { ApiProperty } from '@nestjs/swagger';
  import { ContactStatus } from '../schemas/contact.schema';
  
  export class HistoryEntryDto {
    @ApiProperty({
      example: new Date(),
      description: 'The timestamp of the history entry',
    })
    @IsDate()
    @Type(() => Date)
    timestamp: Date;
  
    @ApiProperty({
      example: 'call_attempted',
      description: 'The action taken',
    })
    @IsString()
    @IsNotEmpty()
    action: string;
  
    @ApiProperty({
      example: 'Customer requested callback next week',
      description: 'Notes about the action',
      required: false,
    })
    @IsOptional()
    @IsString()
    notes?: string;
  
    @ApiProperty({
      example: { callDuration: 120, callOutcome: 'callback_requested' },
      description: 'Additional data related to the action',
      required: false,
    })
    @IsOptional()
    @IsObject()
    data?: Record<string, any>;
  }
  
  export class CreateContactDto {
    @ApiProperty({
      example: 'John',
      description: 'The first name of the contact',
    })
    @IsString()
    @IsNotEmpty()
    firstName: string;
  
    @ApiProperty({
      example: 'Doe',
      description: 'The last name of the contact',
    })
    @IsString()
    @IsNotEmpty()
    lastName: string;
  
    @ApiProperty({
      example: '+15551234567',
      description: 'The phone number of the contact',
    })
    @IsString()
    @IsNotEmpty()
    phoneNumber: string;
  
    @ApiProperty({
      example: 'john.doe@example.com',
      description: 'The email of the contact',
      required: false,
    })
    @IsOptional()
    @IsEmail()
    email?: string;
  
    @ApiProperty({
      example: '60d0fe4f5311236168a109ca',
      description: 'The ID of the campaign this contact belongs to',
    })
    @IsString()
    @IsNotEmpty()
    campaign: string;
  
    @ApiProperty({
      enum: ContactStatus,
      example: ContactStatus.PENDING,
      description: 'The status of the contact',
      required: false,
    })
    @IsOptional()
    @IsEnum(ContactStatus)
    status?: ContactStatus;
  
    @ApiProperty({
      example: 0,
      description: 'The number of contact attempts',
      required: false,
    })
    @IsOptional()
    attemptCount?: number;
  
    @ApiProperty({
      example: new Date(),
      description: 'The date of the last attempt',
      required: false,
    })
    @IsOptional()
    @IsDate()
    @Type(() => Date)
    lastAttemptDate?: Date;
  
    @ApiProperty({
      example: new Date(),
      description: 'The date of the next scheduled attempt',
      required: false,
    })
    @IsOptional()
    @IsDate()
    @Type(() => Date)
    nextAttemptDate?: Date;
  
    @ApiProperty({
      example: new Date(),
      description: 'The scheduled time for the call',
      required: false,
    })
    @IsOptional()
    @IsDate()
    @Type(() => Date)
    scheduledTime?: Date;
  
    @ApiProperty({
      example: false,
      description: 'Whether the contact was successfully processed',
      required: false,
    })
    @IsOptional()
    @IsBoolean()
    isSuccessful?: boolean;
  
    @ApiProperty({
      example: { company: 'Acme Inc.', position: 'CEO' },
      description: 'Additional data about the contact',
      required: false,
    })
    @IsOptional()
    @IsObject()
    data?: Record<string, any>;
  
    @ApiProperty({
      type: [HistoryEntryDto],
      description: 'History of actions taken with this contact',
      required: false,
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => HistoryEntryDto)
    history?: HistoryEntryDto[];
  
    @ApiProperty({
      example: ['vip', 'interested'],
      description: 'Tags for categorizing the contact',
      required: false,
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];
  
    @ApiProperty({
      example: { leadSource: 'Website', interests: ['Product A', 'Product B'] },
      description: 'Custom fields for the contact',
      required: false,
    })
    @IsOptional()
    @IsObject()
    customFields?: Record<string, any>;
  }