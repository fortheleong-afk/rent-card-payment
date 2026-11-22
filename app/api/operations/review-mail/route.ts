import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Job = {
  id: string;
  lease_id: string;
  email: string | null;
  application_id: string;
  reference: string | null;
  review_status: 'approved' | 'rejected' | 'needs_changes';
};

const subjects: Record<Job['review_status'], string> = {
  approved: 'Your application was approved',
  rejected: 'Your application review is complete',
  needs_changes: 'Please update your rent application',
};

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const actual = request.headers.get('authorization');
  if (!expected || !actual) return new Response(null, { status: 401 });
  const supplied = Buffer.from(actual);
  const required = Buffer.from('Bearer ' + expected);
  if (supplied.length !== required.length || !timingSafeEqual(supplied, required)) {
    return new Response(null, { status: 401 });
  }

  const project = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.RESEND_API_KEY;
  const sender = process.env.REVIEW_MAIL_FROM;
  const site = process.env.REVIEW_MAIL_SITE_URL;
  if (process.env.REVIEW_MAIL_ENABLED !== 'true' || !project || !key || !apiKey || !sender || !site) {
    return Response.json({ status: 'inactive' });
  }
  let origin: string;
  try {
    const url = new URL(site);
    if (url.protocol !== 'https:') throw new Error();
    origin = url.origin;
  } catch {
    return Response.json({ status: 'invalid_configuration' }, { status: 503 });
  }

  const db = createClient(project, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.rpc('claim_review_emails');
  if (error) return Response.json({ status: 'queue_unavailable' }, { status: 503 });
  let deferred = 0;
  for (const job of (data ?? []) as Job[]) {
    const subject = subjects[job.review_status];
    let outcome = 'recipient_unavailable';
    if (job.email && subject && !/\.(?:example|invalid|test)$/i.test(job.email)) {
      outcome = 'mail_unavailable';
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + apiKey,
            'Content-Type': 'application/json',
            'Idempotency-Key': 'review/' + job.id,
          },
          body: JSON.stringify({
            from: sender,
            to: [job.email],
            subject,
            text: `${subject}. Sign in to view your application and any next steps.\n\nApplication: ${job.reference ?? job.application_id.slice(0,8).toUpperCase()}\n${origin}/applications/${job.application_id}`,
          }),
          signal: AbortSignal.timeout(3500),
        });
        if (response.ok) outcome = 'accepted';
      } catch {}
    }
    const result = await db.rpc('finish_review_email', { p_id: job.id, p_lease: job.lease_id, p_result: outcome });
    if (result.error || outcome !== 'accepted') deferred++;
  }
  return Response.json({ processed: data?.length ?? 0, deferred });
}
