import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Integration, IntegrationDocument } from '../schemas/integration.schema';
import { Webhook, WebhookDocument } from '../schemas/webhook.schema';
import { WebhookEventDto } from '../dto/webhook-event.dto';
import { WebhookEventType } from '../enums/webhook-event-type.enum';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly secretKey: string;

  constructor(
    @InjectModel(Integration.name) private readonly integrationModel: Model<IntegrationDocument>,
    @InjectModel(Webhook.name) private readonly webhookModel: Model<WebhookDocument>,
    private readonly configService: ConfigService,
  ) {
    // Get the secret key for signing webhooks
    this.secretKey = this.configService.get<string>('webhook.secretKey') || 'default_webhook_secret';
  }

  /**
   * Create a new webhook endpoint
   */
  async createWebhook(name: string, url: string, events: WebhookEventType[], isActive: boolean = true): Promise<WebhookDocument> {
    this.logger.log(`Creating new webhook: ${name} for URL: ${url}`);
    
    // Generate a random secret for this webhook
    const secret = crypto.randomBytes(32).toString('hex');
    
    const webhook = new this.webhookModel({
      name,
      url,
      events,
      secret,
      isActive,
    });
    
    return webhook.save();
  }

  /**
   * Get all webhooks
   */
  async getAllWebhooks(): Promise<WebhookDocument[]> {
    return this.webhookModel.find().exec();
  }

  /**
   * Get a webhook by ID
   */
  async getWebhookById(id: string): Promise<WebhookDocument> {
    return this.webhookModel.findById(id).exec();
  }

  /**
   * Update a webhook
   */
  async updateWebhook(id: string, updateData: Partial<Webhook>): Promise<WebhookDocument> {
    this.logger.log(`Updating webhook: ${id}`);
    
    return this.webhookModel.findByIdAndUpdate(id, updateData, { new: true }).exec();
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(id: string): Promise<void> {
    this.logger.log(`Deleting webhook: ${id}`);
    
    await this.webhookModel.findByIdAndDelete(id).exec();
  }

  /**
   * Trigger a webhook event
   */
  async triggerWebhookEvent(event: WebhookEventDto): Promise<void> {
    this.logger.log(`Triggering webhook event: ${event.eventType}`);
    
    // Find all active webhooks that are subscribed to this event
    const webhooks = await this.webhookModel.find({
      events: event.eventType,
      isActive: true,
    }).exec();
    
    if (webhooks.length === 0) {
      this.logger.debug(`No webhooks found for event: ${event.eventType}`);
      return;
    }
    
    // Prepare the webhook payload
    const payload = {
      eventId: crypto.randomUUID(),
      eventType: event.eventType,
      timestamp: new Date().toISOString(),
      data: event.data,
    };
    
    // Send the webhook to all subscribed endpoints
    const promises = webhooks.map(webhook => this.sendWebhook(webhook, payload));
    
    // Wait for all webhooks to be processed
    await Promise.allSettled(promises);
  }

  /**
   * Send a webhook to a specific endpoint
   */
  private async sendWebhook(webhook: WebhookDocument, payload: any): Promise<void> {
    try {
      this.logger.debug(`Sending webhook to: ${webhook.url}`);
      
      // Calculate signature for the payload
      const signature = this.calculateSignature(webhook.secret, payload);
      
      // Send the webhook
      await axios.post(webhook.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-ID': webhook._id.toString(),
        },
        timeout: 5000, // 5 seconds timeout
      });
      
      // Log success and update last successful delivery
      this.logger.debug(`Successfully sent webhook to: ${webhook.url}`);
      
      await this.webhookModel.updateOne(
        { _id: webhook._id },
        { 
          $set: { lastSuccessfulDelivery: new Date() },
          $inc: { successCount: 1 },
        },
      ).exec();
    } catch (error) {
      // Log error and update error count
      this.logger.error(`Error sending webhook to ${webhook.url}: ${error.message}`, error.stack);
      
      await this.webhookModel.updateOne(
        { _id: webhook._id },
        { 
          $set: { 
            lastFailedDelivery: new Date(),
            lastErrorMessage: error.message,
          },
          $inc: { errorCount: 1 },
        },
      ).exec();
    }
  }

  /**
   * Calculate signature for webhook payload
   */
  private calculateSignature(secret: string, payload: any): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  }

  /**
   * Validate a webhook signature
   */
  validateWebhookSignature(signature: string, secret: string, payload: any): boolean {
    const expectedSignature = this.calculateSignature(secret, payload);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    );
  }
}