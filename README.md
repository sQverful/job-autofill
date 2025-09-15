# Job Application Autofill Chrome Extension

<div align="center">

![](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)
![](https://img.shields.io/badge/Typescript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![](https://badges.aleen42.com/src/vitejs.svg)
![](https://img.shields.io/badge/Chrome-Extension-green?style=flat-square&logo=googlechrome)

</div>

**Apply Ninja** - A sophisticated Chrome extension that automatically fills job application forms with your personal information, saving time and ensuring consistency across applications.

## ✨ Features

- **🎯 Smart Form Detection**: Automatically detects job application forms across major job platforms
- **⚡ One-Click Autofill**: Fill entire forms instantly with your saved profile data
- **📝 Comprehensive Profile Management**: Store personal info, work experience, education, and preferences
- **🔄 Multi-Step Form Support**: Handles complex, multi-page application processes
- **🎨 Modern UI Components**: Supports React Select, dynamic forms, and SPA applications
- **📊 Real-time Feedback**: Visual progress indicators and success/error notifications
- **🔒 Privacy-First**: All data stored locally - no external servers involved
- **📤 Import/Export**: Backup and restore your profile data
- **♿ Accessibility**: Full keyboard navigation and screen reader support

## 🌐 Supported Platforms

- **LinkedIn Jobs**
- **Indeed**
- **Workday**
- **SmartRecruiters**
- **Greenhouse**
- **Lever**
- **BambooHR**
- **Custom company career pages**
- **And many more ATS systems**

## 🏗️ Architecture

### Core Components

**Content Scripts** (`pages/content/`)
- **Enhanced Autofill Engine**: Intelligent form detection and field mapping
- **Component Detection**: Handles modern React/Vue components and custom inputs
- **Multi-Strategy Detection**: Traditional forms, SPAs, and page-wide field scanning

**Popup Interface** (`pages/popup/`)
- **Profile Management**: Comprehensive user data entry and editing
- **Autofill Control**: Trigger autofill and view detailed results
- **Settings & Privacy**: Configure extension behavior and data handling

**Content UI** (`pages/content-ui/`)
- **Floating Button**: Contextual autofill trigger on job sites
- **Visual Feedback**: Progress indicators and success/error states

**Background Service** (`chrome-extension/src/background/`)
- **Message Routing**: Handles communication between components
- **Extension Lifecycle**: Manages installation, updates, and settings

### Data Flow

```
User Profile (Local Storage) → Content Script → Form Detection → Field Mapping → Autofill → Visual Feedback
```

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Build System**: Vite, Turborepo (monorepo)
- **Extension**: Chrome Manifest V3
- **Storage**: Chrome Extension Storage API
- **Testing**: Comprehensive test suite
- **Accessibility**: WCAG 2.1 compliant

## 🚀 Getting Started

### Prerequisites
- **Node.js** >= 22.15.1 (see `.nvmrc`)
- **pnpm** package manager
- **Chrome** browser for development

### Installation & Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd job-autofill-extension
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Start development server**
   ```bash
   pnpm dev
   ```

4. **Load extension in Chrome**
   - Open Chrome and go to `chrome://extensions`
   - Enable "Developer mode" (top right toggle)
   - Click "Load unpacked"
   - Select the `dist` folder from the project

5. **Start using the extension**
   - Click the extension icon in Chrome toolbar
   - Set up your profile with personal information
   - Navigate to any job site and click "Fill Out Form"

### Production Build

```bash
# Build for production
pnpm build

# Create extension package
pnpm zip
```

## 📖 How to Use

### 1. Set Up Your Profile
- Click the extension icon in your Chrome toolbar
- Navigate to the "Profile" tab
- Fill in your personal information, work experience, and preferences
- Save your profile (all data is stored locally)

### 2. Apply to Jobs
- Visit any supported job site (LinkedIn, Indeed, etc.)
- Open a job application form
- The extension will automatically detect fillable forms
- Click the "Fill Out Form" button in the extension popup
- Review the filled information and submit

### 3. Manage Your Data
- **Export**: Backup your profile as a JSON file
- **Import**: Restore profile from a backup file
- **Edit**: Update your information anytime
- **Privacy**: All data stays on your device

## 📁 Project Structure

```
job-autofill-extension/
├── pages/                   # Extension pages
│   ├── content/            # Form detection & autofill logic
│   │   ├── src/
│   │   │   ├── enhanced-autofill.ts      # Main autofill engine
│   │   │   ├── components/               # Form interaction components
│   │   │   ├── detection/                # Form detection strategies
│   │   │   └── utils/                    # Helper utilities
│   ├── content-ui/         # Floating UI overlay
│   ├── popup/              # Main extension interface
│   │   ├── src/
│   │   │   ├── components/               # Profile forms & settings
│   │   │   └── Popup.tsx                 # Main popup component
│   └── background/         # Service worker
├── packages/               # Shared packages
│   ├── shared/            # Types & interfaces
│   ├── storage/           # Data persistence layer
│   ├── ui/                # Reusable UI components
│   └── ...                # Build tools & utilities
├── chrome-extension/       # Extension configuration
│   ├── manifest.ts        # Extension manifest
│   └── public/            # Static assets
└── job_forms_samples/      # Sample forms for testing
```

## 🔧 Development

### Available Scripts

```bash
# Development
pnpm dev              # Start development server with hot reload
pnpm dev:firefox      # Development build for Firefox

# Production
pnpm build            # Production build for Chrome
pnpm build:firefox    # Production build for Firefox

# Testing & Quality
pnpm type-check       # TypeScript type checking
pnpm lint             # ESLint code linting
pnpm lint:fix         # Fix linting issues
pnpm format           # Prettier code formatting

# Packaging
pnpm zip              # Create extension package (.zip)
pnpm e2e              # End-to-end testing
```

### Adding New Job Sites

1. **Identify form patterns** in `pages/content/src/enhanced-autofill.ts`
2. **Add platform detection** in `detectPlatform()` method
3. **Configure field mappings** in `mapToProfileField()` method
4. **Test with sample forms** in `job_forms_samples/`

### Extending Profile Data

1. **Update types** in `packages/shared/lib/types/profile.ts`
2. **Modify storage** in `packages/storage/`
3. **Update UI forms** in `pages/popup/src/components/`
4. **Add field mappings** in content script

## 📊 Data Schema

The extension manages comprehensive profile data:

```typescript
interface UserProfile {
  personalInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: Address;
    linkedInUrl?: string;
    portfolioUrl?: string;
    githubUrl?: string;
  };
  professionalInfo: {
    workExperience: WorkExperience[];
    education: Education[];
    skills: string[];
    certifications: Certification[];
    summary?: string;
  };
  preferences: {
    jobPreferences: JobPreferences;
    defaultAnswers: Record<string, string>;
    privacySettings: PrivacySettings;
  };
  documents: {
    resumes: ResumeDocument[];
    coverLetters: CoverLetterTemplate[];
  };
}
```

### Smart Field Detection

The extension intelligently maps form fields using pattern matching:

- **Personal Info**: Name, email, phone, address
- **Professional**: Work experience, education, skills
- **Preferences**: Salary, start date, work authorization
- **Demographics**: Optional diversity and inclusion questions
- **Documents**: Resume and cover letter uploads

## 🎨 User Experience

### Visual Design
- **Clean Interface**: Intuitive popup design with tabbed navigation
- **Real-time Feedback**: Progress indicators and status messages
- **Smooth Animations**: Respects user's motion preferences
- **Responsive Design**: Works across different screen sizes

### Accessibility Features
- **Keyboard Navigation**: Full keyboard support for all interactions
- **Screen Reader Support**: ARIA labels and semantic HTML
- **Motion Preferences**: Respects `prefers-reduced-motion` settings
- **High Contrast**: Compatible with browser accessibility settings

## 🔒 Privacy & Security

- **Local Storage Only**: All data stored in Chrome's extension storage
- **No External Servers**: Zero data transmission to third parties
- **User Control**: Complete control over your data with export/import
- **Minimal Permissions**: Only requests necessary browser permissions
- **Open Source**: Transparent codebase for security review

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Report Issues**: Found a bug or have a feature request? Open an issue
2. **Add Job Sites**: Help us support more job platforms
3. **Improve Detection**: Enhance form field detection accuracy
4. **UI/UX**: Improve the user interface and experience
5. **Documentation**: Help improve documentation and examples

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes and test thoroughly
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with the [Chrome Extension Boilerplate](https://github.com/Jonghakseo/chrome-extension-boilerplate-react-vite)
- Icons and design inspiration from the community
- Thanks to all contributors and testers

## 🔧 Troubleshooting

### Common Issues

**Extension not loading:**
- Ensure you've run `pnpm build` first
- Check that the `dist` folder exists
- Verify Developer Mode is enabled in Chrome

**Form not detected:**
- The extension works best on major job sites
- Some custom sites may need manual configuration
- Try refreshing the page after loading the extension

**Node.js version errors:**
```bash
# Install correct Node.js version
nvm install 22.15.1
nvm use 22.15.1
npm install -g pnpm
```

### Getting Help

1. Check existing [GitHub Issues](https://github.com/your-repo/issues)
2. Create a new issue with:
   - Browser version
   - Extension version
   - Steps to reproduce
   - Console errors (if any)

---

**Made with ❤️ for job seekers everywhere**
