import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authFetch, clearAdminToken, isAuthError } from "../auth";

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "Upload failed";
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (!slug.trim()) {
      setStatusType("error");
      setStatusMessage("Enter a slug before uploading.");
      return;
    }

    if (!file) {
      setStatusType("error");
      setStatusMessage("Choose a CSV file to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("name", name.trim() || slug.trim());
    formData.append("file", file);

    setIsSubmitting(true);
    setStatusType("");
    setStatusMessage("");

    try {
      const response = await authFetch(`/questions_csv/${encodeURIComponent(slug.trim())}`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(responseText || `Upload failed with status ${response.status}`);
      }

      setStatusType("success");
      setStatusMessage(
        `Uploaded ${file.name} as "${name.trim() || slug.trim()}" to slug "${slug.trim()}".`
      );
      setName("");
      setSlug("");
      setFile(null);
      event.target.reset();
    } catch (error) {
      if (isAuthError(error)) {
        navigate("/admin/login", { replace: true });
        return;
      }

      setStatusType("error");
      setStatusMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="card wide">
        <p className="eyebrow">Admin</p>
        <h1>Upload question CSV</h1>
        <p>Send a CSV file to the backend and bind it to a questionnaire name and slug.</p>
        <form className="admin-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Name</span>
            <input
              type="text"
              name="name"
              placeholder="Math Basics"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Slug</span>
            <input
              type="text"
              name="slug"
              placeholder="math-basics"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
            />
          </label>

          <label className="field">
            <span>CSV file</span>
            <input
              type="file"
              name="file"
              accept=".csv,text/csv"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>

          <button type="submit" className="button-primary" disabled={isSubmitting}>
            {isSubmitting ? "Uploading..." : "Upload CSV"}
          </button>
        </form>

        {statusMessage ? (
          <p className={statusType === "error" ? "status-error" : "status-success"}>
            {statusMessage}
          </p>
        ) : null}

        <div className="link-row">
          <Link to="/admin">Back to admin</Link>
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              clearAdminToken();
              navigate("/admin/login", { replace: true });
            }}
          >
            Sign out
          </button>
          <Link to="/">Open game</Link>
        </div>
      </section>
    </main>
  );
}
