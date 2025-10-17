export class InstanceGroupDto {
  id?: string;
  name: string;
  alias?: string;
  description?: string;
  enabled?: boolean;
  instances: string[]; // Array of instance names
  createdAt?: Date;
  updatedAt?: Date;
}

export class CreateInstanceGroupDto {
  name: string;
  alias?: string;
  description?: string;
  enabled?: boolean;
  instances: string[];
}

export class UpdateInstanceGroupDto {
  name?: string;
  alias?: string;
  description?: string;
  enabled?: boolean;
  instances?: string[];
}

export class AddInstanceToGroupDto {
  instanceName: string;
}

export class RemoveInstanceFromGroupDto {
  instanceName: string;
}

export class SendTextWithGroupBalancingDto {
  alias: string;
  number: string;
  text: string;
  delay?: number;
  quoted?: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    message: any;
  };
  linkPreview?: boolean;
  mentionsEveryOne?: boolean;
  mentioned?: string[];
}
