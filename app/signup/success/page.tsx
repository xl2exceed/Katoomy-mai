// app/signup/success/page.tsx
import SuccessClient from "./SuccessClient";

export default function SignupSuccessPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const rawSessionId = searchParams?.session_id;
  const sessionId = typeof rawSessionId === "string" ? rawSessionId : null;

  return <SuccessClient sessionId={sessionId} />;
}
