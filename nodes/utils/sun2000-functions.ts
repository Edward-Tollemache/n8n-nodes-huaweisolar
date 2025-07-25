/**
 * Huawei SUN2000 Inverter Functions
 * 
 * Implementation for reading data from SUN2000 inverters via Modbus TCP
 * Based on ModBus-slave.md documentation and remapped register access
 */

import { HuaweiModbusClient } from './modbus-utils';

export interface SUN2000PowerData {
	activePower?: number;        // Active power (kW)
	reactivePower?: number;      // Reactive power (kVar)
	dcCurrent?: number;          // DC current (A)
	inputPower?: number;         // Input power (kW)
	powerFactor?: number;        // Power factor
}

export interface SUN2000StatusData {
	status?: number;             // Status code
	connectionStatus?: string;   // Connection status description
	cabinetTemperature?: number; // Cabinet temperature (°C)
	insulationResistance?: number; // Insulation resistance (MΩ)
}

export interface SUN2000FaultData {
	majorFault?: number;         // Major fault code (32-bit)
	minorFault?: number;         // Minor fault code (32-bit)
	warning?: number;            // Warning code (32-bit)
}

export interface SUN2000AllData extends SUN2000PowerData, SUN2000StatusData, SUN2000FaultData {
	unitId: number;
	deviceName?: string;
}

/**
 * SUN2000 Inverter Functions Class
 * Uses remapped register access for simplified data reading
 */
export class SUN2000Functions {
	constructor(private client: HuaweiModbusClient) {}

	/**
	 * Calculate remapped register address
	 * Formula: 51000 + (25 × (Device Address - 1)) + Offset
	 */
	private getRemappedRegister(deviceAddress: number, offset: number): number {
		return 51000 + (25 * (deviceAddress - 1)) + offset;
	}

	/**
	 * Read active power from inverter
	 * Offset: 0-1 (I32, gain=1000)
	 */
	async readActivePower(deviceAddress: number): Promise<number | null> {
		const register = this.getRemappedRegister(deviceAddress, 0);
		const result = await this.client.readI32(register, 0); // Use device ID 0 for remapped access
		return result.success ? result.data! / 1000.0 : null;
	}

	/**
	 * Read reactive power from inverter
	 * Offset: 2-3 (I32, gain=1000)
	 */
	async readReactivePower(deviceAddress: number): Promise<number | null> {
		const register = this.getRemappedRegister(deviceAddress, 2);
		const result = await this.client.readI32(register, 0);
		return result.success ? result.data! / 1000.0 : null;
	}

	/**
	 * Read DC current from inverter
	 * Offset: 4 (I16, gain=100)
	 */
	async readDcCurrent(deviceAddress: number): Promise<number | null> {
		const register = this.getRemappedRegister(deviceAddress, 4);
		const result = await this.client.readI16(register, 0);
		return result.success ? result.data! / 100.0 : null;
	}

	/**
	 * Read input power from inverter
	 * Offset: 5-6 (U32, gain=1000)
	 */
	async readInputPower(deviceAddress: number): Promise<number | null> {
		const register = this.getRemappedRegister(deviceAddress, 5);
		const result = await this.client.readU32(register, 0);
		return result.success ? result.data! / 1000.0 : null;
	}

	/**
	 * Read power factor from inverter
	 * Offset: 8 (I16, gain=1000)
	 */
	async readPowerFactor(deviceAddress: number): Promise<number | null> {
		const register = this.getRemappedRegister(deviceAddress, 8);
		const result = await this.client.readI16(register, 0);
		return result.success ? result.data! / 1000.0 : null;
	}

	/**
	 * Read inverter status
	 * Offset: 9 (U16, no gain)
	 */
	async readStatus(deviceAddress: number): Promise<number | null> {
		const register = this.getRemappedRegister(deviceAddress, 9);
		const result = await this.client.readU16(register, 0);
		return result.success ? result.data! : null;
	}

	/**
	 * Read cabinet temperature
	 * Offset: 11 (I16, gain=10)
	 */
	async readCabinetTemperature(deviceAddress: number): Promise<number | null> {
		const register = this.getRemappedRegister(deviceAddress, 11);
		const result = await this.client.readI16(register, 0);
		return result.success ? result.data! / 10.0 : null;
	}

	/**
	 * Read insulation resistance
	 * Offset: 7 (U16, gain=1000)
	 */
	async readInsulationResistance(deviceAddress: number): Promise<number | null> {
		const register = this.getRemappedRegister(deviceAddress, 7);
		const result = await this.client.readU16(register, 0);
		return result.success ? result.data! / 1000.0 : null;
	}

	/**
	 * Read major fault code
	 * Offset: 12-13 (U32, no gain)
	 */
	async readMajorFault(deviceAddress: number): Promise<number | null> {
		const register = this.getRemappedRegister(deviceAddress, 12);
		const result = await this.client.readU32(register, 0);
		return result.success ? result.data! : null;
	}

	/**
	 * Read minor fault code
	 * Offset: 14-15 (U32, no gain)
	 */
	async readMinorFault(deviceAddress: number): Promise<number | null> {
		const register = this.getRemappedRegister(deviceAddress, 14);
		const result = await this.client.readU32(register, 0);
		return result.success ? result.data! : null;
	}

	/**
	 * Read warning code
	 * Offset: 16-17 (U32, no gain)
	 */
	async readWarning(deviceAddress: number): Promise<number | null> {
		const register = this.getRemappedRegister(deviceAddress, 16);
		const result = await this.client.readU32(register, 0);
		return result.success ? result.data! : null;
	}

	/**
	 * Parse status code to human-readable string
	 */
	private parseStatusCode(status: number): string {
		switch (status) {
			case 0xB000: return 'Communication interrupt';
			case 0xC000: return 'Uploading';
			default: return `Status: 0x${status.toString(16).toUpperCase()}`;
		}
	}

	/**
	 * Read power data from inverter
	 */
	async readPowerData(deviceAddress: number): Promise<SUN2000PowerData> {
		const [activePower, reactivePower, dcCurrent, inputPower, powerFactor] = await Promise.all([
			this.readActivePower(deviceAddress),
			this.readReactivePower(deviceAddress),
			this.readDcCurrent(deviceAddress),
			this.readInputPower(deviceAddress),
			this.readPowerFactor(deviceAddress)
		]);

		return {
			...(activePower !== null && { activePower }),
			...(reactivePower !== null && { reactivePower }),
			...(dcCurrent !== null && { dcCurrent }),
			...(inputPower !== null && { inputPower }),
			...(powerFactor !== null && { powerFactor })
		};
	}

	/**
	 * Read status data from inverter
	 */
	async readStatusData(deviceAddress: number): Promise<SUN2000StatusData> {
		const [status, cabinetTemperature, insulationResistance] = await Promise.all([
			this.readStatus(deviceAddress),
			this.readCabinetTemperature(deviceAddress),
			this.readInsulationResistance(deviceAddress)
		]);

		return {
			...(status !== null && { status }),
			...(status !== null && { connectionStatus: this.parseStatusCode(status) }),
			...(cabinetTemperature !== null && { cabinetTemperature }),
			...(insulationResistance !== null && { insulationResistance })
		};
	}

	/**
	 * Read fault data from inverter
	 */
	async readFaultData(deviceAddress: number): Promise<SUN2000FaultData> {
		const [majorFault, minorFault, warning] = await Promise.all([
			this.readMajorFault(deviceAddress),
			this.readMinorFault(deviceAddress),
			this.readWarning(deviceAddress)
		]);

		return {
			...(majorFault !== null && { majorFault }),
			...(minorFault !== null && { minorFault }),
			...(warning !== null && { warning })
		};
	}

	/**
	 * Read all data from a single inverter
	 */
	async readAllData(deviceAddress: number, deviceName?: string): Promise<SUN2000AllData> {
		const [powerData, statusData, faultData] = await Promise.all([
			this.readPowerData(deviceAddress),
			this.readStatusData(deviceAddress),
			this.readFaultData(deviceAddress)
		]);

		return {
			unitId: deviceAddress,
			...(deviceName && { deviceName }),
			...powerData,
			...statusData,
			...faultData
		};
	}

	/**
	 * Read data from multiple inverters based on discovery results
	 */
	async readMultipleInverters(devices: Array<{unitId: number, deviceName?: string, deviceAddress: number}>): Promise<SUN2000AllData[]> {
		const results: SUN2000AllData[] = [];
		
		// Process inverters in parallel batches of 5 to avoid overwhelming the network
		const batchSize = 5;
		for (let i = 0; i < devices.length; i += batchSize) {
			const batch = devices.slice(i, i + batchSize);
			
			const batchPromises = batch.map(async (device) => {
				try {
					return await this.readAllData(device.deviceAddress, device.deviceName);
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
}