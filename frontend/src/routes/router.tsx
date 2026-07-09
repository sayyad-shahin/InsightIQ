import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import { PlaceholderPage } from "@/components/shared/placeholder-page";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { AppLayout } from "@/layouts/app-layout";
import { AuthLayout } from "@/layouts/auth-layout";
import { ProtectedRoute, PublicOnlyRoute } from "@/routes/protected-route";

const LandingPage = lazy(() => import("@/features/landing/landing-page"));
const LoginPage = lazy(() => import("@/features/auth/login-page"));
const SignupPage = lazy(() => import("@/features/auth/signup-page"));
const DashboardPage = lazy(() => import("@/features/dashboard/dashboard-page"));
const DatasetsPage = lazy(() => import("@/features/datasets/datasets-page"));
const ChatPage = lazy(() => import("@/features/chat/chat-page"));
const AnalyticsPage = lazy(() => import("@/features/analytics/analytics-page"));
const ForecastsPage = lazy(() => import("@/features/forecasts/forecasts-page"));
const NotFoundPage = lazy(() => import("@/features/misc/not-found-page"));

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageSkeleton />}>{children}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <Lazy>
        <LandingPage />
      </Lazy>
    ),
  },
  {
    element: <AuthLayout />,
    children: [
      {
        path: "/login",
        element: (
          <PublicOnlyRoute>
            <Lazy>
              <LoginPage />
            </Lazy>
          </PublicOnlyRoute>
        ),
      },
      {
        path: "/signup",
        element: (
          <PublicOnlyRoute>
            <Lazy>
              <SignupPage />
            </Lazy>
          </PublicOnlyRoute>
        ),
      },
    ],
  },
  {
    path: "/app",
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <Lazy>
            <DashboardPage />
          </Lazy>
        ),
      },
      {
        path: "datasets",
        element: (
          <Lazy>
            <DatasetsPage />
          </Lazy>
        ),
      },
      {
        path: "analytics",
        element: (
          <Lazy>
            <AnalyticsPage />
          </Lazy>
        ),
      },
      {
        path: "chat",
        element: (
          <Lazy>
            <ChatPage />
          </Lazy>
        ),
      },
      {
        path: "forecasts",
        element: (
          <Lazy>
            <ForecastsPage />
          </Lazy>
        ),
      },
      { path: "reports", element: <PlaceholderPage title="Reports" description="Generate shareable summaries." /> },
      { path: "admin", element: <PlaceholderPage title="Admin" description="Manage users and review the audit trail." /> },
      { path: "settings", element: <PlaceholderPage title="Settings" description="Manage your workspace preferences." /> },
      { path: "profile", element: <PlaceholderPage title="Profile" description="Your account details." /> },
    ],
  },
  {
    path: "*",
    element: (
      <Lazy>
        <NotFoundPage />
      </Lazy>
    ),
  },
]);
