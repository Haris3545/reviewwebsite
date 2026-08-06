import type { MouseEvent } from "react";
import { useRouter } from "./lib/router";
import HomePage from "./pages/HomePage";
import ProjectsPage from "./pages/ProjectsPage";

export default function App() {
  const { path, navigate } = useRouter();
  const isProjects = path.startsWith("/projects");

  function handleNavClick(e: MouseEvent, to: string) {
    e.preventDefault();
    navigate(to);
  }

  return (
    <div className="page">
      <nav className="top-nav">
        <a
          href="/"
          className={!isProjects ? "active" : ""}
          onClick={(e) => handleNavClick(e, "/")}
        >
          Home
        </a>
        <a
          href="/projects"
          className={isProjects ? "active" : ""}
          onClick={(e) => handleNavClick(e, "/projects")}
        >
          Projects
        </a>
      </nav>
      <div className="app-frame">
        {isProjects ? <ProjectsPage navigate={navigate} /> : <HomePage />}
      </div>
    </div>
  );
}
