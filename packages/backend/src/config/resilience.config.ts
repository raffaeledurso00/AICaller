export default () => ({
    resilience: {
      // Retry settings
      maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
      retryDelay: parseInt(process.env.RETRY_DELAY || '1000', 10),
      
      // Circuit breaker settings
      failureThreshold: parseInt(process.env.CIRCUIT_FAILURE_THRESHOLD || '5', 10),
      resetTimeout: parseInt(process.env.CIRCUIT_RESET_TIMEOUT || '30000', 10),
      halfOpenSuccessThreshold: parseInt(process.env.CIRCUIT_HALF_OPEN_SUCCESS_THRESHOLD || '2', 10),
      
      // Error tracking settings
      errorLogEnabled: process.env.ERROR_LOG_ENABLED !== 'false',
      sentryEnabled: process.env.SENTRY_ENABLED === 'true',
      sentryDsn: process.env.SENTRY_DSN || '',
    },
  });