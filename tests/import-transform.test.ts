import { describe, expect, it } from 'vitest'
import { transformImportRows } from '@/lib/import-transform'
import { AmountStrategy, ImportFieldMapping } from '@/types'

describe('transformImportRows', () => {
  it('maps signed amounts and resolves description fallback', async () => {
    const rows = [
      {
        Date: '01/02/2024',
        Amount: '-42.50',
        Payee: 'Acme Supplies',
        Memo: 'Office chairs',
      },
    ]

    const mapping: ImportFieldMapping = {
      date: 'Date',
      amount: 'Amount',
      inflow: null,
      outflow: null,
      payee: 'Payee',
      description: null,
      memo: 'Memo',
      reference: null,
      category_name: null,
      status: null,
    }

    const result = await transformImportRows({
      rows,
      mapping,
      amountStrategy: 'signed' as AmountStrategy,
    })

    expect(result.errors).toHaveLength(0)
    expect(result.transactions[0]).toMatchObject({
      date: '2024-01-02',
      payee: 'Acme Supplies',
      description: 'Office chairs',
      amount: -42.5,
    })
  })

  it('computes inflow/outflow amount strategy', async () => {
    const rows = [
      {
        Date: '2024-03-10',
        Inflow: '250.00',
        Outflow: '50.00',
        Payee: 'Deposit',
      },
    ]

    const mapping: ImportFieldMapping = {
      date: 'Date',
      amount: null,
      inflow: 'Inflow',
      outflow: 'Outflow',
      payee: 'Payee',
      description: null,
      memo: null,
      reference: null,
      category_name: null,
      status: null,
    }

    const result = await transformImportRows({
      rows,
      mapping,
      amountStrategy: 'inflow_outflow' as AmountStrategy,
    })

    expect(result.errors).toHaveLength(0)
    expect(result.transactions[0].amount).toBe(200)
  })

  it('falls back description to memo, reference, then payee', async () => {
    const rows = [
      {
        Date: '2024-04-01',
        Amount: '15.00',
        Payee: 'Fallback Vendor',
        Reference: 'INV-4',
      },
    ]

    const mapping: ImportFieldMapping = {
      date: 'Date',
      amount: 'Amount',
      inflow: null,
      outflow: null,
      payee: 'Payee',
      description: null,
      memo: null,
      reference: 'Reference',
      category_name: null,
      status: null,
    }

    const result = await transformImportRows({
      rows,
      mapping,
      amountStrategy: 'signed' as AmountStrategy,
    })

    expect(result.transactions[0].description).toBe('INV-4')
    expect(result.transactions[0].payee).toBe('Fallback Vendor')
  })

  it('uses payee as description when only payee is provided', async () => {
    const rows = [
      {
        Date: '2024-05-01',
        Amount: '12.00',
        Payee: 'Corner Store',
      },
    ]

    const mapping: ImportFieldMapping = {
      date: 'Date',
      amount: 'Amount',
      inflow: null,
      outflow: null,
      payee: 'Payee',
      description: null,
      memo: null,
      reference: null,
      category_name: null,
      status: null,
    }

    const result = await transformImportRows({
      rows,
      mapping,
      amountStrategy: 'signed' as AmountStrategy,
    })

    expect(result.transactions[0].description).toBe('Corner Store')
  })

  it('keeps provided description over memo/reference/payee', async () => {
    const rows = [
      {
        Date: '2024-06-01',
        Amount: '25.00',
        Payee: 'Cafe',
        Description: 'Breakfast meeting',
        Memo: 'Team sync',
        Reference: 'REF-99',
      },
    ]

    const mapping: ImportFieldMapping = {
      date: 'Date',
      amount: 'Amount',
      inflow: null,
      outflow: null,
      payee: 'Payee',
      description: 'Description',
      memo: 'Memo',
      reference: 'Reference',
      category_name: null,
      status: null,
    }

    const result = await transformImportRows({
      rows,
      mapping,
      amountStrategy: 'signed' as AmountStrategy,
    })

    expect(result.transactions[0].description).toBe('Breakfast meeting')
  })

  it('defaults reviewed to false and parses dates', async () => {
    const rows = [
      {
        Date: '07/15/2024',
        Amount: '(1,234.50)',
        Payee: 'Sample Vendor',
      },
    ]

    const mapping: ImportFieldMapping = {
      date: 'Date',
      amount: 'Amount',
      inflow: null,
      outflow: null,
      payee: 'Payee',
      description: null,
      memo: null,
      reference: null,
      category_name: null,
      status: null,
    }

    const result = await transformImportRows({
      rows,
      mapping,
      amountStrategy: 'signed' as AmountStrategy,
    })

    expect(result.errors).toHaveLength(0)
    expect(result.transactions[0].date).toBe('2024-07-15')
    expect(result.transactions[0].amount).toBe(-1234.5)
    expect(result.transactions[0].reviewed).toBe(false)
    expect(result.transactions[0].import_row_hash).toHaveLength(64)
  })

  it('applies mapping overrides to use the selected headers', async () => {
    const rows = [
      {
        Posted: '2024-08-01',
        Total: '18.25',
        Merchant: 'Mapped Payee',
      },
    ]

    const mapping: ImportFieldMapping = {
      date: 'Posted',
      amount: 'Total',
      inflow: null,
      outflow: null,
      payee: 'Merchant',
      description: null,
      memo: null,
      reference: null,
      category_name: null,
      status: null,
    }

    const result = await transformImportRows({
      rows,
      mapping,
      amountStrategy: 'signed' as AmountStrategy,
    })

    expect(result.transactions[0].payee).toBe('Mapped Payee')
    expect(result.transactions[0].amount).toBe(18.25)
  })

  it('maps category name and trims empty values to null', async () => {
    const rows = [
      {
        Date: '2024-09-01',
        Amount: '9.99',
        Payee: 'Example Store',
        Category: ' Office Supplies ',
      },
      {
        Date: '2024-09-02',
        Amount: '5.00',
        Payee: 'Blank Category',
        Category: '   ',
      },
    ]

    const mapping: ImportFieldMapping = {
      date: 'Date',
      amount: 'Amount',
      inflow: null,
      outflow: null,
      payee: 'Payee',
      description: null,
      memo: null,
      reference: null,
      category_name: 'Category',
      status: null,
    }

    const result = await transformImportRows({
      rows,
      mapping,
      amountStrategy: 'signed' as AmountStrategy,
    })

    expect(result.transactions[0].category_name).toBe('Office Supplies')
    expect(result.transactions[1].category_name).toBeNull()
  })
})
