import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    UseGuards,
    NotFoundException,
    BadRequestException,
    Logger,
  } from '@nestjs/common';
  import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
  import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
  import { RolesGuard } from '../../auth/guards/roles.guard';
  import { Roles } from '../../../common/decorators/roles.decorator';
  import { Role } from '../../../common/enums/role.enum';
  import { RealTimeTranscriptionService } from '../services/real-time-transcription.service';
  
  class ProcessAudioSegmentDto {
    speaker: 'ai' | 'human';
    audioData: string; // base64 encoded audio or URL
    startTime: number;
    endTime: number;
    mockText?: string; // For testing without real speech-to-text
  }
  
  @ApiTags('transcription')
  @Controller('transcription')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  export class TranscriptionController {
    private readonly logger = new Logger(TranscriptionController.name);
  
    constructor(private readonly transcriptionService: RealTimeTranscriptionService) {}
  
    @Post(':callId/register')
    @Roles(Role.ADMIN, Role.SUPERVISOR, Role.AGENT)
    @ApiOperation({ summary: 'Register a call for real-time transcription' })
    @ApiResponse({ status: 200, description: 'Call registered for transcription' })
    registerCall(@Param('callId') callId: string) {
      try {
        this.transcriptionService.registerCall(callId);
        return { success: true, message: 'Call registered for transcription' };
      } catch (error) {
        this.logger.error(`Error registering call for transcription: ${error.message}`, error.stack);
        throw new BadRequestException(`Failed to register call: ${error.message}`);
      }
    }
  
    @Post(':callId/segment')
    @Roles(Role.ADMIN, Role.SUPERVISOR, Role.AGENT)
    @ApiOperation({ summary: 'Process an audio segment from a call' })
    @ApiResponse({ status: 200, description: 'Audio segment processed' })
    async processAudioSegment(
      @Param('callId') callId: string,
      @Body() segmentData: ProcessAudioSegmentDto,
    ) {
      try {
        const segment = await this.transcriptionService.processAudioSegment(
          callId,
          segmentData.speaker,
          segmentData.audioData,
          segmentData.startTime,
          segmentData.endTime,
          segmentData.mockText,
        );
        
        return segment;
      } catch (error) {
        this.logger.error(`Error processing audio segment: ${error.message}`, error.stack);
        throw new BadRequestException(`Failed to process audio segment: ${error.message}`);
      }
    }
  
    @Get(':callId/transcript')
    @Roles(Role.ADMIN, Role.SUPERVISOR, Role.AGENT)
    @ApiOperation({ summary: 'Get the transcript for a call' })
    @ApiResponse({ status: 200, description: 'Call transcript retrieved' })
    getTranscript(@Param('callId') callId: string) {
      const transcript = this.transcriptionService.getTranscript(callId);
      
      if (!transcript) {
        throw new NotFoundException(`Transcript for call ${callId} not found`);
      }
      
      return transcript;
    }
  
    @Get(':callId/formatted')
    @Roles(Role.ADMIN, Role.SUPERVISOR, Role.AGENT)
    @ApiOperation({ summary: 'Get a formatted transcript text for a call' })
    @ApiResponse({ status: 200, description: 'Formatted call transcript retrieved' })
    getFormattedTranscript(@Param('callId') callId: string) {
      const formatted = this.transcriptionService.getFormattedTranscript(callId);
      
      if (!formatted) {
        throw new NotFoundException(`Transcript for call ${callId} not found`);
      }
      
      return { transcript: formatted };
    }
  
    @Post(':callId/end')
    @Roles(Role.ADMIN, Role.SUPERVISOR, Role.AGENT)
    @ApiOperation({ summary: 'End transcription for a call and generate summary' })
    @ApiResponse({ status: 200, description: 'Transcription ended and summary generated' })
    async endTranscription(@Param('callId') callId: string) {
      const result = await this.transcriptionService.endTranscription(callId);
      
      if (!result) {
        throw new NotFoundException(`Transcript for call ${callId} not found`);
      }
      
      return result;
    }
  }