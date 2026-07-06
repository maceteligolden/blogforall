import { redirect } from "next/navigation";

export default function MemoryRedirectPage() {
  redirect("/dashboard/profile?tab=business");
}
