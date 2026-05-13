import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';

@Controller('orgs/:orgId/assets')
@UseGuards(ClerkAuthGuard)
export class AssetsController {
  constructor(private assetsService: AssetsService) {}

  @Get()
  async getAssets(@Param('orgId', ParseIntPipe) orgId: number) {
    const assets = await this.assetsService.getAssets(orgId);
    return { assets };
  }

  @Post()
  async createAsset(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Body() body: any,
  ) {
    const asset = await this.assetsService.createAsset(orgId, body);
    return { asset };
  }

  @Put(':assetId')
  async updateAsset(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('assetId', ParseIntPipe) assetId: number,
    @Body() body: any,
  ) {
    const asset = await this.assetsService.updateAsset(orgId, assetId, body);
    return { asset };
  }

  @Delete(':assetId')
  async deleteAsset(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('assetId', ParseIntPipe) assetId: number,
  ) {
    await this.assetsService.deleteAsset(orgId, assetId);
    return { success: true };
  }
}
