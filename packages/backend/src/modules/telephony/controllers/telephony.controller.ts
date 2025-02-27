import {
    Controller,
    Post,
    Body,
    Param,
    Get,
    UseGuards,
    Req,
    Res,
    HttpStatus,
    Logger,
  } from '@nestjs/common';
  import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
  import { Response } from 'express';
  import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
  import { RolesGuard } from '../../auth/guards/roles.guard';
  import { Roles } from '../../../common/decorators/roles.decorator';
  import { Role } from '../../../common/enums/role.enum';
  import { Public } from '../../../common/decorators/public.decorator';
  import { CallService } from '../services/call.service';
  import { TwilioService } from '../services/twilio.service';
  import { CallStatus, CallOutcome } from '../schemas/call.schema';
  import { InitiateCallDto } from '../dto/initiate-call.dto';
  import { UpdateCallDto } from '../dto/update-call.dto';
  
  @ApiTags('telephony')
  @Controller('telephony')
  export class TelephonyController {
    private readonly logger = new Logger(TelephonyController.name);
  
    constructor(
      private readonly callService: CallService,
      private readonly twilioService: TwilioService,
    ) {}
  
    @Post('calls')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.SUPERVISOR, Role.AGENT)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Initiate an outbound call' })
    @ApiResponse({ status: 201, description: 'Call initiated successfully' })
    async initiateCall(@Body() initiateCallDto: InitiateCallDto, @Req() req) {
      this.logger.log(`Initiating call to ${initiateCallDto.toNumber}`);
      
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      const call = await this.callService.initiateOutboundCall(
        initiateCallDto.campaignId,
        initiateCallDto.contactId,
        initiateCallDto.fromNumber,
        initiateCallDto.toNumber,
        baseUrl,
      );
      
      return call;
    }
  
    @Get('calls/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.SUPERVISOR, Role.AGENT)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get call details' })
    @ApiResponse({ status: 200, description: 'Call details retrieved successfully' })
    async getCallDetails(@Param('id') id: string) {
      return this.callService.findById(id);
    }
  
    @Post('calls/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.SUPERVISOR, Role.AGENT)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update call details' })
    @ApiResponse({ status: 200, description: 'Call updated successfully' })
    async updateCall(@Param('id') id: string, @Body() updateCallDto: UpdateCallDto) {
      return this.callService.updateCallDetails(id, updateCallDto);
    }
  
    @Post('calls/:id/end')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.SUPERVISOR, Role.AGENT)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'End a call' })
    @ApiResponse({ status: 200, description: 'Call ended successfully' })
    async endCall(
      @Param('id') id: string,
      @Body() body: { outcome: CallOutcome },
    ) {
      const call = await this.callService.findById(id);
      
      // If the call has a Twilio SID, end it in Twilio too
      if (call.sid) {
        try {
          await this.twilioService.endCall(call.sid);
        } catch (error) {
          this.logger.error(`Error ending call in Twilio: ${error.message}`);
          // Continue with ending the call locally even if Twilio fails
        }
      }
      
      // Complete the call in our system
      const completedCall = await this.callService.completeCall(id, body.outcome);
      
      return completedCall;
    }
  
    @Get('campaign/:campaignId/calls')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.SUPERVISOR, Role.AGENT)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get all calls for a campaign' })
    @ApiResponse({ status: 200, description: 'Campaign calls retrieved successfully' })
    async getCampaignCalls(@Param('campaignId') campaignId: string) {
      return this.callService.getCampaignCalls(campaignId);
    }
  
    @Get('contact/:contactId/calls')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.SUPERVISOR, Role.AGENT)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get all calls for a contact' })
    @ApiResponse({ status: 200, description: 'Contact calls retrieved successfully' })
    async getContactCalls(@Param('contactId') contactId: string) {
      return this.callService.getContactCalls(contactId);
    }
  
    // Twilio Webhook Endpoints
    
    @Public()
    @Post('webhook/voice/:callId')
    @ApiOperation({ summary: 'Webhook for Twilio voice' })
    async handleVoiceWebhook(
      @Param('callId') callId: string,
      @Res() res: Response,
    ) {
      this.logger.log(`Received voice webhook for call ${callId}`);
      
      try {
        // Get the call details
        const call = await this.callService.findById(callId);
        
        if (!call) {
          this.logger.error(`Call with ID ${callId} not found`);
          return res.status(HttpStatus.NOT_FOUND).send('Call not found');
        }
        
        // Update call status if needed
        if (call.status === CallStatus.INITIATED) {
          await this.callService.updateStatus(callId, CallStatus.IN_PROGRESS);
        }
        
        // Initialize conversation if not already done
        let greeting = 'Hello, this is an automated call.';
        try {
          greeting = await this.callService.processIncomingAudio(callId, '');
        } catch (error) {
          this.logger.error(`Error initializing conversation: ${error.message}`);
        }
        
        // Generate TwiML response with greeting
        const twiml = this.twilioService.generateTwiML(greeting);
        
        // Set content type and send response
        res.setHeader('Content-Type', 'text/xml');
        return res.send(twiml);
      } catch (error) {
        this.logger.error(`Error handling voice webhook: ${error.message}`, error.stack);
        
        // Return a basic TwiML response in case of error
        const errorTwiml = this.twilioService.generateTwiML(
          'Sorry, there was an error processing your call. Please try again later.',
        );
        
        res.setHeader('Content-Type', 'text/xml');
        return res.send(errorTwiml);
      }
    }
  
    @Public()
    @Post('webhook/status/:callId')
    @ApiOperation({ summary: 'Webhook for Twilio call status' })
    async handleStatusWebhook(
      @Param('callId') callId: string,
      @Body() statusData: any,
      @Res() res: Response,
    ) {
      this.logger.log(`Received status webhook for call ${callId}: ${statusData.CallStatus}`);
      
      try {
        // Map Twilio call status to our call status
        let callStatus: CallStatus;
        switch (statusData.CallStatus) {
          case 'initiated':
            callStatus = CallStatus.INITIATED;
            break;
          case 'ringing':
            callStatus = CallStatus.RINGING;
            break;
          case 'in-progress':
            callStatus = CallStatus.IN_PROGRESS;
            break;
          case 'completed':
            callStatus = CallStatus.COMPLETED;
            break;
          case 'busy':
            callStatus = CallStatus.BUSY;
            break;
          case 'no-answer':
            callStatus = CallStatus.NO_ANSWER;
            break;
          case 'failed':
            callStatus = CallStatus.FAILED;
            break;
          default:
            this.logger.warn(`Unknown Twilio call status: ${statusData.CallStatus}`);
            callStatus = CallStatus.FAILED;
        }
        
        // Update call status
        await this.callService.updateStatus(callId, callStatus);
        
        // If call is completed or failed, update end time and duration
        if (
          callStatus === CallStatus.COMPLETED || 
          callStatus === CallStatus.FAILED ||
          callStatus === CallStatus.BUSY ||
          callStatus === CallStatus.NO_ANSWER
        ) {
          const duration = statusData.CallDuration ? parseInt(statusData.CallDuration) : 0;
          await this.callService.updateCallDetails(callId, {
            endTime: new Date(),
            duration,
          });
        }
        
        return res.status(HttpStatus.OK).send('Status updated');
      } catch (error) {
        this.logger.error(`Error handling status webhook: ${error.message}`, error.stack);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Error processing status update');
      }
    }
  
    @Public()
    @Post('webhook/recording/:callId')
    @ApiOperation({ summary: 'Webhook for Twilio recording' })
    async handleRecordingWebhook(
      @Param('callId') callId: string,
      @Body() recordingData: any,
      @Res() res: Response,
    ) {
      this.logger.log(`Received recording webhook for call ${callId}`);
      
      try {
        // Process the recording to get user input
        const recordingUrl = recordingData.RecordingUrl;
        
        // Update call with recording URL
        await this.callService.updateCallDetails(callId, {
          recordingUrl,
        });
        
        // Process the audio recording to get AI response
        const aiResponse = await this.callService.processIncomingAudio(callId, recordingUrl);
        
        // Generate TwiML response with AI response
        const twiml = this.twilioService.generateTwiML(aiResponse);
        
        // Set content type and send response
        res.setHeader('Content-Type', 'text/xml');
        return res.send(twiml);
      } catch (error) {
        this.logger.error(`Error handling recording webhook: ${error.message}`, error.stack);
        
        // Return a basic TwiML response in case of error
        const errorTwiml = this.twilioService.generateTwiML(
          'Sorry, I didn\'t catch that. Could you please repeat?',
        );
        
        res.setHeader('Content-Type', 'text/xml');
        return res.send(errorTwiml);
      }
    }
  }