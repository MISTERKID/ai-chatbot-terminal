import { NextResponse } from 'next/server';
import { HybridVectorStore } from '@/lib/vector-store';

export async function GET() {
    const store = HybridVectorStore.getInstance();
    const docs = await store.list();

    console.log('Listing docs:', {
        tempCount: docs.temporary.length,
        permCount: docs.permanent.length,
        temp: docs.temporary,
        perm: docs.permanent
    });

    const simplify = (list: any[]) => list.map(d => ({
        id: d.id,
        filename: d.metadata.filename,
        mode: d.metadata.mode,
        uploadedAt: d.metadata.uploadedAt
    }));

    return NextResponse.json({
        temporary: simplify(docs.temporary),
        permanent: simplify(docs.permanent)
    });
}
