import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import FieldMappingPanel from '@/components/FieldMappingPanel'
import { ImportFieldMapping } from '@/types'

describe('FieldMappingPanel', () => {
  it('renders mapping controls for provided headers', () => {
    const headers = ['Date', 'Amount', 'Payee']
    const mapping: ImportFieldMapping = {
      date: 'Date',
      amount: 'Amount',
      inflow: null,
      outflow: null,
      payee: 'Payee',
      description: null,
      memo: null,
      reference: null,
      category: null,
      status: null,
    }

    const html = renderToString(
      <FieldMappingPanel
        headers={headers}
        mapping={mapping}
        amountStrategy="signed"
        mappingValidationErrors={[]}
        previewErrorSummary={null}
        mappingLoading={false}
        saveTemplate={false}
        mappingName=""
        onMappingChange={() => undefined}
        onAmountStrategyChange={() => undefined}
        onSaveTemplateChange={() => undefined}
        onMappingNameChange={() => undefined}
      />
    )

    expect(html).toContain('Field mapping')
    expect(html).toContain('Amount strategy')
  })
})
