import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;
  private readonly ivLength = 16;
  private readonly saltLength = 64;
  private readonly tagLength = 16;

  constructor(private readonly configService: ConfigService) {
    // Get encryption key from environment variables
    const encryptionKey = this.configService.get<string>('security.encryptionKey');
    
    if (!encryptionKey) {
      this.logger.error('Encryption key is not set. Using fallback key for development only.');
      // For development only - in production this should error out
      const fallbackKey = 'fallback_encryption_key_for_development_only_123';
      this.key = crypto.scryptSync(fallbackKey, 'salt', 32);
    } else {
      // Convert the environment key to a 32-byte buffer using scrypt
      this.key = crypto.scryptSync(encryptionKey, 'salt', 32);
    }
  }

  /**
   * Encrypt sensitive data
   * @param text Plain text to encrypt
   * @returns Encrypted text (base64 encoded)
   */
  encrypt(text: string): string {
    try {
      // Generate a random initialization vector
      const iv = crypto.randomBytes(this.ivLength);
      
      // Create cipher with key and IV
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      
      // Encrypt the text
      let encrypted = cipher.update(text, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      // Get the authentication tag
      const tag = cipher.getAuthTag();
      
      // Combine IV, encrypted text, and auth tag for storage
      const result = Buffer.concat([
        iv,
        Buffer.from(encrypted, 'base64'),
        tag
      ]).toString('base64');
      
      return result;
    } catch (error) {
      this.logger.error(`Encryption error: ${error.message}`);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt encrypted data
   * @param encryptedText Encrypted text (base64 encoded)
   * @returns Decrypted plain text
   */
  decrypt(encryptedText: string): string {
    try {
      // Convert from base64 to buffer
      const buffer = Buffer.from(encryptedText, 'base64');
      
      // Extract IV, encrypted content, and auth tag
      const iv = buffer.slice(0, this.ivLength);
      const tag = buffer.slice(buffer.length - this.tagLength);
      const encrypted = buffer.slice(this.ivLength, buffer.length - this.tagLength);
      
      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(tag);
      
      // Decrypt the text
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      this.logger.error(`Decryption error: ${error.message}`);
      throw new Error('Failed to decrypt data. Data may be corrupted or tampered with.');
    }
  }

  /**
   * Hash data for storage (one-way encryption)
   * @param data Data to hash
   * @returns Hashed data
   */
  hash(data: string): string {
    try {
      // Generate a random salt
      const salt = crypto.randomBytes(this.saltLength);
      
      // Hash the data with the salt
      const hash = crypto.pbkdf2Sync(data, salt, 10000, 64, 'sha512');
      
      // Combine salt and hash for storage
      const result = Buffer.concat([salt, hash]).toString('base64');
      
      return result;
    } catch (error) {
      this.logger.error(`Hashing error: ${error.message}`);
      throw new Error('Failed to hash data');
    }
  }

  /**
   * Verify if data matches a stored hash
   * @param data Data to verify
   * @param storedHash Previously hashed data
   * @returns True if data matches the hash
   */
  verifyHash(data: string, storedHash: string): boolean {
    try {
      // Convert from base64 to buffer
      const buffer = Buffer.from(storedHash, 'base64');
      
      // Extract salt and hash
      const salt = buffer.slice(0, this.saltLength);
      const originalHash = buffer.slice(this.saltLength);
      
      // Hash the input data with the extracted salt
      const newHash = crypto.pbkdf2Sync(data, salt, 10000, 64, 'sha512');
      
      // Compare the new hash with the original hash
      return crypto.timingSafeEqual(originalHash, newHash);
    } catch (error) {
      this.logger.error(`Hash verification error: ${error.message}`);
      return false;
    }
  }
}