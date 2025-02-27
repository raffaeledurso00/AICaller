import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateCampaignDto } from './create-campaign.dto';
import { CampaignStatus } from '../schemas/campaign.schema';

export class UpdateCampaignDto extends PartialType(CreateCampaignDto) {
  @ApiProperty({
    enum: CampaignStatus,
    example: CampaignStatus.ACTIVE,
    description: 'The status of the campaign',
    required: false,
  })
  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;
}