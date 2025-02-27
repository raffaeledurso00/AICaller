import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Contact, ContactSchema } from './schemas/contact.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Contact.name, schema: ContactSchema }]),
  ],
  controllers: [],
  providers: [],
  exports: [MongooseModule],
})
export class ContactsModule {}