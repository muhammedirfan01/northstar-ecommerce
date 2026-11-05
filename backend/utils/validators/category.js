import {
  checkFields,
  readText,
  readId,
  readBoolean,
} from "../formValidation.js";
export function checkCategoryInput(input) {
  checkFields(input, ["name", "parentId", "isListed", "keepImage"]);
  const name = readText(
    input.name,
    "name",
    2,
    80,
    "Enter a category name with at least 2 characters.",
  );
  let parentId = "";
  if (input.parentId !== undefined && input.parentId !== "") {
    parentId = readId(input.parentId, "parentId").toLowerCase();
  }
  return {
    name,
    parentId,
    isListed: readBoolean(input.isListed, "isListed"),
    keepImage: readBoolean(input.keepImage, "keepImage"),
  };
}
