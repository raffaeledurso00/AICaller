export default () => ({
    security: {
      encryptionKey: process.env.ENCRYPTION_KEY || '',
      encryptionEnabled: process.env.ENCRYPTION_ENABLED === 'true',
      personalDataFields: {
        contact: ['phoneNumber', 'email', 'firstName', 'lastName'],
        call: ['recordingUrl', 'transcriptionUrl', 'fromNumber', 'toNumber'],
      },
      auditLogging: process.env.AUDIT_LOGGING_ENABLED === 'true',
      gdprEnabled: process.env.GDPR_ENABLED === 'true',
    },
  });