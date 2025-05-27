const { expect } = require("chai");

describe("CarRental", function () {
    let contract;
    let owner, renter, other;
    let pricePerDay, deposit, metadata;

    beforeEach(async () => {
        [owner, renter, other] = await ethers.getSigners();

        const ContractFactory = await ethers.getContractFactory("CarRental");
        contract = await ContractFactory.deploy();
        await contract.waitForDeployment();

        pricePerDay = ethers.parseEther("0.1");
        deposit = ethers.parseEther("0.5");
        metadata = "ipfs://car1";
    });

    it("should list a car successfully", async () => {
        await expect(contract.connect(owner).listCar(pricePerDay, deposit, metadata))
            .to.emit(contract, "CarListed")
            .withArgs(1, owner.address, pricePerDay, deposit, metadata);

        const car = await contract.cars(1);
        expect(car.owner).to.equal(owner.address);
        expect(car.pricePerDay).to.equal(pricePerDay);
        expect(car.depositAmount).to.equal(deposit);
        expect(car.isAvailable).to.be.true;
    });

    it("should allow booking a car with correct payment", async () => {
        await contract.connect(owner).listCar(pricePerDay, deposit, metadata);

        const currentTime = Math.floor(Date.now() / 1000);
        const start = currentTime + 86400; // 1 day from now
        const end = start + 2 * 86400; // 2 days rental
        const totalCost = pricePerDay * 2n + deposit;

        await expect(contract.connect(renter).bookCar(1, start, end, { value: totalCost }))
            .to.emit(contract, "CarBooked")
            .withArgs(1, renter.address, start, end, totalCost);

        const car = await contract.cars(1);
        expect(car.isAvailable).to.be.false;
    });

    it("should reject incorrect booking payment", async () => {
        await contract.connect(owner).listCar(pricePerDay, deposit, metadata);

        const currentTime = Math.floor(Date.now() / 1000);
        const start = currentTime + 86400;
        const end = start + 86400;
        const wrongAmount = ethers.parseEther("0.01");

        await expect(
            contract.connect(renter).bookCar(1, start, end, { value: wrongAmount })
        ).to.be.revertedWith("Incorrect payment");
    });

    it("should allow cancellation with full refund when >48h before start", async () => {
        await contract.connect(owner).listCar(pricePerDay, deposit, metadata);

        const currentTime = Math.floor(Date.now() / 1000);
        const start = currentTime + 3 * 86400; // 3 days from now
        const end = start + 86400; // 1 day rental
        const total = pricePerDay + deposit;

        await contract.connect(renter).bookCar(1, start, end, { value: total });

        const renterBalanceBefore = await ethers.provider.getBalance(renter.address);

        const tx = await contract.connect(renter).cancelBooking(1);
        const receipt = await tx.wait();
        const gasUsed = receipt.gasUsed * receipt.gasPrice;

        const renterBalanceAfter = await ethers.provider.getBalance(renter.address);

        // Check that renter got approximately full refund (minus gas)
        expect(renterBalanceAfter).to.be.closeTo(
            renterBalanceBefore + total - gasUsed,
            ethers.parseEther("0.001") // Small tolerance for gas variations
        );

        await expect(tx).to.emit(contract, "BookingCancelled");

        const car = await contract.cars(1);
        expect(car.isAvailable).to.be.true;
    });

    it("should allow cancellation with 50% refund when <48h before start", async () => {
        await contract.connect(owner).listCar(pricePerDay, deposit, metadata);

        const currentTime = Math.floor(Date.now() / 1000);
        const start = currentTime + 3600; // 1 hour from now (less than 48h)
        const end = start + 86400; // 1 day rental
        const total = pricePerDay + deposit;

        await contract.connect(renter).bookCar(1, start, end, { value: total });

        await expect(contract.connect(renter).cancelBooking(1))
            .to.emit(contract, "BookingCancelled")
            .withArgs(1, renter.address, total / 2n);
    });

    it("should complete a rental and distribute funds correctly", async () => {
        await contract.connect(owner).listCar(pricePerDay, deposit, metadata);

        const currentTime = Math.floor(Date.now() / 1000);
        const start = currentTime + 100;
        const end = start + 86400; // 1 day rental
        const total = pricePerDay + deposit;

        await contract.connect(renter).bookCar(1, start, end, { value: total });

        // Fast forward time to after rental end
        await ethers.provider.send("evm_increaseTime", [86400 + 120]);
        await ethers.provider.send("evm_mine");

        const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
        const renterBalanceBefore = await ethers.provider.getBalance(renter.address);

        const tx = await contract.connect(renter).completeRental(1);
        const receipt = await tx.wait();
        const gasUsed = receipt.gasUsed * receipt.gasPrice;

        const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
        const renterBalanceAfter = await ethers.provider.getBalance(renter.address);

        // Owner should receive rental fee
        expect(ownerBalanceAfter).to.equal(ownerBalanceBefore + pricePerDay);

        // Renter should receive deposit back (minus gas)
        expect(renterBalanceAfter).to.be.closeTo(
            renterBalanceBefore + deposit - gasUsed,
            ethers.parseEther("0.001")
        );

        await expect(tx)
            .to.emit(contract, "RentalCompleted")
            .withArgs(1, renter.address, pricePerDay, deposit);

        const car = await contract.cars(1);
        expect(car.isAvailable).to.be.true;
    });

    it("should reject booking with start time in the past", async () => {
        await contract.connect(owner).listCar(pricePerDay, deposit, metadata);

        const currentTime = Math.floor(Date.now() / 1000);
        const start = currentTime - 3600; // 1 hour ago
        const end = start + 86400;
        const total = pricePerDay + deposit;

        await expect(
            contract.connect(renter).bookCar(1, start, end, { value: total })
        ).to.be.revertedWith("Start time must be in future");
    });

    it("should handle minimum 1 day rental correctly", async () => {
        await contract.connect(owner).listCar(pricePerDay, deposit, metadata);

        // Get block timestamp to be more accurate
        const latestBlock = await ethers.provider.getBlock('latest');
        const start = latestBlock.timestamp + 3600; // 1 hour from latest block
        const end = start + 3600; // Less than 1 day
        const total = pricePerDay + deposit; // Should still charge for 1 day minimum

        await expect(contract.connect(renter).bookCar(1, start, end, { value: total }))
            .to.emit(contract, "CarBooked");
    });

    it("should get available cars correctly", async () => {
        await contract.connect(owner).listCar(pricePerDay, deposit, metadata);
        await contract.connect(owner).listCar(pricePerDay, deposit, metadata);

        let availableCars = await contract.getAvailableCars();
        expect(availableCars.length).to.equal(2);
        expect(availableCars[0]).to.equal(1);
        expect(availableCars[1]).to.equal(2);

        // Book one car
        const latestBlock = await ethers.provider.getBlock('latest');
        const start = latestBlock.timestamp + 3600; // 1 hour from latest block
        const end = start + 86400;
        const total = pricePerDay + deposit;

        await contract.connect(renter).bookCar(1, start, end, { value: total });

        availableCars = await contract.getAvailableCars();
        expect(availableCars.length).to.equal(1);
        expect(availableCars[0]).to.equal(2);
    });

    it("should not allow non-owner to set rate and deposit", async () => {
        await contract.connect(owner).listCar(pricePerDay, deposit, metadata);

        await expect(
            contract.connect(renter).setRateAndDeposit(1, pricePerDay, deposit)
        ).to.be.revertedWith("Not car owner");
    });

    it("should not allow booking non-existent car", async () => {
        const currentTime = Math.floor(Date.now() / 1000);
        const start = currentTime + 3600;
        const end = start + 86400;
        const total = pricePerDay + deposit;

        await expect(
            contract.connect(renter).bookCar(999, start, end, { value: total })
        ).to.be.revertedWith("Car does not exist");
    });
});