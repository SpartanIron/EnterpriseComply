import { Injectable } from '@nestjs/common';
import { db } from '@workspace/db';
import { sql } from 'drizzle-orm';

@Injectable()
export class AssetsService {
  async getAssets(orgId: number) {
    const result = await db.execute(sql`SELECT * FROM assets WHERE org_id = ${orgId} ORDER BY created_at DESC`);
    return (result.rows ?? result).map((row: any) => this.mapRow(row));
  }

  async createAsset(orgId: number, dto: any) {
    const result = await db.execute(sql`
      INSERT INTO assets (org_id, name, type, environment, owner, data_classification, scoping_tag, description, ip_address, vendor, data_flows)
      VALUES (${orgId}, ${dto.name}, ${dto.type || 'Server'}, ${dto.environment || 'Production'}, ${dto.owner || null},
              ${dto.dataClassification || 'Confidential'}, ${dto.scopingTag || 'In-Scope'}, ${dto.description || null},
              ${dto.ipAddress || null}, ${dto.vendor || null}, ${dto.dataFlows || null})
      RETURNING *
    `);
    const rows = result.rows ?? result;
    return this.mapRow(rows[0]);
  }

  async updateAsset(orgId: number, assetId: number, dto: any) {
    const result = await db.execute(sql`
      UPDATE assets SET
        name = ${dto.name}, type = ${dto.type}, environment = ${dto.environment},
        owner = ${dto.owner || null}, data_classification = ${dto.dataClassification},
        scoping_tag = ${dto.scopingTag}, description = ${dto.description || null},
        ip_address = ${dto.ipAddress || null}, vendor = ${dto.vendor || null},
        data_flows = ${dto.dataFlows || null}, updated_at = NOW()
      WHERE org_id = ${orgId} AND id = ${assetId}
      RETURNING *
    `);
    const rows = result.rows ?? result;
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async deleteAsset(orgId: number, assetId: number) {
    await db.execute(sql`DELETE FROM assets WHERE org_id = ${orgId} AND id = ${assetId}`);
  }

  private mapRow(row: any) {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      environment: row.environment,
      owner: row.owner,
      dataClassification: row.data_classification,
      scopingTag: row.scoping_tag,
      description: row.description,
      ipAddress: row.ip_address,
      vendor: row.vendor,
      dataFlows: row.data_flows,
      createdAt: row.created_at,
    };
  }
}
