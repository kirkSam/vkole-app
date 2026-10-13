import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { ParentLogin } from "@/components/parent-login";
import { PageSkeleton } from "@/components/shell";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <PageSkeleton />;
  if (user) return <Navigate to="/" />;
  return <ParentLogin />;
}
