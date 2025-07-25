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
	activePowerTotal?: number;   // Total active power (kW)
	reactivePowerTotal?: number; // Total reactive power (kVar)
	powerFactor?: number;        // System power factor
	plantStatus?: string;        // Plant operational status
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
	async readSystemData(): Promise<SmartLoggerSystemData> {
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
	 * Read plant operational status
	 * Register: 40543 (U16)
	 */
	async readPlantStatus(): Promise<string | null> {
		const result = await this.client.readU16(40543, this.unitId);
		return result.success ? parsePlantStatus(result.data!) : null;
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
	async readPowerData(): Promise<SmartLoggerPowerData> {
		const [
			dcCurrentTotal,
			inputPowerTotal,
			activePowerTotal,
			reactivePowerTotal,
			powerFactor,
			plantStatus,
			totalEnergy,
			dailyEnergy
		] = await Promise.all([
			this.readDcCurrentTotal(),
			this.readInputPowerTotal(),
			this.readActivePowerTotal(),
			this.readReactivePowerTotal(),
			this.readPowerFactor(),
			this.readPlantStatus(),
			this.readTotalEnergy(),
			this.readDailyEnergy()
		]);

		return {
			...(dcCurrentTotal !== null && { dcCurrentTotal }),
			...(inputPowerTotal !== null && { inputPowerTotal }),
			...(activePowerTotal !== null && { activePowerTotal }),
			...(reactivePowerTotal !== null && { reactivePowerTotal }),
			...(powerFactor !== null && { powerFactor }),
			...(plantStatus !== null && { plantStatus }),
			...(totalEnergy !== null && { totalEnergy }),
			...(dailyEnergy !== null && { dailyEnergy })
		};
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
	async readEnvironmentalData(): Promise<SmartLoggerEnvironmentalData> {
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

		return {
			...(windSpeed !== null && { windSpeed }),
			...(windDirection !== null && { windDirection }),
			...(pvTemperature !== null && { pvTemperature }),
			...(ambientTemperature !== null && { ambientTemperature }),
			...(irradiance !== null && { irradiance }),
			...(dailyIrradiation !== null && { dailyIrradiation })
		};
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
	async readAlarmData(): Promise<SmartLoggerAlarmData> {
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
	 */
	async discoverAllDevicesParallel(unitRange: number[] = Array.from({length: 247}, (_, i) => i + 1), concurrency: number = 10): Promise<DeviceInfo[]> {
		const discovered: DeviceInfo[] = [];
		
		// Process units in batches to limit concurrent connections
		for (let i = 0; i < unitRange.length; i += concurrency) {
			const batch = unitRange.slice(i, i + concurrency);
			
			const batchPromises = batch.map(async (unitId) => {
				try {
					// Try to read device name first (most reliable public register)
					const deviceName = await this.readDeviceName(unitId);
					if (deviceName) {
						// Get additional device info in parallel
						const [connectionStatus, portNumber, deviceAddress] = await Promise.all([
							this.readConnectionStatus(unitId),
							this.readPortNumber(unitId),
							this.readDeviceAddress(unitId)
						]);

						return {
							unitId,
							...(deviceName && { deviceName }),
							...(connectionStatus && { connectionStatus }),
							...(portNumber !== null && { portNumber }),
							...(deviceAddress !== null && { deviceAddress })
						};
					}
				} catch (error) {
					// Skip unresponsive units
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
	 */
	async discoverInvertersParallel(unitRange: number[] = [12, 13, 14, 15], concurrency: number = 5): Promise<DeviceInfo[]> {
		const inverters: DeviceInfo[] = [];
		
		// Process units in batches
		for (let i = 0; i < unitRange.length; i += concurrency) {
			const batch = unitRange.slice(i, i + concurrency);
			
			const batchPromises = batch.map(async (unitId) => {
				try {
					const deviceName = await this.readDeviceName(unitId);
					if (deviceName && deviceName.includes('SUN2000')) {
						const [connectionStatus, portNumber, deviceAddress] = await Promise.all([
							this.readConnectionStatus(unitId),
							this.readPortNumber(unitId),
							this.readDeviceAddress(unitId)
						]);

						return {
							unitId,
							deviceName,
							...(connectionStatus && { connectionStatus }),
							...(portNumber !== null && { portNumber }),
							...(deviceAddress !== null && { deviceAddress })
						};
					}
				} catch (error) {
					// Skip unresponsive units
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
		connectedDevices?: DeviceInfo[];
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