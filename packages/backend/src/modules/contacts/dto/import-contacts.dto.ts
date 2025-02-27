import { 
    IsString, 
    IsNotEmpty, 
    IsArray, 
    ValidateNested 
  } from 'class-validator';
  import { Type } from 'class-transformer';
  import { ApiProperty } from '@nestjs/swagger';
  
  export class ContactImportDto {
    @ApiProperty({
      example: 'John',
      description: 'The first name of the contact',
    })
    @IsString()
    @IsNotEmpty()
    firstName: string;
  
    @ApiProperty({
      example: 'Doe',
      description: 'The last name of the contact',
    })
    @IsString()
    @IsNotEmpty()
    lastName: string;
  
    @ApiProperty({
      example: '+15551234567',
      description: 'The phone number of the contact',
    })
    @IsString()
    @IsNotEmpty()
    phoneNumber: string;
  
    @ApiProperty({
      example: 'john.doe@example.com',
      description: 'The email of the contact',
      required: false,
    })
    @IsString()
    @IsNotEmpty()
    email?: string;
  }
  
  export class ImportContactsDto {
    @ApiProperty({
      example: '60d0fe4f5311236168a109ca',
      description: 'The ID of the campaign to import contacts for',
    })
    @IsString()
    @IsNotEmpty()
    campaignId: string;
  
    @ApiProperty({
      type: [ContactImportDto],
      description: 'The list of contacts to import',
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ContactImportDto)
    contacts: ContactImportDto[];
  }