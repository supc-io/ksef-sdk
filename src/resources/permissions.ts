import { BaseResource } from './base-resource.js';
import type {
  PermissionGrantParams,
  PermissionGrantResult,
  PermissionRevokeParams,
  PermissionRevokeResult,
  PermissionQueryParams,
  PermissionQueryResult,
} from '../types/permission.js';

export class PermissionsResource extends BaseResource {
  /**
   * Grants credentials/permissions to a subject.
   */
  async grant(params: PermissionGrantParams): Promise<PermissionGrantResult> {
    return this.requestJson<PermissionGrantResult>('POST', '/online/Credentials/ContextGrant', {
      body: {
        contextNip: params.contextNip,
        credentialsIdentifier: params.credentialsIdentifier,
        credentialsRoleList: params.credentialsRoleList,
      },
      requestOptions: params.requestOptions,
    });
  }

  /**
   * Revokes credentials/permissions from a subject.
   */
  async revoke(params: PermissionRevokeParams): Promise<PermissionRevokeResult> {
    return this.requestJson<PermissionRevokeResult>('POST', '/online/Credentials/ContextRevoke', {
      body: {
        contextNip: params.contextNip,
        credentialsIdentifier: params.credentialsIdentifier,
        credentialsRoleList: params.credentialsRoleList,
      },
      requestOptions: params.requestOptions,
    });
  }

  /**
   * Queries current permissions for a given NIP context.
   */
  async query(params: PermissionQueryParams): Promise<PermissionQueryResult> {
    return this.requestJson<PermissionQueryResult>('POST', '/online/Credentials/ContextQuery', {
      body: {
        contextNip: params.contextNip,
        queryDetails: {
          pageSize: params.pageSize ?? 10,
          pageOffset: params.pageOffset ?? 0,
        },
      },
      requestOptions: params.requestOptions,
    });
  }
}
