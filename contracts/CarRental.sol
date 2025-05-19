// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DecentraRent {
    struct Car {
        uint id;
        address payable owner;
        uint pricePerDay;
        uint depositAmount;
        bool isAvailable;
        string metadataURI; // URI pointing to off-chain metadata (MongoDB/IPFS)
    }

    struct Rental {
        address renter;
        uint startTime;
        uint endTime;
        bool isActive;
    }

    uint public carCount;
    mapping(uint => Car) public cars;
    mapping(uint => Rental) public rentals;

    // Events
    event CarListed(uint indexed carId, address indexed owner, uint pricePerDay, uint depositAmount, string metadataURI);
    event RateAndDepositSet(uint indexed carId, uint pricePerDay, uint depositAmount);
    event CarBooked(uint indexed carId, address indexed renter, uint startTime, uint endTime, uint paidAmount);
    event BookingCancelled(uint indexed carId, address indexed renter, uint refundAmount);
    event RentalCompleted(uint indexed carId, address indexed renter, uint ownerPayout, uint renterRefund);

    // Modifiers
    modifier onlyCarOwner(uint carId) {
        require(cars[carId].owner == msg.sender, "Not car owner");
        _;
    }

    modifier onlyRenter(uint carId) {
        require(rentals[carId].renter == msg.sender, "Not renter");
        _;
    }

    modifier onlyBeforeStart(uint carId) {
        require(block.timestamp < rentals[carId].startTime, "Too late to cancel");
        _;
    }

    modifier carExists(uint carId) {
        require(carId > 0 && carId <= carCount, "Car does not exist");
        _;
    }

    // List a new car
    function listCar(uint pricePerDay, uint depositAmount, string calldata metadataURI) external {
        carCount++;
        cars[carCount] = Car({
            id: carCount,
            owner: payable(msg.sender),
            pricePerDay: pricePerDay,
            depositAmount: depositAmount,
            isAvailable: true,
            metadataURI: metadataURI
        });
        emit CarListed(carCount, msg.sender, pricePerDay, depositAmount, metadataURI);
    }

    // Update rate and deposit
    function setRateAndDeposit(uint carId, uint newPricePerDay, uint newDepositAmount)
        external
        onlyCarOwner(carId)
        carExists(carId)
    {
        Car storage car = cars[carId];
        require(car.isAvailable, "Cannot change after booking");
        car.pricePerDay = newPricePerDay;
        car.depositAmount = newDepositAmount;
        emit RateAndDepositSet(carId, newPricePerDay, newDepositAmount);
    }

    // Book a car
    function bookCar(uint carId, uint startTime, uint endTime)
        external
        payable
        carExists(carId)
    {
        Car storage car = cars[carId];
        require(car.isAvailable, "Car not available");
        require(endTime > startTime, "Invalid rental period");

        uint daysBooked = (endTime - startTime) / 1 days;
        uint totalCost = daysBooked * car.pricePerDay + car.depositAmount;
        require(msg.value == totalCost, "Incorrect payment");

        car.isAvailable = false;

        rentals[carId] = Rental({
            renter: msg.sender,
            startTime: startTime,
            endTime: endTime,
            isActive: true
        });

        emit CarBooked(carId, msg.sender, startTime, endTime, msg.value);
    }

    // Cancel booking
    function cancelBooking(uint carId)
        external
        onlyRenter(carId)
        onlyBeforeStart(carId)
        carExists(carId)
    {
        Rental storage rent = rentals[carId];
        require(rent.isActive, "No active booking");

        uint timeUntilStart = rent.startTime - block.timestamp;
        uint fullAmount = ((rent.endTime - rent.startTime) / 1 days) * cars[carId].pricePerDay + cars[carId].depositAmount;

        uint refundAmount = timeUntilStart >= 48 hours ? fullAmount : fullAmount / 2;

        rent.isActive = false;
        cars[carId].isAvailable = true;

        payable(rent.renter).transfer(refundAmount);

        emit BookingCancelled(carId, rent.renter, refundAmount);
    }

    // Complete rental
    function completeRental(uint carId)
        external
        onlyRenter(carId)
        carExists(carId)
    {
        Rental storage rent = rentals[carId];
        require(rent.isActive, "Not active");
        require(block.timestamp >= rent.endTime, "Too early to complete");

        uint daysRented = (rent.endTime - rent.startTime) / 1 days;
        uint rentalFee = daysRented * cars[carId].pricePerDay;
        uint deposit = cars[carId].depositAmount;

        rent.isActive = false;
        cars[carId].isAvailable = true;

        cars[carId].owner.transfer(rentalFee);
        payable(rent.renter).transfer(deposit);

        emit RentalCompleted(carId, rent.renter, rentalFee, deposit);
    }

    // Get list of available cars
    function getAvailableCars() external view returns (uint[] memory) {
        uint[] memory temp = new uint[](carCount);
        uint count = 0;

        for (uint i = 1; i <= carCount; i++) {
            if (cars[i].isAvailable) {
                temp[count++] = i;
            }
        }

        uint[] memory available = new uint[](count);
        for (uint i = 0; i < count; i++) {
            available[i] = temp[i];
        }

        return available;
    }

    // Get rental info for a car
    function getRentalInfo(uint carId)
        external
        view
        carExists(carId)
        returns (address renter, uint startTime, uint endTime, bool isActive)
    {
        Rental storage r = rentals[carId];
        return (r.renter, r.startTime, r.endTime, r.isActive);
    }
}