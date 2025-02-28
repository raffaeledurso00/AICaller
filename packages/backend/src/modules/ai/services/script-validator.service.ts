import { Injectable, Logger } from '@nestjs/common';
import { OpenAiService } from './openai.service';

export interface ScriptValidationResult {
  isValid: boolean;
  errors: ScriptValidationError[];
  warnings: ScriptValidationWarning[];
  suggestions: string[];
  score: number; // 0-100
}

export interface ScriptValidationError {
  type: string;
  message: string;
  location?: string; // Where in the script the error occurs
}

export interface ScriptValidationWarning {
  type: string;
  message: string;
  location?: string;
}

@Injectable()
export class ScriptValidatorService {
  private readonly logger = new Logger(ScriptValidatorService.name);

  constructor(private readonly openAiService: OpenAiService) {}

  /**
   * Validate a script template against a set of rules
   */
  async validateScript(
    scriptTemplate: string,
    campaignType: string,
    variables: Record<string, any> = {},
  ): Promise<ScriptValidationResult> {
    try {
      // Basic validation checks
      const basicValidation = this.performBasicValidation(scriptTemplate, variables);

      // If there are critical errors in the basic validation, return early
      if (basicValidation.errors.some(e => e.type === 'critical')) {
        return {
          isValid: false,
          errors: basicValidation.errors,
          warnings: [],
          suggestions: [],
          score: 0
        };
      }

      // Use OpenAI to evaluate the script content and quality
      const aiEvaluation = await this.evaluateScriptWithAI(scriptTemplate, campaignType, variables);

      // Combine results
      const result: ScriptValidationResult = {
        isValid: basicValidation.errors.length === 0 && aiEvaluation.errors.length === 0,
        errors: [...basicValidation.errors, ...aiEvaluation.errors],
        warnings: [...basicValidation.warnings, ...aiEvaluation.warnings],
        suggestions: aiEvaluation.suggestions,
        score: aiEvaluation.score
      };

      return result;
    } catch (error) {
      this.logger.error(`Error validating script: ${error.message}`, error.stack);
      return {
        isValid: false,
        errors: [{ type: 'system', message: `Validation failed: ${error.message}` }],
        warnings: [],
        suggestions: [],
        score: 0
      };
    }
  }

  /**
   * Perform basic validation checks on the script
   */
  private performBasicValidation(
    scriptTemplate: string,
    variables: Record<string, any>
  ): Pick<ScriptValidationResult, 'errors' | 'warnings'> {
    const errors: ScriptValidationError[] = [];
    const warnings: ScriptValidationWarning[] = [];

    // Check if script is empty
    if (!scriptTemplate || scriptTemplate.trim() === '') {
      errors.push({
        type: 'critical',
        message: 'Script template cannot be empty',
      });
      return { errors, warnings };
    }

    // Check if script is too short
    if (scriptTemplate.length < 50) {
      warnings.push({
        type: 'length',
        message: 'Script is very short, consider adding more content',
      });
    }

    // Check if script is too long
    if (scriptTemplate.length > 2000) {
      warnings.push({
        type: 'length',
        message: 'Script is very long, consider making it more concise',
      });
    }

    // Check for variable placeholders in the script
    const variablePlaceholders = scriptTemplate.match(/{{([^{}]+)}}/g) || [];

    // If variables are used, validate them
    if (variablePlaceholders.length > 0) {
      const missingVariables: string[] = [];

      // Extract variable names from the placeholders
      const usedVariables = variablePlaceholders
        .map(placeholder => placeholder.replace('{{', '').replace('}}', '').trim());

      // Check for required variables
      if (!usedVariables.includes('contact_name')) {
        warnings.push({
          type: 'variable',
          message: 'Script does not include {{contact_name}} variable',
        });
      }

      // Check for undefined variables
      usedVariables.forEach(variable => {
        if (variable !== 'contact_name' && !(variable in variables)) {
          missingVariables.push(variable);
        }
      });

      if (missingVariables.length > 0) {
        errors.push({
          type: 'variable',
          message: `Script uses variables that are not defined: ${missingVariables.join(', ')}`,
        });
      }
    } else {
      warnings.push({
        type: 'variable',
        message: 'Script does not use any variables, which may make it less personalized',
      });
    }

    return { errors, warnings };
  }

  /**
   * Use OpenAI to evaluate the script for quality and compliance
   */
  private async evaluateScriptWithAI(
    scriptTemplate: string,
    campaignType: string,
    variables: Record<string, any>
  ): Promise<ScriptValidationResult> {
    const prompt = `
      Please evaluate the following telemarketing script for quality, effectiveness, and compliance.
      
      SCRIPT:
      ${scriptTemplate}
      
      SCRIPT TYPE: ${campaignType}
      
      VARIABLES AVAILABLE:
      ${Object.keys(variables).map(key => `- ${key}: ${variables[key]}`).join('\n')}
      
      Evaluate the script for the following criteria and provide your assessment as a JSON object with the following fields:
      
      - errors: Array of objects with { type, message, location } for any major issues that must be fixed
      - warnings: Array of objects with { type, message, location } for potential issues
      - suggestions: Array of strings with suggestions for improvement
      - score: A number from 0-100 representing overall quality
      
      CRITERIA:
      1. Clear identification of the caller as an AI assistant
      2. Appropriate introduction and purpose of the call
      3. Natural and conversational language
      4. Clear explanation of the product/service
      5. Personalization and variables usage
      6. Compliance with telemarketing regulations
      7. Call flow and structure
      8. Handling of potential objections
      9. Clear call to action
      10. Appropriate closing
      
      Format your response as a valid JSON object.
    `;

    try {
      const response = await this.openAiService.generateResponse(prompt, [
        {
          role: 'system',
          content: 'You are an expert script evaluator. Analyze the telemarketing script and return a detailed evaluation as a valid JSON object.',
        },
      ]);
      
      let evaluation;
      try {
        evaluation = JSON.parse(response);
      } catch (error) {
        this.logger.error(`Failed to parse script evaluation response as JSON: ${response}`);
        return {
          isValid: false,
          errors: [{ type: 'system', message: 'Failed to parse AI evaluation' }],
          warnings: [],
          suggestions: [],
          score: 0
        };
      }
      
      return {
        isValid: (evaluation.errors || []).length === 0,
        errors: evaluation.errors || [],
        warnings: evaluation.warnings || [],
        suggestions: evaluation.suggestions || [],
        score: evaluation.score || 0
      };
    } catch (error) {
      this.logger.error(`Error in AI script evaluation: ${error.message}`, error.stack);
      return {
        isValid: false,
        errors: [{ type: 'system', message: `AI evaluation failed: ${error.message}` }],
        warnings: [],
        suggestions: [],
        score: 0
      };
    }
  }

  /**
   * Check for specific compliance issues in a script
   */
  async checkCompliance(
    scriptTemplate: string,
    region: string = 'us',
  ): Promise<{
    compliant: boolean;
    issues: Array<{ rule: string; description: string }>;
  }> {
    const prompt = `
      Please check the following telemarketing script for compliance with ${region.toUpperCase()} telemarketing regulations.

      SCRIPT:
      ${scriptTemplate}

      Evaluate the script for compliance with telemarketing regulations, including:
      1. Clear identification of the caller and company
      2. Disclosure that this is a sales call (if applicable)
      3. No misleading statements
      4. Respect for do-not-call requests
      5. Clear opt-out options
      6. No harassment or pressure tactics
      7. Appropriate time of day acknowledgment (if any)
      8. Privacy policy mentions (if collecting data)
      
      Format your response as a valid JSON object with:
      - compliant: boolean (true/false)
      - issues: array of objects with { rule, description } for any compliance issues found
    `;

    try {
      const response = await this.openAiService.generateResponse(prompt, [
        {
          role: 'system',
          content: 'You are an expert in telemarketing compliance regulations. Analyze the script and return a detailed compliance evaluation as a valid JSON object.',
        },
      ]);
      
      let compliance;
      try {
        compliance = JSON.parse(response);
      } catch (error) {
        this.logger.error(`Failed to parse compliance evaluation response as JSON: ${response}`);
        return {
          compliant: false,
          issues: [{ rule: 'system_error', description: 'Failed to parse compliance evaluation' }]
        };
      }
      
      return {
        compliant: compliance.compliant || false,
        issues: compliance.issues || []
      };
    } catch (error) {
      this.logger.error(`Error in compliance evaluation: ${error.message}`, error.stack);
      return {
        compliant: false,
        issues: [{ rule: 'system_error', description: `Compliance evaluation failed: ${error.message}` }]
      };
    }
  }
}