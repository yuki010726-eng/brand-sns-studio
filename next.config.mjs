/** @type {import('next').NextConfig} */
const nextConfig = {
  // 마이그레이션 중인 레거시 `pages/*.js`는 기존 해시 라우터 전용이다.
  pageExtensions: ['jsx', 'tsx'],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
