# 🚀 Deployment Guide — Ghost Referee

This guide provides step-by-step instructions for deploying the **Ghost Referee** platform, including the Frontend, Backend, and Database.

---

## 🛠️ Prerequisites
- **Node.js**: v18.x or higher
- **PostgreSQL**: A running instance (e.g. RDS, or local)
- **GitHub Account**: For CI/CD and repository management
- **Telegram Bot Token**: From [@BotFather](https://t.me/botfather)

---

## 1. Database Setup

The project uses **Prisma ORM** for database management.

1.  Create a new PostgreSQL database.
2.  Copy your **Database URL** (Connection String).
3.  The schema will be automatically applied during the backend setup steps below using Prisma.

---

## 2. Backend Deployment (`/server`)

The backend is a Node.js Express server using Prisma ORM.

### Environment Variables (`server/.env`)
Create a `.env` file in the `server` directory with the following:
```env
PORT=4000
DATABASE_URL="postgresql://user:password@host:port/dbname"
JWT_SECRET="your_very_secret_key"
BOT_TOKEN="your_telegram_bot_token"
API_URL="https://your-backend-domain.com"
WEBAPP_URL="https://your-frontend-domain.com"
```

### Steps:
1.  `cd server`
2.  `npm install`
3.  `npx prisma db push` — This will automatically create the tables and relations in your PostgreSQL database.
4.  `npx prisma generate` — Generates the Prisma client for use in the code.
5.  `npm run build`
6.  `npm start`

---

## 3. Frontend Deployment (Root)

The frontend is a Next.js application.

### Environment Variables (`.env.local`)
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_API_URL="https://your-backend-domain.com"
NEXT_PUBLIC_PLATFORM_NAME="Ghost Referee"
```

### Steps:
1.  `npm install`
2.  `npm run build`
3.  Deploy to **Vercel**, **Netlify**, or any Node.js hosting provider.
    *   *If using Vercel:* Simply connect your GitHub repo and add the `NEXT_PUBLIC_API_URL` environment variable.

---

## 4. Telegram Bot Configuration

1.  Open your Telegram Bot in [@BotFather](https://t.me/botfather).
2.  Set the **Menu Button** or a custom button to open your `WEBAPP_URL`.
3.  Ensure the `server/.env` has the correct `BOT_TOKEN`.
4.  The bot must be an administrator in the Telegram Rooms used for battles.

---

## 5. Security Checklist
- [ ] Ensure `JWT_SECRET` is unique and strong.
- [ ] Verify that `.env` files are in `.gitignore`.
- [ ] Set up CORS on the backend to only allow your frontend domain.

---

## 📈 Monitoring & Logs
- **Frontend**: Check Vercel/Hosting dashboard for build errors.
- **Backend**: Use `pm2 logs` or your cloud provider's logging system.
- **Database**: Monitor PostgreSQL logs for transaction conflicts.
