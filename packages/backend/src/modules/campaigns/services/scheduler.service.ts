import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Campaign, CampaignDocument, CampaignStatus } from '../schemas/campaign.schema';
import { Contact, ContactDocument, ContactStatus } from '../../contacts/schemas/contact.schema';
import { CallService } from '../../telephony/services/call.service';
import { ContactService } from '../../contacts/services/contact.service';

interface CampaignCallSettings {
  callRetryAttempts?: number;
  callRetryDelay?: number;
  callTimeWindow?: {
    start: string;
    end: string;
    timezone: string;
  };
  successCriteria?: Record<string, any>;
  phoneNumber?: string;
}

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectModel(Campaign.name) private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(Contact.name) private readonly contactModel: Model<ContactDocument>,
    private readonly callService: CallService,
    private readonly contactService: ContactService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Scheduled job to process active campaigns every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processActiveCampaigns(): Promise<void> {
    this.logger.debug('Starting campaign processing cycle');

    try {
      // Find campaigns ready for processing
      const activeCampaigns = await this.findEligibleCampaigns();

      if (activeCampaigns.length === 0) {
        this.logger.debug('No campaigns require processing');
        return;
      }

      this.logger.log(`Processing ${activeCampaigns.length} active campaigns`);

      // Process each campaign concurrently
      await Promise.all(
        activeCampaigns.map(campaign => this.processCampaign(campaign))
      );
    } catch (error) {
      this.logger.error('Error in campaign processing cycle', error);
    }
  }

  /**
   * Find campaigns that are active and ready to be processed
   */
  private async findEligibleCampaigns(): Promise<CampaignDocument[]> {
    const now = new Date();
    
    return this.campaignModel.find({
      status: CampaignStatus.ACTIVE,
      startDate: { $lte: now },
      $or: [
        { endDate: { $gte: now } },
        { endDate: { $exists: false } },
      ],
    })
    .populate('owner')
    .populate('supervisors')
    .exec();
  }

  /**
   * Process a single campaign
   */
  private async processCampaign(campaign: CampaignDocument): Promise<void> {
    try {
      this.logger.log(`Processing campaign: ${campaign.name}`);

      // Get campaign-specific call settings
      const settings = campaign.settings || {};

      // Determine max concurrent calls
      const maxConcurrentCalls = campaign.maxConcurrentCalls || 1;

      // Check current active calls
      const currentCallCount = await this.callService.getActiveCallCount(
        campaign._id.toString()
      );

      // Calculate available call slots
      const availableSlots = Math.max(0, maxConcurrentCalls - currentCallCount);

      if (availableSlots === 0) {
        this.logger.debug(`Campaign ${campaign.name} has reached max concurrent calls`);
        return;
      }

      // Find contacts ready to be called
      const contacts = await this.findContactsForCalling(
        campaign._id.toString(), 
        availableSlots, 
        settings
      );

      if (contacts.length === 0) {
        await this.checkCampaignCompletion(campaign);
        return;
      }

      // Initiate calls for selected contacts
      await this.initiateContactCalls(campaign, contacts, settings);
    } catch (error) {
      this.logger.error(`Error processing campaign ${campaign.name}`, error);
    }
  }

  /**
   * Find contacts eligible for calling
   */
  private async findContactsForCalling(
    campaignId: string, 
    limit: number, 
    settings: CampaignCallSettings
  ): Promise<ContactDocument[]> {
    const query = {
      campaign: new Types.ObjectId(campaignId),
      $or: [
        { status: ContactStatus.PENDING },
        { 
          status: ContactStatus.FAILED,
          attemptCount: { $lt: settings.callRetryAttempts || 3 }
        }
      ]
    };

    return this.contactModel
      .find(query)
      .sort({ attemptCount: 1, lastAttemptDate: 1 })
      .limit(limit)
      .exec();
  }

  /**
   * Initiate calls for selected contacts
   */
  private async initiateContactCalls(
    campaign: CampaignDocument, 
    contacts: ContactDocument[], 
    settings: CampaignCallSettings
  ): Promise<void> {
    const baseUrl = this.configService.get<string>('app.baseUrl', 'http://localhost:3000');
    const fromNumber = settings.phoneNumber || 
      this.configService.get<string>('twilio.phoneNumber', '');

    for (const contact of contacts) {
      try {
        // Initiate outbound call
        await this.callService.initiateOutboundCall(
          campaign._id.toString(),
          contact._id.toString(),
          fromNumber,
          contact.phoneNumber,
          baseUrl
        );

        // Update contact status
        await this.contactService.updateStatus(
          contact._id.toString(), 
          ContactStatus.IN_PROGRESS
        );

        // Increment attempt count
        await this.contactService.incrementAttemptCount(contact._id.toString());

        // Log call initiation
        await this.contactService.addHistoryEntry(
          contact._id.toString(),
          'call_initiated',
          'Call initiated by campaign scheduler'
        );

        // Update campaign metrics
        await this.campaignModel.updateOne(
          { _id: campaign._id },
          { $inc: { contactedCount: 1 } }
        );

        this.logger.log(`Initiated call to ${contact.firstName} ${contact.lastName}`);
      } catch (error) {
        this.logger.error(
          `Failed to initiate call for contact ${contact._id}`, 
          error
        );

        // Mark contact as failed
        await this.contactService.updateStatus(
          contact._id.toString(), 
          ContactStatus.FAILED
        );
        await this.contactService.addHistoryEntry(
          contact._id.toString(),
          'call_failed',
          `Scheduling error: ${error.message}`
        );
      }
    }
  }

  /**
   * Check if a campaign is complete
   */
  private async checkCampaignCompletion(campaign: CampaignDocument): Promise<void> {
    // Count remaining contacts that need processing
    const pendingCount = await this.contactModel.countDocuments({
      campaign: campaign._id,
      status: { 
        $in: [
          ContactStatus.PENDING, 
          ContactStatus.IN_PROGRESS, 
          ContactStatus.FAILED
        ]
      }
    });

    // If no pending contacts, mark campaign as completed
    if (pendingCount === 0) {
      this.logger.log(`Campaign ${campaign.name} completed. All contacts processed.`);
      
      await this.campaignModel.updateOne(
        { _id: campaign._id },
        { 
          status: CampaignStatus.COMPLETED,
          endTime: new Date()
        }
      );
    }
  }
}