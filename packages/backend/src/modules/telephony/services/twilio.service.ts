import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private readonly client: Twilio;
  private readonly defaultPhoneNumber: string;

  constructor(private readonly configService: ConfigService) {
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
      throw error;
    }
  }

  async sendSms(
    to: string,
    body: string,
    from: string = this.defaultPhoneNumber,
  ) {
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
      throw error;
    }
  }

  async getCallDetails(callSid: string) {
    try {
      return await this.client.calls(callSid).fetch();
    } catch (error) {
      this.logger.error(`Error fetching call details: ${error.message}`, error.stack);
      throw error;
    }
  }

  async endCall(callSid: string) {
    try {
      return await this.client.calls(callSid).update({ status: 'completed' });
    } catch (error) {
      this.logger.error(`Error ending call: ${error.message}`, error.stack);
      throw error;
    }
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
      
      /*
      // Example of a real implementation:
      const call = await this.callModel.findById(callId).exec();
      
      if (!call || !call.sid) {
        throw new Error('Call not found or missing SID');
      }
      
      // Update the call with TTS
      await this.client.calls(call.sid).update({
        twiml: `
          <Response>
            <Say voice="Polly.Amy" language="en-GB">${text}</Say>
            <Pause length="1"/>
            <Record action="/api/telephony/webhook/recording" maxLength="60" />
          </Response>
        `,
      });
      
      return true;
      */
    } catch (error) {
      this.logger.error(`Error sending text to call: ${error.message}`, error.stack);
      return false;
    }
  }
}