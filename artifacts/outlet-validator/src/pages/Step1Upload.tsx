import { Upload } from "lucide-react";
import { useState } from "react";
import { Button, Panel, Select } from "../components/ui";
import { parseOutletFile, sheetToRows } from "../lib/file";
import { useOutletStore } from "../store";

export function Step1Upload() {
  const { workbook, fileName, rawRows, sheetNames, selectedSheet, setUpload, setSelectedSheetRows, setStep } = useOutletStore();
  const [error, setError] = useState("");

  async function handleFile(file?: File) {
    if (!file) return;
    setError("");
    try {
      const parsed = await parseOutletFile(file);
      setUpload({
        workbook: parsed.workbook,
        sheetNames: parsed.sheetNames,
        selectedSheet: parsed.selectedSheet,
        rawHeaders: parsed.headers,
        rawRows: parsed.rows,
        fileName: file.name
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not parse file");
    }
  }

  function changeSheet(sheetName: string) {
    if (!workbook) return;
    const { headers, rows } = sheetToRows(workbook, sheetName);
    setSelectedSheetRows(sheetName, headers, rows);
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-4 p-4">
      <Panel className="grid gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">Upload outlet data</h2>
          <p className="mt-1 text-sm text-slate-500">Use an Excel workbook or CSV with outlet IDs and coordinates.</p>
        </div>
        <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center hover:border-coke">
          <Upload className="text-coke" size={32} />
          <span className="font-semibold text-slate-900">Tap to upload or drop a file</span>
          <span className="text-sm text-slate-500">.xlsx, .xls, or .csv</span>
          <input className="sr-only" type="file" accept=".xlsx,.xls,.csv" onChange={(event) => handleFile(event.target.files?.[0])} />
        </label>
        {error ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        {fileName ? (
          <div className="grid gap-3 rounded-md bg-slate-100 p-3 text-sm">
            <div className="font-semibold text-slate-900">{fileName}</div>
            <div className="text-slate-600">{rawRows.length} loaded rows</div>
            {sheetNames.length > 1 ? (
              <Select value={selectedSheet} onChange={(event) => changeSheet(event.target.value)}>
                {sheetNames.map((sheet) => (
                  <option key={sheet} value={sheet}>
                    {sheet}
                  </option>
                ))}
              </Select>
            ) : null}
          </div>
        ) : null}
        <div className="flex justify-end">
          <Button disabled={!fileName || rawRows.length === 0} onClick={() => setStep(2)}>
            Continue
          </Button>
        </div>
      </Panel>
    </div>
  );
}
