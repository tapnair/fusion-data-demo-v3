import 'dotenv/config'
import { Command } from 'commander'
import {
  createFusionClient,
  fetchRootComponent,
  fetchAllSubcomponents,
  type ComponentInfo,
} from './fusionClient.js'
import { generateErpData } from './fakeData.js'
import { upsertMaterials, clearAll } from './mongoWriter.js'

function envOrExit(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`Missing required env var: ${name}`)
    process.exit(1)
  }
  return v
}

const program = new Command()
program
  .name('seed-erp')
  .description('Seed mock SAP-like material-master data into MongoDB Atlas')
  .version('0.1.0')

program
  .command('seed')
  .description('Walk a Fusion assembly and upsert one ERP record per unique sub-model')
  .requiredOption('--modelId <id>', 'root model ID to walk (base64 modelId from the viewer)')
  .option('--depth <n>', 'max walk depth', '50')
  .option('--dry-run', 'fetch + generate but skip Mongo writes', false)
  .action(async (opts) => {
    const token = envOrExit('APS_ACCESS_TOKEN')
    const endpoint = envOrExit('GRAPHQL_ENDPOINT')
    const mongoUri = envOrExit('MONGO_CONNECTION_STRING')
    const dbName = process.env.MONGO_DB ?? 'fusion_erp_demo'
    const collName = process.env.MONGO_COLLECTION ?? 'materials'

    const client = createFusionClient(endpoint, token)

    console.log(`Fetching root model ${opts.modelId} ...`)
    const root = await fetchRootComponent(client, opts.modelId)
    if (!root) {
      console.error('Root model not found or no component associated.')
      process.exit(1)
    }
    console.log(`  root: ${root.name} (component ${root.componentId})`)

    console.log(`Walking unique sub-models (depth=${opts.depth}) ...`)
    const subs = await fetchAllSubcomponents(client, opts.modelId, Number(opts.depth))
    console.log(`  found ${subs.length} unique sub-models`)

    const allComponents: ComponentInfo[] = [root, ...subs]
    const materials = allComponents.map(generateErpData)

    console.log(`Generated ${materials.length} ERP records.`)
    if (opts.dryRun) {
      console.log('\nDry run — first record:')
      console.log(JSON.stringify(materials[0], null, 2))
      console.log(`\n(${materials.length - 1} more not shown)`)
      return
    }

    console.log(`Writing to ${dbName}.${collName} ...`)
    const res = await upsertMaterials(mongoUri, dbName, collName, materials)
    console.log(`  upserted ${res.upserted}, modified ${res.modified}, matched ${res.matched}`)
    console.log('Done.')
  })

program
  .command('clear')
  .description('Delete every document in the materials collection')
  .option('--yes', 'skip confirmation prompt', false)
  .action(async (opts) => {
    const mongoUri = envOrExit('MONGO_CONNECTION_STRING')
    const dbName = process.env.MONGO_DB ?? 'fusion_erp_demo'
    const collName = process.env.MONGO_COLLECTION ?? 'materials'

    if (!opts.yes) {
      console.error(`Refusing to clear without --yes. This will delete every document in ${dbName}.${collName}.`)
      process.exit(1)
    }

    console.log(`Clearing ${dbName}.${collName} ...`)
    const n = await clearAll(mongoUri, dbName, collName)
    console.log(`  deleted ${n} documents`)
  })

program.parse()
