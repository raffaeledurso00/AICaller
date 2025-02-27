import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../users/services/users.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { UserDocument } from '../../users/schemas/user.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    try {
      const user = await this.usersService.findByEmail(email);
      
      const isPasswordValid = await this.usersService.validatePassword(
        password,
        user.password,
      );

      if (isPasswordValid) {
        // Using type assertion to handle Document methods
        const userObject = (user as UserDocument).toObject();
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _, ...result } = userObject;
        return result;
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    
    const user = await this.validateUser(email, password);
    
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    await this.usersService.updateLastLogin(user._id.toString());

    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      roles: user.roles,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    const user = await this.usersService.create(registerDto);
    
    // Using type assertion to access _id
    const userId = (user as unknown as { _id: string })._id;
    
    const payload: JwtPayload = {
      sub: userId.toString(),
      email: user.email,
      roles: user.roles,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: userId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
      },
    };
  }

  async validateJwtPayload(payload: JwtPayload) {
    const userId = payload.sub;
    try {
      const user = await this.usersService.findOne(userId);
      if (user && user.isActive) {
        return user;
      }
      return null;
    } catch {
      return null;
    }
  }
}