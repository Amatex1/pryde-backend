import { API_BASE_URL } from "../config/api.js"; // include .js extension
import axios from "axios";
import { getAuthToken } from "./auth";

const api = axios.create({
  baseURL: API_BASE_URL
});

// Add auth token
api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
