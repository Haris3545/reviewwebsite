import type { Project, ProjectSummary, ProductResult } from "./types";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const res = await fetch("/api/projects");
  const data = await handle<{ projects: ProjectSummary[] }>(res);
  return data.projects;
}

export async function getProject(id: string): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`);
  const data = await handle<{ project: Project }>(res);
  return data.project;
}

export interface SaveProjectInput {
  name: string;
  mode: "links" | "search";
  urls: string[];
  searchQuery: string | null;
  searchDomain: string | null;
  results: ProductResult[];
}

export async function createProject(input: SaveProjectInput): Promise<Project> {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await handle<{ project: Project }>(res);
  return data.project;
}

export async function updateProject(
  id: string,
  input: Partial<SaveProjectInput>,
): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await handle<{ project: Project }>(res);
  return data.project;
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }
}
