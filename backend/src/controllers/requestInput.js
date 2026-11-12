// HTTP adaptation stays here; services receive plain inputs.
export function inputFrom(req) {
  return {
    body: req.body || {},
    user: req.user,
    params: req.params || {},
    query: req.query || {},
    file: req.file,
    files: req.files,
  };
}

export function inputWithUrl(req) {
  const input = inputFrom(req);
  const host = req.headers?.host;
  input.apiBaseUrl = "";

  if (host) {
    const protocol = req.protocol || "http";
    input.apiBaseUrl = `${protocol}://${host}/api`;
  }

  return input;
}
