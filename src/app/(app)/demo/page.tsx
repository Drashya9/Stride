import { redirect } from "next/navigation";
import { getCtx } from "@/server/ctx";
import { demoWorkspaceFor } from "@/server/services/demo";

/** Where "Try the demo" lands after sign-in: forwards the guest to their own board. */
export default async function DemoPage() {
  const slug = await demoWorkspaceFor(await getCtx());
  redirect(slug ? `/w/${slug}` : "/w");
}
