import { pipeline, env } from '@xenova/transformers';
import path from 'path';

// Configure cache to be in project folder to avoid permission issues
env.cacheDir = path.join(process.cwd(), '.cache');

// Singleton instance of the embedder
class Embedder {
    private static instance: any = null;

    static async getInstance() {
        if (this.instance === null) {
            console.log('Loading embedding model...');
            try {
                // Use a smaller model for faster local inference
                this.instance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
                console.log('Embedding model loaded successfully');
            } catch (e) {
                console.error('Failed to load embedding model:', e);
                throw e;
            }
        }
        return this.instance;
    }
}

export async function getEmbedding(text: string): Promise<number[]> {
    const embedder = await Embedder.getInstance();
    const output = await embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
}
