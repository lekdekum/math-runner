import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authFetch, clearAdminToken, isAuthError } from "../auth";

function normalizeQuestionList(payload) {
  if (Array.isArray(payload)) {
    return payload
      .map((entry) => {
        if (typeof entry === "string") {
          return { slug: entry, name: entry };
        }

        if (typeof entry?.slug === "string") {
          return {
            slug: entry.slug,
            name: typeof entry?.name === "string" && entry.name.trim() ? entry.name : entry.slug
          };
        }

        return null;
      })
      .filter(Boolean);
  }

  if (Array.isArray(payload?.questions)) {
    return normalizeQuestionList(payload.questions);
  }

  if (Array.isArray(payload?.slugs)) {
    return normalizeQuestionList(payload.slugs);
  }

  if (Array.isArray(payload?.payload)) {
    return normalizeQuestionList(payload.payload);
  }

  return [];
}

export default function AdminListPage() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [revealedSlugs, setRevealedSlugs] = useState({});

  useEffect(() => {
    const controller = new AbortController();

    async function loadSlugs() {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const response = await authFetch("/list-questions", {
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const payload = await response.json();
        setQuestions(normalizeQuestionList(payload));
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }

        if (isAuthError(error)) {
          navigate("/admin/login", { replace: true });
          return;
        }

        setQuestions([]);
        setErrorMessage(error.message || "Failed to load question slugs");
      } finally {
        setIsLoading(false);
      }
    }

    loadSlugs();

    return () => {
      controller.abort();
    };
  }, [navigate]);

  return (
    <main className="page-shell">
      <section className="card wide">
        <p className="eyebrow">Admin</p>
        <h1>Question Sets</h1>
        <p>Browse available slugs or upload a new CSV-backed question set.</p>

        <div className="link-row admin-actions">
          <Link to="/admin/new">Add new slug</Link>
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
          <Link to="/game">Open game</Link>
        </div>

        {isLoading ? (
          <p>Loading available slugs...</p>
        ) : errorMessage ? (
          <p className="status-error">{errorMessage}</p>
        ) : questions.length > 0 ? (
          <div className="slug-grid">
            {questions.map(({ slug, name }) => (
              <article key={slug} className="slug-card">
                <div className="slug-card-header">
                  <p className="slug-card-name">{name}</p>
                  <button
                    type="button"
                    className="button-secondary icon-button slug-toggle-button"
                    onClick={() =>
                      setRevealedSlugs((currentValue) => ({
                        ...currentValue,
                        [slug]: !currentValue[slug]
                      }))
                    }
                    aria-pressed={Boolean(revealedSlugs[slug])}
                    aria-label={revealedSlugs[slug] ? `Hide slug for ${name}` : `Show slug for ${name}`}
                  >
                    <span className="icon-button-eye" aria-hidden="true">
                      {revealedSlugs[slug] ? "◉" : "○"}
                    </span>
                  </button>
                </div>
                <Link to={`/admin/details/${encodeURIComponent(slug)}`} className="slug-card-link">
                  <h2>
                    <span className="slug-card-code-label">CODE:</span>{" "}
                    {revealedSlugs[slug] ? slug : "*".repeat(Math.max(slug.length, 8))}
                  </h2>
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <p>No slugs were returned by `/list-questions`.</p>
        )}
      </section>
    </main>
  );
}
