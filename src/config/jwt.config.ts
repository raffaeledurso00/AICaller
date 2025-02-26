export default () => ({
  jwt: {
    secret: process.env.JWT_SECRET || 'default_dev_secret_please_change',
    expiresIn: process.env.JWT_EXPIRATION || '1d',
  },
});
