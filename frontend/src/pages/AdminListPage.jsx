import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

function normalizeSlugList(payload) {
  if (Array.isArray(payload)) {
    return payload
      .map((entry) => {
        if (typeof entry === "string") {
          return entry;
        }

        if (typeof entry?.slug === "string") {
          return entry.slug;
        }

        return null;
      })
      .filter(Boolean);
  }

  if (Array.isArray(payload?.slugs)) {
    return normalizeSlugList(payload.slugs);
  }

  if (Array.isArray(payload?.questions)) {
    return normalizeSlugList(payload.questions);
  }

  if (Array.isArray(payload?.payload)) {
    return normalizeSlugList(payload.payload);
  }

  return [];
}

export default function AdminListPage() {
  const [slugs, setSlugs] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSlugs() {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const response = await fetch("/list-questions", {
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const payload = await response.json();
        setSlugs(normalizeSlugList(payload));
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }

        setSlugs([]);
        setErrorMessage(error.message || "Failed to load question slugs");
      } finally {
        setIsLoading(false);
      }
    }

    loadSlugs();

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <main className="page-shell">
      <section className="card wide">
        <p className="eyebrow">Admin</p>
        <h1>Question Sets</h1>
        <p>Browse available slugs or upload a new CSV-backed question set.</p>

        <div className="link-row admin-actions">
          <Link to="/admin/new">Add new slug</Link>
          <Link to="/game">Open game</Link>
        </div>

        {isLoading ? (
          <p>Loading available slugs...</p>
        ) : errorMessage ? (
          <p className="status-error">{errorMessage}</p>
        ) : slugs.length > 0 ? (
          <div className="slug-grid">
            {slugs.map((slug) => (
              <Link key={slug} to={`/admin/details/${encodeURIComponent(slug)}`} className="slug-card">
                <p className="eyebrow">Slug</p>
                <h2>{slug}</h2>
              </Link>
            ))}
          </div>
        ) : (
          <p>No slugs were returned by `/list-questions`.</p>
        )}
      </section>
    </main>
  );
}
