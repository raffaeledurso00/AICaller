import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Request,
    Query,
    Logger,
  } from '@nestjs/common';
  import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
  import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
  import { RolesGuard } from '../../auth/guards/roles.guard';
  import { Roles } from '../../../common/decorators/roles.decorator';
  import { Role } from '../../../common/enums/role.enum';
  import { CampaignService } from '../services/campaign.service';
  import { CreateCampaignDto } from '../dto/create-campaign.dto';
  import { UpdateCampaignDto } from '../dto/update-campaign.dto';
  import { CampaignStatus } from '../schemas/campaign.schema';
  
  @ApiTags('campaigns')
  @Controller('campaigns')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  export class CampaignController {
    private readonly logger = new Logger(CampaignController.name);
  
    constructor(private readonly campaignService: CampaignService) {}
  
    @Post()
    @Roles(Role.ADMIN, Role.SUPERVISOR)
    @ApiOperation({ summary: 'Create a new campaign' })
    @ApiResponse({ status: 201, description: 'Campaign created successfully' })
    create(@Body() createCampaignDto: CreateCampaignDto, @Request() req) {
      this.logger.log(`Creating new campaign: ${createCampaignDto.name}`);
      
      // Extract supervisors if provided and add them to the campaign
      const supervisors = createCampaignDto.supervisorIds || [];
      delete createCampaignDto.supervisorIds;
      
      return this.campaignService.create(createCampaignDto, req.user._id);
    }
  
    @Get()
    @Roles(Role.ADMIN, Role.SUPERVISOR, Role.AGENT)
    @ApiOperation({ summary: 'Find all campaigns' })
    @ApiResponse({ status: 200, description: 'Return all campaigns' })
    findAll(@Request() req, @Query('status') status?: CampaignStatus) {
      const user = req.user;
      const filters: any = {};
      
      // Apply status filter if provided
      if (status) {
        filters.status = status;
      }
      
      // If not admin, only show campaigns where user is owner or supervisor
      if (!user.roles.includes(Role.ADMIN)) {
        filters.$or = [
          { owner: user._id },
          { supervisors: user._id },
        ];
      }
      
      return this.campaignService.findAll(filters);
    }
  
    @Get(':id')
    @Roles(Role.ADMIN, Role.SUPERVISOR, Role.AGENT)
    @ApiOperation({ summary: 'Find a campaign by ID' })
    @ApiResponse({ status: 200, description: 'Return the campaign' })
    @ApiResponse({ status: 404, description: 'Campaign not found' })
    findOne(@Param('id') id: string) {
      return this.campaignService.findOne(id);
    }
  
    @Patch(':id')
    @Roles(Role.ADMIN, Role.SUPERVISOR)
    @ApiOperation({ summary: 'Update a campaign' })
    @ApiResponse({ status: 200, description: 'Campaign updated successfully' })
    @ApiResponse({ status: 404, description: 'Campaign not found' })
    update(@Param('id') id: string, @Body() updateCampaignDto: UpdateCampaignDto) {
      return this.campaignService.update(id, updateCampaignDto);
    }
  
    @Delete(':id')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Delete a campaign' })
    @ApiResponse({ status: 200, description: 'Campaign deleted successfully' })
    @ApiResponse({ status: 404, description: 'Campaign not found' })
    remove(@Param('id') id: string) {
      return this.campaignService.remove(id);
    }
  
    @Patch(':id/status')
    @Roles(Role.ADMIN, Role.SUPERVISOR)
    @ApiOperation({ summary: 'Update campaign status' })
    @ApiResponse({ status: 200, description: 'Campaign status updated successfully' })
    @ApiResponse({ status: 404, description: 'Campaign not found' })
    updateStatus(
      @Param('id') id: string,
      @Body('status') status: CampaignStatus,
    ) {
      return this.campaignService.updateStatus(id, status);
    }
  
    @Post(':id/supervisors/:supervisorId')
    @Roles(Role.ADMIN, Role.SUPERVISOR)
    @ApiOperation({ summary: 'Add a supervisor to the campaign' })
    @ApiResponse({ status: 200, description: 'Supervisor added successfully' })
    @ApiResponse({ status: 404, description: 'Campaign not found' })
    addSupervisor(@Param('id') id: string, @Param('supervisorId') supervisorId: string) {
      return this.campaignService.addSupervisor(id, supervisorId);
    }
  
    @Delete(':id/supervisors/:supervisorId')
    @Roles(Role.ADMIN, Role.SUPERVISOR)
    @ApiOperation({ summary: 'Remove a supervisor from the campaign' })
    @ApiResponse({ status: 200, description: 'Supervisor removed successfully' })
    @ApiResponse({ status: 404, description: 'Campaign not found' })
    removeSupervisor(@Param('id') id: string, @Param('supervisorId') supervisorId: string) {
      return this.campaignService.removeSupervisor(id, supervisorId);
    }
  
    @Get('owner/:ownerId')
    @Roles(Role.ADMIN, Role.SUPERVISOR)
    @ApiOperation({ summary: 'Find campaigns by owner' })
    @ApiResponse({ status: 200, description: 'Return campaigns by owner' })
    findByOwner(@Param('ownerId') ownerId: string) {
      return this.campaignService.findByOwner(ownerId);
    }
  
    @Get('supervisor/:supervisorId')
    @Roles(Role.ADMIN, Role.SUPERVISOR)
    @ApiOperation({ summary: 'Find campaigns by supervisor' })
    @ApiResponse({ status: 200, description: 'Return campaigns by supervisor' })
    findBySupervisor(@Param('supervisorId') supervisorId: string) {
      return this.campaignService.findBySupervisor(supervisorId);
    }
  }