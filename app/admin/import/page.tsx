"use client";
import { useState, useRef } from "react";
import Link from "next/link";

type Step = "upload" | "map" | "preview" | "importing" | "results";

interface MappingConfig {
  phone: string;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface SkippedRow {
  name: string;
  phone: string;
  email: string;
  reason: string;
}

interface ImportResult {
  imported: number;
  duplicates: number;
  skipped: SkippedRow[];
}

// ── CSV parser ──────────────────────────────────────────────────────────────
function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // Strip BOM
  const clean = text.replace(/^﻿/, "");
  const lines = clean.split(/\r?\n/);

  function parseLine(line: string): string[] {
    const fields: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === "," && !inQ) {
        fields.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    fields.push(cur.trim());
    return fields;
  }

  const headers = parseLine(lines[0] ?? "").map(h => h.replace(/^"|"$/g, ""));
  const rows = lines
    .slice(1)
    .map(line => {
      if (!line.trim()) return null;
      const vals = parseLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = (vals[i] ?? "").replace(/^"|"$/g, ""); });
      return row;
    })
    .filter((r): r is Record<string, string> => r !== null && Object.values(r).some(v => v.trim()));

  return { headers, rows };
}

// ── Auto-detect column names ────────────────────────────────────────────────
function autoDetect(headers: string[]): MappingConfig {
  const h = headers.map(x => x.toLowerCase());
  const find = (terms: string[]) =>
    headers[h.findIndex(x => terms.some(t => x.includes(t)))] ?? "";

  return {
    phone:     find(["phone", "mobile", "cell", "telephone", "tel", "contact"]),
    fullName:  find(["full name", "full_name", "customer name", "client name", "name"]),
    firstName: find(["first name", "first_name", "firstname", "given name", "given_name"]),
    lastName:  find(["last name", "last_name", "lastname", "surname", "family name"]),
    email:     find(["email", "e-mail", "email address", "email_address"]),
  };
}

// ── Phone normalization (client-side for preview count) ─────────────────────
function isValidPhone(raw: string): boolean {
  const d = (raw ?? "").replace(/\D/g, "");
  return d.length === 10 || (d.length === 11 && d[0] === "1");
}

// ── Build name from mapping ──────────────────────────────────────────────────
function buildName(row: Record<string, string>, m: MappingConfig): string {
  if (m.fullName && row[m.fullName]?.trim()) return row[m.fullName].trim();
  const first = m.firstName ? (row[m.firstName] ?? "").trim() : "";
  const last  = m.lastName  ? (row[m.lastName]  ?? "").trim() : "";
  return [first, last].filter(Boolean).join(" ");
}

// ── Download skipped as CSV ──────────────────────────────────────────────────
function downloadSkipped(skipped: SkippedRow[]) {
  const header = "Name,Phone,Email,Reason";
  const body = skipped.map(r =>
    [`"${r.name}"`, `"${r.phone}"`, `"${r.email}"`, `"${r.reason}"`].join(",")
  ).join("\n");
  const blob = new Blob([header + "\n" + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "katoomy-skipped-customers.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Step indicator ───────────────────────────────────────────────────────────
const STEPS = ["Upload", "Map Columns", "Preview", "Results"];
function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition ${
              i < current ? "bg-purple-600 text-white" :
              i === current ? "bg-purple-600 text-white ring-4 ring-purple-100" :
              "bg-gray-200 text-gray-500"
            }`}>
              {i < current ? "✓" : i + 1}
            </div>
            <span className={`text-xs mt-1 font-medium ${i === current ? "text-purple-700" : "text-gray-400"}`}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-0.5 w-16 mx-1 mb-4 transition ${i < current ? "bg-purple-600" : "bg-gray-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

const STEP_INDEX: Record<Step, number> = { upload: 0, map: 1, preview: 2, importing: 2, results: 3 };

// ── Main component ───────────────────────────────────────────────────────────
export default function ImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<MappingConfig>({ phone: "", fullName: "", firstName: "", lastName: "", email: "" });
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setFileError("");
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      setFileError("Please upload a CSV file. Most booking apps let you export customers as CSV.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers: h, rows: r } = parseCSV(text);
      if (h.length === 0 || r.length === 0) {
        setFileError("The file appears to be empty or couldn't be read. Make sure it's a valid CSV export.");
        return;
      }
      setHeaders(h);
      setRows(r);
      setMapping(autoDetect(h));
      setStep("map");
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // Compute preview counts
  const phoneCol = mapping.phone;
  const validRows = rows.filter(r => phoneCol && isValidPhone(r[phoneCol] ?? ""));
  const skippedNoPhone = rows.length - validRows.length;

  const handleImport = async () => {
    setStep("importing");

    const customers = validRows.map(r => ({
      phone: r[phoneCol] ?? "",
      fullName: buildName(r, mapping),
      email: mapping.email ? (r[mapping.email] ?? null) : null,
    }));

    const res = await fetch("/api/admin/import-customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customers }),
    });

    if (!res.ok) {
      setFileError("Import failed. Please try again.");
      setStep("preview");
      return;
    }

    const data = await res.json();
    // Merge in the no-phone rows as skipped
    const noPhoneSkipped: SkippedRow[] = rows
      .filter(r => !phoneCol || !isValidPhone(r[phoneCol] ?? ""))
      .map(r => ({
        name: buildName(r, mapping),
        phone: phoneCol ? (r[phoneCol] ?? "") : "",
        email: mapping.email ? (r[mapping.email] ?? "") : "",
        reason: "Invalid or missing phone number",
      }));

    setResult({
      imported: data.imported,
      duplicates: data.duplicates,
      skipped: [...noPhoneSkipped, ...(data.skipped ?? [])],
    });
    setStep("results");
  };

  const reset = () => {
    setStep("upload");
    setHeaders([]);
    setRows([]);
    setMapping({ phone: "", fullName: "", firstName: "", lastName: "", email: "" });
    setResult(null);
    setFileError("");
  };

  const colOptions = ["", ...headers];

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/admin/customers" className="text-sm text-gray-400 hover:text-gray-600">
          ← Customers
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Import Customers</h1>
        <p className="text-gray-500 text-sm mt-1">
          Bring your customers over from any booking app. Export a CSV from your old system and upload it here.
        </p>
      </div>

      <StepBar current={STEP_INDEX[step]} />

      {/* ── STEP 1: UPLOAD ──────────────────────────────────────────────── */}
      {step === "upload" && (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition ${
              dragOver ? "border-purple-400 bg-purple-50" : "border-gray-300 hover:border-purple-300 hover:bg-gray-50"
            }`}
          >
            <p className="text-4xl mb-3">📂</p>
            <p className="font-semibold text-gray-900 text-lg">Drop your CSV file here</p>
            <p className="text-sm text-gray-500 mt-1">or click to browse</p>
            <p className="text-xs text-gray-400 mt-3">Exports from Booksy, Vagaro, GlossGenius, Square, Fresha, and most booking apps work.</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          {fileError && (
            <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{fileError}</p>
          )}
          <div className="mt-6 p-4 bg-gray-50 rounded-xl">
            <p className="text-xs font-semibold text-gray-600 mb-2">How to export your customers:</p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>→ <strong>Booksy:</strong> Clients → Export Clients</li>
              <li>→ <strong>Vagaro:</strong> Reports → Customer List → Export</li>
              <li>→ <strong>Square:</strong> Customers → Export</li>
              <li>→ <strong>GlossGenius:</strong> Clients → Export</li>
              <li>→ <strong>Fresha:</strong> Clients → Export CSV</li>
              <li>→ <strong>Other:</strong> Look for "Export" or "Download" in your client/customer list</li>
            </ul>
          </div>
        </div>
      )}

      {/* ── STEP 2: MAP COLUMNS ─────────────────────────────────────────── */}
      {step === "map" && (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <p className="font-semibold text-gray-900 mb-1">Match your columns to Katoomy fields</p>
          <p className="text-sm text-gray-500 mb-6">
            We found <strong>{rows.length.toLocaleString()}</strong> rows and <strong>{headers.length}</strong> columns in your file.
            We&apos;ve auto-detected the mapping below — fix anything that looks wrong.
          </p>

          <div className="space-y-4">
            {/* Phone — required */}
            <div className="flex items-center gap-4">
              <div className="w-44 flex-shrink-0">
                <p className="text-sm font-semibold text-gray-900">Phone Number</p>
                <p className="text-xs text-red-500 font-medium">Required</p>
              </div>
              <select
                value={mapping.phone}
                onChange={e => setMapping(m => ({ ...m, phone: e.target.value }))}
                className={`flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  mapping.phone ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"
                }`}
              >
                {colOptions.map(o => <option key={o} value={o}>{o || "— Not in file —"}</option>)}
              </select>
            </div>

            {/* Full name */}
            <div className="flex items-center gap-4">
              <div className="w-44 flex-shrink-0">
                <p className="text-sm font-semibold text-gray-900">Full Name</p>
                <p className="text-xs text-gray-400">Optional</p>
              </div>
              <select
                value={mapping.fullName}
                onChange={e => setMapping(m => ({ ...m, fullName: e.target.value }))}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {colOptions.map(o => <option key={o} value={o}>{o || "— Not in file —"}</option>)}
              </select>
            </div>

            {/* First + Last (shown when no full name) */}
            {!mapping.fullName && (
              <>
                <div className="flex items-center gap-4">
                  <div className="w-44 flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-900">First Name</p>
                    <p className="text-xs text-gray-400">Optional</p>
                  </div>
                  <select
                    value={mapping.firstName}
                    onChange={e => setMapping(m => ({ ...m, firstName: e.target.value }))}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {colOptions.map(o => <option key={o} value={o}>{o || "— Not in file —"}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-44 flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-900">Last Name</p>
                    <p className="text-xs text-gray-400">Optional</p>
                  </div>
                  <select
                    value={mapping.lastName}
                    onChange={e => setMapping(m => ({ ...m, lastName: e.target.value }))}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {colOptions.map(o => <option key={o} value={o}>{o || "— Not in file —"}</option>)}
                  </select>
                </div>
              </>
            )}

            {/* Email */}
            <div className="flex items-center gap-4">
              <div className="w-44 flex-shrink-0">
                <p className="text-sm font-semibold text-gray-900">Email</p>
                <p className="text-xs text-gray-400">Optional</p>
              </div>
              <select
                value={mapping.email}
                onChange={e => setMapping(m => ({ ...m, email: e.target.value }))}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {colOptions.map(o => <option key={o} value={o}>{o || "— Not in file —"}</option>)}
              </select>
            </div>
          </div>

          {/* Sample data preview */}
          {mapping.phone && (
            <div className="mt-6 overflow-x-auto">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Preview (first 3 rows)</p>
              <table className="w-full text-xs border border-gray-100 rounded-xl overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Name</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Phone</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.slice(0, 3).map((r, i) => (
                    <tr key={i} className="bg-white">
                      <td className="px-3 py-2 text-gray-900">{buildName(r, mapping) || "—"}</td>
                      <td className="px-3 py-2 text-gray-900">{mapping.phone ? r[mapping.phone] : "—"}</td>
                      <td className="px-3 py-2 text-gray-500">{mapping.email ? r[mapping.email] : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button onClick={reset} className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
              ← Start Over
            </button>
            <button
              onClick={() => setStep("preview")}
              disabled={!mapping.phone}
              className="flex-1 py-2 text-sm font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 disabled:opacity-40 transition"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: PREVIEW ─────────────────────────────────────────────── */}
      {(step === "preview" || step === "importing") && (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <p className="font-semibold text-gray-900 mb-1">Ready to import</p>
          <p className="text-sm text-gray-500 mb-6">Review the counts below, then hit Import to bring your customers into Katoomy.</p>

          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
              <span className="text-2xl">✅</span>
              <div>
                <p className="font-bold text-green-900 text-lg">{validRows.length.toLocaleString()}</p>
                <p className="text-sm text-green-700">customers ready to import</p>
              </div>
            </div>
            {skippedNoPhone > 0 && (
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="font-bold text-amber-900 text-lg">{skippedNoPhone.toLocaleString()}</p>
                  <p className="text-sm text-amber-700">rows will be skipped — no valid phone number</p>
                </div>
              </div>
            )}
            <p className="text-xs text-gray-400 pl-1">
              Duplicate detection runs on import. Customers already in Katoomy won&apos;t be added twice.
            </p>
          </div>

          {validRows.length === 0 ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center mb-4">
              <p className="text-red-700 font-semibold text-sm">No importable customers found</p>
              <p className="text-red-600 text-xs mt-1">Make sure the Phone Number column is mapped correctly.</p>
            </div>
          ) : null}

          {step === "importing" && (
            <div className="flex items-center gap-3 p-4 bg-purple-50 border border-purple-200 rounded-xl mb-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600 flex-shrink-0" />
              <p className="text-sm font-semibold text-purple-800">Importing {validRows.length.toLocaleString()} customers…</p>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep("map")} disabled={step === "importing"} className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 transition">
              ← Back
            </button>
            <button
              onClick={handleImport}
              disabled={step === "importing" || validRows.length === 0}
              className="flex-1 py-2 text-sm font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 disabled:opacity-40 transition"
            >
              {step === "importing" ? "Importing…" : `Import ${validRows.length.toLocaleString()} Customers →`}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: RESULTS ─────────────────────────────────────────────── */}
      {step === "results" && result && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
            <p className="text-2xl font-bold text-gray-900 mb-1">Import complete 🎉</p>
            <p className="text-sm text-gray-500 mb-6">Here&apos;s a summary of what happened.</p>

            <div className="space-y-3">
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-bold text-green-900 text-xl">{result.imported.toLocaleString()}</p>
                  <p className="text-sm text-green-700">customers imported successfully</p>
                </div>
              </div>

              {result.duplicates > 0 && (
                <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <span className="text-2xl">♻️</span>
                  <div>
                    <p className="font-bold text-blue-900 text-xl">{result.duplicates.toLocaleString()}</p>
                    <p className="text-sm text-blue-700">already existed in Katoomy — skipped</p>
                  </div>
                </div>
              )}

              {result.skipped.length > 0 && (
                <div className="flex items-center justify-between gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div>
                      <p className="font-bold text-amber-900 text-xl">{result.skipped.length.toLocaleString()}</p>
                      <p className="text-sm text-amber-700">rows couldn&apos;t be imported</p>
                    </div>
                  </div>
                  <button
                    onClick={() => downloadSkipped(result.skipped)}
                    className="flex-shrink-0 px-4 py-2 text-sm font-semibold text-amber-800 bg-amber-100 border border-amber-300 rounded-xl hover:bg-amber-200 transition"
                  >
                    ⬇ Download skipped rows
                  </button>
                </div>
              )}
            </div>

            {result.skipped.length > 0 && (
              <div className="mt-4 text-xs text-gray-500 p-3 bg-gray-50 rounded-xl">
                <p className="font-semibold mb-1">Why rows get skipped:</p>
                <ul className="space-y-0.5">
                  <li>· <strong>Invalid or missing phone number</strong> — Katoomy uses phone as the customer identifier</li>
                  <li>· <strong>Already exists in Katoomy</strong> — customer with that phone number was already in your account</li>
                </ul>
                <p className="mt-2">Download the skipped rows file to see exactly who was skipped and why.</p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={reset} className="flex-1 py-3 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition">
              Import Another File
            </button>
            <Link
              href="/admin/customers"
              className="flex-1 py-3 text-sm font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition text-center"
            >
              Go to Customers →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
