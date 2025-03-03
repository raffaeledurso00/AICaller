import {
    Controller,
    Get,
    Post,
    Param,
    UseGuards,
    Req,
    ForbiddenException,
    Logger,
  } from '@nestjs/common';
  import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
  import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
  import { RolesGuard } from '../../modules/auth/guards/roles.guard';
  import { Roles } from '../decorators/roles.decorator';
  import { Role } from '../enums/role.enum';
  import { GdprService } from '../services/gdpr.service';
  import { AuditLogService } from '../services/audit-log.service';
  import { AuditActionType } from '../schemas/audit-log.schema';
  import { Request } from 'express';
  
  @ApiTags('gdpr')
  @Controller('gdpr')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  export class GdprController {
    private readonly logger = new Logger(GdprController.name);
  
    constructor(
      private readonly gdprService: GdprService,
      private readonly auditLogService: AuditLogService,
    ) {}
  
    @Get('data-access/:userId')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Handle a data subject access request (DSAR)' })
    @ApiResponse({ status: 200, description: 'Personal data retrieved successfully' })
    async handleDataAccessRequest(@Param('userId') userId: string, @Req() req: Request) {
      this.logger.log(`Processing data access request for user ${userId}`);
      const requestingUserId = (req.user as any)._id.toString();
  
      return this.gdprService.handleDataAccessRequest(userId, requestingUserId);
    }
  
    @Post('erasure/:userId')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Handle a right to erasure request (right to be forgotten)' })
    @ApiResponse({ status: 200, description: 'Personal data anonymized successfully' })
    async handleErasureRequest(@Param('userId') userId: string, @Req() req: Request) {
      this.logger.log(`Processing erasure request for user ${userId}`);
      const requestingUserId = (req.user as any)._id.toString();
  
      // Prevent self-erasure by admins
      if (userId === requestingUserId) {
        throw new ForbiddenException('Administrators cannot erase their own data');
      }
  
      await this.gdprService.handleErasureRequest(userId, requestingUserId);
      return { success: true, message: 'User data anonymized successfully' };
    }
  
    @Get('audit-logs')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Get GDPR-related audit logs' })
    @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully' })
    async getGdprAuditLogs(@Req() req: Request) {
      const requestingUserId = (req.user as any)._id.toString();
  
      // Log this access to audit logs
      await this.auditLogService.log(
        AuditActionType.ACCESS,
        'auditLog',
        requestingUserId,
        req,
        { type: 'gdpr' },
      );
  
      // Get GDPR-related audit logs
      return this.auditLogService.getAuditLogs({
        action: AuditActionType.ACCESS,
      });
    }
  }