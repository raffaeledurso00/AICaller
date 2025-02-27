import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { Campaign, CampaignSchema } from '../campaigns/schemas/campaign.schema';
import { ContactsModule } from '../contacts/contacts.module';
import { TelephonyModule } from '../telephony/telephony.module';
import { SchedulerService } from '../campaigns/services/scheduler.service';
import { SchedulerController } from './controllers/scheduler.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([{ name: Campaign.name, schema: CampaignSchema }]),
    ContactsModule,
    TelephonyModule,
  ],
  controllers: [SchedulerController],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}