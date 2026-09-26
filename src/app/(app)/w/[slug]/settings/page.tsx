import { emailStatus } from "@/server/integrations/email";
import { Settings } from "./settings";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return (
    <Settings
      slug={slug}
      webhookUrl={`${appUrl}/api/webhooks/github`}
      email={emailStatus()}
      appIsLocal={/localhost|127\.0\.0\.1/.test(appUrl)}
    />
  );
}
