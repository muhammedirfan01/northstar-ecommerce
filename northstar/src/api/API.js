import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  withCredentials:true,
});
export function isSuccess(response) {
  return response.status >= 200 && response.status < 300;
}
export default API;