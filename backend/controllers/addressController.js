import * as addressService from "../services/addressService.js";

export async function getAddresses(req, res) {
  const result = await addressService.getAddresses({
    user: req.user,
  });
  return res.status(result.status).json(result.body);
}

export async function addAddress(req, res) {
  const result = await addressService.addAddress({
    user: req.user,
    body: req.body,
  });
  return res.status(result.status).json(result.body);
}

export async function editAddress(req, res) {
  const result = await addressService.editAddress({
    user: req.user,
    params: req.params,
    body: req.body,
  });
  return res.status(result.status).json(result.body);
}

export async function deleteAddress(req, res) {
  const result = await addressService.deleteAddress({
    user: req.user,
    params: req.params,
    body: req.body,
  });
  return res.status(result.status).json(result.body);
}

export async function setDefaultAddress(req, res) {
  const result = await addressService.setDefaultAddress({
    user: req.user,
    params: req.params,
    body: req.body,
  });
  return res.status(result.status).json(result.body);
}
