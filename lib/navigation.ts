// Never let login redirects leave this origin, including browser-normalized controls.
export function safeNextPath(value:string|null){
 if(!value||!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u0020\u007f]/.test(value))return '/dashboard';
 try{
  const url=new URL(value,'https://divercity.invalid');
  if(url.origin!=='https://divercity.invalid')return '/dashboard';
  if(/^\/demo(\/|$)/.test(url.pathname))return url.pathname==='/demo/admin'?'/admin':url.pathname==='/demo/apply'?'/applications/new':'/dashboard';
  return url.pathname+url.search+url.hash;
 }catch{return '/dashboard';}
}
