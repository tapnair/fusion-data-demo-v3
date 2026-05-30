import { Faker, en } from '@faker-js/faker'
import type { ComponentInfo } from './fusionClient.js'

export interface ErpMaterial {
  modelId: string
  matnr: string
  maktx: string
  meins: string
  mtart: 'FERT' | 'HALB' | 'ROH'
  werks: string
  mmsta: 'ACTIVE' | 'BLOCKED' | 'OBSOLETE'
  beskz: 'E' | 'F'
  dismm: string
  plifz: number
  eisbe: number
  stprs: number
  waers: string
  bestand: number
  vendor: { lifnr: string; name: string } | null
  lastUpdated: string
}

const PLANTS = ['PL01', 'PL02', 'PL03']
const UOMS = ['EA', 'KG', 'M', 'PC']
const MRP_TYPES = ['PD', 'PD', 'PD', 'PD', 'PD', 'PD', 'PD', 'PD', 'PD', 'M1']
const STATUSES: ErpMaterial['mmsta'][] = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'BLOCKED']
const MTARTS: ErpMaterial['mtart'][] = [
  'FERT', 'FERT', 'FERT', 'FERT', 'FERT', 'FERT', 'FERT',
  'HALB', 'HALB',
  'ROH',
]

function hashSeed(modelId: string): number {
  let h = 2166136261
  for (let i = 0; i < modelId.length; i++) {
    h = Math.imul(h ^ modelId.charCodeAt(i), 16777619)
  }
  return h >>> 0
}

function pad7(n: number): string {
  return n.toString().padStart(7, '0')
}

function fmt2(n: number): number {
  return Math.round(n * 100) / 100
}

export function generateErpData(component: ComponentInfo): ErpMaterial {
  const seed = hashSeed(component.modelId)
  const faker = new Faker({ locale: [en] })
  faker.seed(seed)

  const matnr =
    component.partNumber?.replace(/\s+/g, '') || pad7(faker.number.int({ min: 1000000, max: 9999999 }))
  const maktx = (component.description || component.name || 'UNNAMED COMPONENT').toUpperCase()
  const mtart = faker.helpers.arrayElement(MTARTS)
  const beskz: 'E' | 'F' = faker.number.int({ min: 0, max: 1 }) === 0 ? 'E' : 'F'

  // stprs: log-uniform between $0.50 and $500
  const stprsMin = Math.log(0.5)
  const stprsMax = Math.log(500)
  const stprs = fmt2(Math.exp(stprsMin + faker.number.float({ min: 0, max: 1 }) * (stprsMax - stprsMin)))

  // vendor only for externally-procured (F) items
  const vendor = beskz === 'F'
    ? {
        lifnr: 'V' + pad7(faker.number.int({ min: 100000, max: 999999 })).slice(1),
        name: faker.company.name(),
      }
    : null

  return {
    modelId: component.modelId,
    matnr,
    maktx,
    meins: faker.helpers.arrayElement(UOMS),
    mtart,
    werks: faker.helpers.arrayElement(PLANTS),
    mmsta: faker.helpers.arrayElement(STATUSES),
    beskz,
    dismm: faker.helpers.arrayElement(MRP_TYPES),
    plifz: faker.number.int({ min: 7, max: 42 }),
    eisbe: faker.number.int({ min: 5, max: 100 }),
    stprs,
    waers: 'USD',
    bestand: faker.number.int({ min: 0, max: 500 }),
    vendor,
    lastUpdated: new Date().toISOString(),
  }
}
