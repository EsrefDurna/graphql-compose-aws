/* @flow */

import { TypeComposer, upperFirst } from 'graphql-compose';
import type { GraphQLObjectType } from 'graphql-compose/lib/graphql';
import AwsServiceMetadata, { type ServiceMetadataConfig } from './AwsServiceMetadata';
import AwsServiceOperation, { type ServiceOperationConfig } from './AwsServiceOperation';
import AwsShapes, { type ShapesMap } from './AwsShapes';
import type { AwsSDK } from './AwsApiParser';

export type ServiceConfig = {
  version: string,
  metadata: ServiceMetadataConfig,
  operations: {
    [name: string]: ServiceOperationConfig,
  },
  shapes: ShapesMap,
  paginators: any,
  waiters: any,
};

type ServiceOpts = {|
  serviceId: string,
  prefix: string,
  config: ServiceConfig,
  awsSDK: AwsSDK,
|};

export default class AwsService {
  prefix: string;
  serviceId: string;
  awsSDK: AwsSDK;
  tc: ?TypeComposer;
  config: ServiceConfig;
  metadata: AwsServiceMetadata;
  shapes: AwsShapes;

  constructor(opts: ServiceOpts) {
    this.prefix = opts.prefix;
    this.serviceId = opts.serviceId;
    this.awsSDK = opts.awsSDK;
    this.config = opts.config;

    this.metadata = new AwsServiceMetadata(this.config.metadata);
    this.shapes = new AwsShapes(this.config.shapes, this.getTypeName());
  }

  getTypeName(): string {
    return `${this.prefix}${upperFirst(this.serviceId)}`;
  }

  getOperationNames(): string[] {
    return Object.keys(this.config.operations);
  }

  getOperation(name: string): AwsServiceOperation {
    const operConfig = this.config.operations[name];
    if (!operConfig) {
      throw new Error(`Operation with name ${name} does not exist.`);
    }
    return new AwsServiceOperation({
      serviceId: this.serviceId,
      name,
      prefix: this.prefix,
      config: operConfig,
      shapes: this.shapes,
      awsSDK: this.awsSDK,
    });
  }

  getTypeComposer(): TypeComposer {
    if (!this.tc) {
      const fields = this.getOperationNames().reduce((res, name) => {
        res[name] = this.getOperation(name).getFieldConfig();
        return res;
      }, {});

      this.tc = TypeComposer.create({
        name: this.getTypeName(),
        fields,
        description: this.metadata.getDescription(),
      });
    }
    return this.tc;
  }

  getType(): GraphQLObjectType {
    return this.getTypeComposer().getType();
  }
}