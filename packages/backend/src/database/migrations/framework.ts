import { Logger } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NestFactory } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as mongoose from 'mongoose';

// Import config
import appConfig from '../../config/app.config';
import databaseConfig from '../../config/database.config';

// MongoDB Migration model schema
const MigrationSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  appliedAt: { type: Date, required: true },
});

// Interface for migrations
export interface Migration {
  name: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
}

// Create a module just for migrations
import { Module } from '@nestjs/common';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('database.uri') || '',
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }),
    }),
  ],
  controllers: [],
  providers: [],
})
class MigrationModule {}

export class MigrationFramework {
  private logger: Logger;
  private connection: mongoose.Connection;
  private migrationModel: mongoose.Model<any>;
  
  constructor() {
    this.logger = new Logger('MigrationFramework');
  }
  
  async connect(): Promise<void> {
    const app = await NestFactory.create(MigrationModule);
    await app.init();
    
    this.connection = mongoose.connection;
    
    // Register the migration model
    this.migrationModel = this.connection.model('Migration', MigrationSchema);
    this.logger.log('Connected to database and registered migration model');
  }
  
  async applyMigration(migration: Migration): Promise<void> {
    // Check if migration has already been applied
    const existing = await this.migrationModel.findOne({ name: migration.name });
    
    if (existing) {
      this.logger.log(`Migration ${migration.name} has already been applied`);
      return;
    }
    
    try {
      this.logger.log(`Applying migration: ${migration.name}`);
      
      // Start a session for transaction
      const session = await this.connection.startSession();
      await session.withTransaction(async () => {
        // Apply the migration
        await migration.up();
        
        // Record that the migration has been applied
        await this.migrationModel.create([{
          name: migration.name,
          appliedAt: new Date()
        }], { session });
      });
      
      session.endSession();
      this.logger.log(`Successfully applied migration: ${migration.name}`);
    } catch (error) {
      this.logger.error(`Error applying migration ${migration.name}: ${error.message}`, error.stack);
      throw error;
    }
  }
  
  async rollbackMigration(migration: Migration): Promise<void> {
    // Check if migration has been applied
    const existing = await this.migrationModel.findOne({ name: migration.name });
    
    if (!existing) {
      this.logger.log(`Migration ${migration.name} has not been applied, nothing to rollback`);
      return;
    }
    
    try {
      this.logger.log(`Rolling back migration: ${migration.name}`);
      
      // Start a session for transaction
      const session = await this.connection.startSession();
      await session.withTransaction(async () => {
        // Apply the rollback
        await migration.down();
        
        // Remove the migration record
        await this.migrationModel.deleteOne({ name: migration.name }).session(session);
      });
      
      session.endSession();
      this.logger.log(`Successfully rolled back migration: ${migration.name}`);
    } catch (error) {
      this.logger.error(`Error rolling back migration ${migration.name}: ${error.message}`, error.stack);
      throw error;
    }
  }
  
  async getAppliedMigrations(): Promise<string[]> {
    const migrations = await this.migrationModel.find().sort({ appliedAt: 1 });
    return migrations.map(m => m.name);
  }
  
  async close(): Promise<void> {
    await mongoose.disconnect();
    this.logger.log('Closed database connection');
  }
}