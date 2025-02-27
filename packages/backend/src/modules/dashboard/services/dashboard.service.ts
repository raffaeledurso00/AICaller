import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Campaign, CampaignDocument, CampaignStatus } from '../../campaigns/schemas/campaign.schema';
import { Contact, ContactDocument, ContactStatus } from '../../contacts/schemas/contact.schema';
import { Call, CallDocument, CallStatus } from '../../telephony/schemas/call.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { ASYNC_METHOD_SUFFIX } from '@nestjs/common/module-utils/constants';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectModel(Campaign.name) private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(Contact.name) private readonly contactModel: Model<ContactDocument>,
    @InjectModel(Call.name) private readonly callModel: Model<CallDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  /**
   * Get system overview with counts of campaigns, contacts, calls, users
   */
  async getSystemOverview() {
    this.logger.log('Generating system overview statistics');
    
    // Get counts of various entities
    const [
      totalCampaigns,
      activeCampaigns,
      totalContacts,
      totalCalls,
      successfulCalls,
      totalUsers,
      callsToday,
    ] = await Promise.all([
      this.campaignModel.countDocuments().exec(),
      this.campaignModel.countDocuments({ status: CampaignStatus.ACTIVE }).exec(),
      this.contactModel.countDocuments().exec(),
      this.callModel.countDocuments().exec(),
      this.callModel.countDocuments({ status: CallStatus.COMPLETED }).exec(),
      this.userModel.countDocuments().exec(),
      this.getCallsToday(),
    ]);

    // Calculate success rate
    const successRate = totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0;

    return {
      totalCampaigns,
      activeCampaigns,
      totalContacts,
      totalCalls,
      successfulCalls,
      successRate: parseFloat(successRate.toFixed(2)),
      totalUsers,
      callsToday,
    };
  }

  /**
   * Get campaign statistics for the specified number of days
   */
  async getCampaignStats(days: number = 7) {
    this.logger.log(`Generating campaign statistics for last ${days} days`);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Get campaigns created in the time period
    const newCampaigns = await this.campaignModel.countDocuments({
      createdAt: { $gte: startDate },
    }).exec();
    
    // Get campaigns by status
    const [
      draftCampaigns,
      scheduledCampaigns,
      activeCampaigns,
      pausedCampaigns,
      completedCampaigns,
    ] = await Promise.all([
      this.campaignModel.countDocuments({ status: CampaignStatus.DRAFT }).exec(),
      this.campaignModel.countDocuments({ status: CampaignStatus.SCHEDULED }).exec(),
      this.campaignModel.countDocuments({ status: CampaignStatus.ACTIVE }).exec(),
      this.campaignModel.countDocuments({ status: CampaignStatus.PAUSED }).exec(),
      this.campaignModel.countDocuments({ status: CampaignStatus.COMPLETED }).exec(),
    ]);
    
    // Get campaign daily stats
    const dailyStats = await this.getCampaignDailyStats(days);
    
    return {
      newCampaigns,
      campaignsByStatus: {
        draft: draftCampaigns,
        scheduled: scheduledCampaigns,
        active: activeCampaigns,
        paused: pausedCampaigns,
        completed: completedCampaigns,
      },
      dailyStats,
    };
  }

  /**
   * Get call statistics for the specified number of days
   */
  async getCallStats(days: number = 7) {
    this.logger.log(`Generating call statistics for last ${days} days`);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Count calls in the time period
    const totalCalls = await this.callModel.countDocuments({
      startTime: { $gte: startDate },
    }).exec();
    
    // Get calls by status
    const [
      completedCalls,
      failedCalls,
      busyCalls,
      noAnswerCalls,
    ] = await Promise.all([
      this.callModel.countDocuments({ 
        startTime: { $gte: startDate },
        status: CallStatus.COMPLETED,
      }).exec(),
      this.callModel.countDocuments({ 
        startTime: { $gte: startDate },
        status: CallStatus.FAILED,
      }).exec(),
      this.callModel.countDocuments({ 
        startTime: { $gte: startDate },
        status: CallStatus.BUSY,
      }).exec(),
      this.callModel.countDocuments({ 
        startTime: { $gte: startDate },
        status: CallStatus.NO_ANSWER,
      }).exec(),
    ]);
    
    // Calculate success rate
    const successRate = totalCalls > 0 ? (completedCalls / totalCalls) * 100 : 0;
    
    // Get average call duration
    const avgDurationResult = await this.callModel.aggregate([
      { 
        $match: { 
          startTime: { $gte: startDate },
          status: CallStatus.COMPLETED,
          duration: { $exists: true, $gt: 0 },
        } 
      },
      { $group: { _id: null, avgDuration: { $avg: '$duration' } } },
    ]).exec();
    
    const averageDuration = avgDurationResult.length > 0 
      ? Math.round(avgDurationResult[0].avgDuration) 
      : 0;
    
    // Get daily call stats
    const dailyStats = await this.getCallDailyStats(days);
    
    return {
      totalCalls,
      completedCalls,
      failedCalls,
      busyCalls,
      noAnswerCalls,
      successRate: parseFloat(successRate.toFixed(2)),
      averageDuration,
      dailyStats,
    };
  }

  /**
   * Get active campaigns with real-time metrics
   */
  async getActiveCampaigns() {
    this.logger.log('Fetching active campaigns with real-time metrics');
    
    const activeCampaigns = await this.campaignModel.find({
      status: CampaignStatus.ACTIVE,
    })
    .populate('owner', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .exec();
    
    // For each campaign, get additional metrics
    const campaignsWithMetrics = await Promise.all(activeCampaigns.map(async campaign => {
      const [
        pendingContacts,
        completedContacts,
        failedContacts,
        activeCalls,
        completedCalls,
        failedCalls,
      ] = await Promise.all([
        this.contactModel.countDocuments({ 
          campaign: campaign._id,
          status: ContactStatus.PENDING,
        }).exec(),
        this.contactModel.countDocuments({ 
          campaign: campaign._id,
          status: ContactStatus.COMPLETED,
        }).exec(),
        this.contactModel.countDocuments({ 
          campaign: campaign._id,
          status: ContactStatus.FAILED,
        }).exec(),
        this.callModel.countDocuments({ 
          campaign: campaign._id,
          status: { $in: [CallStatus.INITIATED, CallStatus.RINGING, CallStatus.IN_PROGRESS] },
        }).exec(),
        this.callModel.countDocuments({ 
          campaign: campaign._id,
          status: CallStatus.COMPLETED,
        }).exec(),
        this.callModel.countDocuments({ 
          campaign: campaign._id,
          status: { $in: [CallStatus.FAILED, CallStatus.BUSY, CallStatus.NO_ANSWER] },
        }).exec(),
      ]);
      
      // Calculate progress percentage
      const totalContacts = pendingContacts + completedContacts + failedContacts;
      const progress = totalContacts > 0 
        ? ((completedContacts + failedContacts) / totalContacts) * 100 
        : 0;
      
      // Calculate success rate
      const totalCallsCompleted = completedCalls + failedCalls;
      const successRate = totalCallsCompleted > 0 
        ? (completedCalls / totalCallsCompleted) * 100 
        : 0;
      
      return {
        _id: campaign._id,
        name: campaign.name,
        type: campaign.type,
        owner: campaign.owner,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        contacts: {
          total: totalContacts,
          pending: pendingContacts,
          completed: completedContacts,
          failed: failedContacts,
        },
        calls: {
          active: activeCalls,
          completed: completedCalls,
          failed: failedCalls,
        },
        progress: parseFloat(progress.toFixed(2)),
        successRate: parseFloat(successRate.toFixed(2)),
        maxConcurrentCalls: campaign.maxConcurrentCalls,
      };
    }));
    
    return campaignsWithMetrics;
  }

  /**
   * Get detailed performance metrics for a specific campaign
   */
  async getCampaignPerformance(campaignId: string) {
    this.logger.log(`Generating performance metrics for campaign ${campaignId}`);
    
    // Get campaign details
    const campaign = await this.campaignModel.findById(campaignId)
      .populate('owner', 'firstName lastName email')
      .populate('supervisors', 'firstName lastName email')
      .exec();
    
    if (!campaign) {
      return null;
    }
    
    // Get contact counts by status
    const [
      pendingContacts,
      inProgressContacts,
      completedContacts,
      failedContacts,
      doNotCallContacts,
    ] = await Promise.all([
      this.contactModel.countDocuments({ 
        campaign: campaign._id,
        status: ContactStatus.PENDING,
      }).exec(),
      this.contactModel.countDocuments({ 
        campaign: campaign._id,
        status: ContactStatus.IN_PROGRESS,
      }).exec(),
      this.contactModel.countDocuments({ 
        campaign: campaign._id,
        status: ContactStatus.COMPLETED,
      }).exec(),
      this.contactModel.countDocuments({ 
        campaign: campaign._id,
        status: ContactStatus.FAILED,
      }).exec(),
      this.contactModel.countDocuments({ 
        campaign: campaign._id,
        status: ContactStatus.DO_NOT_CALL,
      }).exec(),
    ]);
    
    // Get call metrics
    const [
      totalCalls,
      completedCalls,
      failedCalls,
      busyCalls,
      noAnswerCalls,
      successfulCalls,
    ] = await Promise.all([
      this.callModel.countDocuments({ campaign: campaign._id }).exec(),
      this.callModel.countDocuments({ 
        campaign: campaign._id,
        status: CallStatus.COMPLETED,
      }).exec(),
      this.callModel.countDocuments({ 
        campaign: campaign._id,
        status: CallStatus.FAILED,
      }).exec(),
      this.callModel.countDocuments({ 
        campaign: campaign._id,
        status: CallStatus.BUSY,
      }).exec(),
      this.callModel.countDocuments({ 
        campaign: campaign._id,
        status: CallStatus.NO_ANSWER,
      }).exec(),
      this.callModel.countDocuments({ 
        campaign: campaign._id,
        isSuccessful: true,
      }).exec(),
    ]);
    
    // Get average call duration
    const avgDurationResult = await this.callModel.aggregate([
      { 
        $match: { 
          campaign: campaign._id,
          status: CallStatus.COMPLETED,
          duration: { $exists: true, $gt: 0 },
        } 
      },
      { $group: { _id: null, avgDuration: { $avg: '$duration' } } },
    ]).exec();
    
    const averageDuration = avgDurationResult.length > 0 
      ? Math.round(avgDurationResult[0].avgDuration) 
      : 0;
    
    // Calculate progress and success rates
    const totalContacts = pendingContacts + inProgressContacts + completedContacts + failedContacts + doNotCallContacts;
    const progress = totalContacts > 0 
      ? ((completedContacts + failedContacts + doNotCallContacts) / totalContacts) * 100 
      : 0;
    
    const callSuccessRate = totalCalls > 0 
      ? (completedCalls / totalCalls) * 100 
      : 0;
    
    const conversionRate = completedCalls > 0 
      ? (successfulCalls / completedCalls) * 100 
      : 0;
    
    // Get hourly call distribution
    const hourlyDistribution = await this.getHourlyCallDistribution(campaign._id);
    
    // Get daily stats for this campaign
    const dailyStats = await this.getCampaignDailyStats(7, campaign._id);
    
    return {
      campaign: {
        _id: campaign._id,
        name: campaign.name,
        type: campaign.type,
        status: campaign.status,
        owner: campaign.owner,
        supervisors: campaign.supervisors,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        createdAt: (campaign as any).createdAt,
      },
      contacts: {
        total: totalContacts,
        pending: pendingContacts,
        inProgress: inProgressContacts,
        completed: completedContacts,
        failed: failedContacts,
        doNotCall: doNotCallContacts,
      },
      calls: {
        total: totalCalls,
        completed: completedCalls,
        failed: failedCalls,
        busy: busyCalls,
        noAnswer: noAnswerCalls,
        successful: successfulCalls,
      },
      metrics: {
        progress: parseFloat(progress.toFixed(2)),
        callSuccessRate: parseFloat(callSuccessRate.toFixed(2)),
        conversionRate: parseFloat(conversionRate.toFixed(2)),
        averageDuration,
      },
      hourlyDistribution,
      dailyStats,
    };
  }

  /**
   * Get information about live calls currently in progress
   */
  async getLiveCalls() {
    this.logger.log('Fetching live calls information');
    
    const liveCalls = await this.callModel.find({
      status: { $in: [CallStatus.INITIATED, CallStatus.RINGING, CallStatus.IN_PROGRESS] },
    })
    .populate('campaign', 'name type')
    .populate('contact', 'firstName lastName phoneNumber')
    .populate('supervisor', 'firstName lastName email')
    .sort({ startTime: -1 })
    .exec();
    
    return liveCalls.map(call => ({
      _id: call._id,
      sid: call.sid,
      campaign: call.campaign,
      contact: call.contact,
      supervisor: call.supervisor,
      fromNumber: call.fromNumber,
      toNumber: call.toNumber,
      status: call.status,
      startTime: call.startTime,
      duration: call.duration || this.calculateCurrentDuration(call.startTime),
    }));
  }

  /**
   * Helper method to get counts of calls made today
   */
  private async getCallsToday(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return this.callModel.countDocuments({
      startTime: { $gte: today },
    }).exec();
  }

  /**
   * Helper method to calculate current duration for active calls
   */
  private calculateCurrentDuration(startTime: Date): number {
    if (!startTime) return 0;
    
    const now = new Date();
    return Math.floor((now.getTime() - startTime.getTime()) / 1000);
  }

  /**
   * Helper method to get hourly call distribution for a campaign
   */
  private async getHourlyCallDistribution(campaignId: any) {
    const result = await this.callModel.aggregate([
      { 
        $match: { 
          campaign: campaignId,
        } 
      },
      {
        $project: {
          hour: { $hour: '$startTime' },
          status: 1,
        }
      },
      {
        $group: {
          _id: { hour: '$hour', status: '$status' },
          count: { $sum: 1 },
        }
      },
      {
        $sort: { '_id.hour': 1 }
      }
    ]).exec();
    
    // Transform to a more convenient format
    const hourlyDistribution = Array(24).fill(null).map((_, hour) => ({
      hour,
      completed: 0,
      failed: 0,
      other: 0,
    }));
    
    result.forEach(item => {
      const hour = item._id.hour;
      const status = item._id.status;
      const count = item.count;
      
      if (status === CallStatus.COMPLETED) {
        hourlyDistribution[hour].completed += count;
      } else if (status === CallStatus.FAILED || status === CallStatus.BUSY || status === CallStatus.NO_ANSWER) {
        hourlyDistribution[hour].failed += count;
      } else {
        hourlyDistribution[hour].other += count;
      }
    });
    
    return hourlyDistribution;
  }

  /**
   * Helper method to get daily campaign statistics
   */
  private async getCampaignDailyStats(days: number, campaignId?: any) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    
    // Prepare match stage for aggregation
    const matchStage: any = {
      createdAt: { $gte: startDate },
    };
    
    if (campaignId) {
      matchStage._id = campaignId;
    }
    
// Get campaign creation counts by day
const creationResult = await this.campaignModel.aggregate([
    { 
      $match: matchStage
    },
    {
      $project: {
        date: { 
          $dateToString: { 
            format: '%Y-%m-%d', 
            date: { $toDate: "$createdAt" } 
          } 
        },
      }
    },
      {
        $group: {
          _id: '$date',
          count: { $sum: 1 },
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]).exec();
    
    // Generate dates for the last N days
    const dateRange = [] as any[];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
      dateRange.unshift(formattedDate);
    }
    
    // Prepare the daily stats with dates
    const dailyStats = dateRange.map(date => {
      const creationData = creationResult.find(item => item._id === date);
      
      return {
        date,
        newCampaigns: creationData ? creationData.count : 0,
      };
    });
    
    return dailyStats;
  }

  /**
   * Helper method to get daily call statistics
   */
  private async getCallDailyStats(days: number) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    
    // Get call counts by day and status
    const result = await this.callModel.aggregate([
      { 
        $match: { 
          startTime: { $gte: startDate },
        } 
      },
      {
$project: {
          date: { 
            $dateToString: { 
              format: '%Y-%m-%d', 
              date: { $toDate: "$startTime" } 
            } 
          },
          status: 1,
        }
      },
      {
        $group: {
          _id: { date: '$date', status: '$status' },
          count: { $sum: 1 },
        }
      },
      {
        $sort: { '_id.date': 1 }
      }
    ]).exec();
    
    // Generate dates for the last N days
    const dateRange = [] as any[];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
      dateRange.unshift(formattedDate);
    }
    
    // Prepare the daily stats with dates
    const dailyStats = dateRange.map(date => {
      const completed = result.find(item => 
        item._id.date === date && item._id.status === CallStatus.COMPLETED
      );
      
      const failed = result.find(item => 
        item._id.date === date && item._id.status === CallStatus.FAILED
      );
      
      const busy = result.find(item => 
        item._id.date === date && item._id.status === CallStatus.BUSY
      );
      
      const noAnswer = result.find(item => 
        item._id.date === date && item._id.status === CallStatus.NO_ANSWER
      );
      
      return {
        date,
        completed: completed ? completed.count : 0,
        failed: failed ? failed.count : 0,
        busy: busy ? busy.count : 0,
        noAnswer: noAnswer ? noAnswer.count : 0,
      };
    });
    
    return dailyStats;
  }
}