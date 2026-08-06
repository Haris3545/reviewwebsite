import { useEffect, useState } from "react";
import type { ProjectSummary } from "../lib/types";
import { deleteProject, listProjects, updateProject } from "../lib/projectsApi";

interface ProjectsPageProps {
  navigate: (to: string) => void;
}

export default function ProjectsPage({ navigate }: ProjectsPageProps) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setProjects(await listProjects());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load projects.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRenameConfirm(id: string) {
    if (renameValue.trim().length === 0) return;
    try {
      await updateProject(id, { name: renameValue.trim() });
      setRenamingId(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not rename project.");
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteProject(id);
      setConfirmDeleteId(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete project.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="projects-page">
      <h1>Projects</h1>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="empty-state">Loading…</p>
      ) : projects.length === 0 ? (
        <p className="empty-state">
          No saved projects yet. Fetch some reviews on the home page, then save them as a
          project.
        </p>
      ) : (
        <div className="project-list">
          {projects.map((p) => (
            <div className="project-row" key={p.id}>
              <div className="project-row-info">
                {renamingId === p.id ? (
                  <div className="save-form">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleRenameConfirm(p.id)}
                      autoFocus
                    />
                    <button className="primary" onClick={() => handleRenameConfirm(p.id)}>
                      Save
                    </button>
                    <button onClick={() => setRenamingId(null)}>Cancel</button>
                  </div>
                ) : (
                  <>
                    <strong>{p.name}</strong>
                    <span>
                      {p.mode === "search" ? "Keyword search" : "Pasted links"} · {p.productCount}{" "}
                      product{p.productCount === 1 ? "" : "s"} · {p.reviewCount} review
                      {p.reviewCount === 1 ? "" : "s"} · updated{" "}
                      {new Date(p.updatedAt).toLocaleDateString()}
                    </span>
                  </>
                )}
              </div>

              {renamingId !== p.id && (
                <div className="project-row-actions">
                  <button onClick={() => navigate(`/?project=${p.id}`)}>Open</button>
                  <button
                    onClick={() => {
                      setRenamingId(p.id);
                      setRenameValue(p.name);
                    }}
                  >
                    Rename
                  </button>
                  {confirmDeleteId === p.id ? (
                    <>
                      <button
                        className="danger"
                        onClick={() => handleDelete(p.id)}
                        disabled={deletingId === p.id}
                      >
                        {deletingId === p.id ? "Deleting…" : "Confirm delete"}
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                    </>
                  ) : (
                    <button className="danger" onClick={() => setConfirmDeleteId(p.id)}>
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
