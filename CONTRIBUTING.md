# Contributing to Nandha LeetCode Intelligence (NLCI)

Thank you for your interest in contributing to the Nandha LeetCode Intelligence platform!

## Development Workflow

1. **Fork & Clone**: Fork the repository and clone your branch locally.
2. **Environment Setup**: Follow the [Quick Start Guide](README.md#quick-start--local-development) to configure Python, virtual environment, and Node dependencies.
3. **Branching**: Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Coding Standards**:
   - Python code follows PEP 8 standards with strict type hinting.
   - Frontend components use React 18 with TypeScript and Tailwind CSS.
   - Do not bypass authentication, encryption, or database immutability triggers.
5. **Testing**: Run test suites before submitting PRs:
   ```bash
   python -m pytest backend/tests/ -v
   npm --prefix frontend run build
   ```
6. **Submitting a Pull Request**: Submit your pull request to the `main` branch with a clear description of the problem solved and test verification logs.

---
*Maintained by Nanthish S ([@nanthishvaran17](https://github.com/nanthishvaran17)) & Nandha Engineering College.*
