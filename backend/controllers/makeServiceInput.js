// HTTP adaptation stays here; services receive plain inputs.
export function makeServiceInput(req) {
  return {
    body: req.body || {},
    user: req.user,
    params: req.params || {},
    query: req.query || {},
    file: req.file,
    files: req.files,
  };
}

export function makePublicServiceInput(req) {
  return {
    ...makeServiceInput(req),
    apiBaseUrl: req.headers?.host
      ? `${req.protocol || "http"}://${req.headers.host}/api`
      : "",
  };
}
