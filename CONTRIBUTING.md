# Contributing

Thanks for your interest in contributing to RepoStars. We're happy to have you here.

Please take a moment to review this document before submitting your first pull request. We also strongly recommend that you check for open issues and pull requests to see if someone else is working on something similar.

If you need any help, feel free to reach out to [@orcdev](https://x.com/theorcdev), or to OrcDev <a href="https://discord.com/invite/uFB5YzH9YG">Discord Channel</a>.

## About this repository

- We use [pnpm](https://pnpm.io) for development.

## Structure

| Path              | Description                              |
| ----------------- | ---------------------------------------- |
| `/app`            | The Next.js application.                 |
| `/components`     | The React components.                    |
| `/hooks`          | Custom React hooks.                      |
| `/lib`            | Utility functions, themes, and API logic.|

## Development

### Fork this repo

You can fork this repo by clicking the fork button in the top right corner of this page.

### Clone on your local machine

```bash
git clone https://github.com/your-username/repostars.git
```

### Navigate to project directory

```bash
cd repostars
```

### Create a new Branch

```bash
git checkout -b my-new-branch
```

### Install dependencies

```bash
pnpm i
```

### Run the development server

```bash
pnpm dev
```

### Environment variables

Optionally set `GITHUB_TOKEN` in `.env.local` for higher GitHub API rate limits (5,000/hr vs 60/hr). No scopes needed — just a personal access token with public repo read access.

## Adding a New Theme

Themes are defined in `lib/themes.ts`. Each theme has:

- `id` — unique key
- `name` — display name
- `background`, `gridColor`, `textColor`, `axisColor` — chart styling
- `lineColors` — array of 5 colors for repo lines
- `tooltipBg`, `tooltipBorder`, `tooltipText` — tooltip styling
- `areaOpacity` — gradient fill opacity
- `fontFamily` — optional custom font

When adding a theme, make sure it's visually distinct from existing themes.

## Commit Convention

Before you create a Pull Request, please check whether your commits comply with
the commit conventions used in this repository.

When you create a commit we kindly ask you to follow the convention
`category(scope or module): message` in your commit message while using one of
the following categories:

- `feat / feature`: all changes that introduce completely new code or new
  features
- `fix`: changes that fix a bug (ideally you will additionally reference an
  issue if present)
- `refactor`: any code related change that is not a fix nor a feature
- `docs`: changing existing or creating new documentation (i.e. README, docs for
  usage of a lib or cli usage)
- `build`: all changes regarding the build of the software, changes to
  dependencies or the addition of new dependencies
- `test`: all changes regarding tests (adding new tests or changing existing
  ones)
- `ci`: all changes regarding the configuration of continuous integration (i.e.
  github actions, ci system)
- `chore`: all changes to the repository that do not fit into any of the above
  categories

  e.g. `feat(themes): add new Lava theme`

If you are interested in the detailed specification you can visit
https://www.conventionalcommits.org/ or check out the
[Angular Commit Message Guidelines](https://github.com/angular/angular/blob/22b96b9/CONTRIBUTING.md#-commit-message-guidelines).

## Requests for new themes or features

If you have a request for a new theme or feature, please open an issue on GitHub. We'll be happy to help you out.
