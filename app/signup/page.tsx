// app/signup/page.tsx
import SignupClient from "./SignupClient";

type PlanType = "free" | "premium" | "pro";

function normalizePlan(value: unknown): PlanType {
  if (value === "premium" || value === "pro" || value === "free") return value;
  return "free";
}

export default function SignupPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const rawPlan = searchParams?.plan;
  const planFromQuery =
    typeof rawPlan === "string" ? normalizePlan(rawPlan) : "free";

  return <SignupClient initialPlan={planFromQuery} />;
}
