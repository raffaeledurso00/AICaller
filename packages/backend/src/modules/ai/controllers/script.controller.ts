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
  import { ScriptValidatorService } from '../services/script-validator.service';
  import { ScriptTesterService } from '../services/script-tester.service';
  
  class ValidateScriptDto {
    scriptTemplate: string;
    campaignType: string;
    variables: Record<string, any>;
  }
  
  class TestScriptDto {
    scriptTemplate: string;
    campaignType: string;
    variables: Record<string, any>;
    testCase: {
      name: string;
      userReplies: string[];
      expectedTopics: string[];
      expectedOutcomes: string[];
    };
  }
  
  class TestScriptMultipleDto {
    scriptTemplate: string;
    campaignType: string;
    variables: Record<string, any>;
    testCases: Array<{
      name: string;
      userReplies: string[];
      expectedTopics: string[];
      expectedOutcomes: string[];
    }>;
  }
  
  class CheckComplianceDto {
    scriptTemplate: string;
    region: string;
  }
  
  @ApiTags('scripts')
  @Controller('scripts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  export class ScriptController {
    private readonly logger = new Logger(ScriptController.name);
  
    constructor(
      private readonly scriptValidatorService: ScriptValidatorService,
      private readonly scriptTesterService: ScriptTesterService,
    ) {}
  
    @Post('validate')
    @Roles(Role.ADMIN, Role.SUPERVISOR)
    @ApiOperation({ summary: 'Validate a call script' })
    @ApiResponse({ status: 200, description: 'Script validation results' })
    async validateScript(@Body() validateScriptDto: ValidateScriptDto) {
      this.logger.log(`Validating script for campaign type: ${validateScriptDto.campaignType}`);
      
      const validationResult = await this.scriptValidatorService.validateScript(
        validateScriptDto.scriptTemplate,
        validateScriptDto.campaignType,
        validateScriptDto.variables,
      );
      
      return validationResult;
    }
  
    @Post('test')
    @Roles(Role.ADMIN, Role.SUPERVISOR)
    @ApiOperation({ summary: 'Test a call script with a single test case' })
    @ApiResponse({ status: 200, description: 'Script test results' })
    async testScript(@Body() testScriptDto: TestScriptDto) {
      this.logger.log(`Testing script for test case: ${testScriptDto.testCase.name}`);
      
      const testResult = await this.scriptTesterService.testScript(
        testScriptDto.scriptTemplate,
        testScriptDto.campaignType,
        testScriptDto.variables,
        testScriptDto.testCase,
      );
      
      return testResult;
    }
  
    @Post('test-multiple')
    @Roles(Role.ADMIN, Role.SUPERVISOR)
    @ApiOperation({ summary: 'Test a call script with multiple test cases' })
    @ApiResponse({ status: 200, description: 'Script test results and summary' })
    async testScriptMultiple(@Body() testScriptMultipleDto: TestScriptMultipleDto) {
      this.logger.log(`Testing script with ${testScriptMultipleDto.testCases.length} test cases`);
      
      const testResults = await this.scriptTesterService.testScriptWithMultipleCases(
        testScriptMultipleDto.scriptTemplate,
        testScriptMultipleDto.campaignType,
        testScriptMultipleDto.variables,
        testScriptMultipleDto.testCases,
      );
      
      return testResults;
    }
  
    @Post('check-compliance')
    @Roles(Role.ADMIN, Role.SUPERVISOR)
    @ApiOperation({ summary: 'Check script compliance with regulations' })
    @ApiResponse({ status: 200, description: 'Compliance check results' })
    async checkCompliance(@Body() checkComplianceDto: CheckComplianceDto) {
      this.logger.log(`Checking script compliance for region: ${checkComplianceDto.region}`);
      
      const complianceResult = await this.scriptValidatorService.checkCompliance(
        checkComplianceDto.scriptTemplate,
        checkComplianceDto.region,
      );
      
      return complianceResult;
    }
  }