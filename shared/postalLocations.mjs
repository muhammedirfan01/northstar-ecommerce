const aliases = {
  bangalore: "bengaluru",
  cochin: "kochi",
  fortkochi: "kochi",
  fortcochin: "kochi",
  calcutta: "kolkata",
  madras: "chennai",
  trivandrum: "thiruvananthapuram",
  gurgaon: "gurugram",
  mysore: "mysuru",
  mangalore: "mangaluru",
  bombay: "mumbai",
  newdelhi: "delhi",
};
export function normalizeCity(value) {
  const name = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+(?:g\.?p\.?o\.?|h\.?o\.?|s\.?o\.?|b\.?o\.?)$/i, "")
    .replace(/[^a-z0-9]/g, "");
  return aliases[name] || name;
}
export function cityMatches(city, locations) {
  const name = normalizeCity(city);
  return Boolean(
    name && locations?.some((location) => normalizeCity(location) === name),
  );
}
