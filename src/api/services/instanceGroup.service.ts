import { CreateInstanceGroupDto, InstanceGroupDto, UpdateInstanceGroupDto } from '@api/dto/instanceGroup.dto';
import { PrismaRepository } from '@api/repository/repository.service';
import { WAMonitoringService } from '@api/services/monitor.service';
import { Logger } from '@config/logger.config';
import { BadRequestException, NotFoundException } from '@exceptions';
import { InstanceGroup } from '@prisma/client';

export class InstanceGroupService {
  private readonly logger = new Logger('InstanceGroupService');

  constructor(
    private readonly repository: PrismaRepository,
    private readonly waMonitor: WAMonitoringService,
  ) {}

  public async create(data: CreateInstanceGroupDto): Promise<InstanceGroupDto> {
    this.logger.verbose('Creating instance group');

    // Validate that all instances exist and are connected
    await this.validateInstances(data.instances);

    // Check if group name already exists
    const existingGroup = await this.repository.instanceGroup.findFirst({
      where: { name: data.name },
    });

    if (existingGroup) {
      throw new BadRequestException('Instance group with this name already exists');
    }

    const instanceGroup = await this.repository.instanceGroup.create({
      data: {
        name: data.name,
        alias: data.alias,
        description: data.description,
        enabled: data.enabled ?? true,
        instances: data.instances,
      },
    });

    this.logger.verbose(`Instance group created: ${instanceGroup.name}`);
    return this.mapToDto(instanceGroup);
  }

  public async findAll(): Promise<InstanceGroupDto[]> {
    this.logger.verbose('Finding all instance groups');

    const instanceGroups = await this.repository.instanceGroup.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return instanceGroups.map((group) => this.mapToDto(group));
  }

  public async findById(id: string): Promise<InstanceGroupDto> {
    this.logger.verbose(`Finding instance group by id: ${id}`);

    const instanceGroup = await this.repository.instanceGroup.findUnique({
      where: { id },
    });

    if (!instanceGroup) {
      throw new NotFoundException('Instance group not found');
    }

    return this.mapToDto(instanceGroup);
  }

  public async findByName(name: string): Promise<InstanceGroupDto> {
    this.logger.verbose(`Finding instance group by name: ${name}`);

    const instanceGroup = await this.repository.instanceGroup.findUnique({
      where: { name },
    });

    if (!instanceGroup) {
      throw new NotFoundException('Instance group not found');
    }

    return this.mapToDto(instanceGroup);
  }

  public async findByAlias(alias: string): Promise<InstanceGroupDto> {
    this.logger.verbose(`Finding instance group by alias: ${alias}`);

    const instanceGroup = await this.repository.instanceGroup.findUnique({
      where: { alias },
    });

    if (!instanceGroup) {
      throw new NotFoundException('Instance group not found');
    }

    return this.mapToDto(instanceGroup);
  }

  public async update(id: string, data: UpdateInstanceGroupDto): Promise<InstanceGroupDto> {
    this.logger.verbose(`Updating instance group: ${id}`);

    // Check if group exists
    const existingGroup = await this.repository.instanceGroup.findUnique({
      where: { id },
    });

    if (!existingGroup) {
      throw new NotFoundException('Instance group not found');
    }

    // If updating name, check for conflicts
    if (data.name && data.name !== existingGroup.name) {
      const nameConflict = await this.repository.instanceGroup.findFirst({
        where: { name: data.name, id: { not: id } },
      });

      if (nameConflict) {
        throw new BadRequestException('Instance group with this name already exists');
      }
    }

    // If updating instances, validate them
    if (data.instances) {
      await this.validateInstances(data.instances);
    }

    const instanceGroup = await this.repository.instanceGroup.update({
      where: { id },
      data: {
        name: data.name,
        alias: data.alias,
        description:
          data.description !== undefined ? (data.description.trim() === '' ? null : data.description) : undefined,
        enabled: data.enabled,
        instances: data.instances,
      },
    });

    this.logger.verbose(`Instance group updated: ${instanceGroup.name}`);
    return this.mapToDto(instanceGroup);
  }

  public async delete(id: string): Promise<void> {
    this.logger.verbose(`Deleting instance group: ${id}`);

    const existingGroup = await this.repository.instanceGroup.findUnique({
      where: { id },
    });

    if (!existingGroup) {
      throw new NotFoundException('Instance group not found');
    }

    await this.repository.instanceGroup.delete({
      where: { id },
    });

    this.logger.verbose(`Instance group deleted: ${existingGroup.name}`);
  }

  public async addInstance(id: string, instanceName: string): Promise<InstanceGroupDto> {
    this.logger.verbose(`Adding instance ${instanceName} to group ${id}`);

    const group = await this.repository.instanceGroup.findUnique({
      where: { id },
    });

    if (!group) {
      throw new NotFoundException('Instance group not found');
    }

    // Validate the instance
    await this.validateInstances([instanceName]);

    const currentInstances = group.instances as string[];
    if (currentInstances.includes(instanceName)) {
      throw new BadRequestException('Instance is already in the group');
    }

    const updatedInstances = [...currentInstances, instanceName];

    const updatedGroup = await this.repository.instanceGroup.update({
      where: { id },
      data: { instances: updatedInstances },
    });

    this.logger.verbose(`Instance ${instanceName} added to group ${group.name}`);
    return this.mapToDto(updatedGroup);
  }

  public async removeInstance(id: string, instanceName: string): Promise<InstanceGroupDto> {
    this.logger.verbose(`Removing instance ${instanceName} from group ${id}`);

    const group = await this.repository.instanceGroup.findUnique({
      where: { id },
    });

    if (!group) {
      throw new NotFoundException('Instance group not found');
    }

    const currentInstances = group.instances as string[];
    if (!currentInstances.includes(instanceName)) {
      throw new BadRequestException('Instance is not in the group');
    }

    const updatedInstances = currentInstances.filter((name) => name !== instanceName);

    if (updatedInstances.length === 0) {
      throw new BadRequestException('Cannot remove the last instance from the group');
    }

    const updatedGroup = await this.repository.instanceGroup.update({
      where: { id },
      data: { instances: updatedInstances },
    });

    this.logger.verbose(`Instance ${instanceName} removed from group ${group.name}`);
    return this.mapToDto(updatedGroup);
  }

  public async getActiveInstances(groupId: string): Promise<string[]> {
    this.logger.verbose(`Getting active instances for group: ${groupId}`);

    const group = await this.repository.instanceGroup.findUnique({
      where: { id: groupId, enabled: true },
    });

    if (!group) {
      throw new NotFoundException('Instance group not found or disabled');
    }

    const instances = group.instances as string[];
    const activeInstances: string[] = [];

    // Check which instances are currently connected
    for (const instanceName of instances) {
      const instance = this.waMonitor.waInstances[instanceName];
      if (instance && instance.connectionStatus?.state === 'open') {
        activeInstances.push(instanceName);
      }
    }

    if (activeInstances.length === 0) {
      throw new BadRequestException('No active instances found in the group');
    }

    return activeInstances;
  }

  private async validateInstances(instanceNames: string[]): Promise<void> {
    for (const instanceName of instanceNames) {
      const instance = await this.repository.instance.findUnique({
        where: { name: instanceName },
      });

      if (!instance) {
        throw new BadRequestException(`Instance '${instanceName}' not found`);
      }
    }
  }

  private mapToDto(instanceGroup: InstanceGroup): InstanceGroupDto {
    return {
      id: instanceGroup.id,
      name: instanceGroup.name,
      alias: instanceGroup.alias,
      description: instanceGroup.description,
      enabled: instanceGroup.enabled,
      instances: instanceGroup.instances as string[],
      createdAt: instanceGroup.createdAt,
      updatedAt: instanceGroup.updatedAt,
    };
  }
}
