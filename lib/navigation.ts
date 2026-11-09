// Only same-site destinations are accepted after login.
export function safeNextPath(value:string|null) {
 if(!value||!value.startsWith('/')||value.startsWith('//')||value.includes('\\'))return '/dashboard';
 if(/^\/demo(\/|$|\?)/.test(value))return value.startsWith('/demo/admin')?'/admin':value.startsWith('/demo/apply')?'/applications/new':'/dashboard';
 return value;
}
