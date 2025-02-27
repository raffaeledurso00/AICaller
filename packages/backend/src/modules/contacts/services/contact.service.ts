import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Contact, ContactDocument, ContactStatus } from '../schemas/contact.schema';
import { CreateContactDto } from '../dto/create-contact.dto';
import { UpdateContactDto } from '../dto/update-contact.dto';
import { ImportContactsDto } from '../dto/import-contacts.dto';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    @InjectModel(Contact.name) private readonly contactModel: Model<ContactDocument>,
  ) {}

  async create(createContactDto: CreateContactDto): Promise<ContactDocument> {
    this.logger.log(`Creating new contact: ${createContactDto.firstName} ${createContactDto.lastName}`);
    
    const contact = new this.contactModel(createContactDto);
    return contact.save();
  }

  async findAll(filters: Partial<Contact> = {}): Promise<ContactDocument[]> {
    return this.contactModel.find(filters)
      .populate('campaign')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<ContactDocument> {
    const contact = await this.contactModel.findById(id)
      .populate('campaign')
      .exec();

    if (!contact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    return contact;
  }

  async update(id: string, updateContactDto: UpdateContactDto): Promise<ContactDocument> {
    const updatedContact = await this.contactModel.findByIdAndUpdate(
      id,
      updateContactDto,
      { new: true },
    ).exec();

    if (!updatedContact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    return updatedContact;
  }

  async remove(id: string): Promise<void> {
    const result = await this.contactModel.deleteOne({ _id: id }).exec();
    
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }
  }

  async findByCampaign(campaignId: string): Promise<ContactDocument[]> {
    return this.contactModel.find({ campaign: new Types.ObjectId(campaignId) })
      .exec();
  }

  async updateStatus(id: string, status: ContactStatus): Promise<ContactDocument> {
    const updatedContact = await this.contactModel.findByIdAndUpdate(
      id,
      { status },
      { new: true },
    ).exec();

    if (!updatedContact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    return updatedContact;
  }

  async incrementAttemptCount(id: string): Promise<ContactDocument> {
    const updatedContact = await this.contactModel.findByIdAndUpdate(
      id,
      { 
        $inc: { attemptCount: 1 },
        lastAttemptDate: new Date(),
      },
      { new: true },
    ).exec();

    if (!updatedContact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    return updatedContact;
  }

  async markAsSuccessful(id: string): Promise<ContactDocument> {
    const updatedContact = await this.contactModel.findByIdAndUpdate(
      id,
      { 
        isSuccessful: true,
        successDate: new Date(),
      },
      { new: true },
    ).exec();

    if (!updatedContact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    return updatedContact;
  }

  async addHistoryEntry(
    id: string, 
    action: string, 
    notes?: string, 
    data?: Record<string, any>,
  ): Promise<ContactDocument> {
    const historyEntry = {
      timestamp: new Date(),
      action,
      notes,
      data,
    };

    const updatedContact = await this.contactModel.findByIdAndUpdate(
      id,
      { $push: { history: historyEntry } },
      { new: true },
    ).exec();

    if (!updatedContact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    return updatedContact;
  }

  async bulkImport(importContactsDto: ImportContactsDto): Promise<{ 
    success: number; 
    failed: number; 
    total: number;
  }> {
    this.logger.log(`Importing ${importContactsDto.contacts.length} contacts for campaign ${importContactsDto.campaignId}`);
    
    // Prepare contacts data with campaign ID
    const contactsToInsert = importContactsDto.contacts.map(contact => ({
      ...contact,
      campaign: new Types.ObjectId(importContactsDto.campaignId),
      status: ContactStatus.PENDING,
      attemptCount: 0,
      history: [{
        timestamp: new Date(),
        action: 'imported',
      }],
    }));

    try {
      // Insert many contacts at once
      const result = await this.contactModel.insertMany(contactsToInsert, { ordered: false });
      
      return {
        success: result.length,
        failed: importContactsDto.contacts.length - result.length,
        total: importContactsDto.contacts.length,
      };
    } catch (error) {
      this.logger.error(`Error importing contacts: ${error.message}`);
      
      // If some documents were inserted before the error
      if (error.insertedDocs?.length > 0) {
        return {
          success: error.insertedDocs.length,
          failed: importContactsDto.contacts.length - error.insertedDocs.length,
          total: importContactsDto.contacts.length,
        };
      }
      
      throw error;
    }
  }

  async countContactsByStatus(
    campaignId: string, 
    statuses: string[],
  ): Promise<number> {
    return this.contactModel.countDocuments({
      campaign: new Types.ObjectId(campaignId),
      status: { $in: statuses },
    }).exec();
  }
  
  async findAvailableContactsForCampaign(
    campaignId: string, 
    limit: number,
  ): Promise<ContactDocument[]> {
    // Find contacts that are pending or have failed but have not reached max attempts
    return this.contactModel.find({
      campaign: new Types.ObjectId(campaignId),
      $or: [
        { status: ContactStatus.PENDING },
        {
          status: ContactStatus.FAILED,
          attemptCount: { $lt: 3 }, // Configurable max attempts
        },
      ],
      // Exclude contacts with Do Not Call status
      status: { $ne: ContactStatus.DO_NOT_CALL },
    })
    .sort({ attemptCount: 1, lastAttemptDate: 1 })
    .limit(limit)
    .exec();
  }
}