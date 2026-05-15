import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { StepProgress } from "./components/StepProgress";
import { AdminPage } from "./pages/AdminPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { Step0SessionPicker } from "./pages/Step0SessionPicker";
import { Step1Upload } from "./pages/Step1Upload";
import { Step2Detect } from "./pages/Step2Detect";
import { Step3MapFields } from "./pages/Step3MapFields";
import { Step4VisibleFields } from "./pages/Step4VisibleFields";
import { Step5VerifyFields } from "./pages/Step5VerifyFields";
import { Step6ReviewerName } from "./pages/Step6ReviewerName";
import { Step7MapView } from "./pages/Step7MapView";
import { useOutletStore } from "./store";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <AdminPage />
          </RequireAuth>
        }
      />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <OutletWizard />
          </RequireAuth>
        }
      />
    </Routes>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <main className="grid min-h-[100dvh] place-items-center bg-background text-muted-foreground">Loading...</main>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function OutletWizard() {
  const currentStep = useOutletStore((state) => state.currentStep);

  if (currentStep === 0) return <Step0SessionPicker />;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <StepProgress />
      <div className={currentStep === 7 ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "min-h-0 flex-1 overflow-y-auto"}>
        {currentStep === 1 ? <Step1Upload /> : null}
        {currentStep === 2 ? <Step2Detect /> : null}
        {currentStep === 3 ? <Step3MapFields /> : null}
        {currentStep === 4 ? <Step4VisibleFields /> : null}
        {currentStep === 5 ? <Step5VerifyFields /> : null}
        {currentStep === 6 ? <Step6ReviewerName /> : null}
        {currentStep === 7 ? <Step7MapView /> : null}
      </div>
    </div>
  );
}
import type React from "react";
