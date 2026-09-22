const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('./config/db');
const app = require('./app');

// Fail loudly at boot rather than issuing tokens signed with a default secret
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'replace_with_a_long_random_secret') {
  console.error(
    'JWT_SECRET is missing or still set to the placeholder value. ' +
      'Set a long random string in backend/.env before starting the server.'
  );
  process.exit(1);
}

const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
})();
