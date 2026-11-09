// Fixed Auth user ID, not editable user_metadata. This is a routing marker,
// never an authorization grant. The database role remains tenant.
export const DEMO_USER_ID = '729166e1-42c4-48d1-833c-da19e3cd68de';
export function isDemoAccount(user: {id:string}|null|undefined) { return user?.id === DEMO_USER_ID; }
export function demoDestination(path:string) {
  return path.startsWith('/admin') ? '/demo/admin' : path.startsWith('/applications/new') ? '/demo/apply' : '/demo/dashboard';
}
export function safeNextPath(value:string|null) {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : '/dashboard';
}
