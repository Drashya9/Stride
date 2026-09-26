import { ActivityFeed } from "./activity-feed";

export const metadata = { title: "Activity" };

export default async function ActivityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ActivityFeed slug={slug} />;
}
