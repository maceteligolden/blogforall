export type DemoWorkspaceMember = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "editor";
};

export const DEMO_WORKSPACE_MEMBERS: DemoWorkspaceMember[] = [
  { id: "1", name: "Alex Chen", email: "alex@demo.workspace", role: "owner" },
  { id: "2", name: "Jamie Rivera", email: "jamie@demo.workspace", role: "admin" },
  { id: "3", name: "Sam Taylor", email: "sam@demo.workspace", role: "editor" },
];
