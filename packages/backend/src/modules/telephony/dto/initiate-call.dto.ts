import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InitiateCallDto {
  @ApiProperty({
    example: '60d0fe4f5311236168a109ca',
    description: 'The ID of the campaign',
  })
  @IsString()
  @IsNotEmpty()
  campaignId: string;

  @ApiProperty({
    example: '60d0fe4f5311236168a109cb',
    description: 'The ID of the contact to call',
  })
  @IsString()
  @IsNotEmpty()
  contactId: string;

  @ApiProperty({
    example: '+15551234567',
    description: 'The phone number to call from',
  })
  @IsString()
  @IsNotEmpty()
  fromNumber: string;

  @ApiProperty({
    example: '+15559876543',
    description: 'The phone number to call',
  })
  @IsString()
  @IsNotEmpty()
  toNumber: string;
}