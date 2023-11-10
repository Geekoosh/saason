# tenant-dns

Tenant DNS is an open-source TypeScript library that allows you to register a separate subdomain per tenant. Each tenant is considered a different account in a SaaS service. In addition to registering the subdomain in AWS Route53, it also checks whether the subdomain is available (i.e., no existing DNS entry with the same name) and suggests a close subdomain instead in case one exists.

## Installation

```sh
npm install @sasson/tenant-dns
```

## Usage

To use the tenant-dns library, you'll first need to import it:

```ts
import { Route53Provider, Route53ProviderOptions } from 'tenant-dns';
```

## Initialization

Once you've imported the library, you can create a new Route53Provider instance, passing in the `hostedZoneId` and `rootDomain` options:

```ts
const providerOptions: Route53ProviderOptions = {
    hostedZoneId: '<HOSTED_ZONE_ID>',
    rootDomain: '<ROOT_DOMAIN>',
    meaningfulSubdomainPostfixes: ['app', 'company', 'org', 'net', 'co']
};
const provider = new Route53Provider(providerOptions);
```

## Suggesting Available Subdomain Name

To get a suggested subdomain based on the tenant name, call the `suggestSubdomain` method. It validates the tenant's name offering a similar valid and available subdomain:

```ts
const subdomain = await route53.suggestSubdomain("my-company");
```

## Creating an A Record for a Subdomain Pointing to a CloudFront Distribution

To create an A record for a subdomain pointing to a CloudFront distribution, call the `createCDNSubdomain` method, passing in the subdomain, CloudFront distribution, account (tenant name), and any `ResourceRecordSet` override parameters:

```ts
const waiter = provider.createCDNSubdomain('<SUBDOMAIN>', '<CLOUDFRONT_DISTRIBUTION>', '<ACCOUNT>');
await waiter.waitForPropagation();
```

## Creating a CNAME Record for a Subdomain
To create a CNAME record for a subdomain, call the `createCNAMESubdomain` method, passing in the subdomain, target, account (tenant name), and any `ResourceRecordSet` override parameters:

```ts
const waiter = provider.createCNAME('<SUBDOMAIN>', '<TARGET>', '<ACCOUNT>', {});
await waiter.waitForPropagation();
```

## Deleting a Subdomain

To delete a subdomain, call the deleteSubdomain method, passing in the subdomain and the type of the record ('A' or 'CNAME'):

```ts
const waiter = provider.deleteSubdomain('<SUBDOMAIN>', 'A');
await waiter.waitForPropagation();
```

## Contributing

If you want to contribute to tenant-dns, please submit a pull request! We'd love to have your contributions.
