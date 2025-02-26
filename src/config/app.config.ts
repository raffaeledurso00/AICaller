export default () => ({
  port: parseInt(process.env.API_PORT, 10) || 3000,
  env: process.env.NODE_ENV || 'development',
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
});
