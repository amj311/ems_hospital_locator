import axios from "axios";
import { AuthService } from "./authService";
import { CryptoUtils } from "core/utils/crypto";

const baseURL = window.location.href.includes('localhost:517') ? 'http://localhost:5001/api' : '/api'

const request = axios.create({
	baseURL,
})

request.interceptors.request.use(async (config) => {
	const token = await CryptoUtils.sha256Hash(AuthService.getValidToken() || '');
	if (token) {
		config.headers.Authorization = token;
	}
	return config;
});


request.interceptors.response.use(null, (error) => {
	if (error.isAxiosError && error.response?.status === 401) {
		console.log("Received unauthorized response. Logging out");
		AuthService.clearSession();
	}
	throw error;
})

export default request;