import { describe, expect, it } from 'vitest'
import { transformImportRows } from '@/lib/import-transform'
import { AmountStrategy, ImportFieldMapping } from '@/types'

describe('transformImportRows', () => {
  it('maps signed amounts and resolves description fallback', () => {
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
      category: null,
      status: null,
    }

    const result = transformImportRows({
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

  it('computes inflow/outflow amount strategy', () => {
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
      category: null,
      status: null,
    }

    const result = transformImportRows({
      rows,
      mapping,
      amountStrategy: 'inflow_outflow' as AmountStrategy,
    })

    expect(result.errors).toHaveLength(0)
    expect(result.transactions[0].amount).toBe(200)
  })

  it('falls back description to memo, reference, then payee', () => {
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
      category: null,
      status: null,
    }

    const result = transformImportRows({
      rows,
      mapping,
      amountStrategy: 'signed' as AmountStrategy,
    })

    expect(result.transactions[0].description).toBe('INV-4')
    expect(result.transactions[0].payee).toBe('Fallback Vendor')
  })
})
