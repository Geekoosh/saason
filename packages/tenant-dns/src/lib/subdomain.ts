import isValidDomain from 'is-valid-domain';

const MAX_SUBDOMAIN_LENGTH = 63;

export function subdomainFqdn(name: string, domain: string): string {
    return `${name}.${domain}`;
}

export function suggestValidSubdomain(name: string, domain: string, maxLen: number = MAX_SUBDOMAIN_LENGTH): string | undefined {    
    // try removing invalid characters and replacing | and _ with hyphens 
    // remove hyphens from the beginning and end of the subdomain
    // truncate the subdomain to maxLen characters
    let suggestSubdomain = name.slice(0, maxLen).replace(/(^-|-$)/g, '').replace(/[|_]/g, '-').replace(/[^a-zA-Z0-9\-_]/g, '');

    // try to find a valid subdomain
    while (suggestSubdomain.length > 0 && !isValidDomain(subdomainFqdn(suggestSubdomain, domain), {subdomain: true})) {
        suggestSubdomain = suggestSubdomain.slice(0, suggestSubdomain.length - 1);
    }

  return isValidDomain(subdomainFqdn(suggestSubdomain, domain), {subdomain: true}) ? suggestSubdomain : undefined;
}