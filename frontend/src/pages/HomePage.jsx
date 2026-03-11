import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const PLAYER_NAME_STORAGE_KEY = "math-runner-player-name";

export default function HomePage() {
  const navigate = useNavigate();
  const [slug, setSlug] = useState("");
  const [playerName, setPlayerName] = useState("");

  useEffect(() => {
    const storedPlayerName = window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY);

    if (storedPlayerName) {
      setPlayerName(storedPlayerName);
    }
  }, []);

  function handleSubmit(event) {
    event.preventDefault();

    const normalizedSlug = slug.trim();
    const normalizedPlayerName = playerName.trim();

    if (!normalizedSlug || !normalizedPlayerName) {
      return;
    }

    window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, normalizedPlayerName);
    navigate(`/game/${encodeURIComponent(normalizedSlug)}`);
  }

  return (
    <main className="page-shell">
      <section className="card wide">
        <p className="eyebrow">Math Runner</p>
        <h1>Load a question set</h1>
        <p>Enter the slug for the quiz JSON you want to play.</p>

        <form className="admin-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Your name</span>
            <input
              type="text"
              name="playerName"
              placeholder="Ada"
              value={playerName}
              onChange={(event) => setPlayerName(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Slug</span>
            <input
              type="text"
              name="slug"
              placeholder="teste-inicial"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
            />
          </label>

          <button type="submit" className="button-primary">
            Start game
          </button>
        </form>
      </section>
    </main>
  );
}
