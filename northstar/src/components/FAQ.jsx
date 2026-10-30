const questions = [
  {
    question: "When will my order arrive, and how much does delivery cost?",
    answer:
      "Delivery estimates and applicable shipping charges are shown at checkout based on your delivery address.",
  },
  {
    question: "Can I return or replace a product?",
    answer:
      "Return and replacement eligibility depends on the product and its condition. Please check our Return Policy for the applicable conditions and deadlines before purchasing.",
  },
  {
    question: "What should I do if my product arrives damaged or incorrect?",
    answer:
      "Contact our support team with your order number and clear photos of the product and packaging. Keep the original packaging while we review your request.",
  },
  {
    question: "Do products come with a warranty?",
    answer:
      "Warranty coverage varies by brand and product. Check the product page for the warranty period, coverage, and claim instructions.",
  },{
    question: "How can I track my order?",
    answer:
      "Once your order has shipped, open its details under My Orders to find the available tracking information.",
  },
];

export default function FAQ() {
  return (
    <section className="faq-section" aria-labelledby="faq-heading">
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