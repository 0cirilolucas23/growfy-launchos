/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack(config) {
    // Find Next's default rule that catches *.svg (as asset/URL)
    const fileLoaderRule = config.module.rules.find(
      (rule) => rule.test instanceof RegExp && rule.test.test(".svg")
    );

    if (fileLoaderRule) {
      // Keep asset behavior only when explicitly requested via `?url`
      config.module.rules.push({
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/,
      });
      // Exclude .svg from the default asset loader so SVGR can take over
      fileLoaderRule.exclude = /\.svg$/i;
    }

    // Everything else importing *.svg goes through SVGR → React component
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      resourceQuery: { not: [/url/] },
      use: [
        {
          loader: "@svgr/webpack",
          options: {
            dimensions: false, // strip width/height so className controls size
            svgoConfig: {
              plugins: [
                {
                  name: "preset-default",
                  params: { overrides: { removeViewBox: false } },
                },
              ],
            },
          },
        },
      ],
    });

    return config;
  },
};

export default nextConfig;
