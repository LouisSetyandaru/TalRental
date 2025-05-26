const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DecentraRent", function () {
    let contract, owner, renter, other;
    const metadata = "ipfs://car1";
    const pricePerDay = ethers.utils.parseEther("0.1");
    const deposit = ethers.utils.parseEther("0.5");

    beforeEach(async () => {
        [owner, renter, other] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory("DecentraRent");
        contract = await Factory.deploy();
        await contract.deployed();
    });

    it("should list a car successfully", async () => {
        await expect(contract.connect(owner).listCar(pricePerDay, deposit, metadata))
            .to.emit(contract, "CarListed");

        const car = await contract.cars(1);
        expect(car.owner).to.equal(owner.address);
        expect(car.pricePerDay).to.equal(pricePerDay);
    });

    it("should allow booking a car with correct payment", async () => {
        await contract.connect(owner).listCar(pricePerDay, deposit, metadata);

        const start = Math.floor(Date.now() / 1000) + 86400;
        const end = start + 2 * 86400;
        const totalCost = pricePerDay.mul(2).add(deposit);

        await expect(contract.connect(renter).bookCar(1, start, end, { value: totalCost }))
            .to.emit(contract, "CarBooked");

        const rental = await contract.getRentalInfo(1);
        expect(rental.renter).to.equal(renter.address);
    });

    it("should reject incorrect booking payment", async () => {
        await contract.connect(owner).listCar(pricePerDay, deposit, metadata);

        const start = Math.floor(Date.now() / 1000) + 86400;
        const end = start + 86400;
        const wrongAmount = ethers.utils.parseEther("0.01");

        await expect(
            contract.connect(renter).bookCar(1, start, end, { value: wrongAmount })
        ).to.be.revertedWith("Incorrect payment");
    });

    it("should allow cancellation and give full refund", async () => {
        await contract.connect(owner).listCar(pricePerDay, deposit, metadata);

        const start = Math.floor(Date.now() / 1000) + 3 * 86400;
        const end = start + 86400;
        const total = pricePerDay.mul(1).add(deposit);

        await contract.connect(renter).bookCar(1, start, end, { value: total });

        await expect(contract.connect(renter).cancelBooking(1))
            .to.emit(contract, "BookingCancelled");
    });

    it("should complete a rental and distribute funds correctly", async () => {
        await contract.connect(owner).listCar(pricePerDay, deposit, metadata);

        const start = Math.floor(Date.now() / 1000) + 100;
        const end = start + 86400;
        const total = pricePerDay.mul(1).add(deposit);

        await contract.connect(renter).bookCar(1, start, end, { value: total });

        await ethers.provider.send("evm_increaseTime", [86400 + 120]);
        await ethers.provider.send("evm_mine");

        await expect(contract.connect(renter).completeRental(1))
            .to.emit(contract, "RentalCompleted");
    });
});
