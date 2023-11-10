export * from './lib/route53-provider';
export * from './lib/errors';
export * from './lib/route53-waiter';

import {Route53Provider} from './lib/route53-provider';

async function create() {
    const provider = new Route53Provider({hostedZoneId: "Z063138213TW0F6UO4XJK", rootDomain: "runbop.com"});
    await provider.createCNAMESubdomain("test1a §", "example.com", "test", {TTL: 300}).change();
}

create();