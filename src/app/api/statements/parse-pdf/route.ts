import { NextRequest, NextResponse } from 'next/server';
import { extractStatementData } from '@/lib/openai';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ ok: false, error: 'Only PDF files are supported' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const extracted = await extractStatementData(buffer);

    if (!extracted) {
      return NextResponse.json(
        { ok: false, error: 'Failed to extract data from PDF. Ensure OPENAI_API_KEY is set.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, data: extracted });
  } catch (err) {
    console.error('[parse-pdf] error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
