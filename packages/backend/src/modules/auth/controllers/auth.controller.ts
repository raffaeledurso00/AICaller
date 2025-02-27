import {
    Controller,
    Post,
    Body,
    HttpCode,
    HttpStatus,
  } from '@nestjs/common';
  import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
  import { AuthService } from '../services/auth.service';
  import { LoginDto } from '../dto/login.dto';
  import { RegisterDto } from '../dto/register.dto';
  import { Public } from '../../../common/decorators/public.decorator';
  
  @ApiTags('auth')
  @Controller('auth')
  export class AuthController {
    constructor(private readonly authService: AuthService) {}
  
    @Public()
    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'User login' })
    @ApiResponse({ status: 200, description: 'Login successful' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async login(@Body() loginDto: LoginDto) {
      return this.authService.login(loginDto);
    }
  
    @Public()
    @Post('register')
    @ApiOperation({ summary: 'User registration' })
    @ApiResponse({ status: 201, description: 'User successfully registered' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    async register(@Body() registerDto: RegisterDto) {
      return this.authService.register(registerDto);
    }
  }