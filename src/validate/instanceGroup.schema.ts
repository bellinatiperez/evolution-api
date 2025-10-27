import { JSONSchema7 } from 'json-schema';
import { v4 } from 'uuid';

const isNotEmpty = (...propertyNames: string[]): JSONSchema7 => {
  const properties: JSONSchema7['properties'] = {};
  propertyNames.forEach((property) => {
    properties[property] = {
      minLength: 1,
      description: `The "${property}" cannot be empty`,
    };
  });
  return {
    if: {
      propertyNames: {
        enum: propertyNames,
      },
    },
    then: { properties },
  };
};

export const instanceGroupSchema: JSONSchema7 = {
  $id: v4(),
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 100 },
    alias: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      pattern: '^[a-z0-9-]+$',
      description: 'Alias must be lowercase, contain only letters, numbers and hyphens',
    },
    description: { type: 'string', maxLength: 500 },
    enabled: { type: 'boolean' },
    instances: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      minItems: 1,
      uniqueItems: true,
    },
  },
  required: ['name', 'instances'],
  ...isNotEmpty('name'),
};

export const updateInstanceGroupSchema: JSONSchema7 = {
  $id: v4(),
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 100 },
    alias: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      pattern: '^[a-z0-9-]+$',
      description: 'Alias must be lowercase, contain only letters, numbers and hyphens',
    },
    description: { type: 'string', maxLength: 500 },
    enabled: { type: 'boolean' },
    instances: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      minItems: 1,
      uniqueItems: true,
    },
  },
  anyOf: [
    { required: ['name'] },
    { required: ['alias'] },
    { required: ['description'] },
    { required: ['enabled'] },
    { required: ['instances'] },
  ],
  ...isNotEmpty('name'),
};

export const addInstanceToGroupSchema: JSONSchema7 = {
  $id: v4(),
  type: 'object',
  properties: {
    instanceName: { type: 'string', minLength: 1 },
  },
  required: ['instanceName'],
  ...isNotEmpty('instanceName'),
};

export const removeInstanceFromGroupSchema: JSONSchema7 = {
  $id: v4(),
  type: 'object',
  properties: {
    instanceName: { type: 'string', minLength: 1 },
  },
  required: ['instanceName'],
  ...isNotEmpty('instanceName'),
};

export const sendTextWithGroupBalancingSchema: JSONSchema7 = {
  $id: v4(),
  type: 'object',
  properties: {
    alias: { type: 'string', minLength: 1 },
    number: { type: 'string', pattern: '^\\d+[\\.@\\w-]+' },
    text: { type: 'string', minLength: 1 },
    delay: { type: 'integer', minimum: 0 },
    quoted: {
      type: 'object',
      properties: {
        key: {
          type: 'object',
          properties: {
            remoteJid: { type: 'string' },
            fromMe: { type: 'boolean' },
            id: { type: 'string' },
          },
          required: ['remoteJid', 'fromMe', 'id'],
        },
        message: { type: 'object' },
      },
      required: ['key', 'message'],
    },
    linkPreview: { type: 'boolean' },
    mentionsEveryOne: { type: 'boolean' },
    mentioned: {
      type: 'array',
      items: { type: 'string', pattern: '^\\d+' },
      uniqueItems: true,
    },
  },
  required: ['alias', 'number', 'text'],
  ...isNotEmpty('alias', 'number', 'text'),
};
