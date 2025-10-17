import {
  AddInstanceToGroupDto,
  CreateInstanceGroupDto,
  InstanceGroupDto,
  RemoveInstanceFromGroupDto,
  UpdateInstanceGroupDto,
} from '@api/dto/instanceGroup.dto';
import { PrismaRepository } from '@api/repository/repository.service';
import { InstanceGroupService } from '@api/services/instanceGroup.service';
import { WAMonitoringService } from '@api/services/monitor.service';
import { Logger } from '@config/logger.config';
import { BadRequestException } from '@exceptions';

export class InstanceGroupController {
  private readonly logger = new Logger('InstanceGroupController');

  constructor(
    private readonly instanceGroupService: InstanceGroupService,
    private readonly waMonitor: WAMonitoringService,
    private readonly repository: PrismaRepository,
  ) {}

  /**
   * Transforms a string to a valid alias format:
   * - Converts to lowercase
   * - Replaces spaces with hyphens
   * - Removes invalid characters (keeps only letters, numbers, and hyphens)
   */
  private transformToAlias(input: string): string {
    return input
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Validates if an alias is unique in the system
   */
  private async validateAliasUniqueness(alias: string, excludeId?: string): Promise<void> {
    try {
      const existingGroup = await this.instanceGroupService.findByAlias(alias);
      if (existingGroup && existingGroup.id !== excludeId) {
        throw new BadRequestException(`Alias '${alias}' is already in use`);
      }
    } catch (error) {
      // If findByAlias throws an error (group not found), that's what we want
      if (error instanceof BadRequestException && (error as any).message?.includes('already in use')) {
        throw error;
      }
      // If it's a "not found" error, that's fine - alias is available
    }
  }

  public async create(data: CreateInstanceGroupDto): Promise<InstanceGroupDto> {
    this.logger.verbose('Creating instance group');

    if (!data.name || data.name.trim().length === 0) {
      throw new BadRequestException('Group name is required');
    }

    if (!data.instances || data.instances.length === 0) {
      throw new BadRequestException('At least one instance is required');
    }

    // Handle alias transformation and validation
    if (!data.alias || data.alias.trim().length === 0) {
      // Auto-generate alias from name if not provided
      data.alias = this.transformToAlias(data.name);
    } else {
      // Transform provided alias to ensure it follows the rules
      data.alias = this.transformToAlias(data.alias);
    }

    if (!data.alias || data.alias.length === 0) {
      throw new BadRequestException('Unable to generate a valid alias from the provided name');
    }

    // Validate alias uniqueness
    await this.validateAliasUniqueness(data.alias);

    // Remove duplicates and empty strings
    data.instances = [...new Set(data.instances.filter((name) => name && name.trim().length > 0))];

    if (data.instances.length === 0) {
      throw new BadRequestException('At least one valid instance is required');
    }

    return await this.instanceGroupService.create(data);
  }

  public async findAll(): Promise<InstanceGroupDto[]> {
    this.logger.verbose('Finding all instance groups');
    return await this.instanceGroupService.findAll();
  }

  public async findById(id: string): Promise<InstanceGroupDto> {
    this.logger.verbose(`Finding instance group by id: ${id}`);

    if (!id || id.trim().length === 0) {
      throw new BadRequestException('Group ID is required');
    }

    return await this.instanceGroupService.findById(id);
  }

  public async findByName(name: string): Promise<InstanceGroupDto> {
    this.logger.verbose(`Finding instance group by name: ${name}`);

    if (!name || name.trim().length === 0) {
      throw new BadRequestException('Group name is required');
    }

    return await this.instanceGroupService.findByName(name);
  }

  public async findByAlias(alias: string): Promise<InstanceGroupDto> {
    this.logger.verbose(`Finding instance group by alias: ${alias}`);

    if (!alias || alias.trim().length === 0) {
      throw new BadRequestException('Group alias is required');
    }

    return await this.instanceGroupService.findByAlias(alias);
  }

  public async update(id: string, data: UpdateInstanceGroupDto): Promise<InstanceGroupDto> {
    this.logger.verbose(`Updating instance group: ${id}`);

    if (!id || id.trim().length === 0) {
      throw new BadRequestException('Group ID is required');
    }

    // Validate that at least one field is being updated
    if (!data.name && !data.alias && !data.description && data.enabled === undefined && !data.instances) {
      throw new BadRequestException('At least one field must be provided for update');
    }

    // Handle alias transformation and validation
    if (data.alias !== undefined) {
      if (data.alias.trim().length === 0) {
        // If alias is being cleared, auto-generate from name
        const existingGroup = await this.instanceGroupService.findById(id);
        const nameToUse = data.name || existingGroup.name;
        data.alias = this.transformToAlias(nameToUse);
      } else {
        // Transform provided alias to ensure it follows the rules
        data.alias = this.transformToAlias(data.alias);
      }

      if (!data.alias || data.alias.length === 0) {
        throw new BadRequestException('Unable to generate a valid alias');
      }

      // Validate alias uniqueness (excluding current group)
      await this.validateAliasUniqueness(data.alias, id);
    }

    // Clean up instances array if provided
    if (data.instances) {
      data.instances = [...new Set(data.instances.filter((name) => name && name.trim().length > 0))];
      if (data.instances.length === 0) {
        throw new BadRequestException('At least one valid instance is required');
      }
    }

    return await this.instanceGroupService.update(id, data);
  }

  public async delete(id: string): Promise<{ message: string }> {
    this.logger.verbose(`Deleting instance group: ${id}`);

    if (!id || id.trim().length === 0) {
      throw new BadRequestException('Group ID is required');
    }

    await this.instanceGroupService.delete(id);
    return { message: 'Instance group deleted successfully' };
  }

  public async addInstance(id: string, data: AddInstanceToGroupDto): Promise<InstanceGroupDto> {
    this.logger.verbose(`Adding instance to group: ${id}`);

    if (!id || id.trim().length === 0) {
      throw new BadRequestException('Group ID is required');
    }

    if (!data.instanceName || data.instanceName.trim().length === 0) {
      throw new BadRequestException('Instance name is required');
    }

    return await this.instanceGroupService.addInstance(id, data.instanceName.trim());
  }

  public async removeInstance(id: string, data: RemoveInstanceFromGroupDto): Promise<InstanceGroupDto> {
    this.logger.verbose(`Removing instance from group: ${id}`);

    if (!id || id.trim().length === 0) {
      throw new BadRequestException('Group ID is required');
    }

    if (!data.instanceName || data.instanceName.trim().length === 0) {
      throw new BadRequestException('Instance name is required');
    }

    return await this.instanceGroupService.removeInstance(id, data.instanceName.trim());
  }

  public async getActiveInstances(id: string): Promise<{ instances: string[] }> {
    this.logger.verbose(`Getting active instances for group: ${id}`);

    if (!id || id.trim().length === 0) {
      throw new BadRequestException('Group ID is required');
    }

    const activeInstances = await this.instanceGroupService.getActiveInstances(id);
    return { instances: activeInstances };
  }

  public async getGroupStats(id: string): Promise<{
    totalInstances: number;
    activeInstances: number;
    inactiveInstances: number;
    instances: Array<{ name: string; status: string }>;
  }> {
    this.logger.verbose(`Getting stats for group: ${id}`);

    if (!id || id.trim().length === 0) {
      throw new BadRequestException('Group ID is required');
    }

    const group = await this.instanceGroupService.findById(id);
    const instances = group.instances;
    const instanceStats: Array<{ name: string; status: string }> = [];

    let activeCount = 0;
    let inactiveCount = 0;

    for (const instanceName of instances) {
      const instance = this.waMonitor.waInstances[instanceName];
      const status = instance && instance.connectionStatus?.state === 'open' ? 'active' : 'inactive';

      instanceStats.push({
        name: instanceName,
        status,
      });

      if (status === 'active') {
        activeCount++;
      } else {
        inactiveCount++;
      }
    }

    return {
      totalInstances: instances.length,
      activeInstances: activeCount,
      inactiveInstances: inactiveCount,
      instances: instanceStats,
    };
  }
}
