type TablePaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  from: number;
  to: number;
  onPageChange: (p: number) => void;
  /** Accessible label for the table this controls */
  label: string;
};

export function TablePagination({ page, totalPages, total, from, to, onPageChange, label }: TablePaginationProps) {
  if (total === 0) return null;

  return (
    <div
      className="flex flex-col gap-3 border-t border-neutral-200 bg-neutral-50/50 px-3 py-2.5 text-sm text-neutral-700 sm:flex-row sm:items-center sm:justify-between"
      role="navigation"
      aria-label={`Pagination for ${label}`}
    >
      <p className="tabular-nums text-xs text-neutral-600">
        Showing <span className="font-medium text-neutral-900">{from}</span>–
        <span className="font-medium text-neutral-900">{to}</span> of{" "}
        <span className="font-medium text-neutral-900">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-800 shadow-sm hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <span className="px-2 text-xs tabular-nums text-neutral-600">
          Page {page} / {totalPages}
        </span>
        <button
          type="button"
          className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-800 shadow-sm hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
