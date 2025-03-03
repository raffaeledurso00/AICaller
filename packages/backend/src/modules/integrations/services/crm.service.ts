import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { Integration, IntegrationDocument, IntegrationType } from '../schemas/integration.schema';
import { WebhookService } from './webhook.service';
import { WebhookEventType } from '../enums/webhook-event-type.enum';
import { Call } from '../../telephony/schemas/call.schema';
import { Contact } from '../../contacts/schemas/contact.schema';
import { Campaign } from '../../campaigns/schemas/campaign.schema';

@Injectable()
export class CrmService {
  private readonly logger = new Logger(CrmService.name);

  constructor(
    @InjectModel(Integration.name) private readonly integrationModel: Model<IntegrationDocument>,
    private readonly webhookService: WebhookService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Create a new CRM integration
   */
  async createIntegration(
    name: string,
    type: IntegrationType,
    config: Record<string, any>,
    fieldMapping: Record<string, string>,
  ): Promise<IntegrationDocument> {
    this.logger.log(`Creating new ${type} integration: ${name}`);
    
    const integration = new this.integrationModel({
      name,
      type,
      config,
      fieldMapping,
      isActive: true,
    });
    
    return integration.save();
  }

  /**
   * Get all integrations
   */
  async getAllIntegrations(): Promise<IntegrationDocument[]> {
    return this.integrationModel.find().exec();
  }

  /**
   * Get an integration by ID
   */
  async getIntegrationById(id: string): Promise<IntegrationDocument> {
    const integration = await this.integrationModel.findById(id).exec();
    if (!integration) {
      throw new Error('Integration not found');
    }
    return integration;
  }

  /**
   * Update an integration
   */
  async updateIntegration(id: string, updateData: Partial<Integration>): Promise<IntegrationDocument> {
    this.logger.log(`Updating integration: ${id}`);
    
    const updatedIntegration = await this.integrationModel.findByIdAndUpdate(id, updateData, { new: true }).exec();
    if (!updatedIntegration) {
      throw new Error('Integration not found');
    }
    return updatedIntegration;
  }

  /**
   * Delete an integration
   */
  async deleteIntegration(id: string): Promise<void> {
    this.logger.log(`Deleting integration: ${id}`);
    
    await this.integrationModel.findByIdAndDelete(id).exec();
  }

  /**
   * Test a CRM integration connection
   */
  async testIntegration(id: string): Promise<{ success: boolean; message: string }> {
    const integration = await this.getIntegrationById(id);
    
    if (!integration) {
      return { success: false, message: 'Integration not found' };
    }
    
    try {
      // Test the connection based on the integration type
      switch (integration.type) {
        case IntegrationType.SALESFORCE:
          return await this.testSalesforceConnection(integration);
        case IntegrationType.HUBSPOT:
          return await this.testHubspotConnection(integration);
        case IntegrationType.ZOHO:
          return await this.testZohoConnection(integration);
        case IntegrationType.CUSTOM:
          return await this.testCustomConnection(integration);
        default:
          return { success: false, message: `Unsupported integration type: ${integration.type}` };
      }
    } catch (error) {
      this.logger.error(`Error testing integration: ${error.message}`, error.stack);
      return { success: false, message: `Error: ${error.message}` };
    }
  }

  /**
   * Sync a contact to the CRM
   */
  async syncContact(
    integrationId: string, 
    contact: Contact,
    campaign?: Campaign,
  ): Promise<{ success: boolean; externalId?: string; message?: string }> {
    const integration = await this.getIntegrationById(integrationId);
    
    if (!integration || !integration.isActive) {
      return { success: false, message: 'Integration not found or inactive' };
    }
    
    try {
      // Map contact fields based on integration's field mapping
      const mappedContact = this.mapFields(contact, integration.fieldMapping);
      
      // Add campaign data if available
      if (campaign) {
        mappedContact.campaign = campaign.name;
        mappedContact.campaignType = campaign.type;
      }
      
      // Sync based on the integration type
      switch (integration.type) {
        case IntegrationType.SALESFORCE:
          return await this.syncContactToSalesforce(integration, mappedContact);
        case IntegrationType.HUBSPOT:
          return await this.syncContactToHubspot(integration, mappedContact);
        case IntegrationType.ZOHO:
          return await this.syncContactToZoho(integration, mappedContact);
        case IntegrationType.CUSTOM:
          return await this.syncContactToCustomCrm(integration, mappedContact);
        default:
          return { success: false, message: `Unsupported integration type: ${integration.type}` };
      }
    } catch (error) {
      this.logger.error(`Error syncing contact: ${error.message}`, error.stack);
      return { success: false, message: `Error: ${error.message}` };
    }
  }

  /**
   * Log a call in the CRM
   */
  async logCall(
    integrationId: string, 
    call: Call,
    contact: Contact,
    campaign: Campaign,
  ): Promise<{ success: boolean; externalId?: string; message?: string }> {
    const integration = await this.getIntegrationById(integrationId);
    
    if (!integration || !integration.isActive) {
      return { success: false, message: 'Integration not found or inactive' };
    }
    
    try {
      // Prepare the call data
      const callData = {
        subject: `${campaign.name} - Call with ${contact.firstName} ${contact.lastName}`,
        to: contact.phoneNumber,
        from: call.fromNumber,
        startTime: call.startTime,
        endTime: call.endTime,
        duration: call.duration,
        status: call.status,
        outcome: call.outcome,
        notes: call.notes,
        recordingUrl: call.recordingUrl,
        contactId: (contact as any)._id.toString(),
        // Map additional fields based on integration's field mapping
        ...this.mapFields(call, integration.fieldMapping),
      };
      
      // Log the call based on the integration type
      switch (integration.type) {
        case IntegrationType.SALESFORCE:
          return await this.logCallToSalesforce(integration, callData, contact);
        case IntegrationType.HUBSPOT:
          return await this.logCallToHubspot(integration, callData, contact);
        case IntegrationType.ZOHO:
          return await this.logCallToZoho(integration, callData, contact);
        case IntegrationType.CUSTOM:
          return await this.logCallToCustomCrm(integration, callData, contact);
        default:
          return { success: false, message: `Unsupported integration type: ${integration.type}` };
      }
    } catch (error) {
      this.logger.error(`Error logging call: ${error.message}`, error.stack);
      return { success: false, message: `Error: ${error.message}` };
    }
  }

  /**
   * Map fields based on the integration's field mapping
   */
  private mapFields(data: any, fieldMapping: Record<string, string>): Record<string, any> {
    const result: Record<string, any> = {};
    
    // For each field in the mapping
    Object.entries(fieldMapping).forEach(([sourceField, targetField]) => {
      // Use dot notation to access nested fields
      const value = sourceField.split('.').reduce((obj, key) => (obj && obj[key] !== undefined) ? obj[key] : undefined, data);
      
      if (value !== undefined) {
        // Support for nested target fields
        if (targetField.includes('.')) {
          const parts = targetField.split('.');
          let current = result;
          
          // Create nested objects as needed
          for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!current[part]) {
              current[part] = {};
            }
            current = current[part];
          }
          
          // Set the value at the leaf node
          current[parts[parts.length - 1]] = value;
        } else {
          // Simple case: direct mapping
          result[targetField] = value;
        }
      }
    });
    
    return result;
  }

  // Connection test methods for different CRM systems

  private async testSalesforceConnection(integration: IntegrationDocument): Promise<{ success: boolean; message: string }> {
    const { instanceUrl, accessToken } = integration.config;
    
    if (!instanceUrl || !accessToken) {
      return { success: false, message: 'Missing Salesforce configuration' };
    }
    
    try {
      // Test the connection by fetching the Salesforce API version
      const response = await axios.get(`${instanceUrl}/services/data`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      
      if (response.status === 200 && Array.isArray(response.data)) {
        return { success: true, message: 'Successfully connected to Salesforce API' };
      } else {
        return { success: false, message: 'Invalid response from Salesforce API' };
      }
    } catch (error) {
      return { success: false, message: `Salesforce connection error: ${error.message}` };
    }
  }

  private async testHubspotConnection(integration: IntegrationDocument): Promise<{ success: boolean; message: string }> {
    const { apiKey } = integration.config;
    
    if (!apiKey) {
      return { success: false, message: 'Missing HubSpot API key' };
    }
    
    try {
      // Test the connection by fetching HubSpot API status
      const response = await axios.get('https://api.hubapi.com/crm/v3/objects/contacts', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        params: {
          limit: 1,
        },
      });
      
      if (response.status === 200) {
        return { success: true, message: 'Successfully connected to HubSpot API' };
      } else {
        return { success: false, message: 'Invalid response from HubSpot API' };
      }
    } catch (error) {
      return { success: false, message: `HubSpot connection error: ${error.message}` };
    }
  }

  private async testZohoConnection(integration: IntegrationDocument): Promise<{ success: boolean; message: string }> {
    const { accessToken, apiDomain } = integration.config;
    
    if (!accessToken || !apiDomain) {
      return { success: false, message: 'Missing Zoho configuration' };
    }
    
    try {
      // Test the connection by fetching Zoho CRM API info
      const response = await axios.get(`${apiDomain}/crm/v2/org`, {
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
      });
      
      if (response.status === 200) {
        return { success: true, message: 'Successfully connected to Zoho CRM API' };
      } else {
        return { success: false, message: 'Invalid response from Zoho CRM API' };
      }
    } catch (error) {
      return { success: false, message: `Zoho connection error: ${error.message}` };
    }
  }

  private async testCustomConnection(integration: IntegrationDocument): Promise<{ success: boolean; message: string }> {
    const { apiUrl, apiKey, testEndpoint } = integration.config;
    
    if (!apiUrl || !apiKey || !testEndpoint) {
      return { success: false, message: 'Missing custom CRM configuration' };
    }
    
    try {
      // Test the connection by hitting the test endpoint
      const response = await axios.get(`${apiUrl}${testEndpoint}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });
      
      if (response.status >= 200 && response.status < 300) {
        return { success: true, message: 'Successfully connected to custom CRM API' };
      } else {
        return { success: false, message: `Invalid response from custom CRM API: ${response.status}` };
      }
    } catch (error) {
      return { success: false, message: `Custom CRM connection error: ${error.message}` };
    }
  }

  // Methods for syncing contacts to different CRM systems

  private async syncContactToSalesforce(
    integration: IntegrationDocument, 
    contactData: Record<string, any>,
  ): Promise<{ success: boolean; externalId?: string; message?: string }> {
    const { instanceUrl, accessToken } = integration.config;
    
    try {
      // Check if contact already exists in Salesforce
      let existingContact;
      if (contactData.email) {
        const queryResponse = await axios.get(
          `${instanceUrl}/services/data/v53.0/query/?q=SELECT+Id+FROM+Contact+WHERE+Email='${contactData.email}'`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
        
        if (queryResponse.data.records && queryResponse.data.records.length > 0) {
          existingContact = queryResponse.data.records[0];
        }
      }
      
      let response;
      if (existingContact) {
        // Update existing contact
        response = await axios.patch(
          `${instanceUrl}/services/data/v53.0/sobjects/Contact/${existingContact.Id}`,
          contactData,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        return { 
          success: true, 
          externalId: existingContact.Id,
          message: 'Contact updated in Salesforce',
        };
      } else {
        // Create new contact
        response = await axios.post(
          `${instanceUrl}/services/data/v53.0/sobjects/Contact`,
          contactData,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (response.data.success) {
          return { 
            success: true, 
            externalId: response.data.id,
            message: 'Contact created in Salesforce',
          };
        } else {
          return { 
            success: false, 
            message: 'Failed to create contact in Salesforce',
          };
        }
      }
    } catch (error) {
      this.logger.error(`Error syncing contact to Salesforce: ${error.message}`, error.stack);
      return { success: false, message: `Salesforce error: ${error.message}` };
    }
  }

  private async syncContactToHubspot(
    integration: IntegrationDocument, 
    contactData: Record<string, any>,
  ): Promise<{ success: boolean; externalId?: string; message?: string }> {
    const { apiKey } = integration.config;
    
    try {
      // Prepare the contact properties in HubSpot format
      const properties = {};
      Object.entries(contactData).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          properties[key] = String(value);
        }
      });
      
      // Check if contact already exists in HubSpot
      let existingContact;
      if (contactData.email) {
        try {
          const searchResponse = await axios.post(
            'https://api.hubapi.com/crm/v3/objects/contacts/search',
            {
              filterGroups: [
                {
                  filters: [
                    {
                      propertyName: 'email',
                      operator: 'EQ',
                      value: contactData.email,
                    },
                  ],
                },
              ],
            },
            {
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
            }
          );
          
          if (searchResponse.data.results && searchResponse.data.results.length > 0) {
            existingContact = searchResponse.data.results[0];
          }
        } catch (error) {
          // Continue with creating a new contact if search fails
          this.logger.warn(`Error searching HubSpot contact: ${error.message}`);
        }
      }
      
      let response;
      if (existingContact) {
        // Update existing contact
        response = await axios.patch(
          `https://api.hubapi.com/crm/v3/objects/contacts/${existingContact.id}`,
          { properties },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        return { 
          success: true, 
          externalId: existingContact.id,
          message: 'Contact updated in HubSpot',
        };
      } else {
        // Create new contact
        response = await axios.post(
          'https://api.hubapi.com/crm/v3/objects/contacts',
          { properties },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        return { 
          success: true, 
          externalId: response.data.id,
          message: 'Contact created in HubSpot',
        };
      }
    } catch (error) {
      this.logger.error(`Error syncing contact to HubSpot: ${error.message}`, error.stack);
      return { success: false, message: `HubSpot error: ${error.message}` };
    }
  }

  private async syncContactToZoho(
    integration: IntegrationDocument, 
    contactData: Record<string, any>,
  ): Promise<{ success: boolean; externalId?: string; message?: string }> {
    const { accessToken, apiDomain } = integration.config;
    
    try {
      // Check if contact already exists in Zoho CRM
      let existingContact;
      if (contactData.Email) {
        const searchResponse = await axios.get(
          `${apiDomain}/crm/v2/Contacts/search?email=${encodeURIComponent(contactData.Email)}`,
          {
            headers: {
              Authorization: `Zoho-oauthtoken ${accessToken}`,
            },
          }
        );
        
        if (searchResponse.data.data && searchResponse.data.data.length > 0) {
          existingContact = searchResponse.data.data[0];
        }
      }
      
      let response;
      if (existingContact) {
        // Update existing contact
        response = await axios.put(
          `${apiDomain}/crm/v2/Contacts/${existingContact.id}`,
          { data: [contactData] },
          {
            headers: {
              Authorization: `Zoho-oauthtoken ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        return { 
          success: true, 
          externalId: existingContact.id,
          message: 'Contact updated in Zoho CRM',
        };
      } else {
        // Create new contact
        response = await axios.post(
          `${apiDomain}/crm/v2/Contacts`,
          { data: [contactData] },
          {
            headers: {
              Authorization: `Zoho-oauthtoken ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (response.data.data && response.data.data.length > 0) {
          return { 
            success: true, 
            externalId: response.data.data[0].details.id,
            message: 'Contact created in Zoho CRM',
          };
        } else {
          return { 
            success: false, 
            message: 'Failed to create contact in Zoho CRM',
          };
        }
      }
    } catch (error) {
      this.logger.error(`Error syncing contact to Zoho CRM: ${error.message}`, error.stack);
      return { success: false, message: `Zoho CRM error: ${error.message}` };
    }
  }

  private async syncContactToCustomCrm(
    integration: IntegrationDocument, 
    contactData: Record<string, any>,
  ): Promise<{ success: boolean; externalId?: string; message?: string }> {
    const { apiUrl, apiKey, endpoints } = integration.config;
    
    if (!endpoints || !endpoints.contacts) {
      return { success: false, message: 'Missing contacts endpoint configuration' };
    }
    
    try {
      // Check if contact already exists
      let existingContact;
      if (contactData.email && endpoints.contactSearch) {
        try {
          const searchResponse = await axios.get(
            `${apiUrl}${endpoints.contactSearch}?email=${encodeURIComponent(contactData.email)}`,
            {
              headers: {
                Authorization: `Bearer ${apiKey}`,
              },
            }
          );
          
          if (searchResponse.data && searchResponse.data.length > 0) {
            existingContact = searchResponse.data[0];
          }
        } catch (error) {
          // Continue with creating a new contact if search fails
          this.logger.warn(`Error searching custom CRM contact: ${error.message}`);
        }
      }
      
      let response;
      if (existingContact && endpoints.contactUpdate) {
        // Update existing contact
        response = await axios.put(
          `${apiUrl}${endpoints.contactUpdate.replace(':id', existingContact.id)}`,
          contactData,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        return { 
          success: true, 
          externalId: existingContact.id,
          message: 'Contact updated in custom CRM',
        };
      } else {
        // Create new contact
        response = await axios.post(
          `${apiUrl}${endpoints.contacts}`,
          contactData,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        return { 
          success: true, 
          externalId: response.data.id,
          message: 'Contact created in custom CRM',
        };
      }
    } catch (error) {
      this.logger.error(`Error syncing contact to custom CRM: ${error.message}`, error.stack);
      return { success: false, message: `Custom CRM error: ${error.message}` };
    }
  }

  // Methods for logging calls to different CRM systems

  private async logCallToSalesforce(
    integration: IntegrationDocument, 
    callData: Record<string, any>,
    contact: Contact,
  ): Promise<{ success: boolean; externalId?: string; message?: string }> {
    const { instanceUrl, accessToken } = integration.config;
    
    try {
      // First, get the Salesforce Contact ID
      let contactId;
      
      if (contact.externalIds && contact.externalIds.salesforce) {
        // Use existing external ID if available
        contactId = contact.externalIds.salesforce;
      } else if (contact.email) {
        // Look up contact by email
        const queryResponse = await axios.get(
          `${instanceUrl}/services/data/v53.0/query/?q=SELECT+Id+FROM+Contact+WHERE+Email='${contact.email}'`,
          {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
          }
        );
        
        if (queryResponse.data.records && queryResponse.data.records.length > 0) {
          contactId = queryResponse.data.records[0].Id;
        }
      }
      
      // If still no contact ID, create the contact
      if (!contactId) {
        const contactData = {
          FirstName: contact.firstName,
          LastName: contact.lastName,
          Phone: contact.phoneNumber,
          Email: contact.email,
        };
        
        const createResponse = await axios.post(
          `${instanceUrl}/services/data/v53.0/sobjects/Contact`,
          contactData,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (createResponse.data.success) {
          contactId = createResponse.data.id;
        }
      }
      
      if (!contactId) {
        return { success: false, message: 'Failed to find or create Salesforce contact' };
      }
      
      // Now create the call task
      const taskData = {
        Subject: callData.subject,
        ActivityDate: new Date(callData.startTime).toISOString().split('T')[0],
        Status: 'Completed',
        CallType: 'Outbound',
        CallDurationInSeconds: callData.duration,
        CallObject: callData.recordingUrl,
        Description: callData.notes,
        WhoId: contactId, // Link to the contact
      };
      
      const response = await axios.post(
        `${instanceUrl}/services/data/v53.0/sobjects/Task`,
        taskData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (response.data.success) {
        return { 
          success: true, 
          externalId: response.data.id,
          message: 'Call logged in Salesforce',
        };
      } else {
        return { 
          success: false, 
          message: 'Failed to log call in Salesforce',
        };
      }
    } catch (error) {
      this.logger.error(`Error logging call to Salesforce: ${error.message}`, error.stack);
      return { success: false, message: `Salesforce error: ${error.message}` };
    }
  }

  private async logCallToHubspot(
    integration: IntegrationDocument, 
    callData: Record<string, any>,
    contact: Contact,
  ): Promise<{ success: boolean; externalId?: string; message?: string }> {
    const { apiKey } = integration.config;
    
    try {
      // First, get the HubSpot Contact ID
      let contactId;
      
      if (contact.externalIds && contact.externalIds.hubspot) {
        // Use existing external ID if available
        contactId = contact.externalIds.hubspot;
      } else if (contact.email) {
        // Look up contact by email
        const searchResponse = await axios.post(
          'https://api.hubapi.com/crm/v3/objects/contacts/search',
          {
            filterGroups: [
              {
                filters: [
                  {
                    propertyName: 'email',
                    operator: 'EQ',
                    value: contact.email,
                  },
                ],
              },
            ],
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (searchResponse.data.results && searchResponse.data.results.length > 0) {
          contactId = searchResponse.data.results[0].id;
        }
      }
      
      // If still no contact ID, create the contact
      if (!contactId) {
        const contactData = {
          properties: {
            firstname: contact.firstName,
            lastname: contact.lastName,
            phone: contact.phoneNumber,
            email: contact.email,
          },
        };
        
        const createResponse = await axios.post(
          'https://api.hubapi.com/crm/v3/objects/contacts',
          contactData,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        contactId = createResponse.data.id;
      }
      
      // Now create the call engagement
      const callEngagement = {
        properties: {
          hs_timestamp: new Date(callData.startTime).getTime(),
          hs_call_title: callData.subject,
          hs_call_body: callData.notes,
          hs_call_direction: 'OUTBOUND',
          hs_call_disposition: callData.outcome,
          hs_call_duration: callData.duration,
          hs_call_from_number: callData.from,
          hs_call_to_number: callData.to,
          hs_call_recording_url: callData.recordingUrl,
          hs_call_status: 'COMPLETED',
        },
        associations: [
          {
            to: {
              id: contactId,
            },
            types: [
              {
                associationCategory: 'HUBSPOT_DEFINED',
                associationTypeId: 1,
              },
            ],
          },
        ],
      };
      
      const response = await axios.post(
        'https://api.hubapi.com/crm/v3/objects/calls',
        callEngagement,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      return { 
        success: true, 
        externalId: response.data.id,
        message: 'Call logged in HubSpot',
      };
    } catch (error) {
      this.logger.error(`Error logging call to HubSpot: ${error.message}`, error.stack);
      return { success: false, message: `HubSpot error: ${error.message}` };
    }
  }

  private async logCallToZoho(
    integration: IntegrationDocument, 
    callData: Record<string, any>,
    contact: Contact,
  ): Promise<{ success: boolean; externalId?: string; message?: string }> {
    const { accessToken, apiDomain } = integration.config;
    
    try {
      // First, get the Zoho Contact ID
      let contactId;
      
      if (contact.externalIds && contact.externalIds.zoho) {
        // Use existing external ID if available
        contactId = contact.externalIds.zoho;
      } else if (contact.email) {
        // Look up contact by email
        const searchResponse = await axios.get(
          `${apiDomain}/crm/v2/Contacts/search?email=${encodeURIComponent(contact.email)}`,
          {
            headers: {
              Authorization: `Zoho-oauthtoken ${accessToken}`,
            },
          }
        );
        
        if (searchResponse.data.data && searchResponse.data.data.length > 0) {
          contactId = searchResponse.data.data[0].id;
        }
      }
      
      // If still no contact ID, create the contact
      if (!contactId) {
        const contactData = {
          First_Name: contact.firstName,
          Last_Name: contact.lastName,
          Phone: contact.phoneNumber,
          Email: contact.email,
        };
        
        const createResponse = await axios.post(
          `${apiDomain}/crm/v2/Contacts`,
          { data: [contactData] },
          {
            headers: {
              Authorization: `Zoho-oauthtoken ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (createResponse.data.data && createResponse.data.data.length > 0) {
          contactId = createResponse.data.data[0].details.id;
        }
      }
      
      if (!contactId) {
        return { success: false, message: 'Failed to find or create Zoho contact' };
      }
      
      // Now create the call activity
      const callActivity = {
        Subject: callData.subject,
        Call_Type: 'Outbound',
        Call_Start_Time: new Date(callData.startTime).toISOString(),
        Call_Duration: callData.duration ? `${Math.floor(callData.duration / 60)}:${callData.duration % 60}` : '0:0',
        Call_Purpose: 'Telemarketing',
        Description: callData.notes,
        Who_Id: {
          id: contactId,
        },
        Status: 'Completed',
      };
      
      const response = await axios.post(
        `${apiDomain}/crm/v2/Calls`,
        { data: [callActivity] },
        {
          headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (response.data.data && response.data.data.length > 0) {
        return { 
          success: true, 
          externalId: response.data.data[0].details.id,
          message: 'Call logged in Zoho CRM',
        };
      } else {
        return { 
          success: false, 
          message: 'Failed to log call in Zoho CRM',
        };
      }
    } catch (error) {
      this.logger.error(`Error logging call to Zoho CRM: ${error.message}`, error.stack);
      return { success: false, message: `Zoho CRM error: ${error.message}` };
    }
  }

  private async logCallToCustomCrm(
    integration: IntegrationDocument, 
    callData: Record<string, any>,
    contact: Contact,
  ): Promise<{ success: boolean; externalId?: string; message?: string }> {
    const { apiUrl, apiKey, endpoints } = integration.config;
    
    if (!endpoints || !endpoints.calls) {
      return { success: false, message: 'Missing calls endpoint configuration' };
    }
    
    try {
      // First, ensure we have the contact in the CRM
      let contactId;
      
      if (contact.externalIds && contact.externalIds.custom) {
        // Use existing external ID if available
        contactId = contact.externalIds.custom;
      } else if (contact.email && endpoints.contactSearch) {
        // Look up contact by email
        const searchResponse = await axios.get(
          `${apiUrl}${endpoints.contactSearch}?email=${encodeURIComponent(contact.email)}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );
        
        if (searchResponse.data && searchResponse.data.length > 0) {
          contactId = searchResponse.data[0].id;
        }
      }
      
      // If still no contact ID, create the contact
      if (!contactId && endpoints.contacts) {
        const contactData = {
          firstName: contact.firstName,
          lastName: contact.lastName,
          phone: contact.phoneNumber,
          email: contact.email,
        };
        
        const createResponse = await axios.post(
          `${apiUrl}${endpoints.contacts}`,
          contactData,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        contactId = createResponse.data.id;
      }
      
      if (!contactId) {
        return { success: false, message: 'Failed to find or create contact in custom CRM' };
      }
      
      // Now log the call activity
      const callPayload = {
        ...callData,
        contactId,
      };
      
      const response = await axios.post(
        `${apiUrl}${endpoints.calls}`,
        callPayload,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      return { 
        success: true, 
        externalId: response.data.id,
        message: 'Call logged in custom CRM',
      };
    } catch (error) {
      this.logger.error(`Error logging call to custom CRM: ${error.message}`, error.stack);
      return { success: false, message: `Custom CRM error: ${error.message}` };
    }
  }
}