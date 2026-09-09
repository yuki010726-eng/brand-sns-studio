/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // playwright는 네이티브 크로미움 바이너리를 동적으로 불러온다 — 번들러가 손대면
  // 깨진다. `/api/naver/fill`(lib/naverPublish.js)에서만 쓴다.
  serverExternalPackages: ["playwright"],
};

export default nextConfig;
