import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import './App.css';
import deployment from './contracts/deployment.json';

const CONTRACT_ADDRESS = deployment.contractAddress;

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
    try {
      const response = await fetch("http://localhost:5050/api/cars");
      if (!response.ok) {
        throw new Error("Failed to fetch cars");
      }
      const data = await response.json();
      return data.map(car => ({
        ...car,
        carId: car.id || car._id,
        pricePerDay: car.pricePerDay.toString(),
        depositAmount: car.depositAmount.toString()
      }));
    } catch (error) {
      console.error("API Error:", error);
      throw error;
    }
  },

  async getRentedCars() {
    try {
      console.log('Fetching rented cars from /api/cars/rented...');
      const response = await fetch("http://localhost:5050/api/cars/rented");

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      // In case your route returns an array directly
      if (Array.isArray(data)) {
        return data;
      }

      // If it's wrapped in a success object
      if (data.success && Array.isArray(data.cars)) {
        return data.cars;
      }

      console.warn('Unexpected response format from /rented:', data);
      return [];
    } catch (error) {
      console.error("Error fetching rented cars:", error);
      throw error;
    }
  },

  async fullDeleteCar(carId, requesterAddress, privateKey) {
    const response = await fetch(`http://localhost:5050/api/cars/${carId}/full-delete`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requesterAddress, privateKey })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to delete car");
    }

    return await response.json();
  },

  async cancelRental(carId, requesterAddress) {
    const response = await fetch(`http://localhost:5050/api/cars/${carId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requesterAddress })
    });

    if (!response.ok) {
      throw new Error("Failed to cancel rental");
    }

    return await response.json();
  },

  async completeRental(carId, requesterAddress) {
    const response = await fetch(`http://localhost:5050/api/cars/${carId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requesterAddress })
    });

    if (!response.ok) {
      throw new Error("Failed to complete rental");
    }

    return await response.json();
  },

  async createCar(carData) {
    const response = await fetch("http://localhost:5050/api/cars", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(carData)
    });

    if (!response.ok) {
      throw new Error("Failed to save car to database");
    }

    return await response.json();
  },

  async bookCar(carId, bookingData) {
    const response = await fetch(`http://localhost:5050/api/cars/${carId}/book`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(bookingData)
    });

    if (!response.ok) {
      throw new Error("Failed to book car");
    }

    return await response.json();
  },

  async cancelBooking(carId, data) {
    const response = await fetch(`http://localhost:5050/api/cars/${carId}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error("Failed to cancel booking");
    }

    return await response.json();
  },

  async completeRental(carId, data) {
    const response = await fetch(`http://localhost:5050/api/cars/${carId}/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error("Failed to complete rental");
    }

    return await response.json();
  }
};

function App() {
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState("");
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("browse");
  const [notification, setNotification] = useState({ message: "", type: "", show: false });
  const [rentedCars, setRentedCars] = useState([]);
  useEffect(() => {
    console.log('rentedCars state changed:', rentedCars);
    console.log('rentedCars length:', rentedCars.length);
    console.log('rentedCars type:', typeof rentedCars);
    console.log('rentedCars is array:', Array.isArray(rentedCars));
  }, [rentedCars]);

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
    }, 5050);
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

  const listCarFromDatabase = async (dbCar) => {
    if (!contract || !account) {
      showNotification("Contract not initialized or wallet not connected", "error");
      return false;
    }

    try {
      // Convert price and deposit to wei
      const pricePerDayWei = ethers.parseEther(dbCar.pricePerDay.toString());
      const depositAmountWei = ethers.parseEther(dbCar.depositAmount.toString());

      // List car on blockchain
      const tx = await contract.listCar(
        pricePerDayWei,
        depositAmountWei,
        dbCar.metadataURI || `db-car-${dbCar._id}`
      );

      const receipt = await tx.wait();

      // Get the new car ID from the blockchain
      let carId;
      const carListedEvent = receipt.logs.find(log => {
        try {
          const parsed = contract.interface.parseLog(log);
          return parsed.name === 'CarListed';
        } catch (e) {
          return false;
        }
      });

      if (carListedEvent) {
        const parsed = contract.interface.parseLog(carListedEvent);
        carId = parsed.args.carId.toString();
      } else {
        // Fallback: get from carCount
        const count = await contract.carCount();
        carId = count.toString();
      }

      // Update the database with the new blockchain ID
      try {
        await ApiService.updateCar(dbCar._id, {
          carId: carId,
          blockNumber: receipt.blockNumber,
          transactionHash: tx.hash
        });
      } catch (error) {
        console.error("Error updating car in database:", error);
      }

      showNotification(`Car ${dbCar.model} listed on blockchain!`, "success");
      return true;
    } catch (error) {
      console.error("Error listing car from database:", error);
      showNotification("Error listing car: " + error.message, "error");
      return false;
    }
  };

  // Replace your existing loadCars function with this updated version
  const loadCars = async () => {
    if (!contract) {
      console.log("Contract not initialized");
      return;
    }

    setLoading(true);
    try {
      // Get data from both sources in parallel
      const [dbCars, carCount] = await Promise.all([
        ApiService.getAllCars().catch(e => {
          console.warn("Using empty array for DB cars due to error:", e);
          return [];
        }),
        contract.carCount()
      ]);

      // Get blockchain data
      const blockchainCars = [];
      for (let i = 0; i < Number(carCount); i++) {
        try {
          const car = await contract.cars(i + 1);
          blockchainCars.push({
            id: car.id.toString(),
            owner: car.owner,
            pricePerDay: ethers.formatEther(car.pricePerDay),
            depositAmount: ethers.formatEther(car.depositAmount),
            isAvailable: car.isAvailable,
            metadataURI: car.metadataURI
          });
        } catch (error) {
          console.error(`Error fetching car ${i + 1} from blockchain:`, error);
        }
      }

      // Find DB-only cars that need to be listed on blockchain
      const dbOnlyCars = dbCars.filter(dbCar =>
        !blockchainCars.some(bcCar =>
          bcCar.id === dbCar.id ||
          bcCar.id === dbCar._id ||
          bcCar.id === dbCar.carId
        )
      );

      // List DB-only cars on blockchain
      if (dbOnlyCars.length > 0) {
        showNotification(`Found ${dbOnlyCars.length} unlisted cars. Adding to blockchain...`, "info");

        for (const dbCar of dbOnlyCars) {
          try {
            await listCarFromDatabase(dbCar);
          } catch (error) {
            console.error(`Failed to list car ${dbCar._id}:`, error);
          }
        }

        // Reload cars after listing new ones
        return loadCars();
      }

      // Merge data
      const mergedCars = blockchainCars.map(blockchainCar => {
        const dbCar = dbCars.find(dbCar =>
          dbCar.id === blockchainCar.id ||
          dbCar._id === blockchainCar.id ||
          dbCar.carId === blockchainCar.id
        );

        const isRented = dbCar?.rental?.isActive === true || dbCar?.isAvailable === false;

        return {
          ...blockchainCar,
          isAvailable: !isRented,
          // Database enrichment
          carBrand: dbCar?.carBrand || dbCar?.model?.split(' ')[0] || 'Unknown',
          carModel: dbCar?.carModel || dbCar?.model?.split(' ').slice(1).join(' ') || 'Unknown',
          carYear: dbCar?.carYear || dbCar?.year?.toString() || '',
          carColor: dbCar?.carColor || dbCar?.specs?.color || '',
          carType: dbCar?.carType || dbCar?.specs?.type || '',
          carImage: dbCar?.carImage || dbCar?.imageURL || '',
          location: dbCar?.location || '',
          features: dbCar?.features || dbCar?.specs?.features || [],
          description: dbCar?.description || '',
          specs: dbCar?.specs || {},
          rental: dbCar?.rental || null,
          isAvailable: dbCar?.isAvailable,
          // Preserve DB IDs if they exist
          _id: dbCar?._id,
          dbId: dbCar?._id || dbCar?.id
        };
      });

      setCars(mergedCars);
    } catch (error) {
      console.error("Error loading cars:", error);
      showNotification("Error loading cars: " + error.message, "error");
      setCars([]);
    } finally {
      setLoading(false);
    }
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

  const loadRentedCars = async () => {
    setLoading(true);
    try {
      console.log('=== LOADING RENTED CARS ===');

      // Debug info first
      try {
        const debugInfo = await ApiService.debugAllCars();
        console.log('Debug info:', debugInfo);
      } catch (debugError) {
        console.warn('Could not fetch debug info:', debugError);
      }

      // Fetch rented cars
      const apiResponse = await ApiService.getRentedCars();
      console.log('Raw API response:', apiResponse);
      console.log('Type of response:', typeof apiResponse);
      console.log('Is array:', Array.isArray(apiResponse));

      let carsArray = [];

      // Handle the different response formats
      if (apiResponse && typeof apiResponse === 'object') {
        if (apiResponse.success !== undefined) {
          // New format with success flag
          if (apiResponse.success) {
            carsArray = apiResponse.cars || [];
          } else {
            throw new Error(apiResponse.details || apiResponse.error || 'API returned unsuccessful response');
          }
        } else if (Array.isArray(apiResponse)) {
          // Direct array response
          console.log('Direct array response');
          carsArray = apiResponse;
        } else if (apiResponse.data && Array.isArray(apiResponse.data)) {
          // Response wrapped in data property
          console.log('Response wrapped in data property');
          carsArray = apiResponse.data;
        } else {
          // Try to find array property in the response
          const possibleArrays = Object.values(apiResponse).filter(val => Array.isArray(val));
          if (possibleArrays.length > 0) {
            console.log('Found array in response properties');
            carsArray = possibleArrays[0];
          } else {
            console.warn('No array found in response, treating as single item');
            carsArray = [apiResponse];
          }
        }
      } else if (Array.isArray(apiResponse)) {
        carsArray = apiResponse;
      } else {
        throw new Error('Invalid response format from API');
      }

      console.log('Processed cars array:', carsArray);
      console.log('Cars array length:', carsArray.length);
      console.log('Cars array type:', typeof carsArray);

      // Ensure it's an array
      if (!Array.isArray(carsArray)) {
        console.error('Expected array but got:', typeof carsArray, carsArray);
        throw new Error('Expected array but received ' + typeof carsArray);
      }

      // Transform the data to ensure consistency
      const transformedCars = carsArray.map(car => ({
        ...car,
        id: car.carId || car._id || car.id,
        carId: car.carId || car._id || car.id,
        owner: car.owner || car.ownerAddress || "",
        isAvailable: false,
        pricePerDay: car.pricePerDay?.toString() || '0',
        depositAmount: car.depositAmount?.toString() || '0'
      }));

      console.log('Transformed cars:', transformedCars);
      console.log('About to set state with', transformedCars.length, 'cars');

      // Set the state
      setRentedCars(transformedCars);

      // Verify state was set (this will show in next render)
      console.log('State should be updated with', transformedCars.length, 'cars');

      showNotification(`Loaded ${transformedCars.length} rented cars`, "success");

    } catch (error) {
      console.error("Error loading rented cars:", error);
      console.error("Error stack:", error.stack);
      showNotification("Error loading rented cars: " + error.message, "error");
      setRentedCars([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
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

    const isOwner = (car.owner || car.ownerAddress || "").toLowerCase() === (account || "").toLowerCase();
    const isRentedByMe = (currentRental?.renter || "").toLowerCase() === (account || "").toLowerCase();

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

    // In the CarCard component, update the return logic
    const handleReturnCar = async () => {
      if (!contract) return;

      setLoading(true);
      try {
        // Complete rental in smart contract
        const tx = await contract.completeRental(car.id);
        const receipt = await tx.wait();

        // Update status in database
        await ApiService.completeRental(car.id, {
          returnedBy: account,
          returnCondition: returnData.condition,
          returnNotes: returnData.notes,
          fuelLevel: returnData.fuelLevel,
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber
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

    const handleCancelBooking = async () => {
      if (!contract) return;

      setLoading(true);
      try {
        const tx = await contract.cancelBooking(car.id);
        const receipt = await tx.wait();

        await ApiService.cancelBooking(car.id, {
          cancelledBy: account,
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber
        });

        showNotification("Booking cancelled successfully!", "success");
        onRefresh();
      } catch (error) {
        console.error("Error cancelling booking:", error);
        showNotification(`Error cancelling booking: ${error.message}`, "error");
      }
      setLoading(false);
    };

    const handleCompleteRental = async () => {
      if (!contract) return;

      setLoading(true);
      try {
        const tx = await contract.completeRental(car.id);
        const receipt = await tx.wait();

        await ApiService.completeRental(car.id, {
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber
        });

        showNotification("Rental completed successfully!", "success");
        onRefresh();
      } catch (error) {
        console.error("Error completing rental:", error);
        showNotification(`Error completing rental: ${error.message}`, "error");
      }
      setLoading(false);
    };

    const handleFullDeleteCar = async () => {
      const confirmed = window.confirm("Are you sure you want to delete this car from the blockchain and database?");
      if (!confirmed) return;

      const privateKey = prompt("Enter your private key (only for demo/dev purpose):");
      if (!privateKey) return;

      setLoading(true);
      try {
        const result = await ApiService.fullDeleteCar(car.id, account, privateKey);
        showNotification("Car deleted from blockchain & database", "success");
        onRefresh();
      } catch (error) {
        showNotification(`Delete failed: ${error.message}`, "error");
      }
      setLoading(false);
    };


    return (
      <div>
        <div className="car-card">
          {/* Car information display */}
          <div className="car-card-header">
            {car.carImage && (
              <div className="car-image">
                <img
                  src={
                    car.imageURL?.startsWith("http")
                      ? car.imageURL
                      : "https://via.placeholder.com/300x200?text=No+Image"
                  }
                  alt="Car image"
                />
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

              {
                isOwner && (
                  <div className="owner-actions">
                    {!car.isAvailable && (
                      <>
                        <button
                          onClick={() => ApiService.cancelRental(car.id, account).then(onRefresh)}
                          disabled={loading}
                          className="btn btn-warning btn-sm"
                        >
                          Cancel Rental
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const result = await ApiService.completeRental(car.id, account);
                              showNotification(result.message || "Rental completed", "success");
                              onRefresh();
                            } catch (error) {
                              showNotification(error.message || "Failed to complete rental", "error");
                              showNotification("Failed to complete rental because the rental period hasn't ended yet", "error");
                            }
                          }}
                          disabled={loading}
                          className="btn btn-success btn-sm"
                        >
                          Complete Rental
                        </button>
                      </>
                    )}
                  </div>
                )
              }

              {isOwner && car.isAvailable && (
                <button
                  onClick={handleFullDeleteCar}
                  className="btn btn-warning btn-sm"
                  disabled={loading}
                >
                  Delete Car
                </button>
              )}
            </div>
          </div>

          {/* Return button for cars rented by current user */}
          {isRentedByMe && (
            <button
              onClick={() => setShowReturnForm(true)}
              className="btn btn-warning"
            >
              Return Car
            </button>
          )}
        </div>

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

  useEffect(() => {
    if (activeTab === "rented") {
      loadRentedCars();
    }
  }, [activeTab]);

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
              onClick={() => setActiveTab("rented")}
              className={`nav-tab ${activeTab === "rented" ? "active" : ""}`}
            >
              Rented Cars
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
              ) : cars.filter(car => car.isAvailable).length === 0 ? (
                <div className="empty-state">No cars available</div>
              ) : (
                <div className="cars-grid">
                  {cars.filter(car => car.isAvailable).map((car) => (
                    <CarCard key={car.id} car={car} onRefresh={loadCars} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "rented" && (
            <div className="rented-section">
              <div className="section-header">
                <h2 className="section-title">Rented Cars</h2>
                <button
                  onClick={loadRentedCars}
                  disabled={loading}
                  className="btn btn-secondary"
                >
                  {loading ? "Loading..." : "Refresh"}
                </button>
              </div>

              {loading ? (
                <div className="loading">Loading rented cars...</div>
              ) : rentedCars.length === 0 ? (
                <div className="empty-state">No cars currently rented</div>
              ) : (
                <div className="cars-grid">
                  {rentedCars.map((car) => {
                    // Transform the rented car data to match expected format
                    const transformedCar = {
                      ...car,
                      id: car.carId || car._id,
                      carId: car.carId || car._id,
                      isAvailable: false, // rented cars are not available
                      pricePerDay: car.pricePerDay?.toString() || '0',
                      depositAmount: car.depositAmount?.toString() || '0'
                    };

                    return (
                      <CarCard
                        key={car.carId || car._id}
                        car={transformedCar}
                        onRefresh={loadRentedCars}
                      />
                    );
                  })}
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