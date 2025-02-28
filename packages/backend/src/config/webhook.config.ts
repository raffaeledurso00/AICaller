export default () => ({
    webhook: {
      secretKey: process.env.WEBHOOK_SECRET_KEY || 'default_webhook_secret_change_this',
      timeout: parseInt(process.env.WEBHOOK_TIMEOUT || '5000', 10), // 5 seconds
      retryAttempts: parseInt(process.env.WEBHOOK_RETRY_ATTEMPTS || '3', 10),
      retryDelay: parseInt(process.env.WEBHOOK_RETRY_DELAY || '5000', 10), // 5 seconds
    },
  });