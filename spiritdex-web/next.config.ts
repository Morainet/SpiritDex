import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  images: {
    // BWIKI 图片外链：Special:FilePath 会 302 到 patchwiki.biligame.com CDN，
    // 故两个域名都需白名单。立绘不下载到自家服务器（合规，见方案 §4.2）。
    remotePatterns: [
      { protocol: "https", hostname: "wiki.biligame.com" },
      { protocol: "https", hostname: "patchwiki.biligame.com" },
      // BWIKI 地图瓦片底图（Leaflet tileLayer 直连）
      { protocol: "https", hostname: "wiki-dev-patch-oss.oss-cn-hangzhou.aliyuncs.com" },
    ],
  },
};

export default nextConfig;
