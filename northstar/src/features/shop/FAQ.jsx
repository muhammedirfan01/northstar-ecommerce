const questions = [
  {
    question: "How can I find a product?",
    answer:
      "Search the catalog, filter by category and price range, and sort the results by price or name.",
  },
  {
    question: "Where can I see product details?",
    answer:
      "Open a product to view its images, description, price, highlights, and current stock availability.",
  },
  {
    question: "Can I save products for later?",
    answer:
      "Use the wishlist button on a product. Adding a saved product to your cart removes it from your wishlist.",
  },
  {
    question: "Why can't I increase an item's quantity?",
    answer:
      "Cart quantities are limited by current stock and the maximum quantity allowed for each item.",
  },
  {
    question: "Why did my cart total change?",
    answer:
      "The cart uses current product prices. Checkout review checks prices and stock again so you can review any changes.",
  },
];
export default function FAQ() {
  return (
    <section id="support" className="faq-section" aria-labelledby="faq-heading">
      <div className="section-heading">
        <h2 id="faq-heading">Frequently Asked Questions</h2>
      </div>

      {questions.map((item) => (
        <details className="faq-item" key={item.question}>
          <summary>{item.question}</summary>
          <p>{item.answer}</p>
        </details>
      ))}
    </section>
  );
}
