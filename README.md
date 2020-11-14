# Download Artifact

`download-artifact` is a GitHub Action that downloads an artifact that was uploaded by `actions/upload-artifact`. `actions/download-artifact@v2` can only be used to download artifacts that were uploaded in same workflow run. This `download-artifact` can download any artifact, identified by a repo, workflow name, and run number.

## Usage

| Parameter      | Description                                                  | Required | Default                  |
| -------------- | ------------------------------------------------------------ | -------- | ------------------------ |
| `github_token` | The authentication token used to access the artifact (via the GitHub REST API). | No       | `${{github.token}}`      |
| `repo`         | The repository the artifact belongs to.                      | No       | `${{github.repository}}` |
| `workflow`     | The name of the workflow that generated the artifact. This is the name specified by the `name` property in the workflow’s YAML file. | Yes      |                          |
| `run`          | The run number that generated the artifact. The run number is displayed in the **Actions** page of the repo on GitHub (`https://github.com/:owner/:repo/actions`). | Yes      |                          |
| `name`         | The name of artifact to download                             | Yes      |                          |
| `path`         | The path where the artifact is unzipped to.                  | No       | `./`                     |

Example:

```yaml
on:
  workflow_dispatch:
    inputs:
      run:
        description: 'The run number of the build to deploy'
        required: true

jobs:
  deploy:
    name: Deploy
    runs-on: macOS-latest
    steps:
    - name: Download .ipa and .xcarchive
      uses: toddreed/download-artifact@v1
      with:
        workflow: Build
        run: ${{ github.event.inputs.run }}
        names: ipa, xcarchive
    - name: Display structure of downloaded files
      run: ls -R
```

## Developer Setup

1. Install [Node.js](https://nodejs.org/en/download/).

2. Install [Yarn](https://yarnpkg.com):

   ```sh
   npm install -g yarn
   ```

3. Install `ncc`:

   ```sh
   npm install -g @vercel/ncc
   ```

4. Install dependencies:

   ```sh
   yarn install
   ```

## Release

1. Generate `dist/index.js`:

   ```sh
   ./node_modules/.bin/tsc # compile TypeScript
   ncc build src/download-artifact.ts # generate ./dist/index.js
   ```

2. Commit and tag the release:

   ```sh
   git add dist/index.js
   git commit
   git tag -m "Version 42" v42
   ```

3. Publish:

   ```sh
   git push --follow-tags
   ```

   