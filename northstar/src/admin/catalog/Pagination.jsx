export default function Pagination({
  pagination,
  onPage,
  onLimit,
  itemLabel = "results",
  disabled = false,
}) {
  const { page, totalPages, total, limit } = pagination;

  return (
    <div className="cm-pagination">
      <span>{total} {itemLabel}</span>
      <nav aria-label={`${itemLabel} pagination`}>
        <button
          type="button"
          disabled={disabled || page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </button>
        <span>Page {page} of {totalPages}</span>
        <button
          type="button"
          disabled={disabled || page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </nav>
      <label>
        Rows per page:
        <select
          value={limit}
          disabled={disabled}
          onChange={(event) => onLimit(Number(event.target.value))}
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={20}>20</option>
        </select>
      </label>
    </div>
  );
}
