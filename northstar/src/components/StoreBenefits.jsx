const benefits = [
  {
    title: "Explore Products",
    description: "Search, sort and filter",
    icon: "/free_shipping_icon.png",
  },
  {
    title: "1 Year Warranty",
    description: "On all products",
    icon: "/warranty_icon.png",
  },
  {
    title: "24/7 Support",
    description: "We're here to help",
    icon: "/24_icon.png",
  },
  {
    title: "Cart Review",
    description: "Current prices and stock",
    icon: "/securepayments_icon.png",
  },
];

export default function StoreBenefits() {
  return (
    <ul className="store-benefits" aria-label="Store benefits">
      {benefits.map((benefit) => (
        <li className="benefit-item" key={benefit.title}>
          <img
            className="benefit-icon"
            src={benefit.icon}
            alt=""
          />

          <div>
            <p className="benefit-title">{benefit.title}</p>
            <p className="benefit-description">
              {benefit.description}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}