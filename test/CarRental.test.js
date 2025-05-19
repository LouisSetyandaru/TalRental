// test/CarRental.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("CarRental Contract", function () {
  let CarRental;
  let carRental;
  let owner;
  let renter;
  let otherAccount;
  
  // Price variables
  const pricePerDay = ethers.utils.parseEther("0.01"); // 0.01 ETH per day
  const depositAmount = ethers.utils.parseEther("0.05"); // 0.05 ETH deposit
  const metadataURI = "ipfs://QmSomeHashForCarMetadata";
  
  before(async function () {
    [owner, renter, otherAccount] = await ethers.getSigners();
    
    // Deploy the contract
    CarRental = await ethers.getContractFactory("CarRental");
    carRental = await CarRental.deploy();
    await carRental.deployed();
  });
  
  describe("Car Listing", function () {
    it("Should allow listing a car", async function () {
      await expect(carRental.listCar(pricePerDay, depositAmount, metadataURI))
        .to.emit(carRental, "CarListed")
        .withArgs(1, owner.address, pricePerDay, depositAmount, metadataURI);
      
      const carCount = await carRental.getCarCount();
      expect(carCount).to.equal(1);
      
      const car = await carRental.cars(1);
      expect(car.owner).to.equal(owner.address);
      expect(car.pricePerDay).to.equal(pricePerDay);
      expect(car.depositAmount).to.equal(depositAmount);
      expect(car.isAvailable).to.equal(true);
      expect(car.metadataURI).to.equal(metadataURI);
    });
    
    it("Should allow updating rate and deposit", async function () {
      const newPrice = ethers.utils.parseEther("0.02");
      const newDeposit = ethers.utils.parseEther("0.1");
      
      await expect(carRental.setRateAndDeposit(1, newPrice, newDeposit))
        .to.emit(carRental, "RateAndDepositSet")
        .withArgs(1, newPrice, newDeposit);
      
      const car = await carRental.cars(1);
      expect(car.pricePerDay).to.equal(newPrice);
      expect(car.depositAmount).to.equal(newDeposit);
    });
    
    it("Should not allow non-owner to update rate and deposit", async function () {
      await expect(
        carRental.connect(renter).setRateAndDeposit(
          1,
          ethers.utils.parseEther("0.03"),
          ethers.utils.parseEther("0.15")
        )
      ).to.be.revertedWith("Not car owner");
    });
  });
  
  describe("Car Booking", function () {
    let startTime;
    let endTime;
    let rentalFee;
    
    beforeEach(async function () {
      // Current timestamp plus 1 day
      startTime = (await time.latest()) + 24 * 60 * 60;
      // End time is 3 days after start
      endTime = startTime + (3 * 24 * 60 * 60);
      
      // Calculate rental fee (3 days * price per day)
      rentalFee = ethers.utils.parseEther("0.02").mul(3);
      
      // List a new car if needed
      const carCount = await carRental.getCarCount();
      if (carCount.eq(0)) {
        await carRental.listCar(
          ethers.utils.parseEther("0.02"),
          ethers.utils.parseEther("0.1"),
          "ipfs://QmNewCarMetadata"
        );
      }
    });
    
    it("Should allow booking a car with correct payment", async function () {
      const totalCost = rentalFee.add(ethers.utils.parseEther("0.1")); // fee + deposit
      
      await expect(
        carRental.connect(renter).bookCar(1, startTime, endTime, {
          value: totalCost
        })
      )
        .to.emit(carRental, "CarBooked")
        .withArgs(1, renter.address, startTime, endTime, totalCost);
      
      const car = await carRental.cars(1);
      expect(car.isAvailable).to.equal(false);
      
      const rental = await carRental.rentals(1);
      expect(rental.renter).to.equal(renter.address);
      expect(rental.startTime).to.equal(startTime);
      expect(rental.endTime).to.equal(endTime);
      expect(rental.isActive).to.equal(true);
    });
    
    it("Should not allow booking with incorrect payment", async function () {
      // First reset the car to available
      await carRental.connect(renter).cancelBooking(1);
      
      const incorrectPayment = ethers.utils.parseEther("0.01");
      await expect(
        carRental.connect(renter).bookCar(1, startTime, endTime, {
          value: incorrectPayment
        })
      ).to.be.revertedWith("Incorrect payment");
    });
    
    it("Should not allow booking an unavailable car", async function () {
      // Book the car first
      const totalCost = rentalFee.add(ethers.utils.parseEther("0.1"));
      await carRental.connect(renter).bookCar(1, startTime, endTime, {
        value: totalCost
      });
      
      // Try to book again
      await expect(
        carRental.connect(otherAccount).bookCar(1, startTime, endTime, {
          value: totalCost
        })
      ).to.be.revertedWith("Car unavailable");
    });
  });
  
  describe("Cancellation", function () {
    let startTime;
    let endTime;
    
    beforeEach(async function () {
      // Book a car for testing cancellation
      // Set start time to be 3 days in the future
      startTime = (await time.latest()) + (3 * 24 * 60 * 60);
      endTime = startTime + (2 * 24 * 60 * 60); // 2 day rental
      
      // First reset the car to available if it's not
      const car = await carRental.cars(1);
      if (!car.isAvailable) {
        try {
          await carRental.connect(renter).cancelBooking(1);
        } catch (e) {
          // Might fail if already cancelled or completed, that's OK
        }
      }
      
      // Book the car
      const totalCost = ethers.utils.parseEther("0.02").mul(2).add(ethers.utils.parseEther("0.1"));
      await carRental.connect(renter).bookCar(1, startTime, endTime, {
        value: totalCost
      });
    });
    
    it("Should allow cancellation with full refund when >48hrs before start", async function () {
      const renterBalanceBefore = await ethers.provider.getBalance(renter.address);
      
      // Cancel booking (we're still >48hrs before start)
      const tx = await carRental.connect(renter).cancelBooking(1);
      const receipt = await tx.wait();
      
      // Calculate gas used
      const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      
      const car = await carRental.cars(1);
      expect(car.isAvailable).to.equal(true);
      
      const rental = await carRental.rentals(1);
      expect(rental.isActive).to.equal(false);
      
      // Check that renter received full refund (minus gas)
      const renterBalanceAfter = await ethers.provider.getBalance(renter.address);
      const expectedRefund = ethers.utils.parseEther("0.02").mul(2).add(ethers.utils.parseEther("0.1"));
      
      expect(renterBalanceAfter).to.be.closeTo(
        renterBalanceBefore.add(expectedRefund).sub(gasUsed),
        ethers.utils.parseEther("0.0001") // Allow for small rounding differences
      );
    });
    
    it("Should allow cancellation with partial refund when <48hrs before start", async function () {
      // Move time forward to be <48hrs but still before start
      await time.increaseTo(startTime - 24 * 60 * 60);
      
      const renterBalanceBefore = await ethers.provider.getBalance(renter.address);
      
      // Cancel booking
      const tx = await carRental.connect(renter).cancelBooking(1);
      const receipt = await tx.wait();
      
      // Calculate gas used
      const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      
      // Should get 50% refund
      const totalAmount = ethers.utils.parseEther("0.02").mul(2).add(ethers.utils.parseEther("0.1"));
      const expectedRefund = totalAmount.div(2);
      
      const renterBalanceAfter = await ethers.provider.getBalance(renter.address);
      
      expect(renterBalanceAfter).to.be.closeTo(
        renterBalanceBefore.add(expectedRefund).sub(gasUsed),
        ethers.utils.parseEther("0.0001") // Allow for small rounding differences
      );
    });
    
    it("Should not allow cancellation after start time", async function () {
      // Move time forward to after start
      await time.increaseTo(startTime + 1);
      
      // Try to cancel
      await expect(
        carRental.connect(renter).cancelBooking(1)
      ).to.be.revertedWith("Too late to cancel");
    });
  });
  
  describe("Rental Completion", function () {
    let startTime;
    let endTime;
    
    beforeEach(async function () {
      // Book a car for testing completion
      startTime = (await time.latest()) + (24 * 60 * 60);
      endTime = startTime + (2 * 24 * 60 * 60); // 2 day rental
      
      // First reset the car to available if it's not
      const car = await carRental.cars(1);
      if (!car.isAvailable) {
        try {
          await carRental.connect(renter).cancelBooking(1);
        } catch (e) {
          // Might fail if already cancelled or completed, that's OK
        }
      }
      
      // Book the car
      const totalCost = ethers.utils.parseEther("0.02").mul(2).add(ethers.utils.parseEther("0.1"));
      await carRental.connect(renter).bookCar(1, startTime, endTime, {
        value: totalCost
      });
    });
    
    it("Should not allow completion before end time", async function () {
      // Move time to after start but before end
      await time.increaseTo(startTime + 1);
      
      await expect(
        carRental.connect(renter).completeRental(1)
      ).to.be.revertedWith("Too early");
    });
    
    it("Should allow completion after end time with correct payouts", async function () {
      // Move time to after end
      await time.increaseTo(endTime + 1);
      
      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
      const renterBalanceBefore = await ethers.provider.getBalance(renter.address);
      
      // Complete rental
      const tx = await carRental.connect(renter).completeRental(1);
      const receipt = await tx.wait();
      
      // Calculate gas used
      const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      
      const car = await carRental.cars(1);
      expect(car.isAvailable).to.equal(true);
      
      const rental = await carRental.rentals(1);
      expect(rental.isActive).to.equal(false);
      
      // Owner should receive rental fee
      const rentalFee = ethers.utils.parseEther("0.02").mul(2);
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
      expect(ownerBalanceAfter).to.equal(ownerBalanceBefore.add(rentalFee));
      
      // Renter should receive deposit back (minus gas)
      const deposit = ethers.utils.parseEther("0.1");
      const renterBalanceAfter = await ethers.provider.getBalance(renter.address);
      expect(renterBalanceAfter).to.be.closeTo(
        renterBalanceBefore.add(deposit).sub(gasUsed),
        ethers.utils.parseEther("0.0001") // Allow for small rounding differences
      );
    });
    
    it("Should not allow non-renter to complete the rental", async function () {
      // Move time to after end
      await time.increaseTo(endTime + 1);
      
      await expect(
        carRental.connect(otherAccount).completeRental(1)
      ).to.be.revertedWith("Not renter");
    });
  });
  
  describe("View Functions", function () {
    it("Should list available cars correctly", async function () {
      // List a second car
      await carRental.listCar(
        ethers.utils.parseEther("0.03"),
        ethers.utils.parseEther("0.15"),
        "ipfs://QmAnotherCarMetadata"
      );
      
      const availableCars = await carRental.getAvailableCars();
      expect(availableCars.length).to.be.at.least(1);
      
      // Check that listed cars are actually available
      for (const carId of availableCars) {
        const car = await carRental.cars(carId);
        expect(car.isAvailable).to.equal(true);
      }
    });
    
    it("Should retrieve correct rental info", async function () {
      // Find a booked car
      let bookedCarId = 0;
      const carCount = await carRental.getCarCount();
      
      for (let i = 1; i <= carCount.toNumber(); i++) {
        const rental = await carRental.rentals(i);
        if (rental.isActive) {
          bookedCarId = i;
          break;
        }
      }
      
      if (bookedCarId > 0) {
        const rental = await carRental.rentals(bookedCarId);
        const [renter, startTime, endTime, isActive] = await carRental.getRentalInfo(bookedCarId);
        
        expect(renter).to.equal(rental.renter);
        expect(startTime).to.equal(rental.startTime);
        expect(endTime).to.equal(rental.endTime);
        expect(isActive).to.equal(rental.isActive);
      }
    });
  });
});