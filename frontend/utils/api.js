import axios from "axios";

const API_BASE_URL = "https://association1.onrender.com/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;