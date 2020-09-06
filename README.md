# Typescript Saleforce Client


## Usage

```typescript
const cfg: SalesforceAuthConfig = {
                version,
                loginHost,
                consumerKey,
                consumerSecret,
                username,
                password,
                accessToken,
                clientUserAgent: "my-sweet-salesforce-app"
            }
const salesforceClient: SalesforceClient = await SalesforceClient.login(cfg)
const myAccount = await salesforceClient.get("Account", "00e100121x")
```