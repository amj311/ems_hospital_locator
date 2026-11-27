import axios from "axios";
import { AuthService } from "./authService";
import { CryptoUtils } from "@core/utils/crypto";
import { Capacitor } from "@capacitor/core";

const getBaseURL = () => {
	const configuredBaseURL = import.meta.env.VITE_API_BASE_URL;
	if (configuredBaseURL) {
		return configuredBaseURL;
	}

    // 1. If we are running on a native device (Android/iOS)
    if (Capacitor.isNativePlatform()) {
        // REPLACE '192.168.1.XX' with your actual computer IP
        return 'http://192.168.1.111:5001/api'; 
    }

    // 2. If we are running in a browser (web dev)
    return window.location.href.includes(':517') 
        ? location.href.split(':517')[0] + ':5001/api' 
        : '/api';
}

const baseURL = getBaseURL();
const request = axios.create({
	baseURL,
})

request.interceptors.request.use(async (config) => {
	const token = AuthService.getValidToken() ? await CryptoUtils.sha256Hash(AuthService.getValidToken()!) : null;
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