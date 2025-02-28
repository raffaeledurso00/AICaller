import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Logger,
    NotFoundException,
  } from '@nestjs/common';
  import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
  import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
  import { RolesGuard } from '../../auth/guards/roles.guard';
  import { Roles } from '../../../common/decorators/roles.decorator';
  import { Role } from '../../../common/enums/role.enum';
  import { CrmService } from '../services/crm.service';
  import { WebhookService } from '../services/webhook.service';
  import { WebhookEventDto } from '../dto/webhook-event.dto';
  import { CreateIntegrationDto } from '../dto/create-integration.dto';
  import { UpdateIntegrationDto } from '../dto/update-integration.dto';
  import { CreateWebhookDto } from '../dto/create-webhook.dto';
  import { UpdateWebhookDto } from '../dto/update-webhook.dto';
  import { IntegrationType } from '../schemas/integration.schema';
  
  @ApiTags('integrations')
  @Controller('integrations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  export class IntegrationsController {
    private readonly logger = new Logger(IntegrationsController.name);
  
    constructor(
      private readonly crmService: CrmService,
      private readonly webhookService: WebhookService,
    ) {}
  
    // CRM Integrations endpoints
  
    @Post()
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Create a new CRM integration' })
    @ApiResponse({ status: 201, description: 'Integration created successfully' })
    async createIntegration(@Body() createIntegrationDto: CreateIntegrationDto) {
      this.logger.log(`Creating new ${createIntegrationDto.type} integration: ${createIntegrationDto.name}`);
      
      return this.crmService.createIntegration(
        createIntegrationDto.name,
        createIntegrationDto.type as IntegrationType,
        createIntegrationDto.config,
        createIntegrationDto.fieldMapping,
      );
    }
  
    @Get()
    @Roles(Role.ADMIN, Role.SUPERVISOR)
    @ApiOperation({ summary: 'Get all integrations' })
    @ApiResponse({ status: 200, description: 'Return all integrations' })
    async getAllIntegrations() {
      return this.crmService.getAllIntegrations();
    }
  
    @Get(':id')
    @Roles(Role.ADMIN, Role.SUPERVISOR)
    @ApiOperation({ summary: 'Get integration by ID' })
    @ApiResponse({ status: 200, description: 'Return the integration' })
    @ApiResponse({ status: 404, description: 'Integration not found' })
    async getIntegrationById(@Param('id') id: string) {
      const integration = await this.crmService.getIntegrationById(id);
      
      if (!integration) {
        throw new NotFoundException(`Integration with ID ${id} not found`);
      }
      
      return integration;
    }
  
    @Patch(':id')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Update an integration' })
    @ApiResponse({ status: 200, description: 'Integration updated successfully' })
    @ApiResponse({ status: 404, description: 'Integration not found' })
    async updateIntegration(
      @Param('id') id: string,
      @Body() updateIntegrationDto: UpdateIntegrationDto,
    ) {
      const integration = await this.crmService.updateIntegration(id, updateIntegrationDto);
      
      if (!integration) {
        throw new NotFoundException(`Integration with ID ${id} not found`);
      }
      
      return integration;
    }
  
    @Delete(':id')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Delete an integration' })
    @ApiResponse({ status: 200, description: 'Integration deleted successfully' })
    @ApiResponse({ status: 404, description: 'Integration not found' })
    async deleteIntegration(@Param('id') id: string) {
      const integration = await this.crmService.getIntegrationById(id);
      
      if (!integration) {
        throw new NotFoundException(`Integration with ID ${id} not found`);
      }
      
      await this.crmService.deleteIntegration(id);
      
      return { success: true, message: 'Integration deleted successfully' };
    }
  
    @Post(':id/test')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Test an integration connection' })
    @ApiResponse({ status: 200, description: 'Test results' })
    @ApiResponse({ status: 404, description: 'Integration not found' })
    async testIntegration(@Param('id') id: string) {
      const integration = await this.crmService.getIntegrationById(id);
      
      if (!integration) {
        throw new NotFoundException(`Integration with ID ${id} not found`);
      }
      
      return this.crmService.testIntegration(id);
    }
  
    // Webhooks endpoints
  
    @Post('webhooks')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Create a new webhook' })
    @ApiResponse({ status: 201, description: 'Webhook created successfully' })
    async createWebhook(@Body() createWebhookDto: CreateWebhookDto) {
      this.logger.log(`Creating new webhook: ${createWebhookDto.name}`);
      
      return this.webhookService.createWebhook(
        createWebhookDto.name,
        createWebhookDto.url,
        createWebhookDto.events,
        createWebhookDto.isActive,
      );
    }
  
    @Get('webhooks')
    @Roles(Role.ADMIN, Role.SUPERVISOR)
    @ApiOperation({ summary: 'Get all webhooks' })
    @ApiResponse({ status: 200, description: 'Return all webhooks' })
    async getAllWebhooks() {
      return this.webhookService.getAllWebhooks();
    }
  
    @Get('webhooks/:id')
    @Roles(Role.ADMIN, Role.SUPERVISOR)
    @ApiOperation({ summary: 'Get webhook by ID' })
    @ApiResponse({ status: 200, description: 'Return the webhook' })
    @ApiResponse({ status: 404, description: 'Webhook not found' })
    async getWebhookById(@Param('id') id: string) {
      const webhook = await this.webhookService.getWebhookById(id);
      
      if (!webhook) {
        throw new NotFoundException(`Webhook with ID ${id} not found`);
      }
      
      return webhook;
    }
  
    @Patch('webhooks/:id')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Update a webhook' })
    @ApiResponse({ status: 200, description: 'Webhook updated successfully' })
    @ApiResponse({ status: 404, description: 'Webhook not found' })
    async updateWebhook(
      @Param('id') id: string,
      @Body() updateWebhookDto: UpdateWebhookDto,
    ) {
      const webhook = await this.webhookService.updateWebhook(id, updateWebhookDto);
      
      if (!webhook) {
        throw new NotFoundException(`Webhook with ID ${id} not found`);
      }
      
      return webhook;
    }
  
    @Delete('webhooks/:id')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Delete a webhook' })
    @ApiResponse({ status: 200, description: 'Webhook deleted successfully' })
    @ApiResponse({ status: 404, description: 'Webhook not found' })
    async deleteWebhook(@Param('id') id: string) {
      const webhook = await this.webhookService.getWebhookById(id);
      
      if (!webhook) {
        throw new NotFoundException(`Webhook with ID ${id} not found`);
      }
      
      await this.webhookService.deleteWebhook(id);
      
      return { success: true, message: 'Webhook deleted successfully' };
    }
  
    @Post('webhooks/trigger')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Manually trigger a webhook event' })
    @ApiResponse({ status: 200, description: 'Webhook event triggered' })
    async triggerWebhook(@Body() webhookEventDto: WebhookEventDto) {
      this.logger.log(`Manually triggering webhook event: ${webhookEventDto.eventType}`);
      
      await this.webhookService.triggerWebhookEvent(webhookEventDto);
      
      return { success: true, message: 'Webhook event triggered' };
    }
  }