"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/client/api";
import { Button } from "@/components/ui/button";

export function AcceptInvite({ token, workspaceName }: { token: string; workspaceName: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        variant="primary"
        disabled={pending}
        className="h-10 w-full justify-center bg-emerald-600 text-[14px] text-white hover:bg-emerald-700 hover:opacity-100 dark:bg-emerald-500 dark:text-zinc-950"
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            const { slug } = await api<{ slug: string }>("/api/invites/accept", { body: { token } });
            toast.success(`Welcome to ${workspaceName}!`);
            router.push(`/w/${slug}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not accept invite");
            setPending(false);
          }
        }}
      >
        <Check size={16} /> {pending ? "Joining…" : `Accept & join ${workspaceName}`}
      </Button>
      {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}
    </div>
  );
}
