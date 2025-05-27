import React, { useEffect, useState } from "react";
import { ethers } from "ethers";

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
      alert("Please install MetaMask!");
    }
  };

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts"
        });
        setAccount(accounts[0]);
      } catch (error) {
        console.error("Error connecting wallet:", error);
      }
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
    }
    setLoading(false);
  };

  const listCar = async () => {
    if (!contract) return;

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
      alert("Car listed successfully!");
      
      setListCarForm({ pricePerDay: "", depositAmount: "", metadataURI: "" });
      loadCars();
    } catch (error) {
      console.error("Error listing car:", error);
      alert("Error listing car: " + error.message);
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
      alert("Car booked successfully!");
      loadCars();
    } catch (error) {
      console.error("Error booking car:", error);
      alert("Error booking car: " + error.message);
    }
    setLoading(false);
  };

  const cancelBooking = async (carId) => {
    if (!contract) return;

    setLoading(true);
    try {
      const tx = await contract.cancelBooking(carId);
      await tx.wait();
      alert("Booking cancelled successfully!");
      loadCars();
    } catch (error) {
      console.error("Error cancelling booking:", error);
      alert("Error cancelling booking: " + error.message);
    }
    setLoading(false);
  };

  const completeRental = async (carId) => {
    if (!contract) return;

    setLoading(true);
    try {
      const tx = await contract.completeRental(carId);
      await tx.wait();
      alert("Rental completed successfully!");
      loadCars();
    } catch (error) {
      console.error("Error completing rental:", error);
      alert("Error completing rental: " + error.message);
    }
    setLoading(false);
  };

  const CarCard = ({ car }) => {
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [showBookingForm, setShowBookingForm] = useState(false);

    const calculateTotal = () => {
      if (!startDate || !endDate) return 0;
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      return (parseFloat(car.pricePerDay) * days + parseFloat(car.depositAmount)).toFixed(4);
    };

    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-4">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold">Car #{car.id}</h3>
            <p className="text-gray-600">{car.metadataURI}</p>
            <p className="text-sm text-gray-500">Owner: {car.owner.slice(0, 10)}...</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">{car.pricePerDay} ETH/day</p>
            <p className="text-sm text-gray-600">Deposit: {car.depositAmount} ETH</p>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              car.isAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {car.isAvailable ? 'Available' : 'Rented'}
            </span>
          </div>
        </div>

        {car.isAvailable && car.owner.toLowerCase() !== account.toLowerCase() && (
          <div>
            {!showBookingForm ? (
              <button
                onClick={() => setShowBookingForm(true)}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Book Now
              </button>
            ) : (
              <div className="border-t pt-4 mt-4">
                <h4 className="font-semibold mb-3">Book this car</h4>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Start Date</label>
                    <input
                      type="datetime-local"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">End Date</label>
                    <input
                      type="datetime-local"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                </div>
                {startDate && endDate && (
                  <p className="mb-3 font-semibold">Total Cost: {calculateTotal()} ETH</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => bookCar(car.id, startDate, endDate)}
                    disabled={!startDate || !endDate || loading}
                    className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
                  >
                    Confirm Booking
                  </button>
                  <button
                    onClick={() => setShowBookingForm(false)}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {car.owner.toLowerCase() === account.toLowerCase() && !car.isAvailable && (
          <div className="flex gap-2">
            <button
              onClick={() => cancelBooking(car.id)}
              className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
            >
              Cancel Booking
            </button>
            <button
              onClick={() => completeRental(car.id)}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Complete Rental
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Car Rental DApp</h1>
            <div className="text-sm text-gray-600">
              {account ? `Connected: ${account.slice(0, 10)}...` : "Not connected"}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <nav className="flex space-x-1 mb-8">
          <button
            onClick={() => setActiveTab("browse")}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === "browse"
                ? "bg-blue-500 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Browse Cars
          </button>
          <button
            onClick={() => setActiveTab("list")}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === "list"
                ? "bg-blue-500 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            List Your Car
          </button>
        </nav>

        {activeTab === "browse" && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Available Cars</h2>
              <button
                onClick={loadCars}
                disabled={loading}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>

            {loading ? (
              <div className="text-center py-8">Loading cars...</div>
            ) : cars.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No cars available</div>
            ) : (
              <div className="grid gap-6">
                {cars.map((car) => (
                  <CarCard key={car.id} car={car} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "list" && (
          <div>
            <h2 className="text-xl font-semibold mb-6">List Your Car</h2>
            <div className="bg-white rounded-lg shadow-md p-6 max-w-md">
              <div>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Price per Day (ETH)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={listCarForm.pricePerDay}
                    onChange={(e) => setListCarForm({...listCarForm, pricePerDay: e.target.value})}
                    className="w-full p-3 border rounded-lg"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Deposit Amount (ETH)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={listCarForm.depositAmount}
                    onChange={(e) => setListCarForm({...listCarForm, depositAmount: e.target.value})}
                    className="w-full p-3 border rounded-lg"
                  />
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">Car Description</label>
                  <input
                    type="text"
                    value={listCarForm.metadataURI}
                    onChange={(e) => setListCarForm({...listCarForm, metadataURI: e.target.value})}
                    placeholder="e.g., 2023 Tesla Model 3, Blue"
                    className="w-full p-3 border rounded-lg"
                  />
                </div>
                <button
                  onClick={listCar}
                  disabled={loading}
                  className="w-full bg-green-500 text-white py-3 rounded-lg hover:bg-green-600 disabled:opacity-50"
                >
                  {loading ? "Listing..." : "List Car"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;