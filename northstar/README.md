# Northstar frontend

React/Vite frontend for accounts, profiles, addresses, customer management.
The admin dashboard currently displays frontend-only zero values. It does not request dashboard data from the backend.

Run npm run dev for development, npm run lint for lint checks, and npm run build for the production build.

Backend requests use Axios through src/api/request.js. That shared client sends JSON or FormData, includes login cookies with withCredentials: true, and handles API errors.

Authentication uses an eight-hour JWT in an HttpOnly cookie. Password and Google login use the same cookie.
