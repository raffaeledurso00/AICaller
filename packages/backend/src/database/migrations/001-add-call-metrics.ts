import * as mongoose from 'mongoose';
import { Migration } from './framework';

export const AddCallMetricsMigration: Migration = {
  name: '001-add-call-metrics',
  
  up: async (): Promise<void> => {
    const collection = mongoose.connection.collection('calls');
    
    // Add metrics field to all existing call documents if it doesn't exist
    await collection.updateMany(
      { metrics: { $exists: false } },
      { $set: { metrics: {
          aiResponseTime: 0,
          humanSpeakingTime: 0,
          aiSpeakingTime: 0,
          silenceTime: 0,
          interruptions: 0,
        } } 
      }
    );
    
    console.log('Added metrics field to all calls');
  },
  
  down: async (): Promise<void> => {
    const collection = mongoose.connection.collection('calls');
    
    // Remove metrics field from all call documents
    await collection.updateMany(
      {},
      { $unset: { metrics: "" } }
    );
    
    console.log('Removed metrics field from all calls');
  }
};

// packages/backend/src/database/migrations/002-add-contact-tags.ts
export const AddContactTagsMigration: Migration = {
  name: '002-add-contact-tags',
  
  up: async (): Promise<void> => {
    const collection = mongoose.connection.collection('contacts');
    
    // Add tags array to all existing contact documents if it doesn't exist
    await collection.updateMany(
      { tags: { $exists: false } },
      { $set: { tags: [] } }
    );
    
    console.log('Added tags field to all contacts');
  },
  
  down: async (): Promise<void> => {
    const collection = mongoose.connection.collection('contacts');
    
    // Remove tags field from all contact documents
    await collection.updateMany(
      {},
      { $unset: { tags: "" } }
    );
    
    console.log('Removed tags field from all contacts');
  }
};