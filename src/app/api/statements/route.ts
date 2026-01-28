import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ensureStorageBucket } from '@/lib/reconciliation';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account_id');
    const year = searchParams.get('year');

    let query = supabaseAdmin
      .from('bank_statements')
      .select('*, account:accounts(id, name)')
      .order('period_end', { ascending: false });

    if (accountId) query = query.eq('account_id', accountId);
    if (year) {
      query = query.gte('period_end', `${year}-01-01`).lte('period_start', `${year}-12-31`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ ok: true, data: data || [] });
  } catch (error) {
    console.error('[API] statements GET error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const accountId = formData.get('account_id') as string;
    const periodStart = formData.get('period_start') as string;
    const periodEnd = formData.get('period_end') as string;
    const endingBalance = formData.get('ending_balance') as string;
    const beginningBalance = formData.get('beginning_balance') as string | null;
    const notes = formData.get('notes') as string | null;
    const file = formData.get('file') as File | null;

    if (!accountId || !periodStart || !periodEnd || !endingBalance) {
      return NextResponse.json(
        { ok: false, error: 'account_id, period_start, period_end, and ending_balance are required.' },
        { status: 400 }
      );
    }

    let fileUrl: string | null = null;
    let fileName: string | null = null;
    let fileType: string | null = null;
    let fileSize: number | null = null;

    if (file && file.size > 0) {
      await ensureStorageBucket();
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const periodLabel = periodStart.substring(0, 7);
      const path = `${accountId}/${periodLabel}_${Date.now()}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error: uploadError } = await supabaseAdmin.storage
        .from('bank-statements')
        .upload(path, buffer, { contentType: file.type, upsert: false });
      if (uploadError) throw new Error(`File upload failed: ${uploadError.message}`);
      const { data: urlData } = supabaseAdmin.storage.from('bank-statements').getPublicUrl(path);
      fileUrl = urlData.publicUrl;
      fileName = file.name;
      fileType = ext;
      fileSize = file.size;
    }

    const { data, error } = await supabaseAdmin
      .from('bank_statements')
      .insert({
        account_id: accountId,
        period_start: periodStart,
        period_end: periodEnd,
        ending_balance: parseFloat(endingBalance),
        beginning_balance: beginningBalance ? parseFloat(beginningBalance) : null,
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        notes: notes || null,
        status: 'pending',
      })
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error) {
    console.error('[API] statements POST error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
