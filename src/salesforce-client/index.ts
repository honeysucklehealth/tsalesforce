import { RestClient, IRequestOptions, IRestResponse } from 'typed-rest-client/RestClient'

export interface SalesforceAuthConfig {
    loginHost: string,
    version: string,
    consumerKey: string,
    consumerSecret: string,
    username: string,
    password: string,
    accessToken: string,
    clientUserAgent: string
}

interface SalesforceClientConfig {
    host: string,
    accessToken: string,
    version: string
}

interface SalesforceAuthResponse {
    access_token: string,
    instance_url: string
}

type HttpMethod = "GET" | "PUT" | "POST" | "PATCH" | "DELETE"
type RequestParams<M extends HttpMethod> = M extends "GET" | "DELETE" ? never : any

declare module 'typed-rest-client/RestClient' {
    interface RestClient {
        request<M extends HttpMethod, T = any>(url: string, method: M, options?: IRequestOptions, params?: RequestParams<M>): Promise<T>
    }
}
RestClient.prototype.request = function <M extends HttpMethod>(url: string, method: M, options?: IRequestOptions, params?: RequestParams<M>): Promise<any> {
    console.log(`Calling salesforce. Url: ${url}, method: ${method}, options: ${JSON.stringify(options)}, params: ${JSON.stringify(params)}`)
    var res: Promise<IRestResponse<any>>
    switch (method) {
        case "GET":
            res = this.get(url, options);
            break;
        case "DELETE":
            res = this.del(url, options);
            break;
        case "PATCH":
            res = this.update(url, params, options)
            break;
        case "PUT":
            res = this.replace(url, params, options)
            break;
        case "POST":
            res = this.create(url, params, options)
            break;
        default:
            throw new Error("Unknown HTTP Method: " + method)
    }
    return res.then(r => {
        if (200 <= r.statusCode && r.statusCode < 300 || r.statusCode == 404) {
            console.info(`Recieved response from salesforce ${JSON.stringify(r)}`)
            return Promise.resolve(r.result)
        } else {
            console.error(`Recieved error response from salesforce ${JSON.stringify(r)}`)
            return Promise.reject(`Error from Salesforce: ${JSON.stringify(r)}`)
        }
    })
}

const DEFAULT_HEADERS = { "Content-Type": "application/json" }
const withDefaultHeaders = (obj: Record<string, string>) => Object.assign({}, DEFAULT_HEADERS, obj)
type HasAttributes = object & { attributes: any }

export class SalesforceClient {
    defaultHeaders: { "Content-Type": string } & Record<string, string>

    public static login(authConfig: SalesforceAuthConfig, restClientFactory: (userAgent: string) => RestClient = (ua) => new RestClient(ua)): Promise<SalesforceClient> {
        const rc = restClientFactory(authConfig.clientUserAgent)
        const authData = {
            "grant_type": "password",
            "client_id": authConfig.consumerKey,
            "client_secret": authConfig.consumerSecret,
            "username": authConfig.username,
            "password": authConfig.password + authConfig.accessToken
        }
        const authDataEncoded = Object.keys(authData).map(k => `${encodeURI(k)}=${encodeURI((authData as any)[k])}`).join("&")
        return rc
            .client
            .post(`${authConfig.loginHost}/services/oauth2/token`, authDataEncoded, { 'Content-Type': 'application/x-www-form-urlencoded' })
            .then(r => {
                if (200 <= r.message.statusCode! && r.message.statusCode! < 300) {
                    return r.readBody().then(b => {
                        const body = JSON.parse(b) as SalesforceAuthResponse
                        return Promise.resolve(new SalesforceClient({
                            version: authConfig.version,
                            host: body.instance_url,
                            accessToken: body.access_token
                        }, rc))
                    })
                } else {
                    return Promise.reject(`Error logging in from Salesforce: ${JSON.stringify(r)}`)
                }
            })
            .catch(e => {
                return Promise.reject(`Error logging in from Salesforce: ${JSON.stringify(e)}`)
            })
    }

    constructor(private cfg: SalesforceClientConfig, private rc: RestClient) {
        this.defaultHeaders = withDefaultHeaders({ Authorization: `Bearer ${this.cfg.accessToken}` })
    }

    get(sObject: string, sObjectId: string): Promise<any> {
        const url = `${this.cfg.host}/services/data/${this.cfg.version}/sobjects/${sObject}/${sObjectId}`
        return this
            .rc
            .request(url, "GET", { additionalHeaders: this.defaultHeaders })
    }
    private _search(query: string, path: string): Promise<any[]> {
        type SearchResponse = { searchRecords: HasAttributes[] }
        const url = `${this.cfg.host}/services/data/${this.cfg.version}/${path}`
        return this
            .rc
            .request<"GET", SearchResponse>(url, "GET", { additionalHeaders: this.defaultHeaders, queryParameters: { params: { q: query } } })
            .then(r => r.searchRecords.map(rec => {
                const { attributes, ...rest } = rec
                return rest
            }))
    }
    search(query: string): Promise<any[]> {
        return this._search(query, "search")
    }

    parameterizedSearch(query: string): Promise<any[]> {
        return this._search(query, "parameterizedSearch")
    }
    query(query: string): Promise<any[]> {
        type QueryResponse = { records: HasAttributes[] }
        const url = `${this.cfg.host}/services/data/${this.cfg.version}/query`
        return this
            .rc
            .request<"GET", QueryResponse>(url, "GET", { additionalHeaders: this.defaultHeaders, queryParameters: { params: { q: query } } })
            .then(r => r.records.map(rec => {
                const { attributes, ...rest } = rec
                return rest
            }))
    }
    update(sObject: string, sObjectId: string, update: any): Promise<any> {
        const url = `${this.cfg.host}/services/data/${this.cfg.version}/sobjects/${sObject}/${sObjectId}`
        return this
            .rc
            .request(url, "PATCH", { additionalHeaders: this.defaultHeaders }, update)
    }
    updateByExternal(sObject: string, field: string, sObjectId: string, update: any): Promise<any> {
        const url = `${this.cfg.host}/services/data/${this.cfg.version}/sobjects/${sObject}/${field}/${sObjectId}`
        return this
            .rc
            .request(url, "PATCH", { additionalHeaders: this.defaultHeaders }, update)
    }
    create(sObject: string, object: any): Promise<string> {
        type HasId = { id: string }
        const url = `${this.cfg.host}/services/data/${this.cfg.version}/sobjects/${sObject}`
        return this
            .rc
            .request<"POST", HasId>(url, "POST", { additionalHeaders: this.defaultHeaders }, object)
            .then(r => r.id)

    }
    delete(sObject: string, sObjectId: string): Promise<any> {
        const url = `${this.cfg.host}/services/data/${this.cfg.version}/sobjects/${sObject}/${sObjectId}`
        return this
            .rc
            .request(url, "DELETE", { additionalHeaders: this.defaultHeaders })
    }
}