# 🏁 WhipCheck Production Deployment Guide

WhipCheck is ready for production out of the box! This guide covers how to deploy the application completely **for free** on premium cloud hosting platforms, utilizing **Google's generous Free Tiers** for both computing and AI vision.

---

## 1. 🔑 Getting a Free Gemini API Key
To power WhipCheck’s vehicle detection brain in production without paying anything:
1. Visit [Google AI Studio](https://aistudio.google.com/).
2. Click **Create API Key**.
3. Create a key in a new or existing Google Cloud project.
4. **Free Tier Limits (Gemini 2.5 Flash / 1.5 Flash):**
   * **15 Requests Per Minute (RPM)**
   * **1,500 Requests Per Hour (RPH)**
   * 1 Million Tokens Per Minute (TPM)
   * **Cost: $0.00**

---

## 2. 🚀 Option A: Deploy on Google Cloud Run (Highly Recommended)
Google Cloud Run is an ultra-fast serverless container hosting platform. Its default monthly free tier is massive and will never charge you if you stay under it.

### Google Cloud Run Monthly Free Tier:
* **First 2 Million Requests** are 100% Free.
* **First 180,000 vCPU-seconds** are Free.
* **First 360,000 GiB-seconds** are Free.
* Easily runs a hobby or small production app month-after-month for **$0.00**.

### Deployment Steps:
1. Ensure your code is hosted in a GitHub repository.
2. Install the [Google Cloud Console CLI](https://cloud.google.com/sdk/docs/install) on your machine or use the Cloud Shell.
3. Run the following command in your terminal inside the root directory:
   ```bash
   gcloud run deploy whipcheck --source . --port 3000 --allow-unauthenticated
   ```
4. When prompted:
   * Select a region close to your target audience.
   * Accept the prompt to build and publish the container.
5. In your Google Cloud Run dashboard, go to the **WhipCheck service** > **Variables & Secrets** tab, and add:
   * `GEMINI_API_KEY` = `your_actual_gemini_api_key_here`
6. Your live production URL is ready!

---

## 3. 🌐 Option B: Deploy on Render.com (Easiest No-Code Setups)
Render provides free full-stack hosting starting directly from your GitHub repository.

### Deployment Steps:
1. Create a free account at [Render.com](https://render.com/).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub repository containing WhipCheck.
4. **Deploy Settings:**
   * **Runtime:** Select `Docker` (our newly created `Dockerfile` will be auto-detected and built automatically!).
   * **Instance Type:** Select `Free` ($0/month).
5. Scroll down to the **Environment Variables** section and add the following key-value pair:
   * `GEMINI_API_KEY` = `your_actual_gemini_api_key_here`
6. Click **Deploy Web Service**. Render will automatically compile the Vite frontend, bundle the Node/Express backend safely, and launch your application!

---

## 🔒 Security Best Practices implemented for Production (Phase 1):
1. **Lazy Key Initialization**: The backend server boots even if your API key is temporarily missing, preventing silent host crashes (meaning you can deploy first and configure the environment variables later without cold startup loops).
2. **Interactive Environment Verification**: The frontend automatically queries the backend and alerts you with an elegant, non-obtrusive workspace warning if your production environment variables are incomplete, guiding you to the right settings securely.
3. **Multi-Stage secure Docker Isolation**: Run inside production as a non-root system user (`expressjs`) using lightweight, low-memory footprints to guarantee zero unexpected server leaks or overages.
