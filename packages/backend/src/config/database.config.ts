export default () => ({
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-caller',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
});
