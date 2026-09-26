"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/client/api";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { WorkspaceDTO } from "@/lib/types";

function suggestKey(name: string) {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const key = words.length > 1 ? words.map((w) => w[0]).join("") : words[0];
  return key.replace(/^[0-9]+/, "").slice(0, 4);
}

export function CreateWorkspaceForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const effectiveKey = keyTouched ? key : suggestKey(name);

  return (
    <form
      className="grid gap-3 rounded-xl border border-border bg-panel p-4 sm:grid-cols-[1fr_120px_auto] sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        try {
          const ws = await api<WorkspaceDTO>("/api/workspaces", { body: { name, key: effectiveKey } });
          router.push(`/w/${ws.slug}`);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not create workspace");
          setPending(false);
        }
      }}
    >
      <div>
        <Label htmlFor="ws-name">Name</Label>
        <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Capstone Team 7" required minLength={2} />
      </div>
      <div>
        <Label htmlFor="ws-key">Issue key</Label>
        <Input
          id="ws-key"
          value={effectiveKey}
          onChange={(e) => {
            setKeyTouched(true);
            setKey(e.target.value.toUpperCase());
          }}
          placeholder="CAP"
          maxLength={6}
          required
        />
      </div>
      <Button type="submit" variant="primary" disabled={pending || !name.trim() || !effectiveKey}>
        Create
      </Button>
      {error && <p className="text-[13px] text-danger sm:col-span-3">{error}</p>}
    </form>
  );
}
