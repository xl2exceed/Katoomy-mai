"use client";

interface PaginationProps {
  total: number;
  perPage: number;
  page: number;
  onPageChange: (p: number) => void;
  onPerPageChange: (n: number) => void;
}

export default function Pagination({ total, perPage, page, onPageChange, onPerPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (total === 0) return null;

  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white flex-wrap gap-2">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span>Per page:</span>
        <select
          value={perPage}
          onChange={(e) => { onPerPageChange(Number(e.target.value)); onPageChange(1); }}
          className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
        >
          {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <span className="text-gray-400 text-xs">{start}–{end} of {total}</span>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(1)} disabled={page === 1}
          className="px-2 py-1 text-sm text-gray-700 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition">
          «
        </button>
        <button onClick={() => onPageChange(page - 1)} disabled={page === 1}
          className="px-2 py-1 text-sm text-gray-700 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition">
          ‹
        </button>
        <span className="px-3 py-1 text-sm font-medium text-gray-700">{page} / {totalPages}</span>
        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
          className="px-2 py-1 text-sm text-gray-700 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition">
          ›
        </button>
        <button onClick={() => onPageChange(totalPages)} disabled={page >= totalPages}
          className="px-2 py-1 text-sm text-gray-700 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition">
          »
        </button>
      </div>
    </div>
  );
}
