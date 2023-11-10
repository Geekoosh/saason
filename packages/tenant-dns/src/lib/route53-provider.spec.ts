import { Route53Provider } from './route53-provider';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { Route53, HostedZone } from '@aws-sdk/client-route-53';

describe('Route53Provider', () => {
    let localstackContainer: StartedTestContainer;
    let route53HostedZone: HostedZone;
    let route53Client: Route53;

    async function createHostedZone(): Promise<HostedZone | undefined> {
        const result = await route53Client.createHostedZone({
            CallerReference: `${Date.now()}`,
            Name: 'test.com',
            HostedZoneConfig: {
                Comment: 'Public hosted zone for test.com',
            },
        });
        return result.HostedZone;
    }

    beforeAll(async () => {
        localstackContainer = await new GenericContainer(
            'localstack/localstack',
        )
            .withExposedPorts(4566)
            .start();

        // Configure AWS SDK to use LocalStack endpoint
        const endpoint = `http://${localstackContainer.getHost()}:${localstackContainer.getMappedPort(
            4566,
        )}`;
        route53Client = new Route53({
            endpoint,
            region: 'us-east-1',
            credentials: {
                accessKeyId: 'test',
                secretAccessKey: 'test',
            },
        });
        const zone = await createHostedZone();
        if (!zone) {
            throw new Error('Could not create hosted zone');
        }

        route53HostedZone = zone;
    }, 30 * 1000);

    afterAll(async () => {
        await localstackContainer.stop();
    });

    test(
        'should create a subdomain pointing to cloudfront distribution',
        async () => {
            const route53 = new Route53Provider(
                {
                    hostedZoneId: route53HostedZone.Id!,
                    rootDomain: route53HostedZone.Name!,
                },
                route53Client,
            );
            const subdomain = 'my-company';
            const account = 'my-company';
            const cloudfrontDistributionId = 'E1234567890ABCD';
            expect(await route53.isSubdomainAvailable(subdomain)).toBe(true);
            let ssubdomain = await route53.suggestSubdomain(subdomain);
            expect(ssubdomain).toBe(subdomain);
            await route53
                .createCDNSubdomain(
                    subdomain,
                    cloudfrontDistributionId,
                    account,
                )
                .waitForPropagation({ route53: route53Client });
            expect(await route53.isSubdomainAvailable(subdomain)).toBe(false);

            ssubdomain = await route53.suggestSubdomain(subdomain);
            expect(ssubdomain).toBe(`${subdomain}-app`);

            const records = await route53.getSubdomainRecords(subdomain, 'A');
            expect(records?.length).toBe(1);

            await route53
                .deleteSubdomain(records!)
                .waitForPropagation({ route53: route53Client });
            expect(await route53.isSubdomainAvailable(subdomain)).toBe(true);
            ssubdomain = await route53.suggestSubdomain(subdomain);
            expect(ssubdomain).toBe(subdomain);
        },
        30 * 1000,
    );
});
