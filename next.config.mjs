// The current public prototype is the production data boundary. Preview may
// only build against an explicitly separated Supabase project.
if (process.env.VERCEL_ENV === 'preview') {
 const project = process.env.NEXT_PUBLIC_SUPABASE_URL;
 const production = process.env.PRODUCTION_SUPABASE_URL || 'https://bqmiebsocpafgaewijjk.supabase.co';
 if (!project || new URL(project).hostname === new URL(production).hostname) {
  throw new Error('Preview requires a separate Supabase project.');
 }
}

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
