import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5050/api';

export const getAvailableCars = () => {
  return axios.get(`${API_URL}/cars`);
};

export const getCarDetails = (carId) => {
  return axios.get(`${API_URL}/cars/${carId}`);
};

export const createCarListing = (carData) => {
  return axios.post(`${API_URL}/cars`, carData);
};