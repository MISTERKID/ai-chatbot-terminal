import { NextRequest, NextResponse } from 'next/server';
import { HybridVectorStore } from '@/lib/vector-store';

export async function DELETE(req: NextRequest) {
    try {
        const { mode } = await req.json();
        const store = HybridVectorStore.getInstance();

        if (mode === 'all') {
            await store.clear('temporary');
            await store.clear('permanent');
        } else {
            await store.clear(mode);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Clear API error:', error);
        return NextResponse.json({ error: 'Clear failed', details: String(error) }, { status: 500 });
    }
}
