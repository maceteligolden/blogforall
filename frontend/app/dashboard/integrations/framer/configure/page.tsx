import { redirect } from "next/navigation";

export default function ConfigureFramerPage() {
  redirect("/dashboard/integrations?configure=framer");
}
