/** Ports of the services a run starts — apart from the dev servers' 4000 / 4001 / 5173. */
export const AUTH_PORT = 4101;
export const API_PORT = 4100;
export const ADMIN_PORT = 4173;
export const AUTH_URL = `http://localhost:${AUTH_PORT}/v1`;
export const API_URL = `http://localhost:${API_PORT}/v1`;
