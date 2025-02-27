import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
  } from '@nestjs/common';
  import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
  import { UsersService } from '../services/users.service';
  import { CreateUserDto } from '../dto/create-user.dto';
  import { UpdateUserDto } from '../dto/update-user.dto';
  import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
  import { RolesGuard } from '../../auth/guards/roles.guard';
  import { Roles } from '../../../common/decorators/roles.decorator';
  import { Role } from '../../../common/enums/role.enum';
  
  @ApiTags('users')
  @Controller('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  export class UsersController {
    constructor(private readonly usersService: UsersService) {}
  
    @Post()
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Create a new user' })
    @ApiResponse({ status: 201, description: 'The user has been successfully created.' })
    @ApiResponse({ status: 400, description: 'Bad Request.' })
    create(@Body() createUserDto: CreateUserDto) {
      return this.usersService.create(createUserDto);
    }
  
    @Get()
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Get all users' })
    @ApiResponse({ status: 200, description: 'Return all users.' })
    findAll() {
      return this.usersService.findAll();
    }
  
    @Get(':id')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Get a user by id' })
    @ApiResponse({ status: 200, description: 'Return the user.' })
    @ApiResponse({ status: 404, description: 'User not found.' })
    findOne(@Param('id') id: string) {
      return this.usersService.findOne(id);
    }
  
    @Patch(':id')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Update a user' })
    @ApiResponse({ status: 200, description: 'The user has been successfully updated.' })
    @ApiResponse({ status: 404, description: 'User not found.' })
    update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
      return this.usersService.update(id, updateUserDto);
    }
  
    @Delete(':id')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Delete a user' })
    @ApiResponse({ status: 200, description: 'The user has been successfully deleted.' })
    @ApiResponse({ status: 404, description: 'User not found.' })
    remove(@Param('id') id: string) {
      return this.usersService.remove(id);
    }
  }