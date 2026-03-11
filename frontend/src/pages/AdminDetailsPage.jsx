import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

function normalizeScores(payload) {
  if (Array.isArray(payload?.scores)) {
    return payload.scores;
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  return [];
}

function normalizeQuestions(payload) {
  if (Array.isArray(payload?.payload?.questions)) {
    return payload.payload.questions;
  }

  if (Array.isArray(payload?.questions)) {
    return payload.questions;
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  return [];
}

function formatCreatedAt(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export default function AdminDetailsPage() {
  const { slug = "" } = useParams();
  const [payload, setPayload] = useState(null);
  const [scores, setScores] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [rankingsErrorMessage, setRankingsErrorMessage] = useState("");
  const [isNotFound, setIsNotFound] = useState(false);

  useEffect(() => {
    const normalizedSlug = slug.trim();

    if (!normalizedSlug) {
      setPayload(null);
      setScores([]);
      setErrorMessage("Missing question slug");
      setRankingsErrorMessage("");
      setIsNotFound(false);
      return undefined;
    }

    const controller = new AbortController();

    async function loadDetails() {
      try {
        setPayload(null);
        setScores([]);
        setErrorMessage("");
        setRankingsErrorMessage("");
        setIsNotFound(false);

        const [questionResponse, rankingsResponse] = await Promise.all([
          fetch(`/questions/${encodeURIComponent(normalizedSlug)}`, {
            signal: controller.signal
          }),
          fetch(`/rankings/${encodeURIComponent(normalizedSlug)}`, {
            signal: controller.signal
          })
        ]);

        if (questionResponse.status === 404) {
          setIsNotFound(true);
          return;
        }

        if (!questionResponse.ok) {
          throw new Error(`Request failed with status ${questionResponse.status}`);
        }

        setPayload(await questionResponse.json());

        if (rankingsResponse.ok) {
          setScores(normalizeScores(await rankingsResponse.json()));
        } else if (rankingsResponse.status !== 404) {
          setRankingsErrorMessage(`Rankings request failed with status ${rankingsResponse.status}`);
        }
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }

        setPayload(null);
        setScores([]);
        setIsNotFound(false);
        setErrorMessage(error.message || "Failed to load question details");
      }
    }

    loadDetails();

    return () => {
      controller.abort();
    };
  }, [slug]);

  const questions = normalizeQuestions(payload);

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
            <p>Questions and answers loaded for this slug.</p>

            {questions.length > 0 ? (
              <div className="rankings-table-wrapper">
                <table className="rankings-table">
                  <thead>
                    <tr>
                      <th>Question</th>
                      <th>Answers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {questions.map((entry, index) => (
                      <tr key={`${entry.question}-${index}`}>
                        <td>{entry.question}</td>
                        <td>{Array.isArray(entry.answers) ? entry.answers.join(", ") : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No questions were returned for this slug.</p>
            )}

            <p className="eyebrow">Rankings</p>
            <p>Name, score, and created date in a copy-friendly format.</p>

            {rankingsErrorMessage ? (
              <p className="status-error">{rankingsErrorMessage}</p>
            ) : scores.length > 0 ? (
              <>
                <div className="rankings-table-wrapper">
                  <table className="rankings-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Score</th>
                        <th>Created At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scores.map((entry) => (
                        <tr key={entry.id ?? `${entry.name}-${entry.score}-${entry.created_at}`}>
                          <td>{entry.name}</td>
                          <td>{entry.score}</td>
                          <td>{formatCreatedAt(entry.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p>No rankings available for this slug yet.</p>
            )}
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
