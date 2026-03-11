import { Link, Route, Routes } from "react-router-dom";
import AdminDetailsPage from "./pages/AdminDetailsPage";
import AdminListPage from "./pages/AdminListPage";
import AdminPage from "./pages/AdminPage";
import GamePage from "./pages/GamePage";
import HomePage from "./pages/HomePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/game" element={<HomePage />} />
      <Route path="/game/:slug" element={<GamePage />} />
      <Route path="/admin" element={<AdminListPage />} />
      <Route path="/admin/new" element={<AdminPage />} />
      <Route path="/admin/details/:slug" element={<AdminDetailsPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function NotFoundPage() {
  return (
    <main className="page-shell">
      <div className="card">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <p>Use one of the routes below.</p>
        <nav className="link-row">
          <Link to="/">Home</Link>
          <Link to="/game">Game</Link>
          <Link to="/admin">Admin</Link>
        </nav>
      </div>
    </main>
  );
}
