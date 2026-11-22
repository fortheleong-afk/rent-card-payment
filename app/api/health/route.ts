import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const project = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let available = false;
  if (project && key) {
    try {
      const db = createClient(project, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await db.rpc('application_intake_open').abortSignal(AbortSignal.timeout(2500));
      available = !error && typeof data === 'boolean';
    } catch {}
  }
  return Response.json({ status: available ? 'ok' : 'unavailable' }, { status: available ? 200 : 503 });
}
