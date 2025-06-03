import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import './App.css';
// Replace with your actual contract address
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// Your contract ABI
const CarRentalABI = [
  "function carCount() view returns (uint256)",
  "function cars(uint256) view returns (uint256 id, address owner, uint256 pricePerDay, uint256 depositAmount, bool isAvailable, string metadataURI)",
  "function rentals(uint256) view returns (address renter, uint256 startTime, uint256 endTime, bool isActive)",
  "function listCar(uint256 pricePerDay, uint256 depositAmount, string metadataURI)",
  "function bookCar(uint256 carId, uint256 startTime, uint256 endTime) payable",
  "function cancelBooking(uint256 carId)",
  "function completeRental(uint256 carId)",
  "function getAvailableCars() view returns (uint256[])",
  "function getRentalInfo(uint256 carId) view returns (address renter, uint256 startTime, uint256 endTime, bool isActive)",
  "event CarListed(uint256 indexed carId, address indexed owner, uint256 pricePerDay, uint256 depositAmount, string metadataURI)",
  "event CarBooked(uint256 indexed carId, address indexed renter, uint256 startTime, uint256 endTime, uint256 paidAmount)",
  "event BookingCancelled(uint256 indexed carId, address indexed renter, uint256 refundAmount)",
  "event RentalCompleted(uint256 indexed carId, address indexed renter, uint256 ownerPayout, uint256 renterRefund)"
];

// Mock API Service for development
const ApiService = {
  async getAllCars() {
    // Mock data - replace with actual API call
    return [];
  },

  async createCar(carData) {
    console.log('Creating car in database:', carData);
    // Mock implementation - replace with actual API call
    return { success: true };
  },

  async bookCar(carId, bookingData) {
    console.log('Booking car in database:', carId, bookingData);
    // Mock implementation - replace with actual API call
    return { success: true };
  },

  async cancelBooking(carId, data) {
    console.log('Cancelling booking in database:', carId, data);
    // Mock implementation - replace with actual API call
    return { success: true };
  },

  async completeRental(carId, data) {
    console.log('Completing rental in database:', carId, data);
    // Mock implementation - replace with actual API call
    return { success: true };
  }
};

function App() {
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState("");
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("browse");
  const [notification, setNotification] = useState({ message: "", type: "", show: false });

  // Form states
  const [listCarForm, setListCarForm] = useState({
    pricePerDay: "",
    depositAmount: "",
    metadataURI: "",
    carBrand: "",
    carModel: "",
    carYear: "",
    carColor: "",
    carType: "",
    carImage: "",
    location: "",
    features: "",
    description: ""
  });

  useEffect(() => {
    initializeContract();
    connectWallet();
  }, []);

  useEffect(() => {
    if (contract) {
      loadCars();
    }
  }, [contract]);

  const showNotification = (message, type = "info") => {
    setNotification({ message, type, show: true });
    setTimeout(() => {
      setNotification({ message: "", type: "", show: false });
    }, 5000);
  };

  const initializeContract = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const carRental = new ethers.Contract(CONTRACT_ADDRESS, CarRentalABI, signer);
        setContract(carRental);
      } catch (error) {
        console.error("Error initializing contract:", error);
        showNotification("Error initializing contract", "error");
      }
    } else {
      showNotification("Please install MetaMask!", "error");
    }
  };

  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts"
        });
        setAccount(accounts[0]);
        showNotification("Wallet connected!", "success");
      } catch (error) {
        showNotification("Connection failed: " + error.message, "error");
      }
    } else {
      showNotification("Please install MetaMask!", "error");
    }
  };

  const loadCars = async () => {
    if (!contract) return;

    setLoading(true);
    try {
      // Get data from smart contract
      const carCount = await contract.carCount();
      const carPromises = [];

      for (let i = 1; i <= carCount; i++) {
        carPromises.push(contract.cars(i));
      }

      const contractCarData = await Promise.all(carPromises);

      // Get data from database
      let dbCars = [];
      try {
        dbCars = await ApiService.getAllCars();
      } catch (error) {
        console.warn("Could not fetch data from database:", error);
      }

      // Merge data from smart contract and database
      const mergedCars = contractCarData.map((contractCar, index) => {
        const carId = contractCar.id.toString();
        const dbCar = dbCars.find(car => car.carId === carId) || {};

        return {
          id: carId,
          owner: contractCar.owner,
          pricePerDay: ethers.formatEther(contractCar.pricePerDay),
          depositAmount: ethers.formatEther(contractCar.depositAmount),
          isAvailable: contractCar.isAvailable,
          metadataURI: contractCar.metadataURI,
          // Additional data from database
          carBrand: dbCar.carBrand || '',
          carModel: dbCar.carModel || '',
          carYear: dbCar.carYear || '',
          carColor: dbCar.carColor || '',
          carType: dbCar.carType || '',
          carImage: dbCar.carImage || '',
          location: dbCar.location || '',
          features: dbCar.features || [],
          description: dbCar.description || contractCar.metadataURI
        };
      });

      setCars(mergedCars);
    } catch (error) {
      console.error("Error loading cars:", error);
      showNotification("Error loading cars", "error");
    }
    setLoading(false);
  };

  const listCar = async () => {
    if (!contract) {
      showNotification("Contract not initialized", "error");
      return;
    }

    if (!listCarForm.pricePerDay || !listCarForm.depositAmount || !listCarForm.metadataURI) {
      showNotification("Please fill in required fields", "error");
      return;
    }

    setLoading(true);
    try {
      const pricePerDayWei = ethers.parseEther(listCarForm.pricePerDay);
      const depositAmountWei = ethers.parseEther(listCarForm.depositAmount);

      // List car in smart contract
      const tx = await contract.listCar(
        pricePerDayWei,
        depositAmountWei,
        listCarForm.metadataURI
      );

      const receipt = await tx.wait();

      // Get car ID from event
      const carListedEvent = receipt.logs.find(log => {
        try {
          const parsed = contract.interface.parseLog(log);
          return parsed.name === 'CarListed';
        } catch (e) {
          return false;
        }
      });

      let carId;
      if (carListedEvent) {
        const parsed = contract.interface.parseLog(carListedEvent);
        carId = parsed.args.carId.toString();
      } else {
        // Fallback: get from carCount
        const count = await contract.carCount();
        carId = count.toString();
      }

      // Save additional data to database
      const carData = {
        carId,
        owner: account,
        pricePerDay: listCarForm.pricePerDay,
        depositAmount: listCarForm.depositAmount,
        metadataURI: listCarForm.metadataURI,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        carBrand: listCarForm.carBrand,
        carModel: listCarForm.carModel,
        carYear: listCarForm.carYear,
        carColor: listCarForm.carColor,
        carType: listCarForm.carType,
        carImage: listCarForm.carImage,
        location: listCarForm.location,
        features: listCarForm.features.split(',').map(f => f.trim()).filter(f => f),
        description: listCarForm.description
      };

      try {
        await ApiService.createCar(carData);
      } catch (error) {
        console.warn("Could not save to database:", error);
      }

      showNotification("Car listed successfully!", "success");

      setListCarForm({
        pricePerDay: "",
        depositAmount: "",
        metadataURI: "",
        carBrand: "",
        carModel: "",
        carYear: "",
        carColor: "",
        carType: "",
        carImage: "",
        location: "",
        features: "",
        description: ""
      });

      loadCars();
    } catch (error) {
      console.error("Error listing car:", error);
      showNotification("Error listing car: " + error.message, "error");
    }
    setLoading(false);
  };

  const bookCar = async (carId, startDate, endDate) => {
    if (!contract) return;

    const car = cars.find(c => c.id === carId);
    if (!car) return;

    const startTime = Math.floor(new Date(startDate).getTime() / 1000);
    const endTime = Math.floor(new Date(endDate).getTime() / 1000);
    const days = Math.ceil((endTime - startTime) / 86400);

    const totalCost = ethers.parseEther((parseFloat(car.pricePerDay) * days + parseFloat(car.depositAmount)).toString());

    setLoading(true);
    try {
      // Book car in smart contract
      const tx = await contract.bookCar(carId, startTime, endTime, {
        value: totalCost
      });

      const receipt = await tx.wait();

      // Save booking to database
      const bookingData = {
        renter: account,
        startTime,
        endTime,
        totalAmount: ethers.formatEther(totalCost),
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber
      };

      try {
        await ApiService.bookCar(carId, bookingData);
      } catch (error) {
        console.warn("Could not save booking to database:", error);
      }

      showNotification("Car booked successfully!", "success");
      loadCars();
    } catch (error) {
      console.error("Error booking car:", error);
      showNotification("Error booking car: " + error.message, "error");
    }
    setLoading(false);
  };

  const cancelBooking = async (carId) => {
    if (!contract) return;

    setLoading(true);
    try {
      // Cancel booking in smart contract
      const tx = await contract.cancelBooking(carId);
      const receipt = await tx.wait();

      // Update status in database
      try {
        await ApiService.cancelBooking(carId, {
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber
        });
      } catch (error) {
        console.warn("Could not update database:", error);
      }

      showNotification("Booking cancelled successfully!", "success");
      loadCars();
    } catch (error) {
      console.error("Error cancelling booking:", error);
      showNotification("Error cancelling booking: " + error.message, "error");
    }
    setLoading(false);
  };

  const completeRental = async (carId) => {
    if (!contract) return;

    setLoading(true);
    try {
      // Complete rental in smart contract
      const tx = await contract.completeRental(carId);
      const receipt = await tx.wait();

      // Update status in database
      try {
        await ApiService.completeRental(carId, {
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber
        });
      } catch (error) {
        console.warn("Could not update database:", error);
      }

      showNotification("Rental completed successfully!", "success");
      loadCars();
    } catch (error) {
      console.error("Error completing rental:", error);
      showNotification("Error completing rental: " + error.message, "error");
    }
    setLoading(false);
  };

  const CarCard = ({ car, onRefresh }) => {
    const [showBookingForm, setShowBookingForm] = useState(false);
    const [showReturnForm, setShowReturnForm] = useState(false);
    const [bookingData, setBookingData] = useState({
      startDate: '',
      endDate: '',
      pickupTime: '12:00',
      rentalDays: 1,
      specialRequests: ''
    });
    const [returnData, setReturnData] = useState({
      condition: 'excellent',
      notes: '',
      fuelLevel: 'full'
    });
    const [currentRental, setCurrentRental] = useState(null);

    const isOwner = car.owner.toLowerCase() === account?.toLowerCase();
    const isRentedByMe = currentRental?.renter.toLowerCase() === account?.toLowerCase();

    // Load rental info when component mounts
    useEffect(() => {
      const loadRentalInfo = async () => {
        if (contract && car.id) {
          try {
            const rentalInfo = await contract.getRentalInfo(car.id);
            if (rentalInfo.isActive) {
              setCurrentRental({
                renter: rentalInfo.renter,
                startTime: new Date(rentalInfo.startTime * 1000),
                endTime: new Date(rentalInfo.endTime * 1000),
                isActive: rentalInfo.isActive
              });
            }
          } catch (error) {
            console.error("Error loading rental info:", error);
          }
        }
      };
      loadRentalInfo();
    }, [contract, car.id]);

    const handleBookingChange = (e) => {
      const { name, value } = e.target;
      setBookingData(prev => ({
        ...prev,
        [name]: value
      }));

      // Calculate end date if rental days changed
      if (name === 'rentalDays' && bookingData.startDate) {
        const startDate = new Date(bookingData.startDate);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + parseInt(value, 10));
        setBookingData(prev => ({
          ...prev,
          endDate: endDate.toISOString().split('T')[0]
        }));
      }
    };

    const handleReturnChange = (e) => {
      const { name, value } = e.target;
      setReturnData(prev => ({
        ...prev,
        [name]: value
      }));
    };

    const calculateTotalCost = () => {
      if (!bookingData.startDate || !bookingData.endDate) return 0;
      const start = new Date(bookingData.startDate);
      const end = new Date(bookingData.endDate);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      return (parseFloat(car.pricePerDay) * days + parseFloat(car.depositAmount)).toFixed(4);
    };

    const handleBookCar = async () => {
      if (!contract || !bookingData.startDate || !bookingData.endDate) return;

      setLoading(true);
      try {
        const startTime = Math.floor(new Date(`${bookingData.startDate}T${bookingData.pickupTime}`).getTime() / 1000);
        const endTime = Math.floor(new Date(`${bookingData.endDate}T${bookingData.pickupTime}`).getTime() / 1000);
        const totalCost = ethers.parseEther(calculateTotalCost());

        const tx = await contract.bookCar(car.id, startTime, endTime, {
          value: totalCost
        });
        await tx.wait();

        // Save booking to database
        await ApiService.bookCar(car.id, {
          renter: account,
          startTime,
          endTime,
          totalAmount: ethers.formatEther(totalCost),
          specialRequests: bookingData.specialRequests,
          transactionHash: tx.hash
        });

        showNotification("Car booked successfully!", "success");
        setShowBookingForm(false);
        onRefresh();
      } catch (error) {
        console.error("Error booking car:", error);
        showNotification(`Error booking car: ${error.message}`, "error");
      }
      setLoading(false);
    };

    const handleReturnCar = async () => {
      if (!contract) return;

      setLoading(true);
      try {
        const tx = await contract.completeRental(car.id);
        await tx.wait();

        // Save return info to database
        await ApiService.completeRental(car.id, {
          returnedBy: account,
          returnCondition: returnData.condition,
          returnNotes: returnData.notes,
          fuelLevel: returnData.fuelLevel,
          transactionHash: tx.hash
        });

        showNotification("Car returned successfully!", "success");
        setShowReturnForm(false);
        onRefresh();
      } catch (error) {
        console.error("Error returning car:", error);
        showNotification(`Error returning car: ${error.message}`, "error");
      }
      setLoading(false);
    };

    return (
      <div className="car-card">
        {/* Car information display */}
        <div className="car-card-header">
          {car.carImage && (
            <div className="car-image">
              <img src={car.carImage} alt={`${car.carBrand} ${car.carModel}`} />
            </div>
          )}

          <div className="car-info">
            <h3 className="car-title">
              {car.carBrand && car.carModel
                ? `${car.carBrand} ${car.carModel} ${car.carYear}`
                : `Car #${car.id}`}
            </h3>

            <p className="car-description">{car.description}</p>

            <div className="car-details">
              {car.carColor && <span className="car-detail">Color: {car.carColor}</span>}
              {car.carType && <span className="car-detail">Type: {car.carType}</span>}
              {car.location && <span className="car-detail">Location: {car.location}</span>}
            </div>

            {car.features && car.features.length > 0 && (
              <div className="car-features">
                <strong>Features:</strong>
                <ul>
                  {car.features.map((feature, index) => (
                    <li key={index}>{feature}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="car-meta">
              <span className={`status-badge ${car.isAvailable ? 'available' : 'rented'}`}>
                {car.isAvailable ? 'Available' : 'Rented'}
              </span>
              <span className="owner-info">
                Owner: {car.owner === account ? 'You' : `${car.owner.slice(0, 6)}...${car.owner.slice(-4)}`}
              </span>
            </div>
          </div>

          <div className="pricing-info">
            <div className="price-main">
              {car.pricePerDay} <span className="price-unit">ETH/day</span>
            </div>
            <div className="price-deposit">Deposit: {car.depositAmount} ETH</div>

            {!isOwner && car.isAvailable && (
              <button
                onClick={() => setShowBookingForm(!showBookingForm)}
                className="btn btn-primary"
              >
                {showBookingForm ? 'Close Booking' : 'Book Now'}
              </button>
            )}
          </div>
        </div>

        {/* Booking button for available cars */}
        {!isOwner && car.isAvailable && (
          <button
            onClick={() => setShowBookingForm(true)}
            className="btn btn-primary"
          >
            Book This Car
          </button>
        )}

        {/* Return button for cars rented by current user */}
        {isRentedByMe && (
          <button
            onClick={() => setShowReturnForm(true)}
            className="btn btn-warning"
          >
            Return Car
          </button>
        )}

        {/* Booking Form Modal */}
        {showBookingForm && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3>Book {car.carBrand || `Car #${car.id}`}</h3>

              <div className="form-group">
                <label>Pickup Date</label>
                <input
                  type="date"
                  name="startDate"
                  min={new Date().toISOString().split('T')[0]}
                  value={bookingData.startDate}
                  onChange={handleBookingChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Pickup Time</label>
                <input
                  type="time"
                  name="pickupTime"
                  value={bookingData.pickupTime}
                  onChange={handleBookingChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Rental Duration (Days)</label>
                <input
                  type="number"
                  name="rentalDays"
                  min="1"
                  max="30"
                  value={bookingData.rentalDays}
                  onChange={handleBookingChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Return Date</label>
                <input
                  type="date"
                  name="endDate"
                  min={bookingData.startDate || new Date().toISOString().split('T')[0]}
                  value={bookingData.endDate}
                  onChange={handleBookingChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Special Requests</label>
                <textarea
                  name="specialRequests"
                  value={bookingData.specialRequests}
                  onChange={handleBookingChange}
                  placeholder="Any special requirements?"
                />
              </div>

              <div className="price-summary">
                <h4>Price Summary</h4>
                <div>Daily Rate: {car.pricePerDay} ETH</div>
                <div>Days: {bookingData.rentalDays}</div>
                <div>Deposit: {car.depositAmount} ETH</div>
                <div className="total-price">
                  Total: {calculateTotalCost()} ETH
                </div>
              </div>

              <div className="modal-actions">
                <button
                  onClick={() => setShowBookingForm(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBookCar}
                  disabled={loading || !bookingData.startDate || !bookingData.endDate}
                  className="btn btn-primary"
                >
                  {loading ? 'Processing...' : 'Confirm Booking'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Return Form Modal */}
        {showReturnForm && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3>Return {car.carBrand || `Car #${car.id}`}</h3>

              <div className="form-group">
                <label>Vehicle Condition</label>
                <select
                  name="condition"
                  value={returnData.condition}
                  onChange={handleReturnChange}
                >
                  <option value="excellent">Excellent (no issues)</option>
                  <option value="good">Good (minor wear)</option>
                  <option value="fair">Fair (noticeable wear)</option>
                  <option value="poor">Poor (needs repair)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Fuel Level</label>
                <select
                  name="fuelLevel"
                  value={returnData.fuelLevel}
                  onChange={handleReturnChange}
                >
                  <option value="full">Full</option>
                  <option value="3/4">3/4</option>
                  <option value="1/2">1/2</option>
                  <option value="1/4">1/4</option>
                  <option value="empty">Empty</option>
                </select>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  name="notes"
                  value={returnData.notes}
                  onChange={handleReturnChange}
                  placeholder="Any notes about the car's condition?"
                />
              </div>

              <div className="refund-summary">
                <h4>Refund Estimate</h4>
                <div>Deposit Amount: {car.depositAmount} ETH</div>
                <div>Deductions: {returnData.condition !== 'excellent' ? 'Possible deductions may apply' : 'None'}</div>
                <div className="estimated-refund">
                  Estimated Refund: {car.depositAmount} ETH
                </div>
              </div>

              <div className="modal-actions">
                <button
                  onClick={() => setShowReturnForm(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReturnCar}
                  disabled={loading}
                  className="btn btn-warning"
                >
                  {loading ? 'Processing...' : 'Confirm Return'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app">
      {/* Notification */}
      {notification.show && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}

      <header className="header">
        <div className="container">
          <div className="header-content">
            <h1 className="logo">
              <span className="logo-drive">Car</span>
              <span className="logo-chain">Rental</span>
            </h1>

            <div className="wallet-section">
              {account ? (
                <div className="wallet-connected">
                  <div className="connection-indicator"></div>
                  <span className="wallet-address">
                    Connected: {account.slice(0, 6)}...{account.slice(-4)}
                  </span>
                </div>
              ) : (
                <button onClick={connectWallet} className="btn btn-primary">
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="container">
          <nav className="nav-tabs">
            <button
              onClick={() => setActiveTab("browse")}
              className={`nav-tab ${activeTab === "browse" ? "active" : ""}`}
            >
              Browse Cars
            </button>
            <button
              onClick={() => setActiveTab("list")}
              className={`nav-tab ${activeTab === "list" ? "active" : ""}`}
            >
              List Your Car
            </button>
          </nav>

          {activeTab === "browse" && (
            <div className="browse-section">
              <div className="section-header">
                <h2 className="section-title">Available Cars</h2>
                <button
                  onClick={loadCars}
                  disabled={loading}
                  className="btn btn-secondary"
                >
                  {loading ? "Loading..." : "Refresh"}
                </button>
              </div>

              {loading ? (
                <div className="loading">Loading cars...</div>
              ) : cars.length === 0 ? (
                <div className="empty-state">No cars available</div>
              ) : (
                <div className="cars-grid">
                  {cars.map((car) => (
                    <CarCard key={car.id} car={car} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "list" && (
            <div className="list-section">
              <h2 className="section-title">List Your Car</h2>
              <div className="list-form">
                <div className="form-row">
                  <div className="input-group">
                    <label className="input-label">Car Brand *</label>
                    <input
                      type="text"
                      value={listCarForm.carBrand}
                      onChange={(e) => setListCarForm({ ...listCarForm, carBrand: e.target.value })}
                      className="form-input"
                      placeholder="e.g., Toyota, Honda, BMW"
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Car Model *</label>
                    <input
                      type="text"
                      value={listCarForm.carModel}
                      onChange={(e) => setListCarForm({ ...listCarForm, carModel: e.target.value })}
                      className="form-input"
                      placeholder="e.g., Camry, Civic, X3"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="input-group">
                    <label className="input-label">Year</label>
                    <input
                      type="number"
                      min="1980"
                      max="2025"
                      value={listCarForm.carYear}
                      onChange={(e) => setListCarForm({ ...listCarForm, carYear: e.target.value })}
                      className="form-input"
                      placeholder="2023"
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Color</label>
                    <input
                      type="text"
                      value={listCarForm.carColor}
                      onChange={(e) => setListCarForm({ ...listCarForm, carColor: e.target.value })}
                      className="form-input"
                      placeholder="Blue, Red, White"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="input-group">
                    <label className="input-label">Car Type</label>
                    <select
                      value={listCarForm.carType}
                      onChange={(e) => setListCarForm({ ...listCarForm, carType: e.target.value })}
                      className="form-input"
                    >
                      <option value="">Select Type</option>
                      <option value="sedan">Sedan</option>
                      <option value="suv">SUV</option>
                      <option value="hatchback">Hatchback</option>
                      <option value="convertible">Convertible</option>
                      <option value="truck">Truck</option>
                      <option value="van">Van</option>
                      <option value="sports">Sports Car</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Location</label>
                    <input
                      type="text"
                      value={listCarForm.location}
                      onChange={(e) => setListCarForm({ ...listCarForm, location: e.target.value })}
                      className="form-input"
                      placeholder="City, State"
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Car Image URL</label>
                  <input
                    type="url"
                    value={listCarForm.carImage}
                    onChange={(e) => setListCarForm({ ...listCarForm, carImage: e.target.value })}
                    className="form-input"
                    placeholder="https://example.com/car-image.jpg"
                  />
                </div>

                <div className="form-row">
                  <div className="input-group">
                    <label className="input-label">Price per Day (ETH) *</label>
                    <input
                      type="number"
                      step="0.001"
                      value={listCarForm.pricePerDay}
                      onChange={(e) => setListCarForm({ ...listCarForm, pricePerDay: e.target.value })}
                      className="form-input"
                      placeholder="0.01"
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Deposit Amount (ETH) *</label>
                    <input
                      type="number"
                      step="0.001"
                      value={listCarForm.depositAmount}
                      onChange={(e) => setListCarForm({ ...listCarForm, depositAmount: e.target.value })}
                      className="form-input"
                      placeholder="0.1"
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Features (comma separated)</label>
                  <input
                    type="text"
                    value={listCarForm.features}
                    onChange={(e) => setListCarForm({ ...listCarForm, features: e.target.value })}
                    className="form-input"
                    placeholder="GPS, Air Conditioning, Bluetooth, Backup Camera"
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Description *</label>
                  <textarea
                    value={listCarForm.description}
                    onChange={(e) => setListCarForm({ ...listCarForm, description: e.target.value })}
                    className="form-input"
                    rows="3"
                    placeholder="Describe your car in detail..."
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Metadata URI *</label>
                  <input
                    type="text"
                    value={listCarForm.metadataURI}
                    onChange={(e) => setListCarForm({ ...listCarForm, metadataURI: e.target.value })}
                    placeholder="Short identifier for blockchain"
                    className="form-input"
                  />
                  <small className="input-help">
                    This will be stored on the blockchain. Keep it short and descriptive.
                  </small>
                </div>

                <button
                  onClick={listCar}
                  disabled={loading}
                  className="btn btn-success btn-full"
                >
                  {loading ? "Listing..." : "List Car"}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;