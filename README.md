# AI-Powered MCQ Master

A responsive multiple-choice question practice platform with immediate feedback, progress tracking, and AI-powered explanations.

## Deployment to Netlify

To deploy this project to Netlify:

1.  **Connect to GitHub**: Push this repository to your GitHub account.
2.  **Create a New Site**: In Netlify, select "Import from git" and choose this repository.
3.  **Build Settings**:
    *   **Build Command**: `npm run build`
    *   **Publish Directory**: `dist`
4.  **Environment Variables**:
    *   Go to **Site settings > Environment variables**.
    *   Add `GEMINI_API_KEY` with your Google Gemini API key.
5.  **Deploy**: Click "Deploy site".

## Local Development

1.  Install dependencies: `npm install`
2.  Create a `.env` file and add `GEMINI_API_KEY=your_key_here`.
3.  Start the dev server: `npm run dev`
