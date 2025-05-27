import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

// Replace with your actual contract address
const CONTRACT_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

// Your contract ABI - replace with the actual ABI
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

function App() {
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState("");
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("browse");
  const [selectedCar, setSelectedCar] = useState(null);

  // Form states
  const [listCarForm, setListCarForm] = useState({
    pricePerDay: "",
    depositAmount: "",
    metadataURI: ""
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

  const initializeContract = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const carRental = new ethers.Contract(CONTRACT_ADDRESS, CarRentalABI, signer);
        setContract(carRental);
      } catch (error) {
        console.error("Error initializing contract:", error);
      }
    } else {
      toast.error("Please install MetaMask!");
    }
  };

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts"
        });
        setAccount(accounts[0]);
        toast.success("Wallet connected!");
      } catch (error) {
        toast.error("Connection failed: " + error.message);
      }
    } else {
      toast.error("Please install MetaMask!");
    }
  };

  const loadCars = async () => {
    if (!contract) return;

    setLoading(true);
    try {
      const carCount = await contract.carCount();
      const carPromises = [];

      for (let i = 1; i <= carCount; i++) {
        carPromises.push(contract.cars(i));
      }

      const carData = await Promise.all(carPromises);
      const formattedCars = carData.map((car, index) => ({
        id: car.id.toString(),
        owner: car.owner,
        pricePerDay: ethers.formatEther(car.pricePerDay),
        depositAmount: ethers.formatEther(car.depositAmount),
        isAvailable: car.isAvailable,
        metadataURI: car.metadataURI
      }));

      setCars(formattedCars);
    } catch (error) {
      console.error("Error loading cars:", error);
      toast.error("Error loading cars");
    }
    setLoading(false);
  };

  const listCar = async () => {
    if (!contract) return;

    if (!listCarForm.pricePerDay || !listCarForm.depositAmount || !listCarForm.metadataURI) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      const pricePerDayWei = ethers.parseEther(listCarForm.pricePerDay);
      const depositAmountWei = ethers.parseEther(listCarForm.depositAmount);

      const tx = await contract.listCar(
        pricePerDayWei,
        depositAmountWei,
        listCarForm.metadataURI
      );

      await tx.wait();
      toast.success("Car listed successfully!");

      setListCarForm({ pricePerDay: "", depositAmount: "", metadataURI: "" });
      loadCars();
    } catch (error) {
      console.error("Error listing car:", error);
      toast.error("Error listing car: " + error.message);
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
      const tx = await contract.bookCar(carId, startTime, endTime, {
        value: totalCost
      });

      await tx.wait();
      toast.success("Car booked successfully!");
      loadCars();
    } catch (error) {
      console.error("Error booking car:", error);
      toast.error("Error booking car: " + error.message);
    }
    setLoading(false);
  };

  const cancelBooking = async (carId) => {
    if (!contract) return;

    setLoading(true);
    try {
      const tx = await contract.cancelBooking(carId);
      await tx.wait();
      toast.success("Booking cancelled successfully!");
      loadCars();
    } catch (error) {
      console.error("Error cancelling booking:", error);
      toast.error("Error cancelling booking: " + error.message);
    }
    setLoading(false);
  };

  const completeRental = async (carId) => {
    if (!contract) return;

    setLoading(true);
    try {
      const tx = await contract.completeRental(carId);
      await tx.wait();
      toast.success("Rental completed successfully!");
      loadCars();
    } catch (error) {
      console.error("Error completing rental:", error);
      toast.error("Error completing rental: " + error.message);
    }
    setLoading(false);
  };

  const CarCard = ({ car }) => {
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [showBookingForm, setShowBookingForm] = useState(false);

    const isOwner = car.owner.toLowerCase() === account?.toLowerCase();
    const isValidDates = startDate && endDate && new Date(startDate) < new Date(endDate);

    const calculateTotal = () => {
      if (!isValidDates) return 0;
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      return (parseFloat(car.pricePerDay) * days + parseFloat(car.depositAmount)).toFixed(4);
    };

    const getDays = () => {
      if (!isValidDates) return 0;
      const start = new Date(startDate);
      const end = new Date(endDate);
      return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    };

    return (
      <div className="car-card">
        <div className="car-card-header">
          <div className="car-info">
            <h3 className="car-title">Car #{car.id}</h3>
            <p className="car-description">{car.metadataURI}</p>
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

        {showBookingForm && (
          <div className="booking-form">
            <h4 className="booking-title">Booking Details</h4>
            <div className="date-inputs">
              <div className="input-group">
                <label className="input-label">Start Date</label>
                <input
                  type="datetime-local"
                  min={new Date().toISOString().slice(0, 16)}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="date-input"
                />
              </div>
              <div className="input-group">
                <label className="input-label">End Date</label>
                <input
                  type="datetime-local"
                  min={startDate || new Date().toISOString().slice(0, 16)}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="date-input"
                />
              </div>
            </div>

            {isValidDates && (
              <div className="cost-breakdown">
                <div className="cost-summary">
                  <div className="total-cost">Total Cost: {calculateTotal()} ETH</div>
                  <div className="cost-details">
                    <div>Rental ({getDays()} days × {car.pricePerDay} ETH): {(parseFloat(car.pricePerDay) * getDays()).toFixed(4)} ETH</div>
                    <div>Deposit: {car.depositAmount} ETH</div>
                  </div>
                </div>
              </div>
            )}

            <div className="booking-actions">
              <button
                onClick={() => bookCar(car.id, startDate, endDate)}
                disabled={!isValidDates || loading}
                className="btn btn-success"
              >
                {loading ? 'Processing...' : 'Confirm Booking'}
              </button>
              <button
                onClick={() => setShowBookingForm(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {isOwner && !car.isAvailable && (
          <div className="management-section">
            <h4 className="management-title">Car Management</h4>
            <div className="management-actions">
              <button
                onClick={() => cancelBooking(car.id)}
                className="btn btn-warning"
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Cancel Booking'}
              </button>
              <button
                onClick={() => completeRental(car.id)}
                className="btn btn-success"
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Complete Rental'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app">
      <ToastContainer position="bottom-right" />

      <header className="header">
        <div className="container">
          <div className="header-content">
            <h1 className="logo">
              <span className="logo-drive">Tal</span>
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
                <div className="input-group">
                  <label className="input-label">Price per Day (ETH)</label>
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
                  <label className="input-label">Deposit Amount (ETH)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={listCarForm.depositAmount}
                    onChange={(e) => setListCarForm({ ...listCarForm, depositAmount: e.target.value })}
                    className="form-input"
                    placeholder="0.1"
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Car Description</label>
                  <input
                    type="text"
                    value={listCarForm.metadataURI}
                    onChange={(e) => setListCarForm({ ...listCarForm, metadataURI: e.target.value })}
                    placeholder="e.g., 2023 Tesla Model 3, Blue"
                    className="form-input"
                  />
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