import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

export default function AdminDetailsPage() {
  const { slug = "" } = useParams();
  const [payload, setPayload] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isNotFound, setIsNotFound] = useState(false);

  useEffect(() => {
    const normalizedSlug = slug.trim();

    if (!normalizedSlug) {
      setPayload(null);
      setErrorMessage("Missing question slug");
      setIsNotFound(false);
      return undefined;
    }

    const controller = new AbortController();

    async function loadDetails() {
      try {
        setPayload(null);
        setErrorMessage("");
        setIsNotFound(false);

        const response = await fetch(`/questions/${encodeURIComponent(normalizedSlug)}`, {
          signal: controller.signal
        });

        if (response.status === 404) {
          setIsNotFound(true);
          return;
        }

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        setPayload(await response.json());
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }

        setPayload(null);
        setIsNotFound(false);
        setErrorMessage(error.message || "Failed to load question details");
      }
    }

    loadDetails();

    return () => {
      controller.abort();
    };
  }, [slug]);

  return (
    <main className="page-shell">
      <section className="card wide">
        {isNotFound ? (
          <>
            <p className="eyebrow">Not Found</p>
            <h1>Question set not found</h1>
            <p>No question JSON exists for slug `{slug}`.</p>
          </>
        ) : errorMessage ? (
          <>
            <p className="eyebrow">Backend Error</p>
            <h1>Could not load details</h1>
            <p>{errorMessage}</p>
          </>
        ) : payload ? (
          <>
            <p className="eyebrow">Question Details</p>
            <h1>{slug}</h1>
            <p>Raw JSON returned by the backend.</p>
            <pre className="json-viewer">{JSON.stringify(payload, null, 2)}</pre>
          </>
        ) : (
          <>
            <p className="eyebrow">Loading</p>
            <h1>Fetching details</h1>
            <p>Requesting `{slug}` from the backend.</p>
          </>
        )}

        <div className="link-row">
          <Link to="/admin">Back to admin</Link>
          <Link to="/admin/new">Add new slug</Link>
        </div>
      </section>
    </main>
  );
}
