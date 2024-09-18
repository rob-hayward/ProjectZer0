import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Put,
  Delete,
} from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  async findOrCreateUser(@Body() userData: { auth0Id: string; email: string }) {
    return this.usersService.findOrCreateUser(userData.auth0Id, userData.email);
  }

  @Get()
  async getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @Get(':auth0Id')
  async getUser(@Param('auth0Id') auth0Id: string) {
    return this.usersService.getUserByAuth0Id(auth0Id);
  }

  @Put(':auth0Id')
  async updateUser(@Param('auth0Id') auth0Id: string, @Body() updateData: any) {
    return this.usersService.updateUser(auth0Id, updateData);
  }

  @Delete(':auth0Id')
  async deleteUser(@Param('auth0Id') auth0Id: string) {
    return this.usersService.deleteUser(auth0Id);
  }

  @Get('test')
  async testDbConnection() {
    return this.usersService.testConnection();
  }
}
