import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/app/components/login-form";
import { getCurrentUser, homePathFor } from "@/lib/auth";

export default function Home() {
  return (
    <Suspense fallback={<div className="page-loading"><span className="spinner" />Opening your workspace...</div>}>
      <LoginLanding />
    </Suspense>
  );
}

async function LoginLanding() {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user));
  return <LoginForm hotelName="Aurelia Hotel Collection" />;
}
