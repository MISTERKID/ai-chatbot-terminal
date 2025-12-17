import { NextRequest, NextResponse } from 'next/server';
import { getEmbedding } from '@/lib/embeddings';
import { HybridVectorStore } from '@/lib/vector-store';
import PDFParser from 'pdf2json';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    console.log('Upload API called');
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const mode = formData.get('mode') as 'temporary' | 'permanent' || 'temporary';

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        let text = '';

        console.log(`Processing file: ${file.name}, type: ${file.type}, size: ${file.size}`);

        try {
            if (file.type === 'application/pdf') {
                console.log('Parsing PDF...');
                const arrayBuffer = await file.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);

                const pdfParser = new PDFParser();

                text = await new Promise((resolve, reject) => {
                    pdfParser.on('pdfParser_dataError', (errData: any) => reject(errData.parserError));
                    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
                        const textParts: string[] = [];
                        if (pdfData.Pages) {
                            pdfData.Pages.forEach((page: any) => {
                                if (page.Texts) {
                                    page.Texts.forEach((text: any) => {
                                        if (text.R) {
                                            text.R.forEach((r: any) => {
                                                if (r.T) {
                                                    textParts.push(decodeURIComponent(r.T));
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                        resolve(textParts.join(' '));
                    });
                    pdfParser.parseBuffer(buffer);
                });

                console.log('PDF parsed successfully, text length:', text.length);
            } else {
                console.log('Extracting text...');
                text = await file.text();
            }
        } catch (e: any) {
            console.error('Text extraction error details:', {
                message: e.message,
                stack: e.stack,
                name: e.name
            });
            return NextResponse.json({ error: `Failed to extract text: ${e.message}` }, { status: 500 });
        }

        if (!text || !text.trim()) {
            return NextResponse.json({ error: 'File is empty or text could not be extracted' }, { status: 400 });
        }

        const embedding = await getEmbedding(text);
        const store = HybridVectorStore.getInstance();
        const docId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();

        await store.add({
            id: docId,
            text,
            embedding,
            metadata: {
                filename: file.name,
                uploadedAt: Date.now(),
                mode
            }
        }, mode);

        console.log(`Document stored: ${docId} in ${mode} mode`);

        return NextResponse.json({
            success: true,
            id: docId,
            message: `Uploaded to ${mode} storage`
        });

    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
    }
}
