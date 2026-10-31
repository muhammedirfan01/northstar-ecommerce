import * as reviews from "../services/reviewService.js";

export async function list(req, res) {
  return res.json({
    success: true,
    data: await reviews.listReviews(req.params.id, req.reviewPage),
  });
}
export async function adminList(req, res) {
  return res.json({
    success: true,
    data: await reviews.listReviews(req.params.id, req.reviewPage, true),
  });
}
export async function eligibility(req, res) {
  return res.json({
    success: true,
    data: await reviews.reviewEligibility(req.params.id, req.user.id),
  });
}
export async function save(req, res) {
  return res.json({
    success: true,
    data: await reviews.saveReview(
      req.params.id,
      req.user.id,
      req.reviewInput,
      req.files || [],
    ),
  });
}
export async function moderate(req, res) {
  return res.json({
    success: true,
    data: await reviews.moderateReview(
      req.params.id,
      req.params.reviewId,
      req.catalogInput.isListed,
    ),
  });
}
export async function remove(req, res) {
  await reviews.deleteReview(req.params.id, req.params.reviewId);
  return res.json({ success: true, data: {} });
}
