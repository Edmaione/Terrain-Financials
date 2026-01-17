export type ExistingTransactionRef = {
  id: string
  source?: string | null
  source_id?: string | null
  source_hash?: string | null
}

export type IncomingTransactionRef = {
  source: string
  source_id?: string | null
  source_hash: string
}

export type PreparedCsvTransaction<TPayload = Record<string, unknown>> = {
  transaction: TPayload & IncomingTransactionRef
  splits: Array<Record<string, unknown>>
}

export function findExistingTransaction(
  existing: ExistingTransactionRef[],
  incoming: IncomingTransactionRef
) {
  if (incoming.source_id) {
    return (
      existing.find(
        (item) => item.source === incoming.source && item.source_id === incoming.source_id
      ) ?? null
    )
  }

  return (
    existing.find(
      (item) => item.source === incoming.source && item.source_hash === incoming.source_hash
    ) ?? null
  )
}

export function planCsvImport<TPayload = Record<string, unknown>>(
  incoming: PreparedCsvTransaction<TPayload>[],
  existing: ExistingTransactionRef[]
) {
  const inserts: PreparedCsvTransaction<TPayload>[] = []
  const updates: Array<PreparedCsvTransaction<TPayload> & { id: string }> = []

  incoming.forEach((item) => {
    const match = findExistingTransaction(existing, item.transaction)
    if (match?.id) {
      updates.push({ ...item, id: match.id })
    } else {
      inserts.push(item)
    }
  })

  return { inserts, updates }
}
