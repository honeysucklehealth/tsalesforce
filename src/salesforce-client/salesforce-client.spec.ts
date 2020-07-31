import { SalesforceAuthConfig } from './../../dist/index.d';
import { SalesforceClient } from './index';
import nock from 'nock'


const authConfig: SalesforceAuthConfig = {
    consumerKey: "consuemr key",
    consumerSecret: "sweet sweet secret",
    username: "jsmith",
    password: "K33p0nTruck1n",
    version: "1.0",
    loginHost: "https://login.salesforce.com",
    clientUserAgent: "test-user-agent"
}

const accessToken = "access_token=="
const sfInstanceUrl = "https://test.salesforce.com"

const authScope = () => nock("https://login.salesforce.com")
    .defaultReplyHeaders({
        'Content-Type': 'application/json',
    })
    .post("/services/oauth2/token", {
        'grant_type': 'password',
        'client_id': authConfig.consumerKey,
        'client_secret': authConfig.consumerSecret,
        'username': authConfig.username,
        'password': authConfig.password
    })
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
        it("Should return an valid logged in client using incorrect password", async () => {
            const badUat = SalesforceClient.login(Object.assign({}, authConfig, { password: "123" }))
            await badUat.then(r => expect(r).toBeFalsy).catch((c: Error) => expect(c).toContain("Error logging in from Salesforce:"))
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