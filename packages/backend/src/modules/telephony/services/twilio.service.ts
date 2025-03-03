import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';
import { RetryService } from '../../resilience/services/retry.service';
import { CircuitBreakerService } from '../../resilience/services/circuit-breaker.service';
import { ErrorTrackingService } from '../../resilience/services/error-tracking.service';

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private readonly client: Twilio;
  private readonly defaultPhoneNumber: string;
  private readonly serviceKey = 'twilio';

  constructor(
    private readonly configService: ConfigService,
    private readonly retryService: RetryService,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly errorTrackingService: ErrorTrackingService,
  ) {
    const accountSid = this.configService.get<string>('twilio.accountSid');
    const authToken = this.configService.get<string>('twilio.authToken');
    this.defaultPhoneNumber = this.configService.get<string>('twilio.phoneNumber') || '';

    if (!accountSid || !authToken) {
      this.logger.error('Twilio credentials are not set');
      throw new Error('Twilio credentials are required');
    }

    this.client = new Twilio(accountSid, authToken);
  }

  async makeCall(
    to: string,
    from: string = this.defaultPhoneNumber,
    webhookUrl: string,
    statusCallback?: string,
  ) {
    const executeCall = async () => {
      try {
        this.logger.log(`Initiating call from ${from} to ${to}`);

        const call = await this.client.calls.create({
          to,
          from,
          url: webhookUrl, // Webhook URL for TwiML instructions
          statusCallback, // Webhook URL for call status updates
          statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
          statusCallbackMethod: 'POST',
        });

        this.logger.log(`Call initiated with SID: ${call.sid}`);
        return call;
      } catch (error) {
        this.logger.error(`Error making call: ${error.message}`, error.stack);
        
        // Track the error
        await this.errorTrackingService.trackError(this.serviceKey, error, {
          to,
          from,
          webhookUrl,
        });
        
        throw error;
      }
    };

    // Use circuit breaker with retry
    return this.circuitBreakerService.executeWithCircuitBreaker(
      this.serviceKey,
      () => this.retryService.executeWithRetry(executeCall, {
        retryCondition: (error) => {
          // Only retry certain types of errors
          return (
            error.code === 20001 || // Invalid phone number
            error.code === 20404 || // Resource not found
            error.code === 20429 || // Too many requests
            error.code === 20003 || // Authentication error
            error.message.includes('timeout') ||
            error.code === 'ECONNRESET'
          );
        },
      }),
    );
  }

  async sendSms(
    to: string,
    body: string,
    from: string = this.defaultPhoneNumber,
  ) {
    const executeSms = async () => {
      try {
        this.logger.log(`Sending SMS from ${from} to ${to}`);

        const message = await this.client.messages.create({
          to,
          from,
          body,
        });

        this.logger.log(`SMS sent with SID: ${message.sid}`);
        return message;
      } catch (error) {
        this.logger.error(`Error sending SMS: ${error.message}`, error.stack);
        
        // Track the error
        await this.errorTrackingService.trackError(this.serviceKey, error, {
          to,
          from,
          bodyLength: body.length,
        });
        
        throw error;
      }
    };

    // Use circuit breaker with retry
    return this.circuitBreakerService.executeWithCircuitBreaker(
      `${this.serviceKey}_sms`,
      () => this.retryService.executeWithRetry(executeSms, {
        maxRetries: 2,
        retryDelay: 1000,
      }),
    );
  }

  async getCallDetails(callSid: string) {
    const executeGetCall = async () => {
      try {
        return await this.client.calls(callSid).fetch();
      } catch (error) {
        this.logger.error(`Error fetching call details: ${error.message}`, error.stack);
        
        // Track the error
        await this.errorTrackingService.trackError(this.serviceKey, error, {
          callSid,
          operation: 'getCallDetails',
        });
        
        throw error;
      }
    };

    // Use retry for fetching call details
    return this.retryService.executeWithRetry(executeGetCall, {
      maxRetries: 2,
      retryDelay: 500,
    });
  }

  async endCall(callSid: string) {
    const executeEndCall = async () => {
      try {
        return await this.client.calls(callSid).update({ status: 'completed' });
      } catch (error) {
        this.logger.error(`Error ending call: ${error.message}`, error.stack);
        
        // Track the error
        await this.errorTrackingService.trackError(this.serviceKey, error, {
          callSid,
          operation: 'endCall',
        });
        
        throw error;
      }
    };

    // Use circuit breaker with retry
    return this.circuitBreakerService.executeWithCircuitBreaker(
      `${this.serviceKey}_call_management`,
      () => this.retryService.executeWithRetry(executeEndCall),
    );
  }

  generateTwiML(response: string): string {
    // This is a simple TwiML response with <Say> for text-to-speech
    return `
      <?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="Polly.Amy" language="en-GB">${response}</Say>
        <Pause length="1"/>
        <Record action="/api/telephony/webhook/recording" maxLength="60" />
      </Response>
    `;
  }

  /**
   * Send text to an ongoing call using TTS
   * Used for supervisor interventions
   */
  async sendTextToCall(callId: string, text: string): Promise<boolean> {
    try {
      this.logger.log(`Sending text to call ${callId}: ${text}`);
      
      // This is a stub implementation
      // In a real implementation, we would need to:
      // 1. Look up the call SID from our database
      // 2. Use Twilio's API to send TTS to the active call
      
      // For now, we'll just return success
      return true;
    } catch (error) {
      this.logger.error(`Error sending text to call: ${error.message}`, error.stack);
      
      // Track the error
      await this.errorTrackingService.trackError(this.serviceKey, error, {
        callId,
        textLength: text.length,
        operation: 'sendTextToCall',
      });
      
      return false;
    }
  }
}