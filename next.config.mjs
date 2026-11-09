/** @type {import('next').NextConfig} */
const nextConfig = {
 reactStrictMode: true,
 async redirects() {
  return [
   {source:'/demo/admin',destination:'/admin',permanent:false},
   {source:'/demo/apply',destination:'/applications/new',permanent:false},
   {source:'/demo/:path*',destination:'/dashboard',permanent:false},
  ];
 },
};
export default nextConfig;
