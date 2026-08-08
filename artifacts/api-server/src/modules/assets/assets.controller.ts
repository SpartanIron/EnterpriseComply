import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { OrgContextGuard, OrgContext } from '../../guards/clerk-auth.guard';
import { RequireRole } from '../../guards/roles.guard';

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller('orgs/:orgId/assets')
@UseGuards(OrgContextGuard)
export class AssetsController {
  constructor(private assetsService: AssetsService) {}

  @Get()
  async getAssets(@OrgContext() ctx: OrgCtx) {
    const assets = await this.assetsService.getAssets(ctx.orgId);
    return { assets };
  }

  @Post()
  @UseGuards(RequireRole('compliance_manager'))
  async createAsset(
    @OrgContext() ctx: OrgCtx,
    @Body() body: any,
  ) {
    const asset = await this.assetsService.createAsset(ctx.orgId, body);
    return { asset };
  }

  @Put(':assetId')
  @UseGuards(RequireRole('compliance_manager'))
  async updateAsset(
    @OrgContext() ctx: OrgCtx,
    @Param('assetId', ParseIntPipe) assetId: number,
    @Body() body: any,
  ) {
    const asset = await this.assetsService.updateAsset(ctx.orgId, assetId, body);
    return { asset };
  }

  @Delete(':assetId')
  @UseGuards(RequireRole('compliance_manager'))
  async deleteAsset(
    @OrgContext() ctx: OrgCtx,
    @Param('assetId', ParseIntPipe) assetId: number,
  ) {
    await this.assetsService.deleteAsset(ctx.orgId, assetId);
    return { success: true };
  }
}
