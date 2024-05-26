import {
  AllowNull,
  Column,
  DataType,
  HasMany,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript'

import { WasmCodeKeyId } from './WasmCodeKeyId'

@Table({
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['codeKey'],
    },
  ],
})
export class WasmCodeKey extends Model {
  @PrimaryKey
  @Column
  declare codeKey: string

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare description: number

  @HasMany(() => WasmCodeKeyId, 'codeKey')
  declare codeKeyIds: WasmCodeKeyId[]

  create(params: {
    codeKey: string
    description: number
  }): Promise<WasmCodeKey> {
    return WasmCodeKey.create(params)
  }

  async associateCodeKeyIds(codeKeyIds: WasmCodeKeyId[]): Promise<void> {
    await this.$add('codeKeyIds', codeKeyIds)
  }

  static async findByKeyIncludeIds(
    codeKey: string
  ): Promise<WasmCodeKey | null> {
    return WasmCodeKey.findOne({
      where: { codeKey },
      include: WasmCodeKeyId,
    })
  }

  static async findAllWithIds(): Promise<WasmCodeKey[]> {
    return WasmCodeKey.findAll({
      include: WasmCodeKeyId,
    })
  }

  static async createWasmCode(
    codeKey: string,
    codeKeyId: number | number[]
  ): Promise<WasmCodeKey | null> {
    await WasmCodeKey.upsert({ codeKey })
    const arrayCodeKeyId = Array.isArray(codeKeyId) ? codeKeyId : [codeKeyId]

    await Promise.all(
      arrayCodeKeyId.map(async (codeId: number) => {
        await WasmCodeKeyId.upsert({ codeKeyId: codeId, codeKey })
      })
    )
    return WasmCodeKey.findByKeyIncludeIds(codeKey)
  }
}
