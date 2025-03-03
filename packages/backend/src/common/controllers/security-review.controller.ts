import {
    Controller,
    Get,
    Post,
    UseGuards,
    Res,
    Logger,
  } from '@nestjs/common';
  import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
  import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
  import { RolesGuard } from '../../modules/auth/guards/roles.guard';
  import { Roles } from '../decorators/roles.decorator';
  import { Role } from '../enums/role.enum';
  import { SecurityReviewService } from '../services/security-review.service';
  import { Response } from 'express';
  import * as fs from 'fs';
  
  @ApiTags('security')
  @Controller('security')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  export class SecurityReviewController {
    private readonly logger = new Logger(SecurityReviewController.name);
  
    constructor(private readonly securityReviewService: SecurityReviewService) {}
  
    @Get('review')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Perform a security review' })
    @ApiResponse({ status: 200, description: 'Security review results' })
    async performSecurityReview() {
      this.logger.log('Performing security review');
      return this.securityReviewService.performSecurityReview();
    }
  
    @Post('report')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Generate a security report file' })
    @ApiResponse({ status: 200, description: 'Security report generated' })
    async generateSecurityReport(@Res() res: Response) {
      this.logger.log('Generating security report');
      const reportPath = await this.securityReviewService.generateSecurityReport();
      
      return res.status(200).json({
        success: true,
        message: 'Security report generated',
        reportPath,
      });
    }
  
    @Get('report/download/:date')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Download a security report' })
    @ApiResponse({ status: 200, description: 'Security report file' })
    async downloadSecurityReport(@Res() res: Response) {
      const reportDate = new Date().toISOString().split('T')[0];
      const reportPath = `reports/security-review-${reportDate}.md`;
      
      if (!fs.existsSync(reportPath)) {
        return res.status(404).json({
          success: false,
          message: 'Report not found',
        });
      }
      
      return res.download(reportPath);
    }
  }