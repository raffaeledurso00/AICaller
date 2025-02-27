import { IsString, IsNotEmpty, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateScriptDto {
  @ApiProperty({
    example: 'sales',
    description: 'The type of campaign (sales, survey, support, etc.)',
  })
  @IsString()
  @IsNotEmpty()
  campaignType: string;

  @ApiProperty({
    example: { name: 'Product X', price: '$99', features: ['Feature 1', 'Feature 2'] },
    description: 'Information about the product or service',
  })
  @IsObject()
  productInfo: Record<string, any>;

  @ApiProperty({
    example: { demographics: 'small business owners', interests: ['technology', 'productivity'] },
    description: 'Information about the target audience',
  })
  @IsObject()
  targetAudience: Record<string, any>;
}