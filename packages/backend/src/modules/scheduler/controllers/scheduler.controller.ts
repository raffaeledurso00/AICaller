import {
    Controller,
    Post,
    Param,
    UseGuards,
    Logger,
  } from '@nestjs/common';
  import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
  import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
  import { RolesGuard } from '../../auth/guards/roles.guard';
  import { Roles } from '../../../common/decorators/roles.decorator';
  import { Role } from '../../../common/enums/role.enum';
  import { SchedulerService } from '../../campaigns/services/scheduler.service';
  
  @ApiTags('scheduler')
  @Controller('scheduler')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  export class SchedulerController {
    private readonly logger = new Logger(SchedulerController.name);
  
    constructor(private readonly schedulerService: SchedulerService) {}
  
    @Post('run')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Manually run the campaign scheduler' })
    @ApiResponse({ status: 200, description: 'Scheduler initiated successfully' })
    async runScheduler() {
      this.logger.log('Manually running the campaign scheduler');
      
      await this.schedulerService.processActiveCampaigns();
      
      return { success: true, message: 'Scheduler executed successfully' };
    }
  }