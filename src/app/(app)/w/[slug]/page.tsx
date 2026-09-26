import { Board } from "@/components/board/board";

export default async function BoardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <Board slug={slug} />;
}
