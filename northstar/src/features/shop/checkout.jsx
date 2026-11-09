import "./checkout.css";
function Checkout() {
  return (
    <div className="checkout-container">

      <div className="checkout-left">
        <section className="checkout-address">
          <h2>Delivery Address</h2>
        </section>
        {/* Payment Section */}
        <section className="checkout-payment">
          <h2>Payment Method</h2>
        </section>
      </div>
      <div className="checkout-right">
        {/* Order Summary Section */}
        <section className="checkout-ordersummary">
          <h2>Order Summary</h2>
        </section>
      </div>

    </div>
  );
}

export default Checkout;