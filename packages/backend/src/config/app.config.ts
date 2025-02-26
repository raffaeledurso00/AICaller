export default () => ({
  port: parseInt(process.env.API_PORT || '3000', 10),
  env: process.env.NODE_ENV || 'development',
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
});
