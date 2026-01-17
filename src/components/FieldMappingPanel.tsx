'use client'

import AlertBanner from '@/components/AlertBanner'
import { Select } from '@/components/ui/Select'
import { AmountStrategy, ImportFieldMapping } from '@/types'

type PreviewErrorSummary = {
  errorRate: number
  dateErrors: number
  amountErrors: number
  total: number
}

export default function FieldMappingPanel({
  headers,
  mapping,
  amountStrategy,
  mappingValidationErrors,
  previewErrorSummary,
  mappingLoading,
  saveTemplate,
  mappingName,
  onMappingChange,
  onAmountStrategyChange,
  onSaveTemplateChange,
  onMappingNameChange,
}: {
  headers: string[]
  mapping: ImportFieldMapping
  amountStrategy: AmountStrategy
  mappingValidationErrors: string[]
  previewErrorSummary: PreviewErrorSummary | null
  mappingLoading: boolean
  saveTemplate: boolean
  mappingName: string
  onMappingChange: (field: keyof ImportFieldMapping, value: string) => void
  onAmountStrategyChange: (value: AmountStrategy) => void
  onSaveTemplateChange: (value: boolean) => void
  onMappingNameChange: (value: string) => void
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Field mapping</h3>
          <p className="text-xs text-slate-500">
            Match the CSV columns to Terrain transaction fields.
          </p>
        </div>
        {mappingLoading && (
          <span className="text-xs text-slate-400">Loading saved mapping…</span>
        )}
      </div>

      {mappingValidationErrors.length > 0 && (
        <AlertBanner
          variant="error"
          title="Mapping required"
          message={mappingValidationErrors.join(' ')}
        />
      )}

      {previewErrorSummary && (
        <AlertBanner
          variant="info"
          title="Parsing warning"
          message={`We could not parse ${previewErrorSummary.total} rows (${Math.round(
            previewErrorSummary.errorRate * 100
          )}%). Check ${previewErrorSummary.dateErrors} date and ${previewErrorSummary.amountErrors} amount values.`}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Date (required)
          </label>
          <Select
            value={mapping.date ?? ''}
            onChange={(event) => onMappingChange('date', event.target.value)}
            className="mt-2 w-full"
          >
            <option value="">Select column</option>
            {headers.map((header) => (
              <option key={`date-${header}`} value={header}>
                {header}
              </option>
            ))}
          </Select>
        </div>

        {amountStrategy === 'signed' ? (
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Amount (required)
            </label>
            <Select
              value={mapping.amount ?? ''}
              onChange={(event) => onMappingChange('amount', event.target.value)}
              className="mt-2 w-full"
            >
              <option value="">Select column</option>
              {headers.map((header) => (
                <option key={`amount-${header}`} value={header}>
                  {header}
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Inflow (required)
              </label>
              <Select
                value={mapping.inflow ?? ''}
                onChange={(event) => onMappingChange('inflow', event.target.value)}
                className="mt-2 w-full"
              >
                <option value="">Select column</option>
                {headers.map((header) => (
                  <option key={`inflow-${header}`} value={header}>
                    {header}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Outflow (required)
              </label>
              <Select
                value={mapping.outflow ?? ''}
                onChange={(event) => onMappingChange('outflow', event.target.value)}
                className="mt-2 w-full"
              >
                <option value="">Select column</option>
                {headers.map((header) => (
                  <option key={`outflow-${header}`} value={header}>
                    {header}
                  </option>
                ))}
              </Select>
            </div>
          </>
        )}

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Payee
          </label>
          <Select
            value={mapping.payee ?? ''}
            onChange={(event) => onMappingChange('payee', event.target.value)}
            className="mt-2 w-full"
          >
            <option value="">Select column</option>
            {headers.map((header) => (
              <option key={`payee-${header}`} value={header}>
                {header}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Description
          </label>
          <Select
            value={mapping.description ?? ''}
            onChange={(event) => onMappingChange('description', event.target.value)}
            className="mt-2 w-full"
          >
            <option value="">Select column</option>
            {headers.map((header) => (
              <option key={`description-${header}`} value={header}>
                {header}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Memo
          </label>
          <Select
            value={mapping.memo ?? ''}
            onChange={(event) => onMappingChange('memo', event.target.value)}
            className="mt-2 w-full"
          >
            <option value="">Select column</option>
            {headers.map((header) => (
              <option key={`memo-${header}`} value={header}>
                {header}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Reference
          </label>
          <Select
            value={mapping.reference ?? ''}
            onChange={(event) => onMappingChange('reference', event.target.value)}
            className="mt-2 w-full"
          >
            <option value="">Select column</option>
            {headers.map((header) => (
              <option key={`reference-${header}`} value={header}>
                {header}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Amount strategy
          </label>
          <Select
            value={amountStrategy}
            onChange={(event) => onAmountStrategyChange(event.target.value as AmountStrategy)}
            className="mt-2 w-full"
          >
            <option value="signed">Signed amount</option>
            <option value="inflow_outflow">Inflow / Outflow</option>
          </Select>
          <p className="mt-2 text-xs text-slate-500">
            Signed amount expects negatives for debits. Inflow/outflow will subtract outflow
            from inflow.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
              checked={saveTemplate}
              onChange={(event) => onSaveTemplateChange(event.target.checked)}
            />
            <span>
              Save mapping as template
              <span className="block text-xs text-slate-500">
                Reuse this mapping the next time these headers appear.
              </span>
            </span>
          </label>
          {saveTemplate && (
            <div className="mt-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Template name
              </label>
              <input
                type="text"
                value={mappingName}
                onChange={(event) => onMappingNameChange(event.target.value)}
                placeholder="e.g. Chase business checking"
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
