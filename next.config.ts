import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
    swSrc: "src/app/sw.ts",
    swDest: "public/sw.js",
    disable: process.env.NODE_ENV === "development",
});

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

export default withSerwist(nextConfig);
