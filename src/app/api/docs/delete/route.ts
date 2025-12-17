import { NextRequest, NextResponse } from 'next/server';
import { HybridVectorStore } from '@/lib/vector-store';

export async function DELETE(req: NextRequest) {
    try {
        const { id, mode } = await req.json();

        if (!id || !mode) {
            return NextResponse.json({ error: 'Missing id or mode' }, { status: 400 });
        }

        const store = HybridVectorStore.getInstance();
        await store.delete(id, mode);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
    }
}
