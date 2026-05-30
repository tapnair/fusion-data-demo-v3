import { MongoClient } from 'mongodb'
import type { ErpMaterial } from './fakeData.js'

export interface SeedResult {
  upserted: number
  modified: number
  matched: number
}

export async function upsertMaterials(
  connectionString: string,
  dbName: string,
  collName: string,
  materials: ErpMaterial[]
): Promise<SeedResult> {
  const client = new MongoClient(connectionString)
  try {
    await client.connect()
    const coll = client.db(dbName).collection<ErpMaterial>(collName)
    const ops = materials.map((m) => ({
      updateOne: {
        filter: { modelId: m.modelId },
        update: { $set: m },
        upsert: true,
      },
    }))
    if (ops.length === 0) return { upserted: 0, modified: 0, matched: 0 }
    const res = await coll.bulkWrite(ops, { ordered: false })
    return {
      upserted: res.upsertedCount,
      modified: res.modifiedCount,
      matched: res.matchedCount,
    }
  } finally {
    await client.close()
  }
}

export async function clearAll(
  connectionString: string,
  dbName: string,
  collName: string
): Promise<number> {
  const client = new MongoClient(connectionString)
  try {
    await client.connect()
    const coll = client.db(dbName).collection(collName)
    const res = await coll.deleteMany({})
    return res.deletedCount
  } finally {
    await client.close()
  }
}
