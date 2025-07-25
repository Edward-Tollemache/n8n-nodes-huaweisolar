/**
 * Huawei Modbus Utilities
 * 
 * Core utility functions for Modbus communication with Huawei devices.
 * Key fixes applied:
 * - LITTLE-ENDIAN byte order (not big-endian as documented)
 * - SmartLogger Unit ID: 3 (not 0 as documented)
 * - Proper error handling and timeouts
 */

import ModbusRTU from 'modbus-serial';

export interface ModbusConnectionConfig {
	host: string;
	port: number;
	unitId: number;
	timeout: number;
	retries: number;
}

export interface ModbusReadResult<T> {
	success: boolean;
	data?: T;
	error?: string;
}

/**
 * Combine two 16-bit registers into 32-bit unsigned (LITTLE-ENDIAN)
 * Critical: Huawei uses little-endian despite documentation claiming big-endian
 */
export function combineU32RegistersLE(lowWord: number, highWord: number): number {
	return (lowWord << 16) | highWord;
}

/**
 * Combine two 16-bit registers into 32-bit signed (LITTLE-ENDIAN)
 */
export function combineI32RegistersLE(lowWord: number, highWord: number): number {
	const combined = (lowWord << 16) | highWord;
	// Handle sign extension for 32-bit signed values
	return combined >= 0x80000000 ? combined - 0x100000000 : combined;
}

/**
 * Combine four 16-bit registers into 64-bit unsigned (LITTLE-ENDIAN)
 */
export function combineU64RegistersLE(reg1: number, reg2: number, reg3: number, reg4: number): number {
	// JavaScript's Number.MAX_SAFE_INTEGER is 2^53-1, sufficient for most use cases
	return (reg1 * Math.pow(2, 48)) + (reg2 * Math.pow(2, 32)) + (reg3 * Math.pow(2, 16)) + reg4;
}

/**
 * Decode string from register values (each register = 2 ASCII chars)
 */
export function decodeStringRegisters(registers: number[], maxLength: number = 20): string {
	const chars: string[] = [];
	for (const reg of registers) {
		// Extract two bytes from each 16-bit register
		chars.push(String.fromCharCode((reg >> 8) & 0xFF)); // High byte
		chars.push(String.fromCharCode(reg & 0xFF));        // Low byte
	}
	
	// Join and strip null terminators
	return chars.join('').substring(0, maxLength).replace(/\0+$/, '');
}

/**
 * Convert signed 16-bit register value to proper signed integer
 */
export function toSignedInt16(value: number): number {
	return value >= 0x8000 ? value - 0x10000 : value;
}

/**
 * Modbus Client Wrapper with connection management and error handling
 */
export class HuaweiModbusClient {
	private client: ModbusRTU;
	private config: ModbusConnectionConfig;
	private isConnected: boolean = false;

	constructor(config: ModbusConnectionConfig) {
		this.client = new ModbusRTU();
		this.config = config;
		
		// Set timeout and retry options
		this.client.setTimeout(config.timeout);
		this.client.setID(config.unitId);
	}

	/**
	 * Get the client configuration
	 */
	getConfig(): ModbusConnectionConfig {
		return { ...this.config };
	}

	/**
	 * Connect to Modbus TCP device
	 */
	async connect(): Promise<boolean> {
		try {
			await this.client.connectTCP(this.config.host, { port: this.config.port });
			this.isConnected = true;
			return true;
		} catch (error) {
			this.isConnected = false;
			return false;
		}
	}

	/**
	 * Disconnect from device
	 */
	async disconnect(): Promise<void> {
		try {
			this.client.close();
			this.isConnected = false;
		} catch (error) {
			// Ignore disconnect errors
		}
	}

	/**
	 * Check if client is connected
	 */
	isClientConnected(): boolean {
		return this.isConnected && this.client.isOpen;
	}

	/**
	 * Read holding registers with retry logic and proper error handling
	 */
	async readHoldingRegisters(
		address: number, 
		count: number, 
		unitId?: number
	): Promise<ModbusReadResult<number[]>> {
		if (!this.isClientConnected()) {
			const connected = await this.connect();
			if (!connected) {
				return { success: false, error: 'Failed to connect to Modbus device' };
			}
		}

		// Set unit ID if provided
		if (unitId !== undefined) {
			this.client.setID(unitId);
		}

		let lastError: string = '';
		
		for (let attempt = 0; attempt <= this.config.retries; attempt++) {
			try {
				const result = await this.client.readHoldingRegisters(address, count);
				
				// Reset unit ID back to default if it was changed
				if (unitId !== undefined) {
					this.client.setID(this.config.unitId);
				}
				
				return { success: true, data: result.data };
			} catch (error) {
				lastError = error instanceof Error ? error.message : 'Unknown Modbus error';
				
				// Wait before retry (exponential backoff)
				if (attempt < this.config.retries) {
					await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
				}
			}
		}

		// Reset unit ID back to default if it was changed
		if (unitId !== undefined) {
			this.client.setID(this.config.unitId);
		}

		return { success: false, error: `Failed after ${this.config.retries + 1} attempts: ${lastError}` };
	}

	/**
	 * Read single U16 register
	 */
	async readU16(address: number, unitId?: number): Promise<ModbusReadResult<number>> {
		const result = await this.readHoldingRegisters(address, 1, unitId);
		if (!result.success || !result.data || result.data.length === 0) {
			return { success: false, error: result.error };
		}
		return { success: true, data: result.data[0] };
	}

	/**
	 * Read single I16 register (signed)
	 */
	async readI16(address: number, unitId?: number): Promise<ModbusReadResult<number>> {
		const result = await this.readU16(address, unitId);
		if (!result.success || result.data === undefined) {
			return result;
		}
		return { success: true, data: toSignedInt16(result.data) };
	}

	/**
	 * Read U32 register (2 consecutive registers, little-endian)
	 */
	async readU32(address: number, unitId?: number): Promise<ModbusReadResult<number>> {
		const result = await this.readHoldingRegisters(address, 2, unitId);
		if (!result.success || !result.data || result.data.length < 2) {
			return { success: false, error: result.error };
		}
		return { success: true, data: combineU32RegistersLE(result.data[0], result.data[1]) };
	}

	/**
	 * Read I32 register (2 consecutive registers, little-endian, signed)
	 */
	async readI32(address: number, unitId?: number): Promise<ModbusReadResult<number>> {
		const result = await this.readHoldingRegisters(address, 2, unitId);
		if (!result.success || !result.data || result.data.length < 2) {
			return { success: false, error: result.error };
		}
		return { success: true, data: combineI32RegistersLE(result.data[0], result.data[1]) };
	}

	/**
	 * Read string from multiple registers
	 */
	async readString(address: number, count: number, maxLength?: number, unitId?: number): Promise<ModbusReadResult<string>> {
		const result = await this.readHoldingRegisters(address, count, unitId);
		if (!result.success || !result.data) {
			return { success: false, error: result.error };
		}
		return { success: true, data: decodeStringRegisters(result.data, maxLength) };
	}

	/**
	 * Calculate inverter base address for remapped registers
	 * Formula: 51000 + (25 × (Device Address - 1))
	 */
	static calculateInverterBaseAddress(inverterUnitId: number): number {
		return 51000 + (25 * (inverterUnitId - 1));
	}
}

/**
 * Connection status enumeration
 */
export enum ConnectionStatus {
	Online = 'Online',
	Offline = 'Offline',
	Unknown = 'Unknown'
}

/**
 * Parse connection status from register value
 */
export function parseConnectionStatus(statusValue: number): ConnectionStatus {
	switch (statusValue) {
		case 0xB001:
			return ConnectionStatus.Online;
		case 0xB000:
			return ConnectionStatus.Offline;
		default:
			return ConnectionStatus.Unknown;
	}
}

/**
 * Plant status enumeration based on Huawei documentation
 */
export enum PlantStatus {
	Unlimited = 1,
	Limited = 2,
	Idle = 3,
	Outage = 4,
	CommInterrupt = 5
}

/**
 * Parse plant status from register value
 */
export function parsePlantStatus(statusValue: number): string {
	switch (statusValue) {
		case PlantStatus.Unlimited:
			return 'Unlimited';
		case PlantStatus.Limited:
			return 'Limited';
		case PlantStatus.Idle:
			return 'Idle';
		case PlantStatus.Outage:
			return 'Outage';
		case PlantStatus.CommInterrupt:
			return 'Communication Interrupt';
		default:
			return `Unknown (${statusValue})`;
	}
}