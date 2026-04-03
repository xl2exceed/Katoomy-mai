"use client";

interface PaginationProps {
  total: number;
  perPage: number;
  page: number;
  onPageChange: (p: number) => void;
  onPerPageChange: (n: number) => void;
  mobile?: boolean;
}

export default function Pagination({ total, perPage, page, onPageChange, onPerPageChange, mobile }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (total === 0) return null;

  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  const btn = mobile
    ? "px-4 py-2.5 text-base font-semibold text-gray-900 rounded border-2 border-gray-500 bg-white disabled:opacity-40 hover:bg-gray-100 active:bg-gray-200 transition"
    : "px-2 py-1 text-sm text-gray-700 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition";

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white flex-wrap gap-2">
      <div className={`flex items-center gap-2 ${mobile ? "text-base text-gray-800" : "text-sm text-gray-600"}`}>
        <span>Per page:</span>
        <select
          value={perPage}
          onChange={(e) => { onPerPageChange(Number(e.target.value)); onPageChange(1); }}
          className={`rounded bg-white ${mobile ? "border-2 border-gray-500 px-2 py-2 text-base text-gray-900 font-medium" : "border border-gray-300 px-2 py-1 text-sm"}`}
        >
          {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <span className={mobile ? "text-sm text-gray-700 font-medium" : "text-xs text-gray-400"}>{start}–{end} of {total}</span>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(1)} disabled={page === 1} className={btn}>«</button>
        <button onClick={() => onPageChange(page - 1)} disabled={page === 1} className={btn}>‹</button>
        <span className={`px-3 py-1 font-medium ${mobile ? "text-base text-gray-900" : "text-sm text-gray-700"}`}>{page} / {totalPages}</span>
        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className={btn}>›</button>
        <button onClick={() => onPageChange(totalPages)} disabled={page >= totalPages} className={btn}>»</button>
      </div>
    </div>
  );
}
