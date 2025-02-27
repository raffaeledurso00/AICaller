import { 
    IsString, 
    IsNotEmpty, 
    IsOptional, 
    IsEnum, 
    IsArray, 
    IsDate, 
    IsNumber, 
    IsObject,
    Min,
    ValidateNested,
  } from 'class-validator';
  import { Type } from 'class-transformer';
  import { ApiProperty } from '@nestjs/swagger';
  import { CampaignType } from '../schemas/campaign.schema';
  
  export class TimeWindowDto {
    @ApiProperty({ example: '09:00', description: 'The start time (HH:MM)' })
    @IsString()
    start: string;
  
    @ApiProperty({ example: '17:00', description: 'The end time (HH:MM)' })
    @IsString()
    end: string;
  
    @ApiProperty({ example: 'America/New_York', description: 'The timezone' })
    @IsString()
    timezone: string;
  }
  
  export class CampaignSettingsDto {
    @ApiProperty({
      example: 3,
      description: 'Number of retry attempts for failed calls',
      required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    callRetryAttempts?: number;
  
    @ApiProperty({
      example: 60,
      description: 'Delay in minutes between retry attempts',
      required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    callRetryDelay?: number;
  
    @ApiProperty({
      type: TimeWindowDto,
      description: 'Allowed time window for making calls',
      required: false,
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => TimeWindowDto)
    callTimeWindow?: TimeWindowDto;
  
    @ApiProperty({
      example: { purchase: true, callback: true },
      description: 'Criteria for considering a call successful',
      required: false,
    })
    @IsOptional()
    @IsObject()
    successCriteria?: Record<string, any>;
  }
  
  export class CreateCampaignDto {
    @ApiProperty({ example: 'Summer Sale Campaign', description: 'The name of the campaign' })
    @IsString()
    @IsNotEmpty()
    name: string;
  
    @ApiProperty({
      example: 'Campaign to promote our summer sale discounts',
      description: 'A description of the campaign',
      required: false,
    })
    @IsOptional()
    @IsString()
    description?: string;
  
    @ApiProperty({
      enum: CampaignType,
      example: CampaignType.SALES,
      description: 'The type of campaign',
    })
    @IsEnum(CampaignType)
    type: CampaignType;
  
    @ApiProperty({
      example: 'Hello {{contact_name}}, I\'m calling about our special offer...',
      description: 'The script template for the campaign calls',
      required: false,
    })
    @IsOptional()
    @IsString()
    scriptTemplate?: string;
  
    @ApiProperty({
      example: { productName: 'Premium Plan', discount: '20%' },
      description: 'Variables to be used in the script template',
      required: false,
    })
    @IsOptional()
    @IsObject()
    scriptVariables?: Record<string, any>;
  
    @ApiProperty({
      example: 'small business owners',
      description: 'The target audience for this campaign',
      required: false,
    })
    @IsOptional()
    @IsString()
    targetAudience?: string;
  
    @ApiProperty({
      example: '2023-10-01T00:00:00.000Z',
      description: 'The start date of the campaign',
      required: false,
    })
    @IsOptional()
    @IsDate()
    @Type(() => Date)
    startDate?: Date;
  
    @ApiProperty({
      example: '2023-10-31T23:59:59.000Z',
      description: 'The end date of the campaign',
      required: false,
    })
    @IsOptional()
    @IsDate()
    @Type(() => Date)
    endDate?: Date;
  
    @ApiProperty({
      example: 5,
      description: 'Maximum number of concurrent calls',
      required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    maxConcurrentCalls?: number;
  
    @ApiProperty({
      type: CampaignSettingsDto,
      description: 'Settings for the campaign',
      required: false,
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => CampaignSettingsDto)
    settings?: CampaignSettingsDto;
  
    @ApiProperty({
      example: ['60d0fe4f5311236168a109ca'],
      description: 'IDs of supervisors for this campaign',
      required: false,
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    supervisorIds?: string[];
  }