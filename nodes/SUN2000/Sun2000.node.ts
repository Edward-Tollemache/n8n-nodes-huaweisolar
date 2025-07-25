import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError, ApplicationError } from 'n8n-workflow';

import { HuaweiModbusClient, ModbusConnectionConfig } from '../utils/modbus-utils';
import { SUN2000Functions, SUN2000AllData } from '../utils/sun2000-functions';

interface DeviceDiscoveryInput {
	unitId: number;
	deviceName?: string;
	deviceAddress: number;
	connectionStatus?: string;
	portNumber?: number;
}

export class SUN2000 implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Huawei SUN2000 Inverter',
		name: 'sun2000',
		icon: 'file:sun2000.svg',
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Read data from Huawei SUN2000 inverters via Modbus TCP',
		defaults: {
			name: 'SUN2000',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Read Inverter Data',
						value: 'readData',
						description: 'Read data from specified inverters',
						action: 'Read data from inverters',
					},
					{
						name: 'Read From Discovery',
						value: 'readFromDiscovery',
						description: 'Read data from inverters found by SmartLogger discovery',
						action: 'Read data from discovered inverters',
					},
				],
				default: 'readFromDiscovery',
			},
			{
				displayName: 'Data to Read',
				name: 'dataCategories',
				type: 'multiOptions',
				options: [
					{
						name: 'Power Data',
						value: 'power',
						description: 'Active/reactive power, DC current, input power, power factor',
					},
					{
						name: 'Status Data',
						value: 'status',
						description: 'Inverter status, temperature, insulation resistance',
					},
					{
						name: 'Fault Data',
						value: 'faults',
						description: 'Major faults, minor faults, warnings',
					},
				],
				default: ['power', 'status'],
				description: 'Select which data categories to read from the inverters',
			},
			{
				displayName: 'Host',
				name: 'host',
				type: 'string',
				default: '192.168.1.10',
				placeholder: '192.168.1.10',
				description: 'IP address or hostname of the SmartLogger device',
				required: true,
				displayOptions: {
					show: {
						operation: ['readData'],
					},
				},
			},
			{
				displayName: 'Port',
				name: 'port',
				type: 'number',
				default: 502,
				description: 'Modbus TCP port (default: 502)',
				required: true,
				displayOptions: {
					show: {
						operation: ['readData'],
					},
				},
			},
			{
				displayName: 'Inverter Addresses',
				name: 'inverterAddresses',
				type: 'string',
				default: '12,13,14,15',
				placeholder: '12,13,14,15 or 12-15',
				description: 'Comma-separated inverter device addresses or ranges',
				displayOptions: {
					show: {
						operation: ['readData'],
					},
				},
			},
			{
				displayName: 'Connection Timeout (Ms)',
				name: 'timeout',
				type: 'number',
				default: 5000,
				description: 'Connection timeout in milliseconds',
				displayOptions: {
					show: {
						operation: ['readData'],
					},
				},
			},
			{
				displayName: 'Retry Attempts',
				name: 'retries',
				type: 'number',
				default: 3,
				description: 'Number of retry attempts on connection failure',
				displayOptions: {
					show: {
						operation: ['readData'],
					},
				},
			},
			{
				displayName: 'Discovery Input Source',
				name: 'discoverySource',
				type: 'options',
				options: [
					{
						name: 'From Input Data',
						value: 'input',
						description: 'Use discovery data from input (e.g., from SmartLogger discovery)',
					},
					{
						name: 'Manual Configuration',
						value: 'manual',
						description: 'Manually specify connection details',
					},
				],
				default: 'input',
				description: 'Source of device discovery information',
				displayOptions: {
					show: {
						operation: ['readFromDiscovery'],
					},
				},
			},
			{
				displayName: 'Host',
				name: 'discoveryHost',
				type: 'string',
				default: '192.168.1.10',
				placeholder: '192.168.1.10',
				description: 'IP address or hostname of the SmartLogger device',
				required: true,
				displayOptions: {
					show: {
						operation: ['readFromDiscovery'],
						discoverySource: ['manual'],
					},
				},
			},
			{
				displayName: 'Port',
				name: 'discoveryPort',
				type: 'number',
				default: 502,
				description: 'Modbus TCP port (default: 502)',
				required: true,
				displayOptions: {
					show: {
						operation: ['readFromDiscovery'],
						discoverySource: ['manual'],
					},
				},
			},
			{
				displayName: 'Filter Inverters Only',
				name: 'filterInverters',
				type: 'boolean',
				default: true,
				description: 'Whether to only read data from devices that contain "SUN2000" in their name',
				displayOptions: {
					show: {
						operation: ['readFromDiscovery'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const dataCategories = this.getNodeParameter('dataCategories', itemIndex, ['power', 'status']) as string[];

				let responseData: any = {};

				if (operation === 'readData') {
					// Direct reading mode
					const host = this.getNodeParameter('host', itemIndex) as string;
					const port = this.getNodeParameter('port', itemIndex) as number;
					const inverterAddresses = this.getNodeParameter('inverterAddresses', itemIndex) as string;
					const timeout = this.getNodeParameter('timeout', itemIndex, 5000) as number;
					const retries = this.getNodeParameter('retries', itemIndex, 3) as number;

					const config: ModbusConnectionConfig = {
						host,
						port,
						unitId: 0, // Always use 0 for remapped register access
						timeout,
						retries,
					};

					const modbusClient = new HuaweiModbusClient(config);
					const sun2000 = new SUN2000Functions(modbusClient);

					try {
						const connected = await modbusClient.connect();
						if (!connected) {
							throw new ApplicationError(`Failed to connect to SmartLogger at ${host}:${port}`);
						}

						// Parse inverter addresses
						const addresses = SUN2000.parseAddressList(inverterAddresses);
						const devices = addresses.map((addr: number) => ({ 
							unitId: addr, 
							deviceAddress: addr,
							deviceName: `Inverter-${addr}`
						}));

						responseData.inverters = await SUN2000.readSelectedData(sun2000, devices, dataCategories);

					} finally {
						await modbusClient.disconnect();
					}

				} else if (operation === 'readFromDiscovery') {
					// Discovery-based reading mode
					const discoverySource = this.getNodeParameter('discoverySource', itemIndex) as string;
					const filterInverters = this.getNodeParameter('filterInverters', itemIndex, true) as boolean;

					let host: string;
					let port: number;
					let discoveredDevices: DeviceDiscoveryInput[] = [];

					if (discoverySource === 'input') {
						// Extract connection info and devices from input data
						const inputData = items[itemIndex].json as IDataObject;
						
						// Look for connection info in metadata
						const metadata = inputData._metadata as IDataObject;
						if (metadata && metadata.host && metadata.port) {
							host = metadata.host as string;
							port = metadata.port as number;
							
							// Extract devices from allDevices array
							if (inputData.allDevices && Array.isArray(inputData.allDevices)) {
								discoveredDevices = inputData.allDevices as DeviceDiscoveryInput[];
							} else {
								throw new ApplicationError('No device discovery data found in input. Expected "allDevices" array from SmartLogger discovery.');
							}
						} else {
							throw new ApplicationError('No connection metadata found in input. Please ensure input comes from SmartLogger discovery.');
						}
					} else {
						// Manual configuration
						host = this.getNodeParameter('discoveryHost', itemIndex) as string;
						port = this.getNodeParameter('discoveryPort', itemIndex) as number;
						
						throw new ApplicationError('Manual discovery configuration not yet implemented. Please use discovery input from SmartLogger node.');
					}

					// Filter for inverters if requested
					if (filterInverters) {
						discoveredDevices = discoveredDevices.filter(device => 
							device.deviceName && (
								device.deviceName.includes('SUN2000') ||
								device.deviceName.includes('100KTL') ||
								device.deviceName.includes('inverter')
							)
						);
					}

					if (discoveredDevices.length === 0) {
						responseData.inverters = [];
						responseData.message = 'No inverters found in discovery data';
					} else {
						// Connect and read data
						const config: ModbusConnectionConfig = {
							host,
							port,
							unitId: 0,
							timeout: 5000,
							retries: 3,
						};

						const modbusClient = new HuaweiModbusClient(config);
						const sun2000 = new SUN2000Functions(modbusClient);

						try {
							const connected = await modbusClient.connect();
							if (!connected) {
								throw new ApplicationError(`Failed to connect to SmartLogger at ${host}:${port}`);
							}

							responseData.inverters = await SUN2000.readSelectedData(sun2000, discoveredDevices, dataCategories);

						} finally {
							await modbusClient.disconnect();
						}
					}
				}

				// Add metadata
				responseData._metadata = {
					operation,
					dataCategories,
					inverterCount: responseData.inverters ? responseData.inverters.length : 0,
					timestamp: new Date().toISOString(),
					success: true,
				};

				returnData.push({
					json: responseData,
					pairedItem: itemIndex,
				});

			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error.message,
							_metadata: {
								success: false,
								timestamp: new Date().toISOString(),
							}
						},
						error,
						pairedItem: itemIndex,
					});
				} else {
					throw new NodeOperationError(this.getNode(), error as Error, {
						itemIndex,
					});
				}
			}
		}

		return [returnData];
	}

	/**
	 * Read selected data categories from multiple inverters
	 */
	private static async readSelectedData(
		sun2000: SUN2000Functions, 
		devices: Array<{unitId: number, deviceAddress: number, deviceName?: string}>, 
		dataCategories: string[]
	): Promise<SUN2000AllData[]> {
		const results: SUN2000AllData[] = [];

		// Process inverters in batches to avoid overwhelming the network
		const batchSize = 3;
		for (let i = 0; i < devices.length; i += batchSize) {
			const batch = devices.slice(i, i + batchSize);
			
			const batchPromises = batch.map(async (device) => {
				try {
					const inverterData: SUN2000AllData = {
						unitId: device.unitId,
						...(device.deviceName && { deviceName: device.deviceName })
					};

					// Read selected data categories in parallel
					const promises = [];
					const categories = [];

					if (dataCategories.includes('power')) {
						promises.push(sun2000.readPowerData(device.deviceAddress));
						categories.push('power');
					}

					if (dataCategories.includes('status')) {
						promises.push(sun2000.readStatusData(device.deviceAddress));
						categories.push('status');
					}

					if (dataCategories.includes('faults')) {
						promises.push(sun2000.readFaultData(device.deviceAddress));
						categories.push('faults');
					}

					const categoryResults = await Promise.all(promises);

					// Merge results into inverter data
					for (let j = 0; j < categories.length; j++) {
						Object.assign(inverterData, categoryResults[j]);
					}

					return inverterData;

				} catch (error) {
					// Return error info for failed devices
					return {
						unitId: device.unitId,
						deviceName: device.deviceName,
						error: error instanceof Error ? error.message : 'Unknown error'
					} as SUN2000AllData & { error: string };
				}
			});

			const batchResults = await Promise.all(batchPromises);
			results.push(...batchResults);
		}

		return results;
	}

	/**
	 * Parse address list string into array of numbers
	 * Examples: "12,13,14,15" -> [12,13,14,15]
	 *           "12-15" -> [12,13,14,15]  
	 */
	private static parseAddressList(addressString: string): number[] {
		const addresses: number[] = [];
		const parts = addressString.split(',').map(s => s.trim());

		for (const part of parts) {
			if (part.includes('-')) {
				// Handle range like "12-15"
				const [start, end] = part.split('-').map(Number);
				if (!isNaN(start) && !isNaN(end) && start <= end) {
					for (let i = start; i <= end; i++) {
						if (i >= 1 && i <= 247) {
							addresses.push(i);
						}
					}
				}
			} else {
				// Handle individual address like "12"
				const addr = Number(part);
				if (!isNaN(addr) && addr >= 1 && addr <= 247) {
					addresses.push(addr);
				}
			}
		}

		return [...new Set(addresses)].sort((a, b) => a - b);
	}
}