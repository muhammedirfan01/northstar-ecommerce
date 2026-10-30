export function nameError(value) {
  const name = value.trim();
  const letters = name.match(/\p{L}/gu) || [];
  if (name.length < 2 || name.length > 80 || letters.length < 2) {
    return "Enter a name with at least 2 letters and no more than 80 characters.";
  }
  if (!/^[\p{L}\p{M} .'-]+$/u.test(name)) {
    return "Use letters, spaces, apostrophes, periods or hyphens in your name.";
  }
  return "";
}
