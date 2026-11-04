// Test support: call the real controller and inspect its response without starting a server.
export async function controllerData(controller, req) {
  let status = 200;
  let result;
  const res = {
    status(value) {
      status = value;
      return this;
    },
    json(value) {
      result = value;
      return this;
    },
  };
  await controller(req, res);
  if (status >= 400) {
    const error = new Error(result.message);
    error.status = status;
    error.data = result.data;
    throw error;
  }
  return result.data;
}
export function validationCase(check) {
  return {
    parse: check,
    safeParse(input) {
      try {
        return {
          success: true,
          data: check(input),
        };
      } catch (error) {
        return {
          success: false,
          error,
        };
      }
    },
  };
}
