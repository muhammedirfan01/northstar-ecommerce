import "./customers.css";
import { Search, X } from "lucide-react";
import { useState } from "react";
function categories() {
    const [status,setStatus]=useState("All Statuses")
    
  return (
    <>
      <section className="cm-page" aria-labelledby="customers-title">
        <p className="cm-breadcrumb">Category / Category management</p>
        <div className="cm-heading">
          <div>
            <h1 id="customers-title">Category Management</h1>
            <p>Manage and organise Category .</p>
          </div>
          <div className="cm-summary">
            <span>
              <strong></strong>0 Total Categories
            </span>
            <span className="cm-active-text">0 ● Active</span>
            <span className="cm-blocked-text">0 ● Inactive</span>
          </div>
        </div>
        <div className="cm-table-card">
          <div>
            <div className="cm-search">
              <Search size={16} aria-hidden="true" />
              <input
                aria-label="Search customers"
                type="search"
                maxLength={100}
                placeholder="Search by name, email or ID..."
                onChange={(event) => changeSearch(event.target.value)}
              />
              {
                <button
                  className="cm-icon-button"
                  type="button"
                  aria-label="Clear search"
                  onClick={() => changeSearch("")}
                >
                  <X size={15} />
                </button>
              }
            </div>
            <label className="cm-filter">
              Status:
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="blocked">Blocked</option>
              </select>
            </label>
            <button>Add Category</button>
          </div>
          <div className="cm-table-scroll">
            <table className="cm-table">
              <caption className="cm-sr-only">
                Registered customers, latest registered first
              </caption>
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col">Products</th>
                  <th scope="col">Status</th>
                  <th scope="col">Created</th>
                  <th scope="col" className="cm-actions-heading">
                    Actions
                  </th>
                </tr>
              </thead>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
export default categories;
