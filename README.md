# 🩸 LifeStream: Blood Donation Platform (Server)

## 🎯 Purpose
Backend API server for the LifeStream blood donation application. Handles authentication, donation requests, user management, funding, and Stripe payment integration.

## 🌐 Live URL
- **Server**: https://lifestream-blood-donation-server.vercel.app
- **Client**: https://lifestream-blood-donation.vercel.app

## ✨ Key Features
- JWT-based authentication via Better Auth JWKS
- Role-based access control (Donor / Volunteer / Admin)
- Blood donation request CRUD with status management (pending → inprogress → done/canceled)
- Donor search with blood group, district, and upazila filtering
- Admin: user management (block/unblock, role change)
- Admin/Volunteer dashboard with real-time stats and chart data
- Stripe payment integration for community funding
- MongoDB Atlas for data storage

## 📦 npm Packages Used
- `express` - Web framework
- `cors` - Cross-Origin Resource Sharing
- `dotenv` - Environment variable management
- `mongodb` - MongoDB native driver
- `stripe` - Payment processing
- `jose-cjs` - JWT verification
- `nodemon` - Development auto-restart

## 🚀 Local Setup
1. Clone the repository
2. Run `npm install`
3. Create a `.env` file with `MONGODB_URI`, `STRIPE_SECRET_KEY`, and `CLIENT_URL`
4. Run `npm start` or `npm run dev`
