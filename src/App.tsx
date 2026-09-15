import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { PlayerProvider } from "./context/PlayerContext";
import { TrackProvider } from "./context/TrackContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Studio from "./pages/Studio";
import Library from "./pages/Library";
import TrackDetail from "./pages/TrackDetail";
import Upload from "./pages/Upload";
import Collections from "./pages/Collections";
import CollectionDetail from "./pages/CollectionDetail";
import Users from "./pages/Users";
import LyricsEditor from "./pages/LyricsEditor";
import { CollectionProvider } from "./context/CollectionContext";
import { LoadingScreen } from "./components/ClaySpinner";
import ErrorBoundary from "./components/ErrorBoundary";
import type { ReactNode } from "react";

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen message="Opening SpotiYen" />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen message="Opening SpotiYen" />;
  if (user) {
    return (
      <Navigate
        to={user.role === "singer" ? "/record" : "/library"}
        replace
      />
    );
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <Login />
          </PublicOnly>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/library" element={<Library />} />
        <Route path="/library/:tab" element={<Library />} />
        <Route path="/record" element={<Studio />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/collections" element={<Collections />} />
        <Route path="/collection/:id" element={<CollectionDetail />} />
        <Route path="/track/:id" element={<TrackDetail />} />
        <Route path="/track/:id/lyrics" element={<LyricsEditor />} />
        <Route path="/users" element={<Users />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <TrackProvider>
            <CollectionProvider>
              <PlayerProvider>
                <AppRoutes />
              </PlayerProvider>
            </CollectionProvider>
          </TrackProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
