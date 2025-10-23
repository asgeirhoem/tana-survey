# Startup Survey App

An AI-powered conversational survey application that collects insights about startup workflows, tools, and team structures. Built with Next.js, Anthropic Claude API, and Google Sheets for data storage.

## Features

- **Conversational AI Interface**: Natural chat experience powered by Claude
- **Secure API Key Management**: Environment variables protect sensitive credentials  
- **Google Sheets Integration**: Automatic data storage and organization
- **Responsive Design**: Clean, mobile-friendly interface with Tailwind CSS
- **Custom Domain Ready**: Configured for easy deployment on Vercel

## Tech Stack

- **Frontend**: Next.js 15 with App Router, TypeScript, Tailwind CSS
- **AI**: Anthropic Claude API (Claude-3 Sonnet)
- **Data Storage**: Google Sheets API
- **Deployment**: Vercel
- **Styling**: Tailwind CSS

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:
```bash
cp .env.example .env.local
```

Fill in your actual values in `.env.local`:

#### Anthropic API Key
1. Sign up at https://console.anthropic.com/
2. Create an API key
3. Add it to `ANTHROPIC_API_KEY`

#### Google Sheets Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google Sheets API
4. Create a Service Account:
   - Go to "Credentials" → "Create Credentials" → "Service Account"
   - Download the JSON key file
   - Extract `private_key` and `client_email` to your `.env.local`
5. Create a Google Sheet and copy its ID from the URL
6. Share the sheet with your service account email (with Editor permissions)

#### Environment Variables
```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GOOGLE_SHEETS_PRIVATE_KEY="your_private_key_with_newlines"
GOOGLE_SHEETS_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_SHEETS_SPREADSHEET_ID=your_sheets_id_from_url
```

### 3. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to see your survey app.

### 4. Deploy to Vercel

#### Option A: Deploy via Git
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

#### Option B: Deploy via CLI
```bash
npm install -g vercel
vercel --prod
```

### 5. Custom Domain Setup

In your Vercel dashboard:
1. Go to your project settings
2. Navigate to "Domains" 
3. Add your custom domain
4. Configure DNS records as instructed

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts      # Anthropic API integration
│   │   └── sheets/route.ts    # Google Sheets API integration
│   ├── components/
│   │   ├── ChatInput.tsx      # Message input component
│   │   ├── ChatMessage.tsx    # Message display component
│   │   └── SurveyChat.tsx     # Main chat interface
│   ├── globals.css            # Global styles
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Home page
└── lib/
    ├── anthropic.ts           # Claude API client
    └── sheets.ts              # Google Sheets client
```

## Survey Logic

The AI is configured to gather insights about:
- Company basics (industry, stage, team size)
- Team structure and roles
- Workflow and processes  
- Tools and software usage
- Challenges and pain points
- Growth plans and priorities

Data is automatically saved to Google Sheets with:
- Timestamp
- Session ID
- Message count
- Full conversation transcript
- Latest AI response

## Security Notes

- API keys are never exposed to the client
- All sensitive operations happen server-side
- Google Sheets integration uses service account authentication
- Environment variables are git-ignored

## Customization

### Modify the Survey Questions
Edit the system prompt in `src/lib/anthropic.ts` to change the AI's behavior and focus areas.

### Styling Changes
Update Tailwind classes in the components or modify `src/app/globals.css` for global styles.

### Data Storage
The Google Sheets integration can be easily swapped for other storage solutions by modifying `src/lib/sheets.ts`.

## Troubleshooting

### Common Issues

1. **Anthropic API Errors**: Check your API key and account credits
2. **Google Sheets Permissions**: Ensure the service account has access to your sheet
3. **Environment Variables**: Verify all required variables are set in production
4. **Private Key Format**: Make sure to replace `\\n` with actual newlines in the private key

### Testing the Setup

Visit `/api/sheets` to test Google Sheets connection (returns success if configured correctly).

## License

MIT License - feel free to use this as a starting point for your own survey projects!