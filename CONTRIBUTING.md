# Contributing to RCJ Rescue Scoring

Thank you for your interest in contributing to the RCJ Rescue CMS (Competition Management System) project! We welcome contributions from the community and appreciate your efforts to improve this open-source RoboCup Junior Rescue Competition Scoring System.

## Table of Contents

- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Coding Standards](#coding-standards)
- [Branching Strategy](#branching-strategy)
- [Issue Management](#issue-management)
- [Pull Request Process](#pull-request-process)
- [Development Setup](#development-setup)
- [Community](#community)

## Getting Started

1. Fork the repository on GitHub
2. Clone your forked repository to your local machine
3. Set up the development environment (see [Development Setup](#development-setup))
4. Create a new branch for your feature or bug fix
5. Make your changes
6. Test your changes thoroughly
7. Submit a pull request

## How to Contribute

### Reporting Bugs

- Use the GitHub Issues to report bugs
- Check if the issue already exists before creating a new one
- Include detailed information about the bug, including steps to reproduce
- Include your environment information (OS, Node.js version, etc.)

### Suggesting Features

- Use GitHub Issues to propose new features
- Explain the feature in detail and why it's needed
- Consider the impact on existing functionality

### Code Contributions

- Look for issues labeled `good first issue` if you're new to the project
- Comment on issues you'd like to work on to avoid duplicate work
- Follow the [Coding Standards](#coding-standards) described below
- Write clear, concise commit messages
- Include tests for new functionality when appropriate

## Coding Standards

### JavaScript/Node.js
- Use ES6+ features where appropriate
- Follow the existing code style in the project
- Use 2 spaces for indentation
- Use descriptive variable and function names
- Add comments for complex logic

### General
- Keep functions focused and relatively small
- Write meaningful commit messages (follow the 50/72 format)
- Ensure code is properly formatted (use Prettier if configured)

## Branching Strategy

We follow a Git Flow-inspired branching model:

- `main` - Production-ready code, only updated via pull requests
- `develop` - Main development branch where features are integrated
- `feature/*` - Feature branches (e.g., `feature/user-authentication`)
- `bugfix/*` - Bug fix branches (e.g., `bugfix/login-error`)
- `hotfix/*` - Urgent fixes for production issues

### Branch Naming Conventions

- Use descriptive names for branches
- Use lowercase letters and hyphens (kebab-case)
- Prefix with type: `feature/`, `bugfix/`, `hotfix/`, `release/`
- Examples:
  - `feature/user-authentication`
  - `bugfix/login-error-handling`
  - `hotfix/security-patch-123`

## Issue Management

We use GitHub Issues for tracking bugs, enhancements, and feature requests:

### Creating Issues
- Use appropriate labels (bug, enhancement, feature, etc.)
- Assign milestone if applicable
- Assign to a specific person if known
- Provide detailed information and reproduction steps for bugs

### Issue Labels
- `bug` - A problem with existing functionality
- `enhancement` - Improvement to existing functionality
- `feature` - New functionality
- `documentation` - Documentation improvements
- `good first issue` - Suitable for newcomers
- `help wanted` - Need assistance with this issue
- `wontfix` - Won't be addressed
- `duplicate` - Issue already exists
- `invalid` - Not reproducible or not a valid issue

## Pull Request Process

1. Ensure your branch is up-to-date with the target branch
2. Follow the pull request template (if available)
3. Include a clear description of what your PR does
4. Reference related issues (e.g., "Closes #123")
5. Ensure all tests pass
6. Request review from maintainers
7. Address feedback from code reviews
8. Wait for approval before merging

### Pull Request Requirements

- Code must follow established standards
- Changes should be well-explained

## Development Setup

### Prerequisites

- Node.js (version specified in package.json)
- npm or yarn package manager
- Git
- MongoDB (for database)
- Redis

### Setup Steps

1. Clone your fork of the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/rcj-rescue-scoring.git
   cd rcj-rescue-scoring
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your specific configuration
   ```

4. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

### Database Setup

1. Ensure MongoDB is running on your system
2. Update the database connection string in your environment file if needed
3. Run any necessary migrations or seed commands

## Community

- Join our discussions in GitHub Issues
- For general questions, use GitHub Discussions (if enabled)
- Follow the project on GitHub to stay updated
- Contribute to discussions and help others

## Repository Access and Branching

For contributors who have been granted repository access:
- You can create branches directly in the main repository instead of forking
- Use the same branching conventions: `feature/*`, `bugfix/*`, `hotfix/*`
- When you've made consistent, quality contributions, you may be invited to join our closed Slack workspace for more direct communication and collaboration

## Questions?

If you have questions about contributing, feel free to open an issue with the `question` label or contact the maintainers.

---

Thank you for contributing to RCJ Rescue CMS!