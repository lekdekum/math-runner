import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { buildApiUrl, isAuthenticated, setAdminToken } from "../auth";

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "Login failed";
}

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (isAuthenticated()) {
      navigate("/admin", { replace: true });
    }
  }, [navigate]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!username.trim() || !password) {
      setErrorMessage("Enter username and password.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch(buildApiUrl("/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username: username.trim(),
          password
        })
      });

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(responseText || `Login failed with status ${response.status}`);
      }

      const payload = await response.json();

      if (!payload?.access_token) {
        throw new Error("Backend returned no access token");
      }

      setAdminToken(payload.access_token);

      const redirectPath = location.state?.from?.pathname || "/admin";
      navigate(redirectPath, { replace: true });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="card wide">
        <p className="eyebrow">Admin Login</p>
        <h1>Sign in</h1>
        <p>Use the admin credentials to access protected question management pages.</p>

        <form className="admin-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Username</span>
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <button type="submit" className="button-primary" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {errorMessage ? <p className="status-error">{errorMessage}</p> : null}

        <div className="link-row">
          <Link to="/">Back to game</Link>
        </div>
      </section>
    </main>
  );
}
