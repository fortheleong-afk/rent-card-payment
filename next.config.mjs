/** @type {import('next').NextConfig} */
const nextConfig = {
 reactStrictMode: true,
 poweredByHeader: false,
 async headers() {
  return [{source:'/:path*',headers:[
   {key:'X-Content-Type-Options',value:'nosniff'},
   {key:'Referrer-Policy',value:'no-referrer'},
   {key:'X-Frame-Options',value:'DENY'},
  ]}];
 },
 async redirects() {
  return [
   {source:'/demo/admin',destination:'/admin',permanent:false},
   {source:'/demo/apply',destination:'/applications/new',permanent:false},
   {source:'/demo/:path*',destination:'/dashboard',permanent:false},
  ];
 },
};
export default nextConfig;
