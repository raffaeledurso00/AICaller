import { IsString, IsNotEmpty, IsEnum, IsObject, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IntegrationType } from '../schemas/integration.schema';

export class CreateIntegrationDto {
  @ApiProperty({
    example: 'Company Salesforce',
    description: 'The name of the integration',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    enum: IntegrationType,
    example: IntegrationType.SALESFORCE,
    description: 'The type of integration',
  })
  @IsEnum(IntegrationType)
  type: string;

  @ApiProperty({
    example: {
      instanceUrl: 'https://company.my.salesforce.com',
      accessToken: 'token123',
    },
    description: 'Configuration settings for the integration',
  })
  @IsObject()
  config: Record<string, any>;

  @ApiProperty({
    example: {
      'firstName': 'FirstName',
      'lastName': 'LastName',
      'phoneNumber': 'Phone',
      'email': 'Email',
    },
    description: 'Field mapping between local and CRM fields',
    required: false,
  })
  @IsOptional()
  @IsObject()
  fieldMapping?: Record<string, string>;

  @ApiProperty({
    example: true,
    description: 'Whether the integration is active',
    default: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}