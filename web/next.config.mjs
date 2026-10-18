/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverActions: { bodySizeLimit: '8mb' } }, // seller document uploads
  poweredByHeader: false,
};
export default nextConfig;
