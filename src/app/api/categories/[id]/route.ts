import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, parent_id, type, section, sort_order } = body ?? {};

    if (!params.id) {
      return NextResponse.json({ ok: false, error: 'Category ID required.' }, { status: 400 });
    }

    if (!name || !type) {
      return NextResponse.json({ ok: false, error: 'Name and type are required.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('categories')
      .update({
        name,
        parent_id: parent_id || null,
        type,
        section: section || null,
        sort_order: sort_order ?? 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select('id, name, parent_id, type, section, sort_order')
      .single();

    if (error) {
      console.error('[API] Category update error:', error);
      return NextResponse.json(
        { ok: false, error: 'Failed to update category', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error('[API] Category update error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    if (!params.id) {
      return NextResponse.json({ ok: false, error: 'Category ID required.' }, { status: 400 });
    }

    const { count, error: countError } = await supabaseAdmin
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .or(`category_id.eq.${params.id},subcategory_id.eq.${params.id}`);

    if (countError) {
      console.error('[API] Category delete count error:', countError);
      return NextResponse.json(
        { ok: false, error: 'Failed to verify category usage', details: countError.message },
        { status: 500 }
      );
    }

    if (count && count > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Category is used by ${count} transaction${count === 1 ? '' : 's'}.`,
          details: { count },
        },
        { status: 409 }
      );
    }

    const { error } = await supabaseAdmin.from('categories').delete().eq('id', params.id);

    if (error) {
      console.error('[API] Category delete error:', error);
      return NextResponse.json(
        { ok: false, error: 'Failed to delete category', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, data: { id: params.id } });
  } catch (error) {
    console.error('[API] Category delete error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
