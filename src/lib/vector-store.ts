import fs from 'fs/promises';
import path from 'path';

export interface Document {
    id: string;
    text: string;
    embedding: number[];
    metadata: {
        filename: string;
        uploadedAt: number;
        mode: 'temporary' | 'permanent';
    };
}

// Temporary In-Memory Storage
class TemporaryVectorStore {
    private documents: Document[] = [];

    constructor() {
        console.log('TemporaryVectorStore initialized');
    }

    async add(doc: Document) {
        this.documents.push(doc);
        return true;
    }

    async delete(id: string) {
        this.documents = this.documents.filter(d => d.id !== id);
        return true;
    }

    async clear() {
        this.documents = [];
        return true;
    }

    async list() {
        return this.documents;
    }

    async search(queryEmbedding: number[], topK: number = 3) {
        return this.documents
            .map(doc => ({
                ...doc,
                score: this.cosineSimilarity(queryEmbedding, doc.embedding)
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
        const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
        const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
        return dotProduct / (magnitudeA * magnitudeB);
    }
}

// Permanent Storage (JSON File)
const DB_FILE_PATH = path.join(process.cwd(), 'vector-store.json');

class SimpleFileVectorStore {
    private documents: Document[] = [];
    private loaded = false;

    private async load() {
        try {
            const data = await fs.readFile(DB_FILE_PATH, 'utf-8');
            this.documents = JSON.parse(data);
        } catch (e) {
            // File doesn't exist yet
            this.documents = [];
        }
        this.loaded = true;
    }

    private async save() {
        await fs.writeFile(DB_FILE_PATH, JSON.stringify(this.documents, null, 2));
    }

    async add(doc: Document) {
        if (!this.loaded) await this.load();
        this.documents.push(doc);
        await this.save();
        return true;
    }

    async delete(id: string) {
        if (!this.loaded) await this.load();
        this.documents = this.documents.filter(d => d.id !== id);
        await this.save();
        return true;
    }

    async clear() {
        if (!this.loaded) await this.load();
        this.documents = [];
        await this.save();
        this.loaded = false; // Reset to force reload on next operation
        return true;
    }

    async list() {
        if (!this.loaded) await this.load();
        return this.documents;
    }

    async search(queryEmbedding: number[], topK: number = 3) {
        if (!this.loaded) await this.load();
        return this.documents
            .map(doc => ({
                ...doc,
                score: this.cosineSimilarity(queryEmbedding, doc.embedding)
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
        const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
        const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
        return dotProduct / (magnitudeA * magnitudeB);
    }
}

// Hybrid Store
export class HybridVectorStore {
    private temporary: TemporaryVectorStore;
    private permanent: SimpleFileVectorStore;

    // Singleton pattern for the store
    private static instance: HybridVectorStore;

    private constructor() {
        this.temporary = new TemporaryVectorStore();
        this.permanent = new SimpleFileVectorStore();
    }

    static getInstance(): HybridVectorStore {
        if (!HybridVectorStore.instance) {
            HybridVectorStore.instance = new HybridVectorStore();
        }
        return HybridVectorStore.instance;
    }

    async add(doc: Document, mode: 'temporary' | 'permanent') {
        if (mode === 'temporary') {
            return await this.temporary.add(doc);
        } else {
            return await this.permanent.add(doc);
        }
    }

    async delete(id: string, mode: 'temporary' | 'permanent') {
        if (mode === 'temporary') {
            return await this.temporary.delete(id);
        } else {
            return await this.permanent.delete(id);
        }
    }

    async clear(mode: 'temporary' | 'permanent') {
        if (mode === 'temporary') {
            return await this.temporary.clear();
        } else {
            return await this.permanent.clear();
        }
    }

    async list() {
        const tempDocs = await this.temporary.list();
        const permDocs = await this.permanent.list();
        return { temporary: tempDocs, permanent: permDocs };
    }

    async search(queryEmbedding: number[], topK: number = 3) {
        const tempResults = await this.temporary.search(queryEmbedding, topK);
        const permResults = await this.permanent.search(queryEmbedding, topK);

        // Combine and sort
        return [...tempResults, ...permResults]
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
    }
}
