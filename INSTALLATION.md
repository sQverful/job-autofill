# Smart AI Autofill Extension - Installation Guide

## Development Mode Installation (Chrome)

### Prerequisites
- Node.js 22.15.1 or higher
- pnpm package manager
- Chrome browser

### Step 1: Clone and Setup
```bash
git clone <your-repo-url>
cd job-autofill
pnpm install
```

### Step 2: Build the Extension
```bash
# For development build
pnpm build

# For production build (recommended)
pnpm zip
```

### Step 3: Load Extension in Chrome
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** toggle in the top right corner
3. Click **"Load unpacked"** button
4. Select the `dist` folder from your project directory
5. The Smart AI Autofill extension should now appear in your extensions list

### Step 4: Verify Installation
- Look for the extension icon in your Chrome toolbar
- Visit a job application form to test the autofill functionality
- Check the extension popup by clicking the icon

## Production Installation (From Release)

### Download Release
1. Go to the [Releases page](../../releases)
2. Download the latest `.zip` file
3. Extract the zip file to a folder on your computer

### Install in Chrome
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** toggle in the top right corner
3. Click **"Load unpacked"** and select the extracted folder
4. The extension is now installed and ready to use

## Troubleshooting

### Common Issues
- **Extension not loading**: Make sure you selected the `dist` folder, not the project root
- **Build errors**: Run `pnpm clean && pnpm install` and try building again
- **Permission errors**: Ensure Chrome has permission to access the extension files

### Development Tips
- Use `pnpm dev` for hot-reload during development
- Check Chrome DevTools Console for any errors
- Use `pnpm lint` to check for code issues before building

## Features
- AI-powered form filling for job applications
- Smart field detection and content generation
- Customizable content preferences
- Privacy-focused local processing