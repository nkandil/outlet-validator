import { ArrowLeft } from "lucide-react";
import { Button } from "./ui";
import { useOutletStore } from "../store";

const labels = ["Upload", "Detect", "Map", "Visible", "Verify", "Reviewer", "Field"];

export function StepProgress() {
  const currentStep = useOutletStore((state) => state.currentStep);
  const sessionName = useOutletStore((state) => state.sessionName);
  const setStep = useOutletStore((state) => state.setStep);
  const showSteps = currentStep < 7;

  return (
    <header className="border-b bg-card px-4 py-3">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="min-w-48 flex-1">
          <h1 className="truncate text-lg font-bold text-foreground">{sessionName || "Outlet Validator"}</h1>
          <p className="text-xs text-muted-foreground">Market Visit Validation</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" onClick={() => setStep(0)} title="Back to sessions">
            <ArrowLeft size={18} />
            Sessions
          </Button>
        </div>
      </div>
      {showSteps ? (
        <div className="mx-auto mt-3 grid max-w-6xl grid-cols-7 gap-1">
          {labels.map((label, index) => {
            const step = index + 1;
            return (
              <div key={label} className="min-w-0">
                <div className={`h-1.5 rounded-full ${currentStep >= step ? "bg-primary" : "bg-muted"}`} />
                <div className="mt-1 truncate text-[10px] font-medium text-muted-foreground">{label}</div>
              </div>
            );
          })}
        </div>
      ) : null}
    </header>
  );
}
