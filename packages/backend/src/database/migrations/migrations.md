# Database Seeds and Migrations

This document explains how to use the database seeding and migration system for the AI Telemarketing API.

## Database Seeds

Seeds are used to populate the database with initial data for development and testing purposes.

### Available Commands

- `npm run seed` - Run the database seeder to populate the database with initial data
- `npm run seed:clear` - Clear existing data before seeding (use with caution!)

### How Seeds Work

The seeding system will:

1. Create a default admin user (if not already exists)
2. Create a default supervisor user (if not already exists)
3. Create a demo campaign (if not already exists)
4. Create sample contacts for the demo campaign (if not already exists)

This allows developers to quickly get started with a populated database.

### Extending Seeds

To add more seed data, modify the `src/database/seeds/index.ts` file to include additional data as needed.

## Database Migrations

Migrations are used to manage database schema changes over time. They ensure that all environments (development, testing, production) have consistent database structures.

### Available Commands

- `npm run migration:list` - List all applied and pending migrations
- `npm run migration:up` - Apply all pending migrations
- `npm run migration:down` - Rollback the last applied migration
- `npm run migration:up:specific <migration-name>` - Apply a specific migration

### How Migrations Work

Each migration file should export an object implementing the `Migration` interface:

```typescript
interface Migration {
  name: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
}
```

- The `name` should be unique and ideally follow a pattern like `001-description-of-change`
- The `up` method contains code to apply the migration
- The `down` method contains code to rollback the migration

Migrations are tracked in a collection called `migrations` in the MongoDB database.

### Creating a New Migration

1. Create a new file in `src/database/migrations/` with a name that follows the pattern `XXX-description.ts`
2. Implement the `Migration` interface
3. Import and add your migration to the `migrations` array in `run-migrations.ts`

Example:

```typescript
// src/database/migrations/003-add-user-preferences.ts
import * as mongoose from 'mongoose';
import { Migration } from './framework';

export const AddUserPreferencesMigration: Migration = {
  name: '003-add-user-preferences',
  
  up: async (): Promise<void> => {
    const collection = mongoose.connection.collection('users');
    await collection.updateMany(
      { preferences: { $exists: false } },
      { $set: { preferences: {} } }
    );
  },
  
  down: async (): Promise<void> => {
    const collection = mongoose.connection.collection('users');
    await collection.updateMany(
      {},
      { $unset: { preferences: "" } }
    );
  }
};
```

Then add it to `run-migrations.ts`:

```typescript
import { AddUserPreferencesMigration } from './003-add-user-preferences';

const migrations = [
  // ... existing migrations
  AddUserPreferencesMigration,
];
```

### Best Practices

1. Always implement both `up` and `down` methods
2. Keep migrations focused on a single change
3. Make migrations idempotent (safe to run multiple times)
4. Test migrations in development before applying to production
5. Add appropriate logging to track progress