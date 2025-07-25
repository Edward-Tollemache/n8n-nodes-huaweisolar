import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError, ApplicationError } from 'n8n-workflow';

import { HuaweiModbusClient, ModbusConnectionConfig } from '../utils/modbus-utils';
import { SmartLoggerFunctions } from '../utils/smartlogger-functions';

export class SmartLogger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Huawei SmartLogger',
		name: 'smartLogger',
		icon: 'file:smartlogger.svg',
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Read data from Huawei SmartLogger 3000 devices via Modbus TCP',
		defaults: {
			name: 'SmartLogger',
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
						name: 'Discover Devices',
						value: 'discoverDevices',
						description: 'Discover all connected devices (inverters, meters, etc.)',
						action: 'Discover connected devices',
					},
					{
						name: 'Read Alarms',
						value: 'readAlarms',
						description: 'Read alarm and status information',
						action: 'Read alarms from smart logger',
					},
					{
						name: 'Read All Data',
						value: 'readAll',
						description: 'Read all available SmartLogger data (system, power, environmental, alarms)',
						action: 'Read all smart logger data',
					},
					{
						name: 'Read Environmental Data',
						value: 'readEnvironmental',
						description: 'Read environmental monitoring data (temperature, irradiance, wind)',
						action: 'Read environmental data from smart logger',
					},
					{
						name: 'Read Power Data',
						value: 'readPower',
						description: 'Read power monitoring data (active/reactive power, current, energy)',
						action: 'Read power data from smart logger',
					},
					{
						name: 'Read System Info',
						value: 'readSystem',
						description: 'Read system information (datetime, location, DST settings)',
						action: 'Read system info from smart logger',
					},
				],
				default: 'readAll',
			},
			{
				displayName: 'Host',
				name: 'host',
				type: 'string',
				default: '192.168.1.10',
				placeholder: '192.168.1.10',
				description: 'IP address or hostname of the SmartLogger device',
				required: true,
			},
			{
				displayName: 'Port',
				name: 'port',
				type: 'number',
				default: 502,
				description: 'Modbus TCP port (default: 502)',
				required: true,
			},
			{
				displayName: 'Unit ID',
				name: 'unitId',
				type: 'number',
				default: 3,
				description: 'SmartLogger Modbus unit ID (typically 3 for SmartLogger)',
				required: true,
			},
			{
				displayName: 'Connection Timeout (Ms)',
				name: 'timeout',
				type: 'number',
				default: 5000,
				description: 'Connection timeout in milliseconds',
			},
			{
				displayName: 'Retry Attempts',
				name: 'retries',
				type: 'number',
				default: 3,
				description: 'Number of retry attempts on connection failure',
			},
			{
				displayName: 'Discovery Range',
				name: 'discoveryRange',
				type: 'string',
				default: '1-15,21-30',
				placeholder: '1-15,21-30 or 12,13,14,15',
				description: 'Unit ID ranges to scan for device discovery (comma-separated ranges or individual IDs)',
				displayOptions: {
					show: {
						operation: ['discoverDevices'],
					},
				},
			},
			{
				displayName: 'Include Inverter Discovery',
				name: 'includeInverters',
				type: 'boolean',
				default: true,
				description: 'Whether to also discover connected SUN2000 inverters',
				displayOptions: {
					show: {
						operation: ['readAll', 'discoverDevices'],
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
				// Get node parameters
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const host = this.getNodeParameter('host', itemIndex) as string;
				const port = this.getNodeParameter('port', itemIndex) as number;
				const unitId = this.getNodeParameter('unitId', itemIndex) as number;
				const timeout = this.getNodeParameter('timeout', itemIndex, 5000) as number;
				const retries = this.getNodeParameter('retries', itemIndex, 3) as number;

				// Create Modbus client configuration
				const config: ModbusConnectionConfig = {
					host,
					port,
					unitId,
					timeout,
					retries,
				};

				// Initialize Modbus client and SmartLogger functions
				const modbusClient = new HuaweiModbusClient(config);
				const smartLogger = new SmartLoggerFunctions(modbusClient, unitId);

				let responseData: any = {};

				try {
					// Connect to the device
					const connected = await modbusClient.connect();
					if (!connected) {
						throw new ApplicationError(`Failed to connect to SmartLogger at ${host}:${port}`);
					}

					// Execute the requested operation
					switch (operation) {
						case 'readAll':
							responseData = await smartLogger.readAllData();
							
							// Include inverter discovery if requested
							const includeInverters = this.getNodeParameter('includeInverters', itemIndex, true) as boolean;
							if (includeInverters) {
								responseData.connectedInverters = await smartLogger.discoverInverters();
							}
							break;

						case 'readPower':
							responseData = await smartLogger.readPowerData();
							break;

						case 'readEnvironmental':
							responseData = await smartLogger.readEnvironmentalData();
							break;

						case 'readSystem':
							responseData = await smartLogger.readSystemData();
							break;

						case 'readAlarms':
							responseData = await smartLogger.readAlarmData();
							break;

						case 'discoverDevices':
							const discoveryRange = this.getNodeParameter('discoveryRange', itemIndex, '1-15,21-30') as string;
							const unitIds = SmartLogger.parseDiscoveryRange(discoveryRange);
							
							responseData.allDevices = await smartLogger.discoverAllDevices(unitIds);
							
							const includeInvertersDiscover = this.getNodeParameter('includeInverters', itemIndex, true) as boolean;
							if (includeInvertersDiscover) {
								responseData.inverters = await smartLogger.discoverInverters();
							}
							break;

						default:
							throw new ApplicationError(`Unknown operation: ${operation}`);
					}

					// Add metadata
					responseData._metadata = {
						operation,
						host,
						port,
						unitId,
						timestamp: new Date().toISOString(),
						success: true,
					};

				} finally {
					// Always disconnect
					await modbusClient.disconnect();
				}

				// Add the response to return data
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
	 * Parse discovery range string into array of unit IDs
	 * Examples: "1-15,21-30" -> [1,2,3,...,15,21,22,...,30]
	 *           "12,13,14,15" -> [12,13,14,15]
	 */
	static parseDiscoveryRange(rangeString: string): number[] {
		const unitIds: number[] = [];
		const parts = rangeString.split(',').map(s => s.trim());

		for (const part of parts) {
			if (part.includes('-')) {
				// Handle range like "1-15"
				const [start, end] = part.split('-').map(Number);
				if (!isNaN(start) && !isNaN(end) && start <= end) {
					for (let i = start; i <= end; i++) {
						if (i >= 1 && i <= 247) { // Valid Modbus unit ID range
							unitIds.push(i);
						}
					}
				}
			} else {
				// Handle individual ID like "12"
				const id = Number(part);
				if (!isNaN(id) && id >= 1 && id <= 247) {
					unitIds.push(id);
				}
			}
		}

		return [...new Set(unitIds)].sort((a, b) => a - b); // Remove duplicates and sort
	}
}