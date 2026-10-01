import React from "react";
import { Navigate } from "react-router-dom";
import { getSession } from "./storage";

// Gate for pages that require sign in. If there's no session, bounce to /login.
export default function ProtectedRoute({ children }) {
  const session = getSession();
  if (!session) return <Navigate to="/login" replace />;
  return children;
}
