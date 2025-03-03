// packages/backend/src/common/controllers/audit-log.controller.ts
import {
    Controller,
    Get,
    Query,
    UseGuards,
    Req,
    Logger,
    ParseIntPipe,
    DefaultValuePipe,
  } from '@nestjs/common';
  import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
  import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
  import { RolesGuard } from '../../modules/auth/guards/roles.guard';
  import { Roles } from '../decorators/roles.decorator';
  import { Role } from '../enums/role.enum';
  import { AuditLogService } from '../services/audit-log.service';
  import { AuditActionType } from '../schemas/audit-log.schema';
  import { Request } from 'express';
  
  @ApiTags('audit-logs')
  @Controller('audit-logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  export class AuditLogController {
    private readonly logger = new Logger(AuditLogController.name);
  
    constructor(private readonly auditLogService: AuditLogService) {}
  
    @Get()
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Get audit logs with filtering' })
    @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully' })
    async getAuditLogs(
      @Query('action') action?: string,
      @Query('entity') entity?: string,
      @Query('entityId') entityId?: string,
      @Query('userId') userId?: string,
      @Query('startDate') startDate?: string,
      @Query('endDate') endDate?: string,
      @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
      @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
      @Req() req?: Request,
    ) {
      this.logger.log('Retrieving audit logs');
      
      // Log this access to audit logs
      const requestingUserId = (req.user as any)._id.toString();
      await this.auditLogService.log(
        AuditActionType.ACCESS,
        'auditLog',
        requestingUserId,
        req,
        { filters: { action, entity, entityId, userId, startDate, endDate } },
      );
  
      // Parse dates if provided
      const parsedStartDate = startDate ? new Date(startDate) : undefined;
      const parsedEndDate = endDate ? new Date(endDate) : undefined;
  
      // Get audit logs with filters
      return this.auditLogService.getAuditLogs(
        {
          action: action as AuditActionType,
          entity,
          entityId,
          userId,
          startDate: parsedStartDate,
          endDate: parsedEndDate,
        },
        page,
        limit,
      );
    }
  }