import { SalesforceClient, SalesforceAuthConfig } from './index';
import nock from 'nock'


const authConfig: SalesforceAuthConfig = {
    consumerKey: "consumer key",
    consumerSecret: "sweet sweet secret",
    username: "jsmith",
    password: "K33p0nTruck1n",
    accessToken: "Sw33tSw33tT0k3n",
    version: "1.0",
    loginHost: "https://login.salesforce.com",
    clientUserAgent: "test-user-agent"
}

const accessToken = "access_token=="
const sfInstanceUrl = "https://test.salesforce.com"

const authScope = () => nock("https://login.salesforce.com")
    .defaultReplyHeaders({
        'Content-Type': 'application/x-www-form-urlencoded',
    })
    .post("/services/oauth2/token", "grant_type=password&client_id=consumer%20key&client_secret=sweet%20sweet%20secret&username=jsmith&password=K33p0nTruck1nSw33tSw33tT0k3n")
    .reply(200, {
        access_token: accessToken,
        instance_url: sfInstanceUrl
    })


const scope = nock(sfInstanceUrl, {
    reqheaders: {
        authorization: `Bearer ${accessToken}`,
    },
})
    .defaultReplyHeaders({
        'Content-Type': 'application/json',
    })
    .replyContentLength()
    .get('/services/data/1.0/sobjects/leads/1')
    .reply(200, {
        id: "1"
    })
    .get(_ => true).reply(404)


describe("SaleforceClient", () => {

    beforeEach(authScope)

    describe("login", () => {
        it("Should return an valid logged in client using correct password", async () => {
            const uatP = SalesforceClient.login(authConfig)
            expect(await uatP).toBeTruthy()
        })
        it("Should return an error when using an incorrect password", async () => {
            const badUat = SalesforceClient.login(Object.assign({}, authConfig, { password: "123" }))
            await expect(badUat.catch(e => "Error")).resolves.toEqual("Error")
        })
    })
    describe("get", () => {
        it("Should return valid sf object if exists", async () => {
            const uatP = SalesforceClient.login(authConfig)
            const uat = await uatP
            const lead = await uat.get("leads", "1")
            expect(lead).toEqual({ id: "1" })
        })
        it("Should return null if not exists", async () => {
            const uatP = SalesforceClient.login(authConfig)
            const uat = await uatP
            const lead = await uat.get("leads", "2")
            expect(lead).toBeFalsy()
        })
    })
})