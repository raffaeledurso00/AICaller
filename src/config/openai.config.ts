export default () => ({
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4',
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '500', 10),
  },
});
