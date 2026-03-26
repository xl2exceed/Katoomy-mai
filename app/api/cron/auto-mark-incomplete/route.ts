// GET /api/cron/auto-mark-incomplete
// Vercel cron — runs every hour.
// Finds bookings that have passed their end time and are still in
// 'requested' or 'confirmed' status (no manual update), and marks
// them 'incomplete' so the business knows to review them.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date().toISOString();

  const { data: updated, error } = await supabaseAdmin
    .from('bookings')
    .update({ status: 'incomplete' })
    .lt('end_ts', now)
    .in('status', ['requested', 'confirmed'])
    .select('id');

  if (error) {
    console.error('[auto-mark-incomplete] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[auto-mark-incomplete] Marked ${updated?.length ?? 0} bookings as incomplete`);
  return NextResponse.json({ success: true, count: updated?.length ?? 0 });
}
