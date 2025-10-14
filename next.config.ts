import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    reactStrictMode: true,
    images: { unoptimized: true },

    webpack: (config, { isServer }) => {
        if (isServer) {
            config.externals = config.externals || [];
            config.externals.push({
                "firebase-functions": "commonjs firebase-functions",
            });
        }
        return config;
    },

    typescript: {
        ignoreBuildErrors: false,
    },

    pageExtensions: ["tsx", "ts", "jsx", "js"],
};

export default nextConfig;
