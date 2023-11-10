import { AWSError } from "aws-sdk";

export function isAwsError(err: unknown): err is AWSError {
  return err instanceof Error && 'code' in err;
}