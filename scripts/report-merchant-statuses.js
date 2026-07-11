/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs')
const path = require('path')

const OFFICIAL_STATUSES = new Set([
  'pending_documents',
  'under_review',
  'active',
  'suspended',
  'rejected',
])

function readMerchants() {
  const merchantsPath = path.join(process.cwd(), 'data', 'merchants.json')

  if (!fs.existsSync(merchantsPath)) {
    return {}
  }

  return JSON.parse(fs.readFileSync(merchantsPath, 'utf-8') || '{}')
}

function normalizeSlug(value) {
  return String(value || '').trim().toLowerCase()
}

const merchants = readMerchants()
const rows = Object.entries(merchants).map(([key, merchant]) => {
  const currentStatus = typeof merchant.status === 'string' && merchant.status ? merchant.status : '(sin estado)'

  return {
    slug: normalizeSlug(merchant.slug || key),
    name: merchant.name || merchant.slug || key,
    currentStatus,
    proposedStatus: OFFICIAL_STATUSES.has(currentStatus) ? currentStatus : 'requiere decision manual',
  }
})

if (rows.length === 0) {
  console.log('No hay comercios existentes en data/merchants.json.')
} else {
  console.table(rows)
}
