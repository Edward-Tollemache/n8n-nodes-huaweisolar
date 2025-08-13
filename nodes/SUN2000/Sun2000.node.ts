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

interface DeviceNameMapping {
	address: number;
	customName: string;
}

export class Sun2000 implements INodeType {
	// Helper functions for data classification and splitting
	private static getTelemetryFields(): string[] {
		return [
			// Descriptive naming
			'activePower', 'reactivePower', 'inputPower', 'powerFactor', 'efficiency',
			'peakPowerToday', 'dailyEnergyYield', 'totalEnergyYield',
			'gridVoltageUAB', 'gridVoltageUBC', 'gridVoltageUCA',
			'phaseAVoltage', 'phaseBVoltage', 'phaseCVoltage',
			'phaseACurrent', 'phaseBCurrent', 'phaseCCurrent', 'gridFrequency',
			'internalTemperature', 'cabinetTemperature', 'dcCurrent',
			'numberOfStrings', 'ratedPower', 'insulationResistance', 'pvStrings',
			// IEC 61850 naming
			'P', 'Q', 'dcP', 'PF', 'eff', 'Pmax', 'EPId', 'EPI',
			'Uab', 'Ubc', 'Uca', 'Ua', 'Ub', 'Uc',
			'Ia', 'Ib', 'Ic', 'Fr', 'TempInt', 'TempCab', 'dcI', 'pv'
		];
	}

	private static getStatusFields(): string[] {
		return [
			'status', 'deviceStatus', 'deviceStatusText', 'runningStatus',
			'majorFault', 'minorFault', 'warning', 'alarm1', 'alarm2', 'alarm3',
			'faultCode', 'alarmTexts'
		];
	}

	private static getIdentificationFields(): string[] {
		return ['unitId', 'deviceName', 'serialNumber', 'model'];
	}

	private static createNestedInverterData(inverterData: any, timestamp: string): any {
		const telemetryFields = this.getTelemetryFields();
		const statusFields = this.getStatusFields();
		const identificationFields = this.getIdentificationFields();

		// Root level data: timestamp + device identification
		const rootData = {
			ts: timestamp,
			...Object.fromEntries(
				identificationFields
					.filter(field => inverterData[field] !== undefined)
					.map(field => [field, inverterData[field]])
			)
		};

		// Nested telemetry object
		const telemetryData = Object.fromEntries(
			telemetryFields
				.filter(field => inverterData[field] !== undefined)
				.map(field => [field, inverterData[field]])
		);

		// Nested status object
		const statusData = Object.fromEntries(
			statusFields
				.filter(field => inverterData[field] !== undefined)
				.map(field => [field, inverterData[field]])
		);

		// Build final nested structure
		const result: any = { ...rootData };
		
		// Always include telemetry and status objects (even if empty) for consistency
		if (Object.keys(telemetryData).length > 0) {
			result.telemetry = telemetryData;
		}
		
		if (Object.keys(statusData).length > 0) {
			result.status = statusData;
		}

		return result;
	}


	private static processInverterDataToItems(
		inverters: any[], 
		timestamp: string, 
		returnData: INodeExecutionData[], 
		itemIndex: number
	): void {
		for (const inverter of inverters) {
			if (inverter.error) {
				// For failed inverters, create a single error item
				returnData.push({
					json: {
						ts: timestamp,
						unitId: inverter.unitId,
						deviceName: inverter.deviceName,
						error: inverter.error
					},
					pairedItem: itemIndex,
				});
			} else {
				// Create single item with nested telemetry and status objects
				const nestedItem = Sun2000.createNestedInverterData(inverter, timestamp);
				returnData.push({
					json: nestedItem,
					pairedItem: itemIndex,
				});
			}
		}
	}


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
				description: 'Whether to always include alarmTexts field in output, even when empty (for consistent packet structure)',
			},
			{
				displayName: 'Field Naming Convention',
				name: 'namingConvention',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Descriptive',
						value: 'descriptive',
						description: 'Use descriptive field names (e.g., activePower, phaseAVoltage)',
					},
					{
						name: 'IEC 61850',
						value: 'iec61850',
						description: 'Use IEC 61850 standard field names (e.g., P, Ua)',
					},
				],
				default: 'descriptive',
				description: 'Choose output field naming: Descriptive or IEC 61850 standard',
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
			{
				displayName: 'Custom Inverter Names',
				name: 'useCustomNames',
				type: 'boolean',
				default: false,
				description: 'Whether to enable custom naming for inverters instead of auto-generated names',
				displayOptions: {
					show: {
						operation: ['specifyDevices'],
					},
				},
			},
			{
				displayName: 'Device Name Mappings',
				name: 'deviceNameMappings',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				options: [
					{
						name: 'mappings',
						displayName: 'Name Mapping',
						values: [
							{
								displayName: 'Inverter Address',
								name: 'address',
								type: 'number',
								default: 12,
								placeholder: '12',
								description: 'The inverter unit ID/address to rename',
							},
							{
								displayName: 'Custom Name',
								name: 'customName',
								type: 'string',
								default: '',
								placeholder: 'Solar Panel East',
								description: 'Custom name for this inverter',
							},
						],
					},
				],
				displayOptions: {
					show: {
						operation: ['specifyDevices'],
						useCustomNames: [true],
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
				const namingConvention = this.getNodeParameter('namingConvention', itemIndex, 'descriptive') as string;
				const useIEC = namingConvention === 'iec61850';

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
						// No inverters found - create a single status item with message
						const timestamp = new Date().toISOString();
						returnData.push({
							json: {
								ts: timestamp,
								message: 'No inverters found in discovery data',
								operation: 'readFromDiscovery'
							},
							pairedItem: itemIndex,
						});
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
							const inverters = await sun2000.readMultipleInverters(discoveredDevices, dataCategories, alwaysIncludeAlarmTexts, useIEC);
							
							// Convert to individual items format
							const timestamp = new Date().toISOString();
							Sun2000.processInverterDataToItems(inverters, timestamp, returnData, itemIndex);

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
					const useCustomNames = this.getNodeParameter('useCustomNames', itemIndex, false) as boolean;
					const deviceNameMappings = this.getNodeParameter('deviceNameMappings', itemIndex, {}) as { mappings?: DeviceNameMapping[] };

					// Parse inverter addresses
					const addresses = Sun2000.parseAddressList(inverterAddresses);
					if (addresses.length === 0) {
						throw new ApplicationError('No valid inverter addresses specified. Please provide addresses like "12,13,14,15" or "12-15".');
					}

					// Convert addresses to device objects
					const devices = addresses.map((addr: number) => {
						let deviceName = `Inverter-${addr}`; // Default name
						
						// Apply custom naming if enabled
						if (useCustomNames && deviceNameMappings?.mappings) {
							const mapping = deviceNameMappings.mappings.find(m => m.address === addr);
							if (mapping?.customName) {
								deviceName = mapping.customName;
							}
						}
						
						return {
							unitId: addr,
							deviceAddress: addr,
							deviceName
						};
					});

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
						const inverters = await sun2000.readMultipleInverters(devices, dataCategories, alwaysIncludeAlarmTexts, useIEC);
						
						// Convert to individual items format
						const timestamp = new Date().toISOString();
						Sun2000.processInverterDataToItems(inverters, timestamp, returnData, itemIndex);

					} finally {
						await modbusClient.disconnect();
					}
				}

			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							ts: new Date().toISOString(),
							error: error.message,
							success: false,
							operation: this.getNodeParameter('operation', itemIndex)
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