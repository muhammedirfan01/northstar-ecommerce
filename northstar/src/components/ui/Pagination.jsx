export default function Pagination({
  pagination,
  onPage,
  onLimit,
  itemLabel = "results",
  disabled = false,
  pageSizes = [5, 10, 20],
}) {
  const page = pagination.page;
  const totalPages = pagination.totalPages;
  const total = pagination.total;
  const limit = pagination.limit;

  function previousPage() {
    onPage(page - 1);
  }

  function nextPage() {
    onPage(page + 1);
  }

  function changeLimit(event) {
    const rowsPerPage = Number(event.target.value);
    onLimit(rowsPerPage);
  }

  return (
    <div className="cm-pagination">
      <span>
        {total} {itemLabel}
      </span>
      <nav aria-label={`${itemLabel} pagination`}>
        <button
          type="button"
          disabled={disabled || page <= 1}
          onClick={previousPage}
        >
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          disabled={disabled || page >= totalPages}
          onClick={nextPage}
        >
          Next
        </button>
      </nav>
      <label>
        Rows per page:
        <select value={limit} disabled={disabled} onChange={changeLimit}>
          {[...new Set([...pageSizes, limit])]
            .sort((a, b) => a - b)
            .map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
        </select>
      </label>
    </div>
  );
}
