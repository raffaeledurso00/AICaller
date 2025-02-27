import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Campaign, CampaignDocument, CampaignStatus } from '../schemas/campaign.schema';
import { CreateCampaignDto } from '../dto/create-campaign.dto';
import { UpdateCampaignDto } from '../dto/update-campaign.dto';
import { OpenAiService } from '../../ai/services/openai.service';

@Injectable()
export class CampaignService {
  private readonly logger = new Logger(CampaignService.name);

  constructor(
    @InjectModel(Campaign.name) private readonly campaignModel: Model<CampaignDocument>,
    private readonly openAiService: OpenAiService,
  ) {}

  async create(createCampaignDto: CreateCampaignDto, userId: string): Promise<CampaignDocument> {
    this.logger.log(`Creating new campaign: ${createCampaignDto.name}`);

    // If no script template is provided, generate one using OpenAI
    if (!createCampaignDto.scriptTemplate) {
      try {
        createCampaignDto.scriptTemplate = await this.openAiService.generateCallScript(
          createCampaignDto.type,
          createCampaignDto.scriptVariables || {},
          { demographics: createCampaignDto.targetAudience || 'general' },
        );
      } catch (error) {
        this.logger.error(`Error generating script template: ${error.message}`);
        createCampaignDto.scriptTemplate = 'Default script template. Please customize this script.';
      }
    }

    // Set the owner
    const campaign = new this.campaignModel({
      ...createCampaignDto,
      owner: new Types.ObjectId(userId),
      status: CampaignStatus.DRAFT,
    });

    return campaign.save();
  }

  async findAll(filters: Partial<Campaign> = {}): Promise<CampaignDocument[]> {
    return this.campaignModel.find(filters)
      .populate('owner', 'firstName lastName email')
      .populate('supervisors', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<CampaignDocument> {
    const campaign = await this.campaignModel.findById(id)
      .populate('owner', 'firstName lastName email')
      .populate('supervisors', 'firstName lastName email')
      .exec();

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    return campaign;
  }

  async update(id: string, updateCampaignDto: UpdateCampaignDto): Promise<CampaignDocument> {
    const updatedCampaign = await this.campaignModel.findByIdAndUpdate(
      id,
      updateCampaignDto,
      { new: true },
    ).exec();

    if (!updatedCampaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    return updatedCampaign;
  }

  async updateStatus(id: string, status: CampaignStatus): Promise<CampaignDocument> {
    const updatedCampaign = await this.campaignModel.findByIdAndUpdate(
      id,
      { status },
      { new: true },
    ).exec();

    if (!updatedCampaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    return updatedCampaign;
  }

  async remove(id: string): Promise<void> {
    const result = await this.campaignModel.deleteOne({ _id: id }).exec();
    
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }
  }

  async findByOwner(ownerId: string): Promise<CampaignDocument[]> {
    return this.campaignModel.find({ owner: new Types.ObjectId(ownerId) })
      .populate('owner', 'firstName lastName email')
      .populate('supervisors', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findBySupervisor(supervisorId: string): Promise<CampaignDocument[]> {
    return this.campaignModel.find({ supervisors: new Types.ObjectId(supervisorId) })
      .populate('owner', 'firstName lastName email')
      .populate('supervisors', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .exec();
  }

  async addSupervisor(id: string, supervisorId: string): Promise<CampaignDocument> {
    const campaign = await this.findOne(id);
    
// Check if supervisor is already added
const supervisorExists = campaign.supervisors?.some(
    supervisor => (supervisor as any)._id?.toString() === supervisorId
  );
    
    if (supervisorExists) {
      return campaign;
    }
    
    const updatedCampaign = await this.campaignModel.findByIdAndUpdate(
      id,
      { $push: { supervisors: new Types.ObjectId(supervisorId) } },
      { new: true },
    ).exec();

    if (!updatedCampaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    return updatedCampaign;
  }

  async removeSupervisor(id: string, supervisorId: string): Promise<CampaignDocument> {
    const updatedCampaign = await this.campaignModel.findByIdAndUpdate(
      id,
      { $pull: { supervisors: new Types.ObjectId(supervisorId) } },
      { new: true },
    ).exec();

    if (!updatedCampaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    return updatedCampaign;
  }

  async updateCallMetrics(id: string, metrics: {
    totalContacts?: number;
    contactedCount?: number;
    successCount?: number;
  }): Promise<CampaignDocument> {
    const updatedCampaign = await this.campaignModel.findByIdAndUpdate(
      id,
      { $inc: metrics },
      { new: true },
    ).exec();

    if (!updatedCampaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    return updatedCampaign;
  }
}