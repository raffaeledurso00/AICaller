import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Campaign, CampaignSchema } from '../campaigns/schemas/campaign.schema';
import { Contact, ContactSchema } from '../contacts/schemas/contact.schema';
import { Call, CallSchema } from '../telephony/schemas/call.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { DashboardController } from './controllers/dashboard.controller';
import { DashboardService } from './services/dashboard.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Campaign.name, schema: CampaignSchema },
      { name: Contact.name, schema: ContactSchema },
      { name: Call.name, schema: CallSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}