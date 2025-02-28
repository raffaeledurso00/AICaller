import { Logger } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NestFactory } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as mongoose from 'mongoose';

// Import schema modules
import { User, UserSchema } from '../../modules/users/schemas/user.schema';
import { Campaign, CampaignSchema } from '../../modules/campaigns/schemas/campaign.schema';
import { Contact, ContactSchema } from '../../modules/contacts/schemas/contact.schema';
import { Role } from '../../common/enums/role.enum';
import { CampaignType, CampaignStatus } from '../../modules/campaigns/schemas/campaign.schema';
import { ContactStatus } from '../../modules/contacts/schemas/contact.schema';

// Import config
import appConfig from '../../config/app.config';
import databaseConfig from '../../config/database.config';

// Create a module just for seeding
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
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Campaign.name, schema: CampaignSchema },
      { name: Contact.name, schema: ContactSchema },
    ]),
  ],
  controllers: [],
  providers: [],
})
class SeedModule {}

async function bootstrap() {
  const logger = new Logger('DatabaseSeeder');
  
  try {
    logger.log('Starting database seeding...');
    
    const app = await NestFactory.create(SeedModule);
    await app.init();
    
    const configService = app.get(ConfigService);
    const dbUri = configService.get<string>('database.uri');
    
    // Get model references
    const connection = mongoose.connection;
    const userModel = connection.model(User.name);
    const campaignModel = connection.model(Campaign.name);
    const contactModel = connection.model(Contact.name);
    
    // Clear existing data (optional - use with caution)
    if (process.env.SEED_CLEAR === 'true') {
      logger.warn('Clearing existing data...');
      await userModel.deleteMany({});
      await campaignModel.deleteMany({});
      await contactModel.deleteMany({});
    }
    
    // Create admin user if it doesn't exist
    const adminEmail = 'admin@example.com';
    const existingAdmin = await userModel.findOne({ email: adminEmail });
    
    let adminUser;
    if (!existingAdmin) {
      logger.log('Creating admin user...');
      adminUser = await userModel.create({
        firstName: 'Admin',
        lastName: 'User',
        email: adminEmail,
        password: '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm', // password is 'password123'
        roles: [Role.ADMIN],
        isActive: true,
      });
    } else {
      adminUser = existingAdmin;
      logger.log('Admin user already exists');
    }
    
    // Create supervisor user if it doesn't exist
    const supervisorEmail = 'supervisor@example.com';
    const existingSupervisor = await userModel.findOne({ email: supervisorEmail });
    
    let supervisorUser;
    if (!existingSupervisor) {
      logger.log('Creating supervisor user...');
      supervisorUser = await userModel.create({
        firstName: 'Supervisor',
        lastName: 'User',
        email: supervisorEmail,
        password: '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm', // password is 'password123'
        roles: [Role.SUPERVISOR],
        isActive: true,
      });
    } else {
      supervisorUser = existingSupervisor;
      logger.log('Supervisor user already exists');
    }
    
    // Create demo campaign if it doesn't exist
    const demoName = 'Demo Sales Campaign';
    const existingCampaign = await campaignModel.findOne({ name: demoName });
    
    let demoCampaign;
    if (!existingCampaign) {
      logger.log('Creating demo campaign...');
      demoCampaign = await campaignModel.create({
        name: demoName,
        description: 'A demonstration campaign for showcasing the system',
        type: CampaignType.SALES,
        status: CampaignStatus.ACTIVE,
        owner: adminUser._id,
        supervisors: [supervisorUser._id],
        scriptTemplate: `Hello {{contact_name}}, I'm calling from XYZ Company. We have a special offer for our premium service that I think would be perfect for you. Do you have a moment to chat?`,
        scriptVariables: {
          company_name: 'XYZ Company',
          offer_details: '50% off for the first 3 months',
        },
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        maxConcurrentCalls: 5,
      });
    } else {
      demoCampaign = existingCampaign;
      logger.log('Demo campaign already exists');
    }
    
    // Create sample contacts if they don't exist
    const existingContacts = await contactModel.countDocuments({ campaign: demoCampaign._id });
    
    if (existingContacts < 5) {
      logger.log('Creating sample contacts...');
      
      const sampleContacts = [
        {
          firstName: 'John',
          lastName: 'Doe',
          phoneNumber: '+15551234567',
          email: 'john.doe@example.com',
          campaign: demoCampaign._id,
          status: ContactStatus.PENDING,
        },
        {
          firstName: 'Jane',
          lastName: 'Smith',
          phoneNumber: '+15559876543',
          email: 'jane.smith@example.com',
          campaign: demoCampaign._id,
          status: ContactStatus.PENDING,
        },
        {
          firstName: 'Bob',
          lastName: 'Johnson',
          phoneNumber: '+15552468001',
          email: 'bob.johnson@example.com',
          campaign: demoCampaign._id,
          status: ContactStatus.PENDING,
        },
        {
          firstName: 'Alice',
          lastName: 'Williams',
          phoneNumber: '+15551357924',
          email: 'alice.williams@example.com',
          campaign: demoCampaign._id,
          status: ContactStatus.PENDING,
        },
        {
          firstName: 'Charlie',
          lastName: 'Brown',
          phoneNumber: '+15558642539',
          email: 'charlie.brown@example.com',
          campaign: demoCampaign._id,
          status: ContactStatus.PENDING,
        },
      ];
      
      await contactModel.insertMany(sampleContacts);
    } else {
      logger.log('Sample contacts already exist');
    }
    
    logger.log('Database seeding completed successfully');
    await app.close();
    process.exit(0);
  } catch (error) {
    const logger = new Logger('DatabaseSeeder');
    logger.error(`Error seeding database: ${error.message}`, error.stack);
    process.exit(1);
  }
}

// Execute the seeder
bootstrap();