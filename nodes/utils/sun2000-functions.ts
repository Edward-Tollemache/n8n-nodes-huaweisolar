/**
 * Huawei SUN2000 Inverter Functions
 * 
 * Simple implementation for reading data from SUN2000 inverters via Modbus TCP
 * Based on modbus-slave.md documentation - using remapped register access
 */

import { HuaweiModbusClient, combineU32RegistersLE, combineI32RegistersLE, toSignedInt16 } from './modbus-utils';

export interface SUN2000InverterData {
	unitId: number;
	deviceName?: string;
	activePower?: number;        // Active power (kW)
	reactivePower?: number;      // Reactive power (kVar)
	dcCurrent?: number;          // DC current (A)
	inputPower?: number;         // Input power (kW)
	powerFactor?: number;        // Power factor
	status?: number;             // Status code
	cabinetTemperature?: number; // Cabinet temperature (°C)
	insulationResistance?: number; // Insulation resistance (MΩ)
	majorFault?: number;         // Major fault code
	minorFault?: number;         // Minor fault code
	warning?: number;            // Warning code
	error?: string;              // Error message if reading failed
}

/**
 * SUN2000 Inverter Functions Class
 * Uses remapped register access for simplified data reading
 * Formula: Register Address = 51000 + (25 × (Device Address - 1)) + Offset
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
	 * Read all available data from a single inverter
	 * Uses batch reading where possible to minimize requests
	 */
	async readInverterData(deviceAddress: number, deviceName?: string): Promise<SUN2000InverterData> {
		const result: SUN2000InverterData = {
			unitId: deviceAddress,
			...(deviceName && { deviceName })
		};

		try {
			// Read power data (offsets 0-8)
			const baseRegister = this.getRemappedRegister(deviceAddress, 0);
			
			// Try to read multiple registers at once for efficiency
			// Registers 0-8: Active Power (I32), Reactive Power (I32), DC Current (I16), Input Power (U32), Insulation (U16), Power Factor (I16)
			const powerResult = await this.client.readHoldingRegisters(baseRegister, 9, 0);
			
			if (powerResult.success && powerResult.data && powerResult.data.length >= 9) {
				const registers = powerResult.data;
				
				// Active Power: Offset 0-1 (I32, gain=1000)
				const activePowerRaw = combineI32RegistersLE(registers[0], registers[1]);
				result.activePower = activePowerRaw / 1000.0;
				
				// Reactive Power: Offset 2-3 (I32, gain=1000)
				const reactivePowerRaw = combineI32RegistersLE(registers[2], registers[3]);
				result.reactivePower = reactivePowerRaw / 1000.0;
				
				// DC Current: Offset 4 (I16, gain=100)
				result.dcCurrent = toSignedInt16(registers[4]) / 100.0;
				
				// Input Power: Offset 5-6 (U32, gain=1000)
				const inputPowerRaw = combineU32RegistersLE(registers[5], registers[6]);
				result.inputPower = inputPowerRaw / 1000.0;
				
				// Insulation Resistance: Offset 7 (U16, gain=1000)
				result.insulationResistance = registers[7] / 1000.0;
				
				// Power Factor: Offset 8 (I16, gain=1000)
				result.powerFactor = toSignedInt16(registers[8]) / 1000.0;
			}

			// Read status and temperature (offsets 9, 11)
			const statusRegister = this.getRemappedRegister(deviceAddress, 9);
			const statusResult = await this.client.readU16(statusRegister, 0);
			if (statusResult.success) {
				result.status = statusResult.data!;
			}

			const tempRegister = this.getRemappedRegister(deviceAddress, 11);
			const tempResult = await this.client.readI16(tempRegister, 0);
			if (tempResult.success) {
				result.cabinetTemperature = tempResult.data! / 10.0;
			}

			// Read fault data (offsets 12-17)
			const faultRegister = this.getRemappedRegister(deviceAddress, 12);
			const faultResult = await this.client.readHoldingRegisters(faultRegister, 6, 0);
			
			if (faultResult.success && faultResult.data && faultResult.data.length >= 6) {
				const faultRegisters = faultResult.data;
				
				// Major Fault: Offset 12-13 (U32)
				result.majorFault = combineU32RegistersLE(faultRegisters[0], faultRegisters[1]);
				
				// Minor Fault: Offset 14-15 (U32)
				result.minorFault = combineU32RegistersLE(faultRegisters[2], faultRegisters[3]);
				
				// Warning: Offset 16-17 (U32)
				result.warning = combineU32RegistersLE(faultRegisters[4], faultRegisters[5]);
			}

		} catch (error) {
			result.error = error instanceof Error ? error.message : 'Unknown error reading inverter data';
		}

		return result;
	}

	/**
	 * Read data from multiple inverters
	 * Processes them sequentially to avoid overwhelming the device
	 */
	async readMultipleInverters(
		devices: Array<{unitId: number, deviceAddress: number, deviceName?: string}>
	): Promise<SUN2000InverterData[]> {
		const results: SUN2000InverterData[] = [];

		// Process inverters one by one to be safe
		for (const device of devices) {
			try {
				const inverterData = await this.readInverterData(device.deviceAddress, device.deviceName);
				results.push(inverterData);
				
				// Small delay between inverters to be gentle on the network
				await new Promise(resolve => setTimeout(resolve, 100));
			} catch (error) {
				// Add error entry for failed inverter
				results.push({
					unitId: device.unitId,
					deviceName: device.deviceName,
					error: error instanceof Error ? error.message : 'Failed to read inverter'
				});
			}
		}

		return results;
	}
}