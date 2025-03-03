import { Controller, Get, Post, Param, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CircuitBreakerService } from '../services/circuit-breaker.service';
import { ErrorTrackingService } from '../services/error-tracking.service';

@ApiTags('resilience')
@Controller('resilience')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ResilienceController {
  private readonly logger = new Logger(ResilienceController.name);

  constructor(
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly errorTrackingService: ErrorTrackingService,
  ) {}

  @Get('circuits')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all circuit breaker statuses' })
  @ApiResponse({ status: 200, description: 'Return all circuit breaker statuses' })
  getAllCircuitStatuses() {
    return this.circuitBreakerService.getAllCircuitStatuses();
  }

  @Post('circuits/:serviceKey/reset')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Reset a circuit breaker' })
  @ApiResponse({ status: 200, description: 'Circuit breaker reset successful' })
  resetCircuit(@Param('serviceKey') serviceKey: string) {
    this.logger.log(`Manually resetting circuit for ${serviceKey}`);
    this.circuitBreakerService.resetCircuit(serviceKey);
    return { success: true, message: `Circuit for ${serviceKey} reset successfully` };
  }

  @Get('errors')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get error counts by service' })
  @ApiResponse({ status: 200, description: 'Return error counts by service' })
  async getErrorCounts() {
    return this.errorTrackingService.getErrorCounts();
  }

  @Get('errors/:service')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get recent errors for a service' })
  @ApiResponse({ status: 200, description: 'Return recent errors for a service' })
  async getRecentErrors(@Param('service') service: string) {
    return this.errorTrackingService.getRecentErrors(service);
  }
}