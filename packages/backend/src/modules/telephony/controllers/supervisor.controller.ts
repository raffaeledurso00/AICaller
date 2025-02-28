import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    UseGuards,
    NotFoundException,
    BadRequestException,
    Logger,
    Request,
  } from '@nestjs/common';
  import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
  import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
  import { RolesGuard } from '../../auth/guards/roles.guard';
  import { Roles } from '../../../common/decorators/roles.decorator';
  import { Role } from '../../../common/enums/role.enum';
  import { SupervisorInterventionService } from '../services/supervisor-intervention.service';
  
  class SendInterventionMessageDto {
    message: string;
    type: 'suggestion' | 'override' | 'transfer' | 'end';
  }
  
  @ApiTags('supervisor')
  @Controller('supervisor')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  export class SupervisorController {
    private readonly logger = new Logger(SupervisorController.name);
  
    constructor(private readonly supervisorService: SupervisorInterventionService) {}
  
    @Post('calls/:callId/intervene')
    @Roles(Role.ADMIN, Role.SUPERVISOR)
    @ApiOperation({ summary: 'Start supervisor intervention for a call' })
    @ApiResponse({ status: 200, description: 'Intervention started successfully' })
    async startIntervention(@Param('callId') callId: string, @Request() req) {
      try {
        const supervisorId = req.user._id;
        const intervention = await this.supervisorService.startIntervention(callId, supervisorId);
        return intervention;
      } catch (error) {
        this.logger.error(`Error starting intervention: ${error.message}`, error.stack);
        if (error instanceof NotFoundException) {
          throw error;
        }
        throw new BadRequestException(`Failed to start intervention: ${error.message}`);
      }
    }
  
    @Post('calls/:callId/message')
    @Roles(Role.ADMIN, Role.SUPERVISOR)
    @ApiOperation({ summary: 'Send a message during intervention' })
    @ApiResponse({ status: 200, description: 'Intervention message sent successfully' })
    async sendInterventionMessage(
      @Param('callId') callId: string,
      @Body() messageDto: SendInterventionMessageDto,
      @Request() req,
    ) {
      try {
        const supervisorId = req.user._id;
        
        if (!this.supervisorService.hasActiveIntervention(callId)) {
          throw new BadRequestException(`No active intervention for call ${callId}`);
        }
        
        const message = await this.supervisorService.sendInterventionMessage(
          callId,
          supervisorId,
          messageDto.message,
          messageDto.type,
        );
        
        return message;
      } catch (error) {
        this.logger.error(`Error sending intervention message: ${error.message}`, error.stack);
        throw new BadRequestException(`Failed to send intervention message: ${error.message}`);
      }
    }
  
    @Post('calls/:callId/end-intervention')
    @Roles(Role.ADMIN, Role.SUPERVISOR)
    @ApiOperation({ summary: 'End supervisor intervention' })
    @ApiResponse({ status: 200, description: 'Intervention ended successfully' })
    async endIntervention(@Param('callId') callId: string, @Request() req) {
      try {
        const supervisorId = req.user._id;
        
        if (!this.supervisorService.hasActiveIntervention(callId)) {
          throw new BadRequestException(`No active intervention for call ${callId}`);
        }
        
        const intervention = await this.supervisorService.endIntervention(callId, supervisorId);
        return intervention;
      } catch (error) {
        this.logger.error(`Error ending intervention: ${error.message}`, error.stack);
        throw new BadRequestException(`Failed to end intervention: ${error.message}`);
      }
    }
  
    @Get('calls/:callId/intervention')
    @Roles(Role.ADMIN, Role.SUPERVISOR)
    @ApiOperation({ summary: 'Get details of a call intervention' })
    @ApiResponse({ status: 200, description: 'Intervention details retrieved' })
    getIntervention(@Param('callId') callId: string) {
      const intervention = this.supervisorService.getIntervention(callId);
      
      if (!intervention) {
        throw new NotFoundException(`No intervention found for call ${callId}`);
      }
      
      return intervention;
    }
  
    @Get('active-interventions')
    @Roles(Role.ADMIN, Role.SUPERVISOR)
    @ApiOperation({ summary: 'Get all active interventions' })
    @ApiResponse({ status: 200, description: 'Active interventions retrieved' })
    getActiveInterventions() {
      return this.supervisorService.getAllActiveInterventions();
    }
  }