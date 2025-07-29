import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError, ApplicationError } from 'n8n-workflow';

import { HuaweiModbusClient, ModbusConnectionConfig } from '../utils/modbus-utils';
import { SUN2000Functions } from '../utils/sun2000-functions';

interface DeviceDiscoveryInput {
	unitId: number;
	deviceName?: string;
	deviceAddress: number;
	connectionStatus?: string;
	portNumber?: number;
}

export class Sun2000 implements INodeType {
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
						name: 'Read From Discovery',
						value: 'readFromDiscovery',
						description: 'Read data from inverters found by SmartLogger discovery',
						action: 'Read data from discovered inverters',
					},
				],
				default: 'readFromDiscovery',
			},
			{
				displayName: 'Filter Inverters Only',
				name: 'filterInverters',
				type: 'boolean',
				default: true,
				description: 'Whether to only read data from devices that contain "SUN2000" in their name',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const filterInverters = this.getNodeParameter('filterInverters', itemIndex, true) as boolean;

				let responseData: any = {};

				if (operation === 'readFromDiscovery') {
					// Extract connection info and devices from input data
					const inputData = items[itemIndex].json as IDataObject;
					
					// Look for connection info in metadata
					const metadata = inputData._metadata as IDataObject;
					if (!metadata || !metadata.host || !metadata.port) {
						throw new ApplicationError('No connection metadata found in input. Please ensure input comes from SmartLogger discovery.');
					}

					const host = metadata.host as string;
					const port = metadata.port as number;
					
					// Extract devices from allDevices array
					if (!inputData.allDevices || !Array.isArray(inputData.allDevices)) {
						throw new ApplicationError('No device discovery data found in input. Expected "allDevices" array from SmartLogger discovery.');
					}

					let discoveredDevices = inputData.allDevices as DeviceDiscoveryInput[];

					// Filter for inverters if requested
					if (filterInverters) {
						discoveredDevices = discoveredDevices.filter(device => 
							device.deviceName && (
								device.deviceName.includes('SUN2000') ||
								device.deviceName.includes('100KTL') ||
								device.deviceName.toLowerCase().includes('inverter')
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
							unitId: 0, // Use unit ID 0 for remapped register access
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

							// Read data from all discovered inverters
							responseData.inverters = await sun2000.readMultipleInverters(discoveredDevices);

						} finally {
							await modbusClient.disconnect();
						}
					}
				}

				// Add metadata
				responseData._metadata = {
					operation,
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
}