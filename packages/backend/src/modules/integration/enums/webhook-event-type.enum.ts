export enum WebhookEventType {
    // Contact events
    CONTACT_CREATED = 'contact.created',
    CONTACT_UPDATED = 'contact.updated',
    CONTACT_DELETED = 'contact.deleted',
    
    // Campaign events
    CAMPAIGN_CREATED = 'campaign.created',
    CAMPAIGN_UPDATED = 'campaign.updated',
    CAMPAIGN_STARTED = 'campaign.started',
    CAMPAIGN_PAUSED = 'campaign.paused',
    CAMPAIGN_COMPLETED = 'campaign.completed',
    CAMPAIGN_DELETED = 'campaign.deleted',
    
    // Call events
    CALL_INITIATED = 'call.initiated',
    CALL_CONNECTED = 'call.connected',
    CALL_COMPLETED = 'call.completed',
    CALL_FAILED = 'call.failed',
    
    // Conversation events
    CONVERSATION_STARTED = 'conversation.started',
    CONVERSATION_ENDED = 'conversation.ended',
    CONVERSATION_MILESTONE = 'conversation.milestone',
    
    // System events
    SYSTEM_ERROR = 'system.error',
    SYSTEM_WARNING = 'system.warning',
  }