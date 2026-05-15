import * as XLSX from "xlsx";
import type { RowData } from "../types";

const allowedExtensions = [".xlsx", ".xls", ".csv"];

export function validateFileName(fileName: string) {
  const lower = fileName.toLowerCase();
  return allowedExtensions.some((extension) => lower.endsWith(extension));
}

export async function parseOutletFile(file: File) {
  if (!validateFileName(file.name)) {
    throw new Error("Upload a .xlsx, .xls, or .csv file.");
  }

  const buffer = await file.arrayBuffer();
  const workbook = file.name.toLowerCase().endsWith(".csv") ? csvToWorkbook(decodeCsv(buffer)) : XLSX.read(buffer, { type: "array" });
  const sheetNames = workbook.SheetNames;
  const selectedSheet = sheetNames[0] ?? "";
  const { headers, rows } = sheetToRows(workbook, selectedSheet);
  return { workbook, sheetNames, selectedSheet, headers, rows };
}

function decodeCsv(buffer: ArrayBuffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1256").decode(buffer);
  }
}

function csvToWorkbook(text: string) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(parseCsvRows(text));
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  return workbook;
}

function parseCsvRows(text: string) {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  function pushCell() {
    row.push(cell);
    cell = "";
  }

  function pushRow() {
    pushCell();
    if (row.some((value) => value !== "")) rows.push(row);
    row = [];
  }

  const value = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < value.length; index++) {
    const char = value[index];

    if (inQuotes) {
      if (char === '"' && value[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      pushCell();
    } else if (char === "\n") {
      pushRow();
    } else if (char === "\r") {
      if (value[index + 1] === "\n") continue;
      pushRow();
    } else {
      cell += char;
    }
  }

  if (cell !== "" || row.length > 0) pushRow();
  return rows;
}

function detectDelimiter(text: string) {
  const firstDataLine = text.replace(/^\uFEFF/, "").split(/\r?\n/).find((line) => line.trim()) ?? "";
  const candidates = [",", ";", "\t"];
  return candidates.reduce((best, candidate) => (countDelimiter(firstDataLine, candidate) > countDelimiter(firstDataLine, best) ? candidate : best), ",");
}

function countDelimiter(line: string, delimiter: string) {
  let count = 0;
  let inQuotes = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      index++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && char === delimiter) {
      count++;
    }
  }
  return count;
}

export function sheetToRows(workbook: XLSX.WorkBook, sheetName: string) {
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) return { headers: [], rows: [] as RowData[] };
  const rows = XLSX.utils.sheet_to_json<RowData>(worksheet, { defval: "" });
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { headers, rows };
}
