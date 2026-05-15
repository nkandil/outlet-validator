import { Badge, Button, Panel } from "../components/ui";
import { useOutletStore } from "../store";

export function Step5VerifyFields() {
  const { visibleFields, fieldsToVerify, setFieldsToVerify, setStep } = useOutletStore();
  const selected = new Set(fieldsToVerify);

  function toggle(field: string) {
    setFieldsToVerify(selected.has(field) ? fieldsToVerify.filter((item) => item !== field) : [...fieldsToVerify, field]);
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-4 p-4">
      <Panel className="grid gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">Fields to verify</h2>
          <p className="mt-1 text-sm text-slate-500">Choose which visible fields need explicit field-level validation.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {visibleFields.map((field) => (
            <button key={field} className="flex min-h-12 items-center justify-between rounded-md border border-slate-200 p-3 text-left text-sm font-medium hover:border-coke" onClick={() => toggle(field)}>
              <span>{field}</span>
              {selected.has(field) ? <Badge tone="success">Verify</Badge> : <Badge>Visible</Badge>}
            </button>
          ))}
        </div>
        <div className="flex justify-between">
          <Button variant="secondary" onClick={() => setStep(4)}>
            Back
          </Button>
          <Button onClick={() => setStep(6)}>Continue</Button>
        </div>
      </Panel>
    </div>
  );
}
