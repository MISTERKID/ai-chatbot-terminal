import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@xenova/transformers', 'pdf2json', 'onnxruntime-node'],
};

export default nextConfig;
