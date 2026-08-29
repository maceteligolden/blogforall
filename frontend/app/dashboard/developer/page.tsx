import { redirect } from "next/navigation";

export default function DeveloperRedirectPage() {
  redirect("/dashboard/integrations/api");
}
