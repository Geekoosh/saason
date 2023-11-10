import {
  Route53,
  waitUntilResourceRecordSetsChanged,
  ChangeResourceRecordSetsCommandOutput,
} from '@aws-sdk/client-route-53';
import pTimeout, { TimeoutError } from 'p-timeout';
import pRetry, { AbortError, Options as RetryOptions } from 'p-retry';
import { isAwsError } from './aws-utils';
import {
  DomainNotFoundError,
  InternalFailureError,
  InvalidInputError,
  PriorRequestNotCompleteError,
  SubdomainAlreadyExistsError,
  SubdomainInvalidNameError,
  ThrottlingError,
  TooManyRequestsExceptionError,
} from './errors';

const RETRY_ERRORS = [
  'Throttling',
  'TooManyRequestsException',
  'InternalFailure',
];

export interface Route53PropagationWaiterOptions extends RetryOptions {
  route53?: Route53;
  delay?: number;
  timeout?: number;
}

export class Route53PropagationWaiter {
  constructor(
    private changeIdRequest: Promise<ChangeResourceRecordSetsCommandOutput>
  ) {}

  async change(): Promise<string> {
    try {
        const { ChangeInfo } = await this.changeIdRequest;
        if(!ChangeInfo) {
            throw new Error("ChangeInfo is undefined");
        }
        const { Id } = ChangeInfo;
        if (!Id) {
          throw new Error('ChangeInfo.Id is undefined');
        }
        return Id;
    } catch (e) {
      throw translateError(e);
    }
  }

  async waitForPropagation(
    waitConfig?: Route53PropagationWaiterOptions
  ): Promise<string> {
    const {
      delay = 5,
      timeout = 600 * 1000,
      route53 = new Route53(),
      ...retryOptions
    } = waitConfig || {};

    const changeId = await this.change();

    const waitForChangeParams = {
      Id: changeId,
      $waiter: { delay, maxAttempts: Infinity },
    };

    return await pTimeout(
      pRetry(async () => {
        try {
          const data = await waitUntilResourceRecordSetsChanged(
            {
              client: route53,
              maxWaitTime: 200,
            },
            waitForChangeParams
          );
          return data.state;
        } catch (err) {
          if (!isAwsError(err)) {
            throw new AbortError(err as Error);
          }
          // Retry on Throttling, TooManyRequestsException, and InternalFailure
          if (
            !RETRY_ERRORS.includes(err.code) &&
            !(err instanceof TimeoutError)
          ) {
            throw err;
          }
          // For any other error, retry with exponential backoff
          throw new AbortError(translateError(err) as Error);
        }
      }, retryOptions),
      timeout
    );
  }
}

function translateError(e: unknown): unknown {
  if (!isAwsError(e)) {
    return e;
  }
  const { code, message } = e;
  if (code === 'InvalidChangeBatch') {
    let err = throwIfAlreadyExists(message);
    if (err) {
      return err;
    }
    err = throwIfInvalidCharacters(message);
    if (err) {
      return err;
    }
  } else if (code === 'InvalidInput') {
    return new InvalidInputError(message);
  } else if (code === 'NoSuchHostedZone') {
    return new DomainNotFoundError(message);
  } else if (code === 'PriorRequestNotComplete') {
    return new PriorRequestNotCompleteError(message);
  } else if (code === 'Throttling') {
    return new ThrottlingError(message);
  } else if (code === 'TooManyRequestsException') {
    return new TooManyRequestsExceptionError(message);
  } else if (code === 'InternalFailure') {
    return new InternalFailureError(message);
  }

  return e;
}

function throwIfAlreadyExists(message: string): Error | undefined {
  const pattern =
    /Tried to create resource record set \[name='(.+)', type='(.+)'\] but it already exists/;
  const match = message.match(pattern);
  if (match) {
    return new SubdomainAlreadyExistsError(match[1], match[2]);
  }
  return undefined;
}

function throwIfInvalidCharacters(message: string): Error | undefined {
  const regex =
    /FATAL problem: UnsupportedCharacter \(Value contains unsupported characters\) encountered with '([^']+)'/g;

  let match;
  const characters = [];
  while ((match = regex.exec(message))) {
    characters.push(match[1]);
  }
  if (characters.length > 0) {
    return new SubdomainInvalidNameError(characters);
  }
  return undefined;
}
