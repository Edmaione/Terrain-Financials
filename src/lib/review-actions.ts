import { supabaseAdmin } from '@/lib/supabase/admin'

export async function recordReviewAction({
  transactionId,
  action,
  before,
  after,
  actor,
}: {
  transactionId: string
  action: 'approve' | 'reclass'
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  actor?: string | null
}) {
  const { error } = await supabaseAdmin.from('review_actions').insert({
    transaction_id: transactionId,
    action,
    before_json: before ?? null,
    after_json: after ?? null,
    actor: actor ?? null,
  })

  if (error) {
    console.warn('[review-actions] Failed to record review action', error)
  }
}
