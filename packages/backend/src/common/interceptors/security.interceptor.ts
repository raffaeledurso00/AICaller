import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
  } from '@nestjs/common';
  import { Observable } from 'rxjs';
  import { map } from 'rxjs/operators';
  import { ConfigService } from '@nestjs/config';
  import { GdprService } from '../services/gdpr.service';
  
  @Injectable()
  export class SecurityInterceptor implements NestInterceptor {
    private readonly logger = new Logger(SecurityInterceptor.name);
    private readonly encryptionEnabled: boolean;
  
    constructor(
      private readonly configService: ConfigService,
      private readonly gdprService: GdprService,
    ) {
      this.encryptionEnabled = this.configService.get<boolean>('security.encryptionEnabled', false);
    }
  
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
      if (!this.encryptionEnabled) {
        return next.handle();
      }
  
      const request = context.switchToHttp().getRequest();
      
      // Process incoming data - encrypt sensitive fields
      if (request.body) {
        const entityType = this.getEntityTypeFromPath(request.path);
        if (entityType) {
          request.body = this.gdprService.encryptPersonalData(request.body, entityType);
        }
      }
  
      // Process outgoing data - decrypt sensitive fields
      return next.handle().pipe(
        map(data => {
          if (data) {
            const entityType = this.getEntityTypeFromPath(request.path);
            if (entityType) {
              if (Array.isArray(data)) {
                return data.map(item => this.gdprService.decryptPersonalData(item, entityType));
              } else {
                return this.gdprService.decryptPersonalData(data, entityType);
              }
            }
          }
          return data;
        }),
      );
    }
  
    private getEntityTypeFromPath(path: string): string | null {
      if (path.includes('/contacts')) {
        return 'contact';
      } else if (path.includes('/calls')) {
        return 'call';
      }
      return null;
    }
  }