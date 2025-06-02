// import axios from 'axios';

// const API_BASE_URL = 'http://localhost:5000/api';

// const api = axios.create({
//   baseURL: API_BASE_URL,
//   headers: {
//     'Content-Type': 'application/json',
//   },
// });

// export const carAPI = {
//   getAllCars: () => api.get('/cars'),
//   getCarById: (id) => api.get(`/cars/${id}`),
//   addCar: (carData) => api.post('/cars', carData),
//   updateCarAvailability: (id, isAvailable) => 
//     api.patch(`/cars/${id}/availability`, { isAvailable }),
// };

// export const rentalAPI = {
//   getUserRentals: (address) => api.get(`/rentals/user/${address}`),
//   createRental: (rentalData) => api.post('/rentals', rentalData),
//   updateRentalStatus: (id, status) => 
//     api.patch(`/rentals/${id}/status`, { status }),
// };

// export default api;

// src/services/api.js
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

class ApiService {
  static async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'API request failed');
      }
      
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Car-related API calls
  static async getAllCars() {
    return this.request('/cars');
  }

  static async getCarById(carId) {
    return this.request(`/cars/${carId}`);
  }

  static async createCar(carData) {
    return this.request('/cars', {
      method: 'POST',
      body: carData,
    });
  }

  static async updateCar(carId, carData) {
    return this.request(`/cars/${carId}`, {
      method: 'PUT',
      body: carData,
    });
  }

  static async deleteCar(carId) {
    return this.request(`/cars/${carId}`, {
      method: 'DELETE',
    });
  }

  // Booking-related API calls
  static async bookCar(carId, bookingData) {
    return this.request(`/cars/${carId}/book`, {
      method: 'POST',
      body: bookingData,
    });
  }

  static async cancelBooking(carId, transactionData) {
    return this.request(`/cars/${carId}/cancel`, {
      method: 'PUT',
      body: transactionData,
    });
  }

  static async completeRental(carId, transactionData) {
    return this.request(`/cars/${carId}/complete`, {
      method: 'PUT',
      body: transactionData,
    });
  }

  // Rental history
  static async getCarRentals(carId) {
    return this.request(`/cars/${carId}/rentals`);
  }

  static async getUserRentals(userAddress) {
    return this.request(`/rentals/user/${userAddress}`);
  }
}

export default ApiService;