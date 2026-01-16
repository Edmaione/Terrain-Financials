const fs = require('fs')
const path = require('path')
const Papa = require('papaparse')

const fixturePath = path.join(__dirname, '..', 'fixtures', 'transactions-fixture.csv')
const csvText = fs.readFileSync(fixturePath, 'utf8')

function parseCSVText(text) {
  const results = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
  })

  if (results.errors.length > 0) {
    throw new Error(results.errors[0].message)
  }

  return detectFormatAndParse(results.data)
}

function detectFormatAndParse(rows) {
  if (rows.length === 0) {
    return []
  }

  const firstRow = rows[0]
  const headers = Object.keys(firstRow).map((header) => header.toLowerCase())

  if (headers.includes('payee') && headers.includes('transaction type')) {
    return parseRelayFormat(rows)
  }

  if (headers.includes('posting date') && headers.includes('description')) {
    return parseChaseFormat(rows)
  }

  if (headers.includes('posted date') && headers.includes('payee')) {
    return parseBofAFormat(rows)
  }

  return parseGenericFormat(rows)
}

function parseRelayFormat(rows) {
  return rows.map((row) => {
    const amount = parseAmount(row.Amount)
    const date = parseDate(row.Date)

    return {
      date,
      payee: row.Payee || 'Unknown',
      description: row.Description || row.Reference || '',
      amount,
      reference: row.Reference || '',
      status: (row.Status || 'SETTLED').toUpperCase(),
      account_number: row['Account #'] || undefined,
      balance: row.Balance ? parseFloat(row.Balance) : undefined,
      raw_data: row,
    }
  })
}

function parseChaseFormat(rows) {
  return rows.map((row) => {
    const amount = parseAmount(row.Amount)
    const date = parseDate(row['Posting Date'] || row['Transaction Date'])

    return {
      date,
      payee: row.Description || 'Unknown',
      description: row.Details || row.Memo || '',
      amount,
      reference: row['Check or Slip #'] || '',
      status: 'SETTLED',
      balance: row.Balance ? parseFloat(row.Balance) : undefined,
      raw_data: row,
    }
  })
}

function parseBofAFormat(rows) {
  return rows.map((row) => {
    const date = parseDate(row['Posted Date'])
    const amount = parseAmount(row.Amount)

    return {
      date,
      payee: row.Payee || row.Description || 'Unknown',
      description: row.Address || '',
      amount,
      reference: row['Reference Number'] || '',
      status: 'SETTLED',
      balance: row['Running Balance'] ? parseFloat(row['Running Balance']) : undefined,
      raw_data: row,
    }
  })
}

function parseGenericFormat(rows) {
  const firstRow = rows[0]
  const headers = Object.keys(firstRow).map((header) => header.toLowerCase())

  const dateCol = headers.find((header) =>
    header.includes('date') || header.includes('posted') || header.includes('transaction')
  )

  const amountCol = headers.find((header) =>
    header.includes('amount') || header.includes('debit') || header.includes('credit')
  )

  const descCol = headers.find((header) =>
    header.includes('description') || header.includes('payee') || header.includes('merchant')
  )

  if (!dateCol || !amountCol) {
    throw new Error('Unable to detect required columns (date, amount) in CSV')
  }

  return rows.map((row) => {
    const originalDateCol = Object.keys(firstRow)[headers.indexOf(dateCol)]
    const originalAmountCol = Object.keys(firstRow)[headers.indexOf(amountCol)]
    const originalDescCol = descCol ? Object.keys(firstRow)[headers.indexOf(descCol)] : null

    const date = parseDate(row[originalDateCol])
    const amount = parseAmount(row[originalAmountCol])

    return {
      date,
      payee: originalDescCol ? row[originalDescCol] : 'Unknown',
      description: '',
      amount,
      reference: '',
      status: 'SETTLED',
      raw_data: row,
    }
  })
}

function parseDate(dateStr) {
  if (!dateStr) {
    return new Date().toISOString().split('T')[0]
  }

  const date = new Date(dateStr)

  if (Number.isNaN(date.getTime())) {
    const parts = dateStr.split('/')
    if (parts.length === 3) {
      const [month, day, year] = parts
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }
    throw new Error(`Unable to parse date: ${dateStr}`)
  }

  return date.toISOString().split('T')[0]
}

function parseAmount(amountStr) {
  if (!amountStr) return 0

  let cleaned = amountStr.replace(/[$,\s]/g, '')

  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = `-${cleaned.slice(1, -1)}`
  }

  const amount = parseFloat(cleaned)

  if (Number.isNaN(amount)) {
    console.warn(`Unable to parse amount: ${amountStr}, defaulting to 0`)
    return 0
  }

  return amount
}

const transactions = parseCSVText(csvText)

console.log('Parsed transactions:')
console.table(transactions)

const insertPayload = transactions.map((transaction) => ({
  account_id: 'REPLACE_WITH_ACCOUNT_ID',
  date: transaction.date,
  payee: transaction.payee,
  description: transaction.description || null,
  amount: transaction.amount,
  reference: transaction.reference || null,
  status: transaction.status || 'SETTLED',
  is_transfer: false,
  ai_suggested_category: null,
  ai_confidence: 0,
  reviewed: false,
  raw_csv_data: transaction.raw_data,
}))

console.log('Insert payload preview:')
console.dir(insertPayload, { depth: null })
