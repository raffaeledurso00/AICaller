import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { User, UserDocument } from '../../modules/users/schemas/user.schema';
import { Contact, ContactDocument } from '../../modules/contacts/schemas/contact.schema';
import { Call, CallDocument } from '../../modules/telephony/schemas/call.schema';
import { AuditLogService } from './audit-log.service';
import { AuditActionType } from '../schemas/audit-log.schema';
import { EncryptionService } from './encryption.service';

@Injectable()
export class GdprService {
  private readonly logger = new Logger(GdprService.name);
  private readonly isEnabled: boolean;
  private readonly personalDataFields: Record<string, string[]>;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Contact.name) private readonly contactModel: Model<ContactDocument>,
    @InjectModel(Call.name) private readonly callModel: Model<CallDocument>,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
    private readonly encryptionService: EncryptionService,
  ) {
    this.isEnabled = this.configService.get<boolean>('security.gdprEnabled', false);
    this.personalDataFields = this.configService.get<Record<string, string[]>>(
      'security.personalDataFields',
      { contact: [], call: [] }
    );
  }

  /**
   * Handle data subject access request (DSAR)
   * Returns all personal data associated with a user
   */
  async handleDataAccessRequest(userId: string, requestingUserId: string): Promise<any> {
    // Audit the access request
    await this.auditLogService.log(
      AuditActionType.ACCESS,
      'user',
      requestingUserId,
      null,
      { targetUserId: userId },
      'started',
    );

    try {
      // Get user data
      const user = await this.userModel.findById(userId).lean();
      if (!user) {
        throw new Error(`User with ID ${userId} not found`);
      }

      // Get contacts associated with the user
      const contacts = await this.contactModel.find({
        'metadata.createdBy': userId,
      }).lean();

      // Get calls associated with the user
      const calls = await this.callModel.find({
        $or: [
          { 'metadata.supervisorId': userId },
          { 'metadata.assignedAgentId': userId },
        ],
      }).lean();

      // Compile the personal data
      const personalData = {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin,
        },
        contacts: contacts.map(contact => {
          const { _id, firstName, lastName, email, phoneNumber, createdAt } = contact;
          return { id: _id, firstName, lastName, email, phoneNumber, createdAt };
        }),
        calls: calls.map(call => {
          const { _id, fromNumber, toNumber, startTime, endTime, createdAt } = call;
          return { id: _id, fromNumber, toNumber, startTime, endTime, createdAt };
        }),
      };

      // Audit the successful access request
      await this.auditLogService.log(
        AuditActionType.ACCESS,
        'user',
        requestingUserId,
        null,
        { targetUserId: userId, dataCount: {
          contacts: contacts.length,
          calls: calls.length,
        }},
        'success',
      );

      return personalData;
    } catch (error) {
      // Audit the failed access request
      await this.auditLogService.log(
        AuditActionType.ACCESS,
        'user',
        requestingUserId,
        null,
        { targetUserId: userId, error: error.message },
        'failed',
      );

      throw error;
    }
  }

  /**
   * Handle right to erasure (right to be forgotten)
   * Anonymizes personal data associated with a user
   */
  async handleErasureRequest(userId: string, requestingUserId: string): Promise<void> {
    // Audit the erasure request
    await this.auditLogService.log(
      AuditActionType.DELETE,
      'user',
      requestingUserId,
      null,
      { targetUserId: userId },
      'started',
    );

    try {
      // Anonymize user data
      await this.userModel.findByIdAndUpdate(userId, {
        email: `anonymized-${Date.now()}@example.com`,
        firstName: 'Anonymized',
        lastName: 'User',
        isActive: false,
        password: this.encryptionService.hash(Math.random().toString(36)),
        // Keep minimal data for audit purposes
        'metadata.anonymized': true,
        'metadata.anonymizedAt': new Date(),
        'metadata.anonymizedBy': requestingUserId,
      });

      // Anonymize contacts
      await this.contactModel.updateMany(
        { 'metadata.createdBy': userId },
        {
          firstName: 'Anonymized',
          lastName: 'Contact',
          email: null,
          phoneNumber: 'XXXXXXXXXXXX',
          'metadata.anonymized': true,
          'metadata.anonymizedAt': new Date(),
          'metadata.anonymizedBy': requestingUserId,
        }
      );

      // Anonymize calls
      await this.callModel.updateMany(
        {
          $or: [
            { 'metadata.supervisorId': userId },
            { 'metadata.assignedAgentId': userId },
          ],
        },
        {
          fromNumber: 'XXXXXXXXXXXX',
          toNumber: 'XXXXXXXXXXXX',
          recordingUrl: null,
          transcriptionUrl: null,
          'metadata.anonymized': true,
          'metadata.anonymizedAt': new Date(),
          'metadata.anonymizedBy': requestingUserId,
        }
      );

      // Audit the successful erasure
      await this.auditLogService.log(
        AuditActionType.DELETE,
        'user',
        requestingUserId,
        null,
        { targetUserId: userId },
        'success',
      );
    } catch (error) {
      // Audit the failed erasure
      await this.auditLogService.log(
        AuditActionType.DELETE,
        'user',
        requestingUserId,
        null,
        { targetUserId: userId, error: error.message },
        'failed',
      );

      throw error;
    }
  }

  /**
   * Encrypt personal data fields in an entity
   */
  encryptPersonalData(entity: any, entityType: string): any {
    if (!this.isEnabled) {
      return entity;
    }

    const fieldsToEncrypt = this.personalDataFields[entityType] || [];
    const encryptedEntity = { ...entity };

    fieldsToEncrypt.forEach(field => {
      if (encryptedEntity[field]) {
        encryptedEntity[field] = this.encryptionService.encrypt(encryptedEntity[field]);
      }
    });

    return encryptedEntity;
  }

  /**
   * Decrypt personal data fields in an entity
   */
  decryptPersonalData(entity: any, entityType: string): any {
    if (!this.isEnabled) {
      return entity;
    }

    const fieldsToDecrypt = this.personalDataFields[entityType] || [];
    const decryptedEntity = { ...entity };

    fieldsToDecrypt.forEach(field => {
      if (decryptedEntity[field]) {
        try {
          decryptedEntity[field] = this.encryptionService.decrypt(decryptedEntity[field]);
        } catch (error) {
          this.logger.warn(`Failed to decrypt field ${field}: ${error.message}`);
          // Keep encrypted value if decryption fails
        }
      }
    });

    return decryptedEntity;
  }
}