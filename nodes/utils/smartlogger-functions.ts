/**
 * Huawei SmartLogger 3000 Functions
 * 
 * Complete implementation of SmartLogger register reading functions
 * Converted from Python with critical fixes applied:
 * - SmartLogger Unit ID: 3 (not 0 as documented)
 * - Little-endian register combination
 * - Proper gain factor applications
 */

import { HuaweiModbusClient, parsePlantStatus, parseConnectionStatus } from './modbus-utils';

export interface SmartLoggerSystemData {
	datetime?: number;           // UTC timestamp
	locationCity?: number;       // City identifier
	dstEnable?: boolean;         // Daylight saving time enabled
}

export interface SmartLoggerPowerData {
	dcCurrentTotal?: number;     // Total DC current (A)
	inputPowerTotal?: number;    // Total input power (kW)
	co2Reduction?: number;       // Total CO2 reduction (kg)
	activePowerTotal?: number;   // Total active power (kW)
	reactivePowerTotal?: number; // Total reactive power (kVar)
	powerFactor?: number;        // System power factor
	plantStatus?: string;        // Plant operational status (Qinghai)
	plantStatusXinjiang?: string; // Plant status for Xinjiang region
	totalEnergy?: number;        // Lifetime energy (kWh)
	dailyEnergy?: number;        // Daily energy (kWh)
}

export interface SmartLoggerEnvironmentalData {
	windSpeed?: number;          // Wind speed (m/s)
	windDirection?: number;      // Wind direction (degrees)
	pvTemperature?: number;      // PV module temperature (°C)
	ambientTemperature?: number; // Ambient air temperature (°C)
	irradiance?: number;         // Solar irradiance (W/m²)
	dailyIrradiation?: number;   // Daily irradiation (MJ/m²)
}

export interface SmartLoggerAlarmData {
	alarmInfo1?: number;         // 16-bit alarm field 1
	alarmInfo2?: number;         // 16-bit alarm field 2
	certificateAlarms?: number;  // Certificate-related alarms
}

export interface DeviceInfo {
	unitId: number;
	deviceName?: string;
	connectionStatus?: string;
	portNumber?: number;
	deviceAddress?: number;
}

/**
 * SmartLogger Functions Class
 * Handles all SmartLogger 3000 register operations
 */
export class SmartLoggerFunctions {
	constructor(private client: HuaweiModbusClient, private unitId: number = 3) {}

	// ============================================================================
	// SYSTEM CONTROL REGISTERS (40000-40299)
	// ============================================================================

	/**
	 * Read system date/time as UTC timestamp
	 * Registers: 40000-40001 (U32, epoch seconds)
	 */
	async readSystemDateTime(): Promise<number | null> {
		const result = await this.client.readU32(40000, this.unitId);
		return result.success ? result.data! : null;
	}

	/**
	 * Read location city identifier
	 * Registers: 40002-40003 (U32)
	 */
	async readLocationCity(): Promise<number | null> {
		const result = await this.client.readU32(40002, this.unitId);
		return result.success ? result.data! : null;
	}

	/**
	 * Read daylight saving time enable status
	 * Register: 40004 (U16)
	 */
	async readDstEnable(): Promise<boolean | null> {
		const result = await this.client.readU16(40004, this.unitId);
		return result.success ? Boolean(result.data!) : null;
	}

	/**
	 * Read all system control data
	 */
	async readSystemData(useIEC?: boolean): Promise<SmartLoggerSystemData> {
		const [datetime, locationCity, dstEnable] = await Promise.all([
			this.readSystemDateTime(),
			this.readLocationCity(),
			this.readDstEnable()
		]);

		return {
			...(datetime !== null && { datetime }),
			...(locationCity !== null && { locationCity }),
			...(dstEnable !== null && { dstEnable })
		};
	}

	// ============================================================================
	// POWER MONITORING REGISTERS (40500-40599)
	// ============================================================================

	/**
	 * Read total DC current from all inverters
	 * Register: 40500 (I16, gain=10)
	 */
	async readDcCurrentTotal(): Promise<number | null> {
		const result = await this.client.readI16(40500, this.unitId);
		return result.success ? result.data! / 10.0 : null;
	}

	/**
	 * Read total input power from all inverters
	 * Registers: 40521-40522 (U32, gain=1000)
	 */
	async readInputPowerTotal(): Promise<number | null> {
		const result = await this.client.readU32(40521, this.unitId);
		return result.success ? result.data! / 1000.0 : null;
	}

	/**
	 * Read total CO2 reduction
	 * Registers: 40523-40524 (U32, gain=10)
	 */
	async readCO2Reduction(): Promise<number | null> {
		const result = await this.client.readU32(40523, this.unitId);
		return result.success ? result.data! / 10.0 : null;
	}

	/**
	 * Read total active power output (AC)
	 * Registers: 40525-40526 (I32, gain=1000)
	 */
	async readActivePowerTotal(): Promise<number | null> {
		const result = await this.client.readI32(40525, this.unitId);
		return result.success ? result.data! / 1000.0 : null;
	}

	/**
	 * Read total reactive power
	 * Registers: 40544-40545 (I32, gain=1000)
	 */
	async readReactivePowerTotal(): Promise<number | null> {
		const result = await this.client.readI32(40544, this.unitId);
		return result.success ? result.data! / 1000.0 : null;
	}

	/**
	 * Read system power factor
	 * Register: 40532 (I16, gain=1000)
	 */
	async readPowerFactor(): Promise<number | null> {
		const result = await this.client.readI16(40532, this.unitId);
		return result.success ? result.data! / 1000.0 : null;
	}

	/**
	 * Read plant operational status (Qinghai region)
	 * Register: 40543 (U16)
	 */
	async readPlantStatus(): Promise<string | null> {
		const result = await this.client.readU16(40543, this.unitId);
		return result.success ? parsePlantStatus(result.data!) : null;
	}

	/**
	 * Read plant operational status (Xinjiang region)
	 * Register: 40566 (U16)
	 */
	async readPlantStatusXinjiang(): Promise<string | null> {
		const result = await this.client.readU16(40566, this.unitId);
		if (!result.success || result.data === undefined) return null;
		
		// Parse Xinjiang-specific status codes
		switch (result.data) {
			case 0: return 'Idle';
			case 1: return 'On-grid';
			case 2: return 'On-grid with self-derating';
			case 3: return 'On-grid with power limit';
			case 4: return 'Planned outage';
			case 5: return 'Power limit outage';
			case 6: return 'Fault outage';
			case 7: return 'Communication interrupt';
			default: return `Unknown (${result.data})`;
		}
	}

	/**
	 * Read total energy yield (lifetime)
	 * Registers: 40560-40561 (U32, gain=10)
	 */
	async readTotalEnergy(): Promise<number | null> {
		const result = await this.client.readU32(40560, this.unitId);
		return result.success ? result.data! / 10.0 : null;
	}

	/**
	 * Read daily energy yield
	 * Registers: 40562-40563 (U32, gain=10)
	 */
	async readDailyEnergy(): Promise<number | null> {
		const result = await this.client.readU32(40562, this.unitId);
		return result.success ? result.data! / 10.0 : null;
	}

	/**
	 * Read all power monitoring data
	 */
	async readPowerData(useIEC?: boolean): Promise<SmartLoggerPowerData> {
		const [
			dcCurrentTotal,
			inputPowerTotal,
			co2Reduction,
			activePowerTotal,
			reactivePowerTotal,
			powerFactor,
			plantStatus,
			plantStatusXinjiang,
			totalEnergy,
			dailyEnergy
		] = await Promise.all([
			this.readDcCurrentTotal(),
			this.readInputPowerTotal(),
			this.readCO2Reduction(),
			this.readActivePowerTotal(),
			this.readReactivePowerTotal(),
			this.readPowerFactor(),
			this.readPlantStatus(),
			this.readPlantStatusXinjiang(),
			this.readTotalEnergy(),
			this.readDailyEnergy()
		]);

		const result: any = {};
		
		if (dcCurrentTotal !== null) result[useIEC ? 'dcI' : 'dcCurrentTotal'] = dcCurrentTotal;
		if (inputPowerTotal !== null) result[useIEC ? 'dcP' : 'inputPowerTotal'] = inputPowerTotal;
		if (co2Reduction !== null) result[useIEC ? 'CO2' : 'co2Reduction'] = co2Reduction;
		if (activePowerTotal !== null) result[useIEC ? 'P' : 'activePowerTotal'] = activePowerTotal;
		if (reactivePowerTotal !== null) result[useIEC ? 'Q' : 'reactivePowerTotal'] = reactivePowerTotal;
		if (powerFactor !== null) result[useIEC ? 'PF' : 'powerFactor'] = powerFactor;
		if (plantStatus !== null) result[useIEC ? 'status' : 'plantStatus'] = plantStatus;
		if (plantStatusXinjiang !== null) result[useIEC ? 'statusXJ' : 'plantStatusXinjiang'] = plantStatusXinjiang;
		if (totalEnergy !== null) result[useIEC ? 'EPI' : 'totalEnergy'] = totalEnergy;
		if (dailyEnergy !== null) result[useIEC ? 'EPId' : 'dailyEnergy'] = dailyEnergy;
		
		return result;
	}

	// ============================================================================
	// ENVIRONMENTAL MONITORING REGISTERS (40031-40037)
	// ============================================================================

	/**
	 * Read current wind speed
	 * Register: 40031 (I16, gain=10)
	 */
	async readWindSpeed(): Promise<number | null> {
		const result = await this.client.readI16(40031, this.unitId);
		return result.success ? result.data! / 10.0 : null;
	}

	/**
	 * Read wind direction
	 * Register: 40032 (I16, 0-359 degrees)
	 */
	async readWindDirection(): Promise<number | null> {
		const result = await this.client.readI16(40032, this.unitId);
		return result.success ? result.data! : null;
	}

	/**
	 * Read PV module temperature
	 * Register: 40033 (I16, gain=10)
	 */
	async readPvTemperature(): Promise<number | null> {
		const result = await this.client.readI16(40033, this.unitId);
		return result.success ? result.data! / 10.0 : null;
	}

	/**
	 * Read ambient air temperature
	 * Register: 40034 (I16, gain=10)
	 */
	async readAmbientTemperature(): Promise<number | null> {
		const result = await this.client.readI16(40034, this.unitId);
		return result.success ? result.data! / 10.0 : null;
	}

	/**
	 * Read solar irradiance
	 * Register: 40035 (I16, gain=10)
	 */
	async readIrradiance(): Promise<number | null> {
		const result = await this.client.readI16(40035, this.unitId);
		return result.success ? result.data! / 10.0 : null;
	}

	/**
	 * Read daily irradiation accumulation
	 * Registers: 40036-40037 (U32, gain=1000)
	 */
	async readDailyIrradiation(): Promise<number | null> {
		const result = await this.client.readU32(40036, this.unitId);
		return result.success ? result.data! / 1000.0 : null;
	}

	/**
	 * Read all environmental monitoring data
	 */
	async readEnvironmentalData(useIEC?: boolean): Promise<SmartLoggerEnvironmentalData> {
		const [
			windSpeed,
			windDirection,
			pvTemperature,
			ambientTemperature,
			irradiance,
			dailyIrradiation
		] = await Promise.all([
			this.readWindSpeed(),
			this.readWindDirection(),
			this.readPvTemperature(),
			this.readAmbientTemperature(),
			this.readIrradiance(),
			this.readDailyIrradiation()
		]);

		const result: any = {};
		
		if (windSpeed !== null) result[useIEC ? 'WindSpd' : 'windSpeed'] = windSpeed;
		if (windDirection !== null) result[useIEC ? 'WindDir' : 'windDirection'] = windDirection;
		if (pvTemperature !== null) result[useIEC ? 'TempPV' : 'pvTemperature'] = pvTemperature;
		if (ambientTemperature !== null) result[useIEC ? 'TempAmb' : 'ambientTemperature'] = ambientTemperature;
		if (irradiance !== null) result[useIEC ? 'Irr' : 'irradiance'] = irradiance;
		if (dailyIrradiation !== null) result[useIEC ? 'IrrDly' : 'dailyIrradiation'] = dailyIrradiation;
		
		return result;
	}

	// ============================================================================
	// ALARM REGISTERS (50000+)
	// ============================================================================

	/**
	 * Read alarm information register 1
	 * Register: 50000 (U16, bit field)
	 */
	async readAlarmInfo1(): Promise<number | null> {
		const result = await this.client.readU16(50000, this.unitId);
		return result.success ? result.data! : null;
	}

	/**
	 * Read alarm information register 2
	 * Register: 50001 (U16, bit field)
	 */
	async readAlarmInfo2(): Promise<number | null> {
		const result = await this.client.readU16(50001, this.unitId);
		return result.success ? result.data! : null;
	}

	/**
	 * Read certificate-related alarms
	 * Register: 50002 (U16)
	 */
	async readCertificateAlarms(): Promise<number | null> {
		const result = await this.client.readU16(50002, this.unitId);
		return result.success ? result.data! : null;
	}

	/**
	 * Read all alarm data
	 */
	async readAlarmData(useIEC?: boolean): Promise<SmartLoggerAlarmData> {
		const [alarmInfo1, alarmInfo2, certificateAlarms] = await Promise.all([
			this.readAlarmInfo1(),
			this.readAlarmInfo2(),
			this.readCertificateAlarms()
		]);

		return {
			...(alarmInfo1 !== null && { alarmInfo1 }),
			...(alarmInfo2 !== null && { alarmInfo2 }),
			...(certificateAlarms !== null && { certificateAlarms })
		};
	}

	// ============================================================================
	// DEVICE DISCOVERY AND INFORMATION
	// ============================================================================

	/**
	 * Read device name string
	 * Registers: 65524-65533 (10x U16, 20-byte string)
	 */
	async readDeviceName(unitId?: number): Promise<string | null> {
		const targetUnitId = unitId || this.unitId;
		const result = await this.client.readString(65524, 10, 20, targetUnitId);
		return result.success ? result.data! : null;
	}

	/**
	 * Read device connection status
	 * Register: 65534 (U16)
	 */
	async readConnectionStatus(unitId?: number): Promise<string | null> {
		const targetUnitId = unitId || this.unitId;
		const result = await this.client.readU16(65534, targetUnitId);
		return result.success ? parseConnectionStatus(result.data!) : null;
	}

	/**
	 * Read device ModBus address
	 * Register: 65523 (U16)
	 */
	async readDeviceAddress(unitId?: number): Promise<number | null> {
		const targetUnitId = unitId || this.unitId;
		const result = await this.client.readU16(65523, targetUnitId);
		return result.success ? result.data! : null;
	}

	/**
	 * Read physical port number
	 * Register: 65522 (U16)
	 */
	async readPortNumber(unitId?: number): Promise<number | null> {
		const targetUnitId = unitId || this.unitId;
		const result = await this.client.readU16(65522, targetUnitId);
		return result.success ? result.data! : null;
	}

	/**
	 * Discover all connected devices by scanning unit IDs (sequential - slower but safer)
	 */
	async discoverAllDevices(unitRange: number[] = Array.from({length: 247}, (_, i) => i + 1)): Promise<DeviceInfo[]> {
		const discovered: DeviceInfo[] = [];

		for (const unitId of unitRange) {
			try {
				// Try to read device name first (most reliable public register)
				const deviceName = await this.readDeviceName(unitId);
				if (deviceName) {
					// Get additional device info
					const [connectionStatus, portNumber, deviceAddress] = await Promise.all([
						this.readConnectionStatus(unitId),
						this.readPortNumber(unitId),
						this.readDeviceAddress(unitId)
					]);

					discovered.push({
						unitId,
						...(deviceName && { deviceName }),
						...(connectionStatus && { connectionStatus }),
						...(portNumber !== null && { portNumber }),
						...(deviceAddress !== null && { deviceAddress })
					});
				}
			} catch (error) {
				// Skip unresponsive units
				continue;
			}
		}

		return discovered;
	}

	/**
	 * Discover all connected devices using parallel scanning (faster but more network intensive)
	 * Creates separate client instances to avoid unit ID conflicts
	 */
	async discoverAllDevicesParallel(unitRange: number[] = Array.from({length: 247}, (_, i) => i + 1), concurrency: number = 10): Promise<DeviceInfo[]> {
		const discovered: DeviceInfo[] = [];
		
		// Process units in batches to limit concurrent connections
		for (let i = 0; i < unitRange.length; i += concurrency) {
			const batch = unitRange.slice(i, i + concurrency);
			
			const batchPromises = batch.map(async (unitId) => {
				// Create a dedicated client for this unit ID to avoid conflicts
				const { HuaweiModbusClient } = await import('./modbus-utils');
				const originalConfig = this.client.getConfig();
				const dedicatedClient = new HuaweiModbusClient({
					...originalConfig,
					unitId: unitId // Set the unit ID for this specific client
				});
				
				try {
					// Connect the dedicated client
					const connected = await dedicatedClient.connect();
					if (!connected) {
						return null;
					}

					// Try to read device name first (most reliable public register)
					const deviceNameResult = await dedicatedClient.readString(65524, 10, 20, unitId);
					if (deviceNameResult.success && deviceNameResult.data) {
						const deviceName = deviceNameResult.data;
						
						// Get additional device info in parallel using the dedicated client
						const [connectionStatusResult, portNumberResult, deviceAddressResult] = await Promise.all([
							dedicatedClient.readU16(65534, unitId),
							dedicatedClient.readU16(65522, unitId),
							dedicatedClient.readU16(65523, unitId)
						]);

						// Parse connection status
						let connectionStatus: string | undefined;
						if (connectionStatusResult.success && connectionStatusResult.data !== undefined) {
							const statusValue = connectionStatusResult.data;
							connectionStatus = statusValue === 0xB001 ? 'Online' : 
											 statusValue === 0xB000 ? 'Offline' : 
											 `Unknown (0x${statusValue.toString(16).toUpperCase()})`;
						}

						return {
							unitId,
							deviceName,
							...(connectionStatus && { connectionStatus }),
							...(portNumberResult.success && portNumberResult.data !== undefined && { portNumber: portNumberResult.data }),
							...(deviceAddressResult.success && deviceAddressResult.data !== undefined && { deviceAddress: deviceAddressResult.data })
						};
					}
				} catch (error) {
					// Skip unresponsive units
				} finally {
					// Always disconnect the dedicated client
					await dedicatedClient.disconnect();
				}
				return null;
			});

			const batchResults = await Promise.all(batchPromises);
			
			// Add successful discoveries to results
			for (const result of batchResults) {
				if (result) {
					discovered.push(result);
				}
			}
		}

		return discovered;
	}

	/**
	 * Discover SUN2000 inverters specifically (typically units 12-15) - sequential
	 */
	async discoverInverters(unitRange: number[] = [12, 13, 14, 15]): Promise<DeviceInfo[]> {
		const inverters: DeviceInfo[] = [];

		for (const unitId of unitRange) {
			try {
				const deviceName = await this.readDeviceName(unitId);
				if (deviceName && deviceName.includes('SUN2000')) {
					const [connectionStatus, portNumber, deviceAddress] = await Promise.all([
						this.readConnectionStatus(unitId),
						this.readPortNumber(unitId),
						this.readDeviceAddress(unitId)
					]);

					inverters.push({
						unitId,
						deviceName,
						...(connectionStatus && { connectionStatus }),
						...(portNumber !== null && { portNumber }),
						...(deviceAddress !== null && { deviceAddress })
					});
				}
			} catch (error) {
				continue;
			}
		}

		return inverters;
	}

	/**
	 * Discover SUN2000 inverters using parallel scanning (faster)
	 * Creates separate client instances to avoid unit ID conflicts
	 */
	async discoverInvertersParallel(unitRange: number[] = [12, 13, 14, 15], concurrency: number = 5): Promise<DeviceInfo[]> {
		const inverters: DeviceInfo[] = [];
		
		// Process units in batches
		for (let i = 0; i < unitRange.length; i += concurrency) {
			const batch = unitRange.slice(i, i + concurrency);
			
			const batchPromises = batch.map(async (unitId) => {
				// Create a dedicated client for this unit ID to avoid conflicts
				const { HuaweiModbusClient } = await import('./modbus-utils');
				const originalConfig = this.client.getConfig();
				const dedicatedClient = new HuaweiModbusClient({
					...originalConfig,
					unitId: unitId // Set the unit ID for this specific client
				});
				
				try {
					// Connect the dedicated client
					const connected = await dedicatedClient.connect();
					if (!connected) {
						return null;
					}

					// Try to read device name first
					const deviceNameResult = await dedicatedClient.readString(65524, 10, 20, unitId);
					if (deviceNameResult.success && deviceNameResult.data && deviceNameResult.data.includes('SUN2000')) {
						const deviceName = deviceNameResult.data;
						
						// Get additional device info in parallel using the dedicated client
						const [connectionStatusResult, portNumberResult, deviceAddressResult] = await Promise.all([
							dedicatedClient.readU16(65534, unitId),
							dedicatedClient.readU16(65522, unitId),
							dedicatedClient.readU16(65523, unitId)
						]);

						// Parse connection status
						let connectionStatus: string | undefined;
						if (connectionStatusResult.success && connectionStatusResult.data !== undefined) {
							const statusValue = connectionStatusResult.data;
							connectionStatus = statusValue === 0xB001 ? 'Online' : 
											 statusValue === 0xB000 ? 'Offline' : 
											 `Unknown (0x${statusValue.toString(16).toUpperCase()})`;
						}

						return {
							unitId,
							deviceName,
							...(connectionStatus && { connectionStatus }),
							...(portNumberResult.success && portNumberResult.data !== undefined && { portNumber: portNumberResult.data }),
							...(deviceAddressResult.success && deviceAddressResult.data !== undefined && { deviceAddress: deviceAddressResult.data })
						};
					}
				} catch (error) {
					// Skip unresponsive units
				} finally {
					// Always disconnect the dedicated client
					await dedicatedClient.disconnect();
				}
				return null;
			});

			const batchResults = await Promise.all(batchPromises);
			
			// Add successful discoveries to results
			for (const result of batchResults) {
				if (result) {
					inverters.push(result);
				}
			}
		}

		return inverters;
	}

	/**
	 * Read all SmartLogger data in one call
	 */
	async readAllData(): Promise<{
		system: SmartLoggerSystemData;
		power: SmartLoggerPowerData;
		environmental: SmartLoggerEnvironmentalData;
		alarms: SmartLoggerAlarmData;
	}> {
		const [system, power, environmental, alarms] = await Promise.all([
			this.readSystemData(),
			this.readPowerData(),
			this.readEnvironmentalData(),
			this.readAlarmData()
		]);

		return {
			system,
			power,
			environmental,
			alarms
		};
	}
}