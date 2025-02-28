import { Logger } from '@nestjs/common';
import { MigrationFramework } from './framework';
import { AddCallMetricsMigration, AddContactTagsMigration } from './002-add-contact-tags';

// Import all migrations here
const migrations = [
  AddCallMetricsMigration,
  AddContactTagsMigration,
];

async function runMigrations() {
  const logger = new Logger('MigrationRunner');
  const framework = new MigrationFramework();
  
  try {
    logger.log('Starting migrations...');
    await framework.connect();
    
    // Get command line arguments
    const args = process.argv.slice(2);
    const command = args[0];
    const specificMigration = args[1];
    
    // List applied migrations
    if (command === 'list') {
      const appliedMigrations = await framework.getAppliedMigrations();
      logger.log('Applied migrations:');
      appliedMigrations.forEach(name => logger.log(`- ${name}`));
      
      // List pending migrations
      const pendingMigrations = migrations
        .filter(m => !appliedMigrations.includes(m.name))
        .map(m => m.name);
      
      if (pendingMigrations.length > 0) {
        logger.log('Pending migrations:');
        pendingMigrations.forEach(name => logger.log(`- ${name}`));
      } else {
        logger.log('No pending migrations');
      }
    }
    
    // Apply pending migrations
    else if (command === 'up') {
      if (specificMigration) {
        // Apply specific migration
        const migration = migrations.find(m => m.name === specificMigration);
        if (!migration) {
          throw new Error(`Migration ${specificMigration} not found`);
        }
        
        await framework.applyMigration(migration);
      } else {
        // Apply all pending migrations
        const appliedMigrations = await framework.getAppliedMigrations();
        const pendingMigrations = migrations.filter(m => !appliedMigrations.includes(m.name));
        
        if (pendingMigrations.length === 0) {
          logger.log('No pending migrations to apply');
        } else {
          logger.log(`Applying ${pendingMigrations.length} migrations...`);
          
          for (const migration of pendingMigrations) {
            await framework.applyMigration(migration);
          }
          
          logger.log('All migrations applied successfully');
        }
      }
    }
    
    // Rollback migrations
    else if (command === 'down') {
      if (specificMigration) {
        // Rollback specific migration
        const migration = migrations.find(m => m.name === specificMigration);
        if (!migration) {
          throw new Error(`Migration ${specificMigration} not found`);
        }
        
        await framework.rollbackMigration(migration);
      } else {
        // Rollback last applied migration
        const appliedMigrations = await framework.getAppliedMigrations();
        
        if (appliedMigrations.length === 0) {
          logger.log('No migrations to rollback');
        } else {
          const lastMigrationName = appliedMigrations[appliedMigrations.length - 1];
          const lastMigration = migrations.find(m => m.name === lastMigrationName);
          
          if (!lastMigration) {
            throw new Error(`Migration ${lastMigrationName} not found in code but exists in database`);
          }
          
          await framework.rollbackMigration(lastMigration);
        }
      }
    }
    
    // Invalid command
    else {
      logger.error('Invalid command. Use "list", "up", or "down".');
      process.exit(1);
    }
    
    await framework.close();
    logger.log('Migration process completed');
    process.exit(0);
  } catch (error) {
    logger.error(`Error running migrations: ${error.message}`, error.stack);
    process.exit(1);
  }
}

// Run the migrations
runMigrations();