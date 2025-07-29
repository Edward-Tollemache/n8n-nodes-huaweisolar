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
					{
						name: 'Specify Devices',
						value: 'specifyDevices',
						description: 'Manually specify inverter device addresses',
						action: 'Read data from specified devices',
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
				displayOptions: {
					show: {
						operation: ['readFromDiscovery'],
					},
				},
			},
			{
				displayName: 'Data Categories',
				name: 'dataCategories',
				type: 'multiOptions',
				options: [
					{
						name: 'Alarms & Faults',
						value: 'alarms',
						description: 'Alarm registers with decoded error messages',
					},
					{
						name: 'Device Information',
						value: 'device',
						description: 'Model, serial number, firmware version, rated power',
					},
					{
						name: 'Grid Currents',
						value: 'currents',
						description: 'AC phase currents and grid frequency',
					},
					{
						name: 'Grid Voltages',
						value: 'voltages',
						description: 'AC line voltages (UAB, UBC, UCA) and phase voltages',
					},
					{
						name: 'Power & Energy',
						value: 'power',
						description: 'Active/reactive power, efficiency, daily/total energy',
					},
					{
						name: 'PV String Data',
						value: 'strings',
						description: 'DC voltages and currents for each PV string',
					},
					{
						name: 'Status & Temperature',
						value: 'status',
						description: 'Device status, running state, temperature readings',
					},
				],
				default: ['power', 'voltages', 'status'],
				description: 'Select which data categories to read from inverters',
			},
			{
				displayName: 'Always Include Alarm Texts',
				name: 'alwaysIncludeAlarmTexts',
				type: 'boolean',
				default: false,
				description: 'Always include alarmTexts field in output, even when empty (for consistent packet structure)',
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
						operation: ['specifyDevices'],
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
						operation: ['specifyDevices'],
					},
				},
			},
			{
				displayName: 'Inverter Addresses',
				name: 'inverterAddresses',
				type: 'string',
				default: '12,13,14,15',
				placeholder: '12,13,14,15 or 12-15 or 1-2,6,8',
				description: 'Comma-separated inverter device addresses or ranges',
				required: true,
				displayOptions: {
					show: {
						operation: ['specifyDevices'],
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
						operation: ['specifyDevices'],
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
						operation: ['specifyDevices'],
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
				const filterInverters = this.getNodeParameter('filterInverters', itemIndex, true) as boolean;
				const dataCategories = this.getNodeParameter('dataCategories', itemIndex, ['power', 'voltages', 'status']) as string[];
				const alwaysIncludeAlarmTexts = this.getNodeParameter('alwaysIncludeAlarmTexts', itemIndex, false) as boolean;

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
							responseData.inverters = await sun2000.readMultipleInverters(discoveredDevices, dataCategories, alwaysIncludeAlarmTexts);

						} finally {
							await modbusClient.disconnect();
						}
					}
				} else if (operation === 'specifyDevices') {
					// Manual device specification mode
					const host = this.getNodeParameter('host', itemIndex) as string;
					const port = this.getNodeParameter('port', itemIndex) as number;
					const inverterAddresses = this.getNodeParameter('inverterAddresses', itemIndex) as string;
					const timeout = this.getNodeParameter('timeout', itemIndex, 5000) as number;
					const retries = this.getNodeParameter('retries', itemIndex, 3) as number;

					// Parse inverter addresses
					const addresses = Sun2000.parseAddressList(inverterAddresses);
					if (addresses.length === 0) {
						throw new ApplicationError('No valid inverter addresses specified. Please provide addresses like "12,13,14,15" or "12-15".');
					}

					// Convert addresses to device objects
					const devices = addresses.map((addr: number) => ({
						unitId: addr,
						deviceAddress: addr,
						deviceName: `Inverter-${addr}`
					}));

					// Connect and read data
					const config: ModbusConnectionConfig = {
						host,
						port,
						unitId: 0, // Use unit ID 0 for remapped register access
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

						// Read data from specified inverters
						responseData.inverters = await sun2000.readMultipleInverters(devices, dataCategories, alwaysIncludeAlarmTexts);

					} finally {
						await modbusClient.disconnect();
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

	/**
	 * Parse address list string into array of numbers
	 * Examples: "12,13,14,15" -> [12,13,14,15]
	 *           "12-15" -> [12,13,14,15]
	 *           "1-2,6,8" -> [1,2,6,8]
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