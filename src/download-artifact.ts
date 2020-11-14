import * as core from '@actions/core'
import * as github from '@actions/github'
import * as os from 'os'
import * as fs from 'fs'
import {resolve, join} from 'path'
import AdmZip from 'adm-zip';

enum Inputs {
    Token = 'token',
    Repo = 'repo',
    Names = 'names',
    WorkflowName = 'workflow',
    RunNumber = 'run',
    Path = 'path'
}

enum Outputs {
    DownloadPath = 'download-path'
}

type GitHubClient = ReturnType<typeof github.getOctokit>

async function get_workflow_id(client: GitHubClient, owner: string, repo: string, workflow_name: string): Promise<number | null>
{
    const response = await client.actions.listRepoWorkflows({owner: owner, repo: repo})
    let workflows = response.data.workflows.filter(workflow => workflow.name == workflow_name)
    switch (workflows.length)
    {
        case 0:
            return null
        case 1:
            return workflows[0].id
        default:
            throw new Error(`More than one workflow found matching the name ${workflow_name}`)
    }
}

async function get_run_id(client: GitHubClient, owner: string, repo: string, workflow_id: number, run_number: number): Promise<number | null> {
    let response = await client.actions.listWorkflowRuns({owner: owner, repo: repo, workflow_id: workflow_id})
    let runs = response.data.workflow_runs.filter(run => run.run_number == run_number)
    switch (runs.length) {
        case 0:
            return null
        case 1:
            return runs[0].id
        default:
            throw new Error(`More than one run found matching the run number ${run_number}`)
    }
}

function unzip(buffer: Buffer, dir: string) {
    fs.mkdirSync(dir, {recursive: true})
    let archive = new AdmZip(buffer);
    archive.getEntries().forEach((entry) => {
        const action = entry.isDirectory ? "creating" : "inflating"
        const filepath = join(dir, entry.entryName)

        console.log(`  ${action}: ${filepath}`)
    })
    archive.extractAllTo(dir, true)
}

async function download_run_artifacts(client: GitHubClient, owner: string, repo: string, run_id: number, artifact_names: string[], output_path: string)
{
    let response = await client.actions.listWorkflowRunArtifacts({
        owner: owner,
        repo: repo,
        run_id: run_id,
    })

    let artifacts = response.data.artifacts.filter(artifact => artifact_names.indexOf(artifact.name) != -1)

    if (artifacts.length == 0)
        throw new Error("no artifacts found")

    for (const artifact of artifacts) {
        const zip = await client.actions.downloadArtifact({
            owner: owner,
            repo: repo,
            artifact_id: artifact.id,
            archive_format: "zip",
        })
        unzip(Buffer.from(zip.data), join(output_path, artifact.name))
    }
}

async function download(owner: string, repo: string, token: string, workflow_name: string, run_number: number, artifact_names: string[], output_path: string)
{
    let client = github.getOctokit(token)

    let workflow_id = await get_workflow_id(client, owner, repo, workflow_name)
    if (workflow_id !== null) {
        let run_id = await get_run_id(client, owner, repo, workflow_id, run_number)
        if (run_id !== null) {
            await download_run_artifacts(client, owner, repo, run_id, artifact_names, output_path)
        }
    }
}

async function run()
{
    try
    {
        const token = core.getInput(Inputs.Token, {required: true})
        const repository = core.getInput(Inputs.Repo, {required: true})
        const workflow_name = core.getInput(Inputs.WorkflowName, {required: true})
        const run_number = core.getInput(Inputs.RunNumber, {required: true})
        const names = core.getInput(Inputs.Names, {required: true})
        const path = core.getInput(Inputs.Path, {required: true})

        let resolvedPath
        // resolve tilde expansions, path.replace only replaces the first occurrence of a pattern
        if (path.startsWith(`~`))
            resolvedPath = resolve(path.replace('~', os.homedir()))
        else
            resolvedPath = resolve(path)

        core.debug(`Resolved path is ${resolvedPath}`)

        const [owner, repo] = repository.split('/')
        const artifact_names = names.split(',').map(name => name.trim())
        await download(owner, repo, token, workflow_name, parseInt(run_number), artifact_names, resolvedPath)

        // if no path is provided, an empty string resolves to the current working directory
        core.setOutput(Outputs.DownloadPath, resolvedPath)
        core.info('Artifact download has finished successfully')
    }
    catch (error)
    {
        core.setFailed(error.message)
    }
}

run()
