import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret') || '',
        signOptions: {
          expiresIn: configService.get<string>('jwt.expiresIn') || '1d',
        },
      }),
    }),
  ],
  controllers: [],
  providers: [],
  exports: [PassportModule, JwtModule],
})
export class AuthModule {}
