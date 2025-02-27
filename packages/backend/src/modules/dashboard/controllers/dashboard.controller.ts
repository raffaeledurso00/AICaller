import {
    Controller,
    Get,
    UseGuards,
    Query,
    Logger,
  } from '@nestjs/common';
  import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
  import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
  import { RolesGuard } from '../../auth/guards/roles.guard';
  import { Roles } from '../../../common/decorators/roles.decorator';
  import { Role } from '../../../common/enums/role.enum';
  import { DashboardService } from '../services/dashboard.service';
  
  @ApiTags('dashboard')
  @Controller('dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  export class DashboardController {
    private readonly logger = new Logger(DashboardController.name);
  
    constructor(private readonly dashboardService: DashboardService) {}
  
    @Get('overview')
    @Roles(Role.ADMIN, Role.SUPERVISOR)
    @ApiOperation({ summary: 'Get system overview statistics' })
    @ApiResponse({ status: 200, description: 'System overview statistics' })
    async getSystemOverview() {
      this.logger.log('Fetching system overview statistics');
      return this.dashboardService.getSystemOverview();
    }
  
    @Get('campaigns/stats')
    @Roles(Role.ADMIN, Role.SUPERVISOR)
    @ApiOperation({ summary: 'Get campaign statistics' })
    @ApiResponse({ status: 200, description: 'Campaign statistics' })
    async getCampaignStats(@Query('days') days: number = 7) {
      this.logger.log(`Fetching campaign statistics for last ${days} days`);
      return this.dashboardService.getCampaignStats(days);
    }
  
    @Get('calls/stats')
    @Roles(Role.ADMIN, Role.SUPERVISOR)
    @ApiOperation({ summary: 'Get call statistics' })
    @ApiResponse({ status: 200, description: 'Call statistics' })
    async getCallStats(@Query('days') days: number = 7) {
      this.logger.log(`Fetching call statistics for last ${days} days`);
      return this.dashboardService.getCallStats(days);
    }
  
    @Get('campaigns/active')
    @Roles(Role.ADMIN, Role.SUPERVISOR, Role.AGENT)
    @ApiOperation({ summary: 'Get active campaigns with real-time metrics' })
    @ApiResponse({ status: 200, description: 'Active campaigns with metrics' })
    async getActiveCampaigns() {
      this.logger.log('Fetching active campaigns with real-time metrics');
      return this.dashboardService.getActiveCampaigns();
    }
  
    @Get('campaigns/:id/performance')
    @Roles(Role.ADMIN, Role.SUPERVISOR)
    @ApiOperation({ summary: 'Get detailed performance metrics for a campaign' })
    @ApiResponse({ status: 200, description: 'Campaign performance metrics' })
    async getCampaignPerformance(@Query('id') campaignId: string) {
      this.logger.log(`Fetching performance metrics for campaign ${campaignId}`);
      return this.dashboardService.getCampaignPerformance(campaignId);
    }
  
    @Get('live/calls')
    @Roles(Role.ADMIN, Role.SUPERVISOR)
    @ApiOperation({ summary: 'Get live calls information' })
    @ApiResponse({ status: 200, description: 'Live calls information' })
    async getLiveCalls() {
      this.logger.log('Fetching live calls information');
      return this.dashboardService.getLiveCalls();
    }
  }