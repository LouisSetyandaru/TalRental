const db = require('./db');
const startBlockchainListener = require('./services/blockchainListener');

// Setelah koneksi database berhasil
db.connectToServer().then(() => {
  // Start blockchain listener
  startBlockchainListener().catch(console.error);
  
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});