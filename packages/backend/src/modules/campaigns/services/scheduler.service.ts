import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Campaign, CampaignDocument, CampaignStatus } from '../schemas/campaign.schema';
import { ContactService } from '../../contacts/services/contact.service';
import { CallService } from '../../telephony/services/call.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly baseUrl: string;
  private readonly defaultFromNumber: string;
  
  constructor(
    @InjectModel(Campaign.name) private readonly campaignModel: Model<CampaignDocument>,
    private readonly contactService: ContactService,
    private readonly callService: CallService,
    private readonly configService: ConfigService,
  ) {
    // Get the base URL for webhooks and default from number from config
    this.baseUrl = this.configService.get<string>('app.baseUrl') || 'http://localhost:3000';
    this.defaultFromNumber = this.configService.get<string>('twilio.phoneNumber') || '';
  }

  /**
   * Run every minute to check for campaigns that need to be processed
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processActiveCampaigns() {
    this.logger.debug('Checking for active campaigns to process...');
    
    try {
      // Find active campaigns that are scheduled to run now
      const activeCampaigns = await this.findActiveCampaigns();
      
      if (activeCampaigns.length === 0) {
        this.logger.debug('No active campaigns to process.');
        return;
      }
      
      this.logger.log(`Found ${activeCampaigns.length} active campaigns to process.`);
      
      // Process each campaign
      for (const campaign of activeCampaigns) {
        await this.processCampaign(campaign);
      }
    } catch (error) {
      this.logger.error(`Error processing campaigns: ${error.message}`, error.stack);
    }
  }

  /**
   * Find campaigns that are active and should be processed now
   */
  private async findActiveCampaigns(): Promise<CampaignDocument[]> {
    const now = new Date();
    
    return this.campaignModel.find({
      status: CampaignStatus.ACTIVE,
      startDate: { $lte: now },
      $or: [
        { endDate: { $gte: now } },
        { endDate: { $exists: false } },
      ],
    }).exec();
  }

  /**
   * Process a single campaign by finding available contacts and initiating calls
   */
  private async processCampaign(campaign: CampaignDocument) {
    this.logger.log(`Processing campaign: ${campaign.name} (${campaign._id})`);
    
    try {
      // Check if we can make more calls for this campaign
      const currentCallCount = await this.getActiveCallCount(campaign._id.toString());
      const maxConcurrentCalls = campaign.maxConcurrentCalls || 1;
      
      if (currentCallCount >= maxConcurrentCalls) {
        this.logger.debug(`Campaign ${campaign.name} already has ${currentCallCount} active calls. Max is ${maxConcurrentCalls}.`);
        return;
      }
      
      // Calculate how many more calls we can make
      const availableSlots = maxConcurrentCalls - currentCallCount;
      
      // Find available contacts for this campaign
      const contacts = await this.contactService.findAvailableContactsForCampaign(
        campaign._id.toString(),
        availableSlots,
      );
      
      if (contacts.length === 0) {
        this.logger.debug(`No available contacts for campaign ${campaign.name}.`);
        
        // If no contacts are available and we're not making any calls,
        // check if campaign is complete
        if (currentCallCount === 0) {
          await this.checkCampaignCompletion(campaign);
        }
        
        return;
      }
      
      this.logger.log(`Initiating calls for ${contacts.length} contacts in campaign ${campaign.name}.`);
      
      // Use the campaign phone number or the default
      const fromNumber = campaign.settings?.phoneNumber || this.defaultFromNumber;
      
      // Initiate calls for each contact
      for (const contact of contacts) {
        try {
          // Initiate the call
          await this.callService.initiateOutboundCall(
            campaign._id.toString(),
            contact._id.toString(),
            fromNumber,
            contact.phoneNumber,
            this.baseUrl,
          );
          
          // Update contact status and attempt count
          await this.contactService.updateStatus(contact._id.toString(), 'in_progress');
          await this.contactService.incrementAttemptCount(contact._id.toString());
          await this.contactService.addHistoryEntry(
            contact._id.toString(),
            'call_initiated',
            'Call initiated by scheduler',
          );
          
          // Update campaign metrics
          await this.campaignModel.updateOne(
            { _id: campaign._id },
            { $inc: { contactedCount: 1 } },
          );
          
          this.logger.debug(`Initiated call to ${contact.firstName} ${contact.lastName} (${contact.phoneNumber}).`);
        } catch (error) {
          this.logger.error(`Error initiating call for contact ${contact._id}: ${error.message}`);
          
          // Mark the contact as failed
          await this.contactService.updateStatus(contact._id.toString(), 'failed');
          await this.contactService.addHistoryEntry(
            contact._id.toString(),
            'call_failed',
            `Error: ${error.message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Error processing campaign ${campaign._id}: ${error.message}`, error.stack);
    }
  }

  /**
   * Get the count of active calls for a campaign
   */
  private async getActiveCallCount(campaignId: string): Promise<number> {
    return this.callService.getActiveCallCount(campaignId);
  }

  /**
   * Check if a campaign is complete (all contacts have been processed)
   */
  private async checkCampaignCompletion(campaign: CampaignDocument) {
    // Count contacts that still need to be processed
    const pendingCount = await this.contactService.countContactsByStatus(
      campaign._id.toString(),
      ['pending', 'in_progress', 'failed'],
    );
    
    if (pendingCount === 0) {
      this.logger.log(`Campaign ${campaign.name} has completed all contacts. Marking as completed.`);
      
      // Update campaign status to completed
      await this.campaignModel.updateOne(
        { _id: campaign._id },
        { $set: { status: CampaignStatus.COMPLETED } },
      );
    }
  }
}