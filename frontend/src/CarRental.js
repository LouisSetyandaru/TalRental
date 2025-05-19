    import React, { useEffect, useState } from 'react';
    import { ethers } from 'ethers';
    import CarRentalABI from './CarRentalABI.json'; // Import ABI dari smart contract

    const CarRental = () => {
        const [provider, setProvider] = useState(null);
        const [contract, setContract] = useState(null);
        const [account, setAccount] = useState(null);

        useEffect(() => {
            const init = async () => {
                const provider = new ethers.providers.Web3Provider(window.ethereum);
                const accounts = await provider.send("eth_requestAccounts", []);
                // eslint-disable-next-line no-undef
                const contract = new ethers.Contract(CONTRACT_ADDRESS, CarRentalABI, provider.getSigner());
                setProvider(provider);
                setContract(contract);
                setAccount(accounts[0]);
            };
            init();
        }, []);

        // Tambahkan fungsi untuk listing, booking, dan lainnya

        return (
            <div>
                <h1>Car Rental DApp</h1>
                {/* Tambahkan UI untuk interaksi */}
            </div>
        );
    };

    export default CarRental;
    