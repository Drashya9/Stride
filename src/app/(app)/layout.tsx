import { redirect } from "next/navigation";
import { getOptionalUser } from "@/server/ctx";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await getOptionalUser())) redirect("/login");
  return children;
}
