# AI Agent for Ama

This repository contains multiple web and backend projects for building an AI assistant application named Ama.

## Repository Structure

- `ama-app/`
  - `backend/` - Node.js backend with authentication, Claude integration, and Gmail services.
  - `frontend/` - Frontend application using Vite and React.
- `backend/` - Separate backend project with Firebase Admin integration.
- `frontend of ai agent ama/` - Another frontend application with a React + Vite app and shadcn/ui components.
- `Register and Login Page/` - Standalone authentication UI project with login and register pages.
- `updateAuth.js` - Utility script for updating authentication configuration.

## Getting Started

1. Install dependencies for the project or chosen workspace:
   ```bash
   npm install
   ```
2. Inspect each subproject for its own setup instructions and `package.json` scripts.
3. Start the appropriate frontend or backend from the corresponding folder.

## Notes

- Some folders are separate applications and may each require their own local environment and startup commands.
- The root `package.json` only lists shared dependencies used by some backend services.

## Suggested Workflow

- Explore `ama-app/` for the main Ama web app stack.
- Use `backend/` for Firebase Admin-based services.
- Use `frontend of ai agent ama/` and `Register and Login Page/` as UI-focused applications.

## License

Add a license and additional documentation as needed.
