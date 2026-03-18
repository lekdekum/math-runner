import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isAuthenticated } from "../auth";

export default function AdminProtectedRoute() {
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
