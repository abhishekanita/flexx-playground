import { API_URL } from '@/config';
import Axios, { type AxiosInstance } from 'axios';

class AxiosInterceptor {
    axiosInstance: AxiosInstance;
    get: AxiosInstance['get'];
    post: AxiosInstance['post'];
    put: AxiosInstance['put'];
    patch: AxiosInstance['patch'];
    delete: AxiosInstance['delete'];

    constructor(instanceConfig = {}) {
        // Initialize Axios instance with provided configuration
        this.axiosInstance = Axios.create({
            ...instanceConfig,
        });

        // Add request interceptor
        this.axiosInstance.interceptors.request.use(
            config => {
                const accessToken = this.getAccessToken();
                if (accessToken) {
                    config.headers.Authorization = `Bearer ${JSON.parse(accessToken)}`;
                }
                return config;
            },
            error => Promise.reject(error)
        );

        // Bind instance methods for convenience
        this.get = this.axiosInstance.get.bind(this.axiosInstance);
        this.post = this.axiosInstance.post.bind(this.axiosInstance);
        this.put = this.axiosInstance.put.bind(this.axiosInstance);
        this.patch = this.axiosInstance.patch.bind(this.axiosInstance);
        this.delete = this.axiosInstance.delete.bind(this.axiosInstance);
    }

    getAccessToken() {
        return localStorage.getItem('auth-token');
    }
}

export const axios = new AxiosInterceptor({
    baseURL: API_URL + '/api/v1/',
});
