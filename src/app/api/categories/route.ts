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
