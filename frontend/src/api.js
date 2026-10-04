import axios from 'axios';

export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

export const setAdminToken = token => {
	if (token) {
		axios.defaults.headers.common.Authorization = `Bearer ${token}`;
	} else {
		delete axios.defaults.headers.common.Authorization;
	}
};

setAdminToken(localStorage.getItem('adminToken'));

axios.interceptors.response.use(
	response => response,
	error => {
		if (error.response?.status === 401 && !error.config?.url?.endsWith('/admin/login')) {
			localStorage.removeItem('adminToken');
			setAdminToken(null);
			window.location.assign('/admin');
		}
		return Promise.reject(error);
	}
);
