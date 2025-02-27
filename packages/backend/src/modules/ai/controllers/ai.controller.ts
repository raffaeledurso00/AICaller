import {
    Controller,
    Post,
    Body,
    Get,
    Param,
    UseGuards,
    Logger,
  } from '@nestjs/common';
  import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
  import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
  import { RolesGuard } from '../../auth/guards/roles.guard';
  import { Roles } from '../../../common/decorators/roles.decorator';
  import { Role } from '../../../common/enums/role.enum';
  import { OpenAiService } from '../services/openai.service';
  import { ConversationService } from '../services/conversation.service';
  import { GenerateScriptDto } from '../dto/generate-script.dto';
  import { ProcessChatMessageDto } from '../dto/process-chat-message.dto';
  import { InitConversationDto } from '../dto/init-conversation.dto';
  
  @ApiTags('ai')
  @Controller('ai')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  export class AiController {
    private readonly logger = new Logger(AiController.name);
  
    constructor(
      private readonly openAiService: OpenAiService,
      private readonly conversationService: ConversationService,
    ) {}
  
    @Post('script')
    @Roles(Role.ADMIN, Role.SUPERVISOR)
    @ApiOperation({ summary: 'Generate a call script for a campaign' })
    @ApiResponse({ status: 201, description: 'Script generated successfully' })
    async generateScript(@Body() generateScriptDto: GenerateScriptDto) {
      this.logger.log(`Generating script for campaign type: ${generateScriptDto.campaignType}`);
      
      const script = await this.openAiService.generateCallScript(
        generateScriptDto.campaignType,
        generateScriptDto.productInfo,
        generateScriptDto.targetAudience,
      );
      
      return { script };
    }
  
    @Post('conversation/:callId/init')
    @Roles(Role.ADMIN, Role.SUPERVISOR, Role.AGENT)
    @ApiOperation({ summary: 'Initialize a conversation for a call' })
    @ApiResponse({ status: 201, description: 'Conversation initialized successfully' })
    async initializeConversation(
      @Param('callId') callId: string,
      @Body() initConversationDto: InitConversationDto,
    ) {
      this.logger.log(`Initializing conversation for call: ${callId}`);
      
      const greeting = await this.conversationService.initializeConversation(
        callId,
        initConversationDto.campaign,
        initConversationDto.contact,
      );
      
      return { greeting };
    }
  
    @Post('conversation/:callId/message')
    @Roles(Role.ADMIN, Role.SUPERVISOR, Role.AGENT)
    @ApiOperation({ summary: 'Process a user message in a conversation' })
    @ApiResponse({ status: 200, description: 'Message processed successfully' })
    async processMessage(
      @Param('callId') callId: string,
      @Body() processChatMessageDto: ProcessChatMessageDto,
    ) {
      this.logger.log(`Processing message for call: ${callId}`);
      
      const response = await this.conversationService.processUserInput(
        callId,
        processChatMessageDto.message,
      );
      
      return { response };
    }
  
    @Post('conversation/:callId/end')
    @Roles(Role.ADMIN, Role.SUPERVISOR, Role.AGENT)
    @ApiOperation({ summary: 'End a conversation' })
    @ApiResponse({ status: 200, description: 'Conversation ended successfully' })
    async endConversation(@Param('callId') callId: string) {
      this.logger.log(`Ending conversation for call: ${callId}`);
      
      await this.conversationService.endConversation(callId);
      
      return { success: true, message: 'Conversation ended successfully' };
    }
  
    @Get('health')
    @ApiOperation({ summary: 'Check OpenAI service health' })
    @ApiResponse({ status: 200, description: 'OpenAI service is healthy' })
    async checkHealth() {
      try {
        // Simple prompt to test OpenAI connectivity
        const response = await this.openAiService.generateResponse('Hello, are you working?', [
          { role: 'system', content: 'Please respond with "Yes, I am working."' },
        ]);
        
        return {
          status: 'healthy',
          message: 'OpenAI service is connected and responding',
          response,
        };
      } catch (error) {
        this.logger.error(`OpenAI health check failed: ${error.message}`, error.stack);
        
        return {
          status: 'unhealthy',
          message: `OpenAI service is not responding: ${error.message}`,
        };
      }
    }
  }