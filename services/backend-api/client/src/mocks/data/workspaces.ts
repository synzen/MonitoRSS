import { Workspace } from "@/features/workspaces";

const mockWorkspaces: Workspace[] = [
  {
    id: "workspace-1",
    name: "Acme Marketing",
    slug: "acme-marketing",
    role: "owner",
    needsBilling: false,
    maxFeeds: 30,
  },
  {
    id: "workspace-2",
    name: "Open Source Crew",
    slug: "open-source-crew",
    role: "admin",
    needsBilling: false,
    maxFeeds: 30,
  },
];

export default mockWorkspaces;
