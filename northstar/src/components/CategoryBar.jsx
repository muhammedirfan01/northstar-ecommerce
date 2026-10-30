const categories = [
  { name: "Laptops", icon: "/laptop_icon.png" },
  { name: "Mobiles", icon: "/smartphone_icon.png" },
  { name: "Audio", icon: "/audio_icon.png" },
  { name: "Smartwatches", icon: "/smartwatch_icon.png" },
  { name: "Gaming", icon: "/game_icon.png" },
  { name: "TV & Home Theatre", icon: "/tv_icon.png" },
  { name: "Cameras", icon: "/camera_icon.png" },
  { name: "Accessories", icon: "/accessories_icon.png" },
];

export default function CategoryBar() {
  return (
    <nav className="category-bar" aria-label="Product categories">
      {categories.map((category) => (
        <a
          className="category-link"
          href="#"
          key={category.name}
        >
          <img
            className="category-icon"
            src={category.icon}
            alt="category"
          />

          <span>{category.name}</span>
        </a>
      ))}
    </nav>
  );
}