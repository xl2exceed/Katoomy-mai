// file: lib/hooks/useStaffFeature.ts
// Custom hook to check if staff management is enabled for the current business

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useStaffFeature() {
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    checkStaffAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkStaffAccess() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setHasAccess(false);
        setLoading(false);
        return;
      }

      const { data: business } = await supabase
        .from('businesses')
        .select('subscription_plan, features')
        .eq('owner_user_id', user.id)
        .maybeSingle();

      if (!business) {
        setHasAccess(false);
        setLoading(false);
        return;
      }

      // Check if business has premium plan OR staff_management feature enabled
      const hasPremiumPlan = business.subscription_plan === 'premium' || business.subscription_plan === 'pro';
      const hasStaffFeature = business.features?.staff_management === true;

      setHasAccess(hasPremiumPlan || hasStaffFeature);
    } catch (error) {
      console.error('Error checking staff access:', error);
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  }

  return { hasAccess, loading };
}
