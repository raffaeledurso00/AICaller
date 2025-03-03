export default () => ({
    cache: {
      ttl: parseInt(process.env.CACHE_TTL || '300', 10), // Default 5 minutes
      checkperiod: parseInt(process.env.CACHE_CHECK_PERIOD || '60', 10), // Default 1 minute
      enabled: process.env.CACHE_ENABLED !== 'false', // Enabled by default
    },
  });