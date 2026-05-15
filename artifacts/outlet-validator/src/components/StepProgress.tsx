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
    <header className="border-b border-slate-200 bg-white px-4 py-3">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font800 font-bold text-slate-950">{sessionName || "Outlet Validator"}</h1>
          <p className="text-xs text-slate-500">Market Visit Validation</p>
        </div>
        <Button variant="ghost" onClick={() => setStep(0)} title="Back to sessions">
          <ArrowLeft size={18} />
          Sessions
        </Button>
      </div>
      {showSteps ? (
        <div className="mx-auto mt-3 grid max-w-6xl grid-cols-7 gap-1">
          {labels.map((label, index) => {
            const step = index + 1;
            return (
              <div key={label} className="min-w-0">
                <div className={`h-1.5 rounded-full ${currentStep >= step ? "bg-coke" : "bg-slate-200"}`} />
                <div className="mt-1 truncate text-[10px] font-medium text-slate-500">{label}</div>
              </div>
            );
          })}
        </div>
      ) : null}
    </header>
  );
}
