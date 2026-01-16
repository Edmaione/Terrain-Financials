import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const { data: categories, error } = await supabaseAdmin
      .from('categories')
      .select('id, name, parent_id, type, section, sort_order')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[API] Categories fetch error:', error);
      return NextResponse.json(
        {
          ok: false,
          error: 'Failed to fetch categories',
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: categories || [],
    });
  } catch (error) {
    console.error('[API] Categories error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, parent_id, type, section, sort_order } = body ?? {};

    if (!name || !type) {
      return NextResponse.json(
        { ok: false, error: 'Name and type are required.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('categories')
      .insert({
        name,
        parent_id: parent_id || null,
        type,
        section: section || null,
        sort_order: sort_order ?? 0,
      })
      .select('id, name, parent_id, type, section, sort_order')
      .single();

    if (error) {
      console.error('[API] Category create error:', error);
      return NextResponse.json(
        { ok: false, error: 'Failed to create category', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error('[API] Category create error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
