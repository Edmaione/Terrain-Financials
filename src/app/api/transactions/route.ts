import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createRuleFromApproval } from '@/lib/categorization-engine'

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, category_id, subcategory_id, reviewed } = body
    
    if (!id) {
      return NextResponse.json(
        { error: 'Transaction ID required' },
        { status: 400 }
      )
    }
    
    // Get the transaction to create a rule from it
    const { data: transaction } = await supabaseAdmin
      .from('transactions')
      .select('payee, description')
      .eq('id', id)
      .single()
    
    // Update the transaction
    const { error } = await supabaseAdmin
      .from('transactions')
      .update({
        category_id: category_id || null,
        subcategory_id: subcategory_id || null,
        reviewed: reviewed ?? true,
      })
      .eq('id', id)
    
    if (error) {
      throw error
    }
    
    // If approved, create a rule for future transactions
    if (reviewed && category_id && transaction) {
      await createRuleFromApproval(
        transaction.payee,
        transaction.description,
        category_id,
        subcategory_id
      )
    }
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Transaction update error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Update failed' },
      { status: 500 }
    )
  }
}
