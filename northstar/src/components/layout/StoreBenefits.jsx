import { images } from "../../assets/images.js";
const benefits = [
  {
    title: "Explore Products",
    description: "Search, sort and filter",
    icon: images.shipping,
  },
  {
    title: "1 Year Warranty",
    description: "On all products",
    icon: images.warranty,
  },
  {
    title: "24/7 Support",
    description: "We're here to help",
    icon: images.support,
  },
  {
    title: "Cart Review",
    description: "Current prices and stock",
    icon: images.securePayments,
  },
];
export default function StoreBenefits() {
  return (
    <ul className="store-benefits" aria-label="Store benefits">
      {benefits.map((benefit) => (
        <li className="benefit-item" key={benefit.title}>
          <img className="benefit-icon" src={benefit.icon} alt="" />

          <div>
            <p className="benefit-title">{benefit.title}</p>
            <p className="benefit-description">{benefit.description}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
