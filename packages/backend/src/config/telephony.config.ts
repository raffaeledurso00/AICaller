export default () => ({
    telephony: {
      twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID || '',
        authToken: process.env.TWILIO_AUTH_TOKEN || '',
        phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
      },
      enableRealTimeAnalysis: process.env.ENABLE_REAL_TIME_ANALYSIS === 'true',
      enableSpeechToText: process.env.ENABLE_SPEECH_TO_TEXT === 'true',
      enableSupervisorIntervention: process.env.ENABLE_SUPERVISOR_INTERVENTION === 'true',
      tmpDirectory: process.env.AUDIO_TMP_DIRECTORY || '/tmp/aicaller',
      recordingEnabled: process.env.CALL_RECORDING_ENABLED === 'true',
      recordingFormat: process.env.CALL_RECORDING_FORMAT || 'wav',
    },
  });