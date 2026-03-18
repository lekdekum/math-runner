import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { buildApiUrl } from "../auth";
import PhaserCanvas from "../phaser/PhaserCanvas";

const PLAYER_NAME_STORAGE_KEY = "math-runner-player-name";

function normalizeQuestionBank(payload) {
  if (Array.isArray(payload)) {
    return { questions: payload };
  }

  if (Array.isArray(payload?.questions)) {
    return { questions: payload.questions };
  }

  if (Array.isArray(payload?.payload?.questions)) {
    return { questions: payload.payload.questions };
  }

  return { questions: [] };
}

export default function GamePage() {
  const { slug = "" } = useParams();
  const [questionBank, setQuestionBank] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isNotFound, setIsNotFound] = useState(false);
  const [playerName, setPlayerName] = useState("");

  useEffect(() => {
    const storedPlayerName = window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY) || "";
    setPlayerName(storedPlayerName);
  }, []);

  useEffect(() => {
    const normalizedSlug = slug.trim();

    if (!normalizedSlug) {
      setQuestionBank(null);
      setErrorMessage("Missing question slug");
      setIsNotFound(false);
      return undefined;
    }

    const controller = new AbortController();
    const questionsUrl = buildApiUrl(`/questions/${encodeURIComponent(normalizedSlug)}`);

    async function loadQuestions() {
      try {
        setQuestionBank(null);
        setErrorMessage("");
        setIsNotFound(false);

        const response = await fetch(questionsUrl, {
          signal: controller.signal
        });

        if (response.status === 404) {
          setIsNotFound(true);
          return;
        }

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const payload = await response.json();
        const normalizedQuestionBank = normalizeQuestionBank(payload);

        if (normalizedQuestionBank.questions.length === 0) {
          throw new Error("Backend returned no questions");
        }

        setQuestionBank(normalizedQuestionBank);
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }

        setQuestionBank(null);
        setIsNotFound(false);
        setErrorMessage(error.message || "Failed to load questions");
      }
    }

    loadQuestions();

    return () => {
      controller.abort();
    };
  }, [slug]);

  return (
    <main className="page-shell game-page">
      <section className="card game-card">
        {isNotFound ? (
          <div className="wide">
            <p className="eyebrow">Not Found</p>
            <h1>Question set not found</h1>
            <p>No question JSON exists for slug `{slug}`.</p>
            <div className="link-row">
              <Link to="/game">Try another slug</Link>
              <Link to="/admin">Open admin</Link>
            </div>
          </div>
        ) : errorMessage ? (
          <div>
            <p className="eyebrow">Backend Error</p>
            <h1>Could not load questions</h1>
            <p>{errorMessage}</p>
            <p>Expected endpoint: `/questions/{slug}`</p>
            <div className="link-row">
              <Link to="/game">Back to slug entry</Link>
            </div>
          </div>
        ) : questionBank ? (
          <PhaserCanvas questionBank={questionBank} slug={slug} playerName={playerName} />
        ) : (
          <div>
            <p className="eyebrow">Loading</p>
            <h1>Fetching questions</h1>
            <p>Requesting `{slug}` from the backend.</p>
          </div>
        )}
      </section>
    </main>
  );
}
