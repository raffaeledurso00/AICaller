import { IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { Campaign } from '../../campaigns/schemas/campaign.schema';
import { Contact } from '../../contacts/schemas/contact.schema';

export class InitConversationDto {
  @ApiProperty({
    description: 'The campaign object',
    type: 'object',
    additionalProperties: true
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => Campaign)
  campaign: Campaign;

  @ApiProperty({
    description: 'The contact object',
    type: 'object',
    additionalProperties: true
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => Contact)
  contact: Contact;
}