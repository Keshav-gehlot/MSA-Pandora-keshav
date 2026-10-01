import { SignInForm } from "../../features/participant/sign-in-form";
import { currentMemberId } from "../../lib/session";
import { redirect } from "next/navigation";

export default async function SignInPage() {
  const memberId = await currentMemberId();

  if (memberId) {
    redirect("/team");
  }

  return <SignInForm />;
}