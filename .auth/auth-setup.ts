import { chromium, type BrowserContext, type FullConfig } from '@playwright/test'
import { promises as fs } from 'fs'

type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>

const filePath = '.auth/user.json'

async function browserAuthorize(config: FullConfig) {
    const { baseURL, storageState } = config.projects[0].use

    // Fail fast: a missing value otherwise only shows up as a timeout waiting for **/token
    const missingCredentials = ['EMAIL', 'PASSWORD'].filter((name) => !process.env[name])
    if (missingCredentials.length > 0) {
        throw new Error(
            `Missing required credentials: ${missingCredentials.join(', ')}. Set them in .env locally, or as repository secrets for GitHub Actions.`,
        )
    }

    let user: StorageState
    try {
        const data = await fs.readFile(filePath, 'utf-8')
        user = JSON.parse(data) as StorageState
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            console.log('User auth file does not exist, creating new file')
            user = { cookies: [], origins: [] }
            await fs.writeFile(filePath, JSON.stringify(user, null, 2))
        } else {
            console.error('Error processing user.json file:', err)
            throw err
        }
    }

    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext()
    await context.addCookies(user.cookies)
    const page = await context.newPage()

    console.log(`\x1b[2m\tSign in started to '${baseURL}'\x1b[0m`)

    await page.goto(baseURL!)
    if (await page.locator('.login').isVisible()) {
        await page.locator('#username').fill(process.env.EMAIL!)
        await page.locator('#password').fill(process.env.PASSWORD!)
        await page.getByRole('button', { name: 'Continue' }).click()
    }
    const tokenResponse = await page.waitForResponse('**/token')
    const responseJsonBody = (await tokenResponse.json()) as { access_token: string }
    process.env['ACCESS_TOKEN'] = responseJsonBody.access_token

    console.log(`\x1b[2m\tSign in processed\x1b[0m`)

    await page.context().storageState({ path: storageState as string })
    await browser.close()
}

export default browserAuthorize
