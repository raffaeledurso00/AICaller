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
    Query,
  } from '@nestjs/common';
  import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
  import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
  import { RolesGuard } from '../../auth/guards/roles.guard';
  import { Roles } from '../../../common/decorators/roles.decorator';
  import { Role } from '../../../common/enums/role.enum';
  import { ContactService } from '../services/contact.service';
  import { CreateContactDto } from '../dto/create-contact.dto';
  import { UpdateContactDto } from '../dto/update-contact.dto';
  import { ImportContactsDto } from '../dto/import-contacts.dto';
  import { ContactStatus } from '../schemas/contact.schema';
  
  @ApiTags('contacts')
  @Controller('contacts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  export class ContactController {
    private readonly logger = new Logger(ContactController.name);
  
    constructor(private readonly contactService: ContactService) {}
  
    @Post()
    @Roles(Role.ADMIN, Role.SUPERVISOR, Role.AGENT)
    @ApiOperation({ summary: 'Create a new contact' })
    @ApiResponse({ status: 201, description: 'Contact created successfully' })
    create(@Body() createContactDto: CreateContactDto) {
      return this.contactService.create(createContactDto);
    }
  
    @Get()
    @Roles(Role.ADMIN, Role.SUPERVISOR, Role.AGENT)
    @ApiOperation({ summary: 'Find all contacts' })
    @ApiResponse({ status: 200, description: 'Return all contacts' })
    findAll(@Query('campaignId') campaignId?: string, @Query('status') status?: ContactStatus) {
      const filters: any = {};
      
      if (campaignId) {
        filters.campaign = campaignId;
      }
      
      if (status) {
        filters.status = status;
      }
      
      return this.contactService.findAll(filters);
    }
  
    @Get(':id')
    @Roles(Role.ADMIN, Role.SUPERVISOR, Role.AGENT)
    @ApiOperation({ summary: 'Find a contact by ID' })
    @ApiResponse({ status: 200, description: 'Return the contact' })
    @ApiResponse({ status: 404, description: 'Contact not found' })
    findOne(@Param('id') id: string) {
      return this.contactService.findOne(id);
    }
  
    @Patch(':id')
    @Roles(Role.ADMIN, Role.SUPERVISOR, Role.AGENT)
    @ApiOperation({ summary: 'Update a contact' })
    @ApiResponse({ status: 200, description: 'Contact updated successfully' })
    @ApiResponse({ status: 404, description: 'Contact not found' })
    update(@Param('id') id: string, @Body() updateContactDto: UpdateContactDto) {
      return this.contactService.update(id, updateContactDto);
    }
  
    @Delete(':id')
    @Roles(Role.ADMIN, Role.SUPERVISOR)
    @ApiOperation({ summary: 'Delete a contact' })
    @ApiResponse({ status: 200, description: 'Contact deleted successfully' })
    @ApiResponse({ status: 404, description: 'Contact not found' })
    remove(@Param('id') id: string) {
      return this.contactService.remove(id);
    }
  
    @Get('campaign/:campaignId')
    @Roles(Role.ADMIN, Role.SUPERVISOR, Role.AGENT)
    @ApiOperation({ summary: 'Find contacts by campaign' })
    @ApiResponse({ status: 200, description: 'Return contacts by campaign' })
    findByCampaign(@Param('campaignId') campaignId: string) {
      return this.contactService.findByCampaign(campaignId);
    }
  
    @Patch(':id/status')
    @Roles(Role.ADMIN, Role.SUPERVISOR, Role.AGENT)
    @ApiOperation({ summary: 'Update contact status' })
    @ApiResponse({ status: 200, description: 'Contact status updated successfully' })
    @ApiResponse({ status: 404, description: 'Contact not found' })
    updateStatus(
      @Param('id') id: string,
      @Body('status') status: ContactStatus,
    ) {
      return this.contactService.updateStatus(id, status);
    }
  
    @Post(':id/history')
    @Roles(Role.ADMIN, Role.SUPERVISOR, Role.AGENT)
    @ApiOperation({ summary: 'Add history entry to contact' })
    @ApiResponse({ status: 200, description: 'History entry added successfully' })
    @ApiResponse({ status: 404, description: 'Contact not found' })
    addHistoryEntry(
      @Param('id') id: string,
      @Body() body: { action: string; notes?: string; data?: Record<string, any> },
    ) {
      return this.contactService.addHistoryEntry(id, body.action, body.notes, body.data);
    }
  
    @Post('import')
    @Roles(Role.ADMIN, Role.SUPERVISOR)
    @ApiOperation({ summary: 'Import multiple contacts' })
    @ApiResponse({ status: 201, description: 'Contacts imported successfully' })
    bulkImport(@Body() importContactsDto: ImportContactsDto) {
      return this.contactService.bulkImport(importContactsDto);
    }
  
    @Get('campaign/:campaignId/available')
    @Roles(Role.ADMIN, Role.SUPERVISOR, Role.AGENT)
    @ApiOperation({ summary: 'Find available contacts for campaign' })
    @ApiResponse({ status: 200, description: 'Return available contacts' })
    findAvailableForCampaign(
      @Param('campaignId') campaignId: string,
      @Query('limit') limit: number = 10,
    ) {
      return this.contactService.findAvailableContactsForCampaign(campaignId, limit);
    }
  
    @Patch(':id/success')
    @Roles(Role.ADMIN, Role.SUPERVISOR, Role.AGENT)
    @ApiOperation({ summary: 'Mark contact as successful' })
    @ApiResponse({ status: 200, description: 'Contact marked as successful' })
    @ApiResponse({ status: 404, description: 'Contact not found' })
    markAsSuccessful(@Param('id') id: string) {
      return this.contactService.markAsSuccessful(id);
    }
  }