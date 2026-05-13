import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../lib/database.service';

@Injectable()
export class AssetsService {
  constructor(private db: DatabaseService) {}

  async getAssets(orgId: number) {
    const result = await this.db.pool.query(
      `SELECT * FROM assets WHERE org_id = $1 ORDER BY created_at DESC`,
      [orgId]
    );
    return result.rows.map(this.mapRow);
  }

  async createAsset(orgId: number, dto: any) {
    const result = await this.db.pool.query(
      `INSERT INTO assets (org_id, name, type, environment, owner, data_classification, scoping_tag, description, ip_address, vendor, data_flows)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [orgId, dto.name, dto.type, dto.environment, dto.owner, dto.dataClassification, dto.scopingTag, dto.description, dto.ipAddress || null, dto.vendor || null, dto.dataFlows || null]
    );
    return this.mapRow(result.rows[0]);
  }

  async updateAsset(orgId: number, assetId: number, dto: any) {
    const result = await this.db.pool.query(
      `UPDATE assets SET name=$3, type=$4, environment=$5, owner=$6, data_classification=$7, scoping_tag=$8, description=$9, ip_address=$10, vendor=$11, data_flows=$12
       WHERE org_id=$1 AND id=$2 RETURNING *`,
      [orgId, assetId, dto.name, dto.type, dto.environment, dto.owner, dto.dataClassification, dto.scopingTag, dto.description, dto.ipAddress || null, dto.vendor || null, dto.dataFlows || null]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async deleteAsset(orgId: number, assetId: number) {
    await this.db.pool.query(`DELETE FROM assets WHERE org_id=$1 AND id=$2`, [orgId, assetId]);
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
