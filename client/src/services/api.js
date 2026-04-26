import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Called from AuthSync component (App.jsx) whenever the Clerk token changes
export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

export const ridersApi = {
  getAll:   (search = '') => api.get('/riders',     { params: search ? { search } : {} }),
  getMe:    ()            => api.get('/riders/me'),
  getById:  (id)          => api.get(`/riders/${id}`),
  create:   (data)        => api.post('/riders',    data),
  update:   (id, data)    => api.put(`/riders/${id}`, data),
  delete:   (id)          => api.delete(`/riders/${id}`),
};

export const driversApi = {
  getAll:   (search = '') => api.get('/drivers',        { params: search ? { search } : {} }),
  getById:  (id)          => api.get(`/drivers/${id}`),
  getStats: ()            => api.get('/drivers/stats'),
  create:   (data)        => api.post('/drivers',       data),
  update:   (id, data)    => api.put(`/drivers/${id}`,  data),
  delete:   (id)          => api.delete(`/drivers/${id}`),
};

export const ridesApi = {
  getAll:   (params = {}) => api.get('/rides',      { params }),
  getById:  (id)          => api.get(`/rides/${id}`),
  create:   (data)        => api.post('/rides',     data),
  update:   (id, data)    => api.put(`/rides/${id}`, data),
  delete:   (id)          => api.delete(`/rides/${id}`),
};

export const paymentsApi = {
  getAll:   ()         => api.get('/payments'),
  getById:  (id)       => api.get(`/payments/${id}`),
  create:   (data)     => api.post('/payments',     data),
  update:   (id, data) => api.put(`/payments/${id}`, data),
  delete:   (id)       => api.delete(`/payments/${id}`),
};

export const aiApi = {
  getDestinationSuggestions: (destination) =>
    api.post('/ai/destination-suggestions', { destination }),
};

export default api;
