export class DNSProviderError extends Error {
    constructor(message: string, public transient: boolean) {
        super(message);
        this.name = 'DNSProviderError';
    }
}

export class SubdomainAlreadyExistsError extends DNSProviderError {
    constructor(public subdomain: string, public type: string) {
        super(`Subdomain ${subdomain} already exists with type ${type}`, false);
        this.name = 'SubdomainAlreadyExistsError';
    }
}

export class SubdomainInvalidNameError extends DNSProviderError {
    constructor(public unsupportedCharacters: string[],) {
        super(`Found unsupported character '${unsupportedCharacters.join(', ')}'`, false);
        this.name = 'SubdomainInvalidNameError';
    }
}

export class InvalidInputError extends DNSProviderError {
    constructor(message: string) {
        super(message, false);
        this.name = 'InvalidInputError';
    }
}

export class DomainNotFoundError extends DNSProviderError {
    constructor(message: string) {
        super(message, false);
        this.name = 'DomainNotFoundError';
    }
}

export class PriorRequestNotCompleteError extends DNSProviderError {
    constructor(message: string) {
        super(message, true);
        this.name = 'PriorRequestNotCompleteError';
    }
}

export class ThrottlingError extends DNSProviderError {
    constructor(message: string) {
        super(message, true);
        this.name = 'ThrottlingError';
    }
}

export class TooManyRequestsExceptionError extends DNSProviderError {
    constructor(message: string) {
        super(message, true);
        this.name = 'TooManyRequestsExceptionError';
    }
}

export class InternalFailureError extends DNSProviderError {
    constructor(message: string) {
        super(message, true);
        this.name = 'InternalFailureError';
    }
}