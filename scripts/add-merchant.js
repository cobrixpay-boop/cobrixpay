const fs = require('fs')
const path = require('path')

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
}

function parseArgs(argv) {
  const args = {}
  let currentKey = null

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      currentKey = arg.slice(2)
      args[currentKey] = true
    } else if (currentKey) {
      args[currentKey] = arg
      currentKey = null
    }
  }

  return args
}

function parseNotificationEmails(value, fallbackEmail) {
  if (!value) {
    return fallbackEmail ? [fallbackEmail] : []
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean)
  }
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function readMerchants(filePath) {
  if (!fs.existsSync(filePath)) {
    return {}
  }
  const raw = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(raw)
}

function writeMerchants(filePath, merchants) {
  fs.writeFileSync(filePath, JSON.stringify(merchants, null, 2), 'utf-8')
}

function main() {
  const args = parseArgs(process.argv)

  const name = args.name || args.n
  const email = args.email || args.e
  const stripeAccountId = args.stripeAccountId || args.stripe || args.accountId
  const notificationEmails = args.notificationEmails || args.notification || args.notify
  const slug = normalizeSlug(args.slug || args.s || name)

  if (!name) {
    console.error('Error: falta el nombre del comercio. Usa --name "Mi Comercio"')
    process.exit(1)
  }

  if (!email) {
    console.error('Error: falta el email del comercio. Usa --email comercio@ejemplo.com')
    process.exit(1)
  }

  if (!slug) {
    console.error('Error: falta el slug o el nombre. Usa --slug mi-comercio o --name "Mi Comercio"')
    process.exit(1)
  }

  if (!stripeAccountId) {
    console.error('Error: falta el Stripe Account ID. Usa --stripeAccountId acct_...')
    process.exit(1)
  }

  const merchantsPath = path.join(process.cwd(), 'data', 'merchants.json')
  const merchants = readMerchants(merchantsPath)

  const parsedNotificationEmails = parseNotificationEmails(notificationEmails, email)

  merchants[slug] = {
    slug,
    name,
    email,
    notificationEmails: parsedNotificationEmails,
    stripeAccountId: stripeAccountId.trim(),
  }

  writeMerchants(merchantsPath, merchants)

  console.log('Comercio creado o actualizado:')
  console.log(JSON.stringify(merchants[slug], null, 2))
  console.log('\nEjemplo de pago: /pay/' + slug)
}

main()
