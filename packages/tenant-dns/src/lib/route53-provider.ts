import {
    ChangeBatch,
    ChangeResourceRecordSetsCommandInput,
    ResourceRecordSet,
    Route53,
} from '@aws-sdk/client-route-53';

import deepmerge from 'deepmerge';
import { subdomainFqdn, suggestValidSubdomain } from './subdomain';
import { Route53PropagationWaiter } from './route53-waiter';

export interface Route53ProviderOptions {
    hostedZoneId: string;
    rootDomain: string;
    meaningfulSubdomainPostfixes?: string[];
}

export const LB_HOSTED_ZONE_ID = 'Z2L77D8WE715BK';
export const CLOUDFRONT_HOSTED_ZONE_ID = 'Z2FDTNDATAQYW2';

export class Route53Provider {
    private readonly route53: Route53;
    hostedZoneId: string;
    rootDomain: string;
    meaningfulSubdomainPostfixes: string[];

    constructor(
        {
            hostedZoneId,
            rootDomain,
            meaningfulSubdomainPostfixes,
        }: Route53ProviderOptions,
        route53?: Route53,
    ) {
        this.route53 = route53 ?? new Route53();
        this.hostedZoneId = hostedZoneId;
        this.rootDomain = rootDomain;
        this.meaningfulSubdomainPostfixes = meaningfulSubdomainPostfixes || [
            'app',
            'company',
            'org',
            'net',
            'co',
        ];
    }

    public async getSubdomainRecords(
        subdomain: string,
        type?: 'A' | 'CNAME',
    ): Promise<ResourceRecordSet[] | undefined> {
        const fqn = subdomainFqdn(subdomain, this.rootDomain);
        const res = await this.route53.listResourceRecordSets({
            HostedZoneId: this.hostedZoneId,
            StartRecordName: fqn,
            MaxItems: 1,
        });
        const { ResourceRecordSets } = res;
        if (!ResourceRecordSets) {
            return undefined;
        }

        return type
            ? ResourceRecordSets.filter((r) => r.Type === type)
            : ResourceRecordSets;
    }

    public async isSubdomainAvailable(subdomain: string): Promise<boolean> {
        const fqn = subdomainFqdn(subdomain, this.rootDomain);
        const ResourceRecordSets = await this.getSubdomainRecords(subdomain);
        if (!ResourceRecordSets) {
            return true;
        }
        if (ResourceRecordSets.length > 0) {
            const { Name } = ResourceRecordSets[0];
            if (!Name) {
                return true;
            }
            return Name.replace(/\.$/, '') === fqn;
        }

        return true;
    }

    private createSubdomainForAliasTarget(
        subdomain: string,
        target: string,
        hostedzoneId: string,
        account: string,
        options: Partial<ResourceRecordSet> = {},
    ): Route53PropagationWaiter {
        const resourceRecordSet: ResourceRecordSet = deepmerge(
            {
                Name: subdomainFqdn(subdomain, this.rootDomain),
                Type: 'A',
                AliasTarget: {
                    DNSName: target,
                    EvaluateTargetHealth: false,
                    HostedZoneId: hostedzoneId,
                },
            },
            options,
        );

        const changeBatch: ChangeBatch = {
            Changes: [
                {
                    Action: 'CREATE',
                    ResourceRecordSet: resourceRecordSet,
                },
            ],
            Comment: account,
        };

        const createParams: ChangeResourceRecordSetsCommandInput = {
            ChangeBatch: changeBatch,
            HostedZoneId: this.hostedZoneId,
        };
        return new Route53PropagationWaiter(
            this.route53.changeResourceRecordSets(createParams),
        );
    }

    async createLBSubdomain(
        subdomain: string,
        albDnsName: string,
        account: string,
        options: Partial<ResourceRecordSet> = {},
    ) {
        return this.createSubdomainForAliasTarget(
            subdomain,
            albDnsName,
            LB_HOSTED_ZONE_ID,
            account,
            options,
        );
    }

    createCNAMESubdomain(
        subdomain: string,
        target: string,
        account: string,
        options: Partial<ResourceRecordSet> = {},
    ): Route53PropagationWaiter {
        const resourceRecordSet: ResourceRecordSet = deepmerge(
            {
                Name: subdomainFqdn(subdomain, this.rootDomain),
                Type: 'CNAME',
                ResourceRecords: [
                    {
                        Value: target,
                    },
                ],
            },
            options,
        );

        const changeBatch: ChangeBatch = {
            Changes: [
                {
                    Action: 'CREATE',
                    ResourceRecordSet: resourceRecordSet,
                },
            ],
            Comment: account,
        };

        const createParams: ChangeResourceRecordSetsCommandInput = {
            ChangeBatch: changeBatch,
            HostedZoneId: this.hostedZoneId,
        };

        return new Route53PropagationWaiter(
            this.route53.changeResourceRecordSets(createParams),
        );
    }

    // Create A record for subdomain pointing to CloudFront distribution
    public createCDNSubdomain(
        subdomain: string,
        cloudfrontDistribution: string,
        account: string,
        options: Partial<ResourceRecordSet> = {},
    ): Route53PropagationWaiter {
        return this.createSubdomainForAliasTarget(
            subdomain,
            cloudfrontDistribution,
            CLOUDFRONT_HOSTED_ZONE_ID,
            account,
            options,
        );
    }

    public deleteSubdomain(
        records: ResourceRecordSet[]
    ): Route53PropagationWaiter {
        if (records.length === 0) {
            throw new Error('No records to delete for');
        }

        const changeBatch: ChangeBatch = {
            Changes: records.map((r) => ({
                Action: 'DELETE',
                ResourceRecordSet: r,
            })),
        };

        const createParams: ChangeResourceRecordSetsCommandInput = {
            ChangeBatch: changeBatch,
            HostedZoneId: this.hostedZoneId,
        };
        return new Route53PropagationWaiter(
            this.route53.changeResourceRecordSets(createParams),
        );
    }

    public async suggestSubdomain(name: string): Promise<string | undefined> {
        let subdomain = suggestValidSubdomain(name, this.rootDomain);
        if (!subdomain) {
            return undefined;
        }

        if (await this.isSubdomainAvailable(subdomain)) {
            return subdomain;
        }

        subdomain = await this.suggestSubdomainWithMeaningfulSuffix(name);
        if (subdomain) {
            return subdomain;
        }

        return await this.suggestSubdomainWithRandomNumberSuffix(name);
    }

    private async suggestSubdomainWithRandomNumberSuffix(
        name: string,
    ): Promise<string | undefined> {
        const maxAttempts = 10;
        for (let i = 1; i <= maxAttempts; i++) {
            const subdomain = `${name.toLowerCase()}-${Math.floor(
                Math.random() * 10000,
            )}`;
            if (await this.isSubdomainAvailable(subdomain)) {
                return subdomain;
            }
        }
        return undefined;
    }

    private async suggestSubdomainWithMeaningfulSuffix(
        name: string,
    ): Promise<string | undefined> {
        for (const word of this.meaningfulSubdomainPostfixes) {
            const subdomain = `${name.toLowerCase()}-${word}`;
            if (await this.isSubdomainAvailable(subdomain)) {
                return subdomain;
            }
        }
        return undefined;
    }
}
