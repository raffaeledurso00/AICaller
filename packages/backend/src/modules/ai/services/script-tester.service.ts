import { Injectable, Logger } from '@nestjs/common';
import { OpenAiService } from './openai.service';
import { ScriptValidatorService } from './script-validator.service';

export interface ScriptTestCase {
  name: string;
  userReplies: string[];
  expectedTopics: string[];
  expectedOutcomes: string[];
}

export interface ScriptTestResult {
  testCase: string;
  success: boolean;
  conversations: Array<{
    speaker: 'ai' | 'user';
    message: string;
  }>;
  coverage: {
    topicsCovered: string[];
    topicsMissed: string[];
    percentageCovered: number;
  };
  metrics: {
    responseTime?: number;
    conversationLength: number;
    userSentiment: 'positive' | 'neutral' | 'negative';
    expectedOutcomesAchieved: string[];
    expectedOutcomesMissed: string[];
  };
  feedback: string;
}

export interface ScriptTestSummary {
  successRate: number;
  averageTopicCoverage: number;
  averageConversationLength: number;
  commonlyMissedTopics: string[];
  recommendedImprovements: string[];
}

@Injectable()
export class ScriptTesterService {
  private readonly logger = new Logger(ScriptTesterService.name);

  constructor(
    private readonly openAiService: OpenAiService,
    private readonly scriptValidatorService: ScriptValidatorService,
  ) {}

  /**
   * Run a single test case for a script
   */
  async testScript(
    scriptTemplate: string,
    campaignType: string,
    variables: Record<string, any>,
    testCase: ScriptTestCase,
  ): Promise<ScriptTestResult> {
    try {
      this.logger.log(`Running test case "${testCase.name}" for script`);
      
      // Start with script validation
      const validationResult = await this.scriptValidatorService.validateScript(
        scriptTemplate,
        campaignType,
        variables,
      );
      
      if (!validationResult.isValid) {
        return {
          testCase: testCase.name,
          success: false,
          conversations: [],
          coverage: {
            topicsCovered: [],
            topicsMissed: testCase.expectedTopics,
            percentageCovered: 0,
          },
          metrics: {
            conversationLength: 0,
            userSentiment: 'negative',
            expectedOutcomesAchieved: [],
            expectedOutcomesMissed: testCase.expectedOutcomes,
          },
          feedback: `Script validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`,
        };
      }
      
      // Replace variables in the script template
      let processedTemplate = scriptTemplate;
      Object.entries(variables).forEach(([key, value]) => {
        processedTemplate = processedTemplate.replace(new RegExp(`{{${key}}}`, 'g'), value as string);
      });
      
      // Replace contact_name with a test customer name
      processedTemplate = processedTemplate.replace(/{{contact_name}}/g, 'Test Customer');
      
      // Simulate a conversation with the AI
      const conversation = await this.simulateConversation(
        processedTemplate,
        campaignType,
        testCase.userReplies,
      );
      
      // Analyze the conversation for topic coverage and outcomes
      const analysis = await this.analyzeConversation(
        conversation,
        testCase.expectedTopics,
        testCase.expectedOutcomes,
      );
      
      // Calculate metrics
      const topicsCovered = analysis.topicsCovered;
      const topicsMissed = testCase.expectedTopics.filter(
        topic => !topicsCovered.includes(topic),
      );
      const percentageCovered = 
        testCase.expectedTopics.length === 0
          ? 100
          : (topicsCovered.length / testCase.expectedTopics.length) * 100;
      
      const outcomesAchieved = analysis.outcomesAchieved;
      const outcomesMissed = testCase.expectedOutcomes.filter(
        outcome => !outcomesAchieved.includes(outcome),
      );
      
      // Determine success based on criteria
      const success = 
        percentageCovered >= 80 && outcomesAchieved.length === testCase.expectedOutcomes.length;
      
      return {
        testCase: testCase.name,
        success,
        conversations: conversation,
        coverage: {
          topicsCovered,
          topicsMissed,
          percentageCovered,
        },
        metrics: {
          conversationLength: conversation.length,
          userSentiment: analysis.userSentiment,
          expectedOutcomesAchieved: outcomesAchieved,
          expectedOutcomesMissed: outcomesMissed,
        },
        feedback: analysis.feedback,
      };
    } catch (error) {
      this.logger.error(`Error testing script: ${error.message}`, error.stack);
      return {
        testCase: testCase.name,
        success: false,
        conversations: [],
        coverage: {
          topicsCovered: [],
          topicsMissed: testCase.expectedTopics,
          percentageCovered: 0,
        },
        metrics: {
          conversationLength: 0,
          userSentiment: 'negative',
          expectedOutcomesAchieved: [],
          expectedOutcomesMissed: testCase.expectedOutcomes,
        },
        feedback: `Error running test: ${error.message}`,
      };
    }
  }
  
  /**
   * Run multiple test cases and provide a summary
   */
  async testScriptWithMultipleCases(
    scriptTemplate: string,
    campaignType: string,
    variables: Record<string, any>,
    testCases: ScriptTestCase[],
  ): Promise<{ results: ScriptTestResult[]; summary: ScriptTestSummary }> {
    const results: ScriptTestResult[] = [];
    
    // Run each test case
    for (const testCase of testCases) {
      const result = await this.testScript(
        scriptTemplate,
        campaignType,
        variables,
        testCase,
      );
      results.push(result);
    }
    
    // Calculate summary statistics
    const successfulTests = results.filter(r => r.success);
    const successRate = (successfulTests.length / results.length) * 100;
    
    const averageTopicCoverage = 
      results.reduce((sum, result) => sum + result.coverage.percentageCovered, 0) / results.length;
    
    const averageConversationLength = 
      results.reduce((sum, result) => sum + result.metrics.conversationLength, 0) / results.length;
    
    // Find commonly missed topics
    const allMissedTopics = results.flatMap(result => result.coverage.topicsMissed);
    const missedTopicCounts = allMissedTopics.reduce((counts, topic) => {
      counts[topic] = (counts[topic] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
    const commonlyMissedTopics = Object.entries(missedTopicCounts)
      .filter(([_, count]) => count > 1)
      .sort(([_, countA], [__, countB]) => countB - countA)
      .map(([topic]) => topic);
    
    // Generate improvement recommendations
    const recommendedImprovements = await this.generateImprovementRecommendations(
      scriptTemplate,
      results,
    );
    
    return {
      results,
      summary: {
        successRate,
        averageTopicCoverage,
        averageConversationLength,
        commonlyMissedTopics,
        recommendedImprovements,
      },
    };
  }
  
  /**
   * Simulate a conversation with the AI system
   */
  private async simulateConversation(
    scriptTemplate: string,
    campaignType: string,
    userReplies: string[],
  ): Promise<Array<{ speaker: 'ai' | 'user'; message: string }>> {
    const conversation: Array<{ speaker: 'ai' | 'user'; message: string }> = [];
    
    // Initialize conversation with a system prompt
    const systemPrompt = `
      You are an AI assistant making a call on behalf of a business. Follow this script template:
      
      SCRIPT:
      ${scriptTemplate}
      
      Campaign type: ${campaignType}
      
      Start by introducing yourself according to the script. Be conversational and adapt to the customer's responses.
      Remember to clearly identify yourself as an AI assistant.
    `;
    
    try {
      // Generate initial AI greeting
      const initialPrompt = "Generate an introduction based on the script template.";
      const initialResponse = await this.openAiService.generateResponse(
        initialPrompt,
        [{ role: 'system', content: systemPrompt }],
      );
      
      // Add to conversation
      conversation.push({ speaker: 'ai', message: initialResponse });
      
      // Process each user reply
      for (const userReply of userReplies) {
        // Add user reply to conversation
        conversation.push({ speaker: 'user', message: userReply });
        
        // Create the conversation history in the format expected by OpenAI
        const conversationHistory = conversation.map(msg => ({
          role: msg.speaker === 'ai' ? 'assistant' as const : 'user' as const,
          content: msg.message,
        }));
        
        // Generate AI response
        const aiResponse = await this.openAiService.generateResponse(
          "Continue the conversation naturally based on the user's response and the script template.",
          [{ role: 'system', content: systemPrompt }, ...conversationHistory],
        );
        
        // Add AI response to conversation
        conversation.push({ speaker: 'ai', message: aiResponse });
      }
      
      return conversation;
    } catch (error) {
      this.logger.error(`Error simulating conversation: ${error.message}`, error.stack);
      throw error;
    }
  }
  
  /**
   * Analyze a conversation for topic coverage, outcomes, and sentiment
   */
  private async analyzeConversation(
    conversation: Array<{ speaker: 'ai' | 'user'; message: string }>,
    expectedTopics: string[],
    expectedOutcomes: string[],
  ): Promise<{
    topicsCovered: string[];
    outcomesAchieved: string[];
    userSentiment: 'positive' | 'neutral' | 'negative';
    feedback: string;
  }> {
    try {
      // Format the conversation for analysis
      const formattedConversation = conversation
        .map(msg => `${msg.speaker.toUpperCase()}: ${msg.message}`)
        .join('\n\n');
      
      const prompt = `
        Analyze the following conversation between an AI agent and a customer.
        
        CONVERSATION:
        ${formattedConversation}
        
        EXPECTED TOPICS:
        ${expectedTopics.join(', ')}
        
        EXPECTED OUTCOMES:
        ${expectedOutcomes.join(', ')}
        
        Provide a detailed analysis in JSON format with the following fields:
        - topicsCovered: an array of strings listing which expected topics were covered
        - outcomesAchieved: an array of strings listing which expected outcomes were achieved
        - userSentiment: either "positive", "neutral", or "negative"
        - feedback: a string with recommendations for improving the script
        
        Format your response as a valid JSON object.
      `;
      
      const analysisText = await this.openAiService.generateResponse(
        prompt,
        [{ role: 'system', content: 'You are an expert in analyzing conversations. Return only valid JSON.' }],
      );
      
      let analysis;
      try {
        analysis = JSON.parse(analysisText);
      } catch (error) {
        this.logger.error(`Failed to parse conversation analysis as JSON: ${analysisText}`);
        return {
          topicsCovered: [],
          outcomesAchieved: [],
          userSentiment: 'neutral',
          feedback: 'Error analyzing conversation.',
        };
      }
      
      return {
        topicsCovered: analysis.topicsCovered || [],
        outcomesAchieved: analysis.outcomesAchieved || [],
        userSentiment: analysis.userSentiment || 'neutral',
        feedback: analysis.feedback || '',
      };
    } catch (error) {
      this.logger.error(`Error analyzing conversation: ${error.message}`, error.stack);
      throw error;
    }
  }
  
  /**
   * Generate recommendations for improving the script based on test results
   */
  private async generateImprovementRecommendations(
    scriptTemplate: string,
    testResults: ScriptTestResult[],
  ): Promise<string[]> {
    try {
      // Extract relevant information from test results
      const failedTests = testResults.filter(result => !result.success);
      const commonlyMissedTopics = this.findCommonlyMissedItems(
        testResults.flatMap(result => result.coverage.topicsMissed),
      );
      const commonlyMissedOutcomes = this.findCommonlyMissedItems(
        testResults.flatMap(result => result.metrics.expectedOutcomesMissed),
      );
      
      const prompt = `
        Analyze the following script template and test results to provide recommendations for improvement.
        
        SCRIPT TEMPLATE:
        ${scriptTemplate}
        
        TEST RESULTS SUMMARY:
        - Total tests: ${testResults.length}
        - Failed tests: ${failedTests.length}
        - Commonly missed topics: ${commonlyMissedTopics.join(', ')}
        - Commonly missed outcomes: ${commonlyMissedOutcomes.join(', ')}
        
        Based on the test results, provide 3-5 specific recommendations for improving the script.
        Format your response as a JSON array of strings, each containing a specific recommendation.
      `;
      
      const recommendationsText = await this.openAiService.generateResponse(
        prompt,
        [{ role: 'system', content: 'You are an expert in script optimization. Return only a valid JSON array of strings.' }],
      );
      
      let recommendations;
      try {
        recommendations = JSON.parse(recommendationsText);
        if (!Array.isArray(recommendations)) {
          recommendations = ['Format script better', 'Add more personalization', 'Improve objection handling'];
        }
      } catch (error) {
        this.logger.error(`Failed to parse recommendations as JSON: ${recommendationsText}`);
        return ['Format script better', 'Add more personalization', 'Improve objection handling'];
      }
      
      return recommendations;
    } catch (error) {
      this.logger.error(`Error generating improvement recommendations: ${error.message}`, error.stack);
      return ['Error generating recommendations'];
    }
  }
  
  /**
   * Find commonly missed items in a list
   */
  private findCommonlyMissedItems(items: string[]): string[] {
    const counts = items.reduce((counts, item) => {
      counts[item] = (counts[item] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
    return Object.entries(counts)
      .filter(([_, count]) => count > 1)
      .sort(([_, countA], [__, countB]) => countB - countA)
      .map(([item]) => item);
  }
}