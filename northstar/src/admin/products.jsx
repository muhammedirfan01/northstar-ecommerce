import "./Customers.css";
function Products(){
    return(
        <>
      <section className="cm-page" aria-labelledby="customers-title">
        <p className="cm-breadcrumb">Products / Products management</p>
        <div className="cm-heading">
          <div>
            <h1 id="customers-title">Products Management</h1>
            <p>Manage and Organise Products.</p>
          </div>
          <div className="cm-summary">
            <span>
              <strong></strong>0 Total Products
            </span>
            <span className="cm-active-text">0 ● Published</span>
            <span className="cm-blocked-text">0 ● Low Stock</span>
          </div>
        </div>
        <div className="cm-table-card">
          </div>
          <div className="cm-table-scroll">
            <table className="cm-table">
              <caption className="cm-sr-only">
                Registered customers, latest registered first
              </caption>
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Category</th>
                  <th scope="col">Price</th>
                  <th scope="col">Stock</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="cm-actions-heading">
                    Actions
                  </th>
                </tr>
              </thead>
            </table>
          </div>
        
      
      </section>
        </>
    )
}
export default Products;